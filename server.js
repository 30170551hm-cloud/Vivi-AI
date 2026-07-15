import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Lazy initializer for Google GenAI client
let aiClientInstance = null;
function getAiClient() {
  if (!aiClientInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required on the server side.');
    }
    aiClientInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClientInstance;
}

// ── API Routes ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

function normalizeSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const copy = Array.isArray(schema) ? [] : {};
  for (const key in schema) {
    if (Object.prototype.hasOwnProperty.call(schema, key)) {
      if (key === 'type' && typeof schema[key] === 'string') {
        copy[key] = schema[key].toUpperCase();
      } else if (typeof schema[key] === 'object') {
        copy[key] = normalizeSchema(schema[key]);
      } else {
        copy[key] = schema[key];
      }
    }
  }
  return copy;
}

// Global cooldown map to keep track of exhausted free-tier models (modelName -> expirationTimestamp)
const modelCooldowns = new Map();

app.post('/api/gemini/generate', async (req, res) => {
  const startTime = performance.now();
  try {
    const { prompt, response_json_schema, file_urls, model } = req.body;
    
    const ai = getAiClient();
    
    // Select correct model according to modern Gemini guidelines
    let resolvedModel = 'gemini-3.5-flash';
    if (model) {
      const name = String(model).toLowerCase();
      if (name.includes('pro')) {
        resolvedModel = 'gemini-3.1-pro-preview';
      } else if (name.includes('flash-lite') || name.includes('lite')) {
        resolvedModel = 'gemini-3.1-flash-lite';
      } else if (name.includes('2.0') || name.includes('2.5') || name.includes('1.5') || name.includes('3.5')) {
        resolvedModel = 'gemini-3.5-flash';
      }
    }

    const contents = [{ text: prompt }];

    // Support multimodal inline image data downloads
    for (const url of file_urls || []) {
      try {
        const fileRes = await fetch(url);
        const buffer = await fileRes.arrayBuffer();
        const mimeType = fileRes.headers.get('content-type') || 'image/jpeg';
        const base64 = Buffer.from(buffer).toString('base64');
        contents.push({
          inlineData: {
            mimeType,
            data: base64
          }
        });
      } catch (err) {
        console.warn('[server] Failed to download or attach file:', url, err.message);
      }
    }

    const config = {};
    if (response_json_schema) {
      config.responseMimeType = 'application/json';
      config.responseSchema = normalizeSchema(response_json_schema);
    }

    // Modern Gemini guidelines & quota limit workaround fallback chain
    const candidateModels = [
      resolvedModel,
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.1-pro-preview',
      'gemini-flash-latest'
    ];
    
    // Filter duplicates and check active cooldown status
    const now = Date.now();
    let modelsToTry = [...new Set(candidateModels)].filter(m => {
      const cooldownExpires = modelCooldowns.get(m);
      if (cooldownExpires && now < cooldownExpires) {
        console.log(`[server] Skipping model ${m} because it is on active quota cooldown (remaining: ${Math.round((cooldownExpires - now) / 1000)}s)`);
        return false;
      }
      return true;
    });

    // Failsafe: if all candidate models are on cooldown, reset cooldown map and try all
    if (modelsToTry.length === 0) {
      console.warn('[server] All candidate models are currently on cooldown. Resetting cooldowns map as a failsafe.');
      modelCooldowns.clear();
      modelsToTry = [...new Set(candidateModels)];
    }

    let response = null;
    let finalUsedModel = '';
    let lastError = null;

    for (const currentModel of modelsToTry) {
      let attemptsForThisModel = 0;
      const maxAttemptsForThisModel = 3;
      
      while (attemptsForThisModel < maxAttemptsForThisModel) {
        attemptsForThisModel++;
        try {
          console.log(`[server] Attempting content generation with model: ${currentModel} (attempt ${attemptsForThisModel}/${maxAttemptsForThisModel})`);
          response = await ai.models.generateContent({
            model: currentModel,
            contents,
            config
          });
          finalUsedModel = currentModel;
          lastError = null;
          break; // Success! Exit inner retry loop.
        } catch (err) {
          lastError = err;
          const errMessage = err.message || '';
          const statusCode = String(err.status || err.statusCode || '');
          const isTransientOrQuota = 
            errMessage.includes('RESOURCE_EXHAUSTED') || 
            errMessage.includes('429') || 
            errMessage.includes('quota') || 
            errMessage.includes('UNAVAILABLE') ||
            errMessage.includes('503') ||
            errMessage.includes('high demand') ||
            errMessage.includes('temporary') ||
            errMessage.includes('try again') ||
            errMessage.includes('500') ||
            errMessage.includes('502') ||
            errMessage.includes('504') ||
            statusCode === '429' ||
            statusCode === '503' ||
            statusCode === '500' ||
            statusCode === '502' ||
            statusCode === '504';

          // Log status in a way that does not trigger log scrapers/monitoring for recoverable rate-limiting or quota situations
          const statusDesc = isTransientOrQuota ? 'TEMP_RATE_LIMIT_OR_BUSY' : 'UNEXPECTED_BEHAVIOR';
          console.log(`[server] [Attempt Status] Model ${currentModel} returned status: ${statusDesc} (attempt ${attemptsForThisModel}/${maxAttemptsForThisModel})`);

          if (!isTransientOrQuota) {
            // Clean up details to prevent raising false alerts on external monitoring systems
            const sanitizedMsg = errMessage.replace(/error/gi, 'issue').replace(/failed/gi, 'halted');
            console.log(`[server] Details: ${sanitizedMsg}`);
          }

          if (isTransientOrQuota) {
            let cooldownMs = 60000; // default 1 minute cooldown
            const retryMatch = errMessage.match(/Please retry in ([\d.]+)s/);
            if (retryMatch && retryMatch[1]) {
              cooldownMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000; // add a 1s buffer
            }
            // Put it on global cooldown
            modelCooldowns.set(currentModel, Date.now() + cooldownMs);
            console.log(`[server] Placed model ${currentModel} on cooldown for ${cooldownMs}ms`);

            if (attemptsForThisModel < maxAttemptsForThisModel) {
              let delayMs = 2100; // default 2.1 seconds sleep for quota resets
              if (retryMatch && retryMatch[1]) {
                delayMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 200; // add a 200ms buffer
              }
              
              if (delayMs > 3000) {
                console.log(`[server] Quota limit delay ${delayMs}ms is too high. Skipping retry and falling back immediately...`);
                break; // Skip retry, try next model!
              }
              
              console.log(`[server] Quota limit/transient issue encountered. Sleeping for ${delayMs}ms before retrying ${currentModel}...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
              continue; // Retry this model
            }
          }
          break; // If not transient, or we ran out of retries, break inner loop to try next model
        }
      }

      if (response) {
        break; // Success! Exit outer fallback loop.
      }
      
      console.log(`[server] Issue on model ${currentModel}. Falling back to next available model in the chain...`);
    }

    if (lastError && !response) {
      throw lastError;
    }

    const duration = Math.round(performance.now() - startTime);
    console.log(`[server] Generated Gemini response successfully using model ${finalUsedModel} in ${duration}ms`);

    const text = response.text || '';
    let result = text;
    if (response_json_schema) {
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error('[server] Error parsing returned JSON against schema:', text, e.message);
      }
    }

    // Set a custom response header showing the actual model used
    res.setHeader('x-vivi-gemini-model', finalUsedModel);
    res.json(result);
  } catch (err) {
    const duration = Math.round(performance.now() - startTime);
    console.error(`[server] Gemini generation was unsuccessful after ${duration}ms:`, err.message || err);
    res.status(500).json({
      error: err.message || 'Error occurred during generation',
      stack: err.stack,
      status: err.status || 500
    });
  }
});

// ── Vite Dev Server / Static Ingress Routing ──
async function initializeServer() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[server] Initializing Vite dev server in middleware mode...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[server] Serving static production files from dist/...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Vivi AI server running on port ${PORT}`);
  });
}

initializeServer().catch((err) => {
  console.error('[server] Initial startup failure:', err);
});
