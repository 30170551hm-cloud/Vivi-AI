import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

initializeApp();

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

function pickProvider(requested, keys) {
  if (requested) return requested;
  if (keys.openai) return 'openai';
  if (keys.gemini) return 'gemini';
  throw new HttpsError('failed-precondition', 'No hay ningún proveedor de IA configurado.');
}

async function invokeOpenAI({ apiKey, prompt, responseSchema, fileUrls }) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const content = [{ type: 'text', text: prompt }];
  for (const url of fileUrls || []) {
    content.push({ type: 'image_url', image_url: { url } });
  }
  const request = {
    model: 'gpt-4o',
    messages: [{ role: 'user', content }],
  };
  if (responseSchema) {
    request.response_format = {
      type: 'json_schema',
      json_schema: { name: 'vivi_response', schema: responseSchema, strict: true },
    };
  }
  const completion = await client.chat.completions.create(request);
  const text = completion.choices?.[0]?.message?.content || '';
  return responseSchema ? JSON.parse(text) : text;
}

async function generateImageOpenAI({ apiKey, prompt }) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const result = await client.images.generate({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024' });
  return { url: result.data?.[0]?.url };
}

async function generateSpeechOpenAI({ apiKey, text, uid }) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: text,
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const bucket = getStorage().bucket();
  const filePath = `tts-cache/${uid}/${Date.now()}.mp3`;
  const file = bucket.file(filePath);
  await file.save(buffer, { contentType: 'audio/mpeg' });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
  return { url };
}

async function invokeGemini({ apiKey, prompt, responseSchema, fileUrls }) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: responseSchema
      ? { responseMimeType: 'application/json', responseSchema }
      : undefined,
  });
  const parts = [{ text: prompt }];
  for (const url of fileUrls || []) {
    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());
    parts.push({
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: res.headers.get('content-type') || 'image/jpeg',
      },
    });
  }
  const result = await model.generateContent(parts);
  const text = result.response.text();
  return responseSchema ? JSON.parse(text) : text;
}

export const callLLM = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
  }
  const { prompt, response_json_schema, file_urls, provider } = request.data || {};
  if (!prompt || typeof prompt !== 'string') {
    throw new HttpsError('invalid-argument', 'Falta "prompt" (string).');
  }
  const keys = { 
    openai: process.env.OPENAI_API_KEY || "", 
    gemini: process.env.GEMINI_API_KEY || "" 
  };
  const chosen = pickProvider(provider, keys);
  try {
    if (chosen === 'openai') {
      return await invokeOpenAI({ apiKey: keys.openai, prompt, responseSchema: response_json_schema, fileUrls: file_urls });
    }
    if (chosen === 'gemini') {
      return await invokeGemini({ apiKey: keys.gemini, prompt, responseSchema: response_json_schema, fileUrls: file_urls });
    }
    throw new HttpsError('invalid-argument', `Proveedor desconocido: ${chosen}`);
  } catch (err) {
    throw new HttpsError('internal', `Fallo del proveedor ${chosen}: ${err.message}`);
  }
});

export const generateSpeech = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
  }
  const { text } = request.data || {};
  if (!text || typeof text !== 'string') {
    throw new HttpsError('invalid-argument', 'Falta "text" (string).');
  }
  const apiKey = process.env.OPENAI_API_KEY || "";
  try {
    return await generateSpeechOpenAI({ apiKey, text: text.slice(0, 5000), uid: request.auth.uid });
  } catch (err) {
    throw new HttpsError('internal', `Fallo generando voz: ${err.message}`);
  }
});

export const generateImage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
  }
  const { prompt } = request.data || {};
  if (!prompt || typeof prompt !== 'string') {
    throw new HttpsError('invalid-argument', 'Falta "prompt" (string).');
  }
  const apiKey = process.env.OPENAI_API_KEY || "";
  try {
    return await generateImageOpenAI({ apiKey, prompt });
  } catch (err) {
    throw new HttpsError('internal', `Fallo generando imagen: ${err.message}`);
  }
});
