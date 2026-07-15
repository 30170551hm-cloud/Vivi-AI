// aiProvider.js — El cerebro de IA de Vivi, con LLM Gateway independiente y sistema de Fallback.
//
// Implementa el contrato original compatible con todo Vivi:
//   AI.InvokeLLM({ prompt, response_json_schema?, file_urls?, model? })
//     → objeto JSON (si hay schema) o string (si no)
//
// Soporta cambio dinámico de proveedores: Gemini, OpenAI, OpenRouter, Claude, Groq, Ollama, LM Studio.
// Implementa persistencia automática en Firestore para el propietario y fallback de alta disponibilidad.

import { normalizeEnvValue } from '@/lib/app-params';
import { diagnosticsStore } from '@/lib/diagnosticsStore';
import { authClient } from '@/lib/authClient';

const GEMINI_API_KEY = normalizeEnvValue(import.meta.env?.VITE_GEMINI_API_KEY);

const DEFAULT_PROVIDERS = [
  {
    id: 'gemini-server',
    name: 'Gemini (Server Proxy)',
    type: 'gemini',
    enabled: true,
    url: '/api/gemini/generate',
    model: 'gemini-3.5-flash',
    apiKey: '',
    priority: 1,
    status: 'active'
  },
  {
    id: 'gemini-direct',
    name: 'Gemini Directo',
    type: 'gemini_direct',
    enabled: true,
    url: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'gemini-3.5-flash',
    apiKey: '',
    priority: 2,
    status: 'active'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'openai_compatible',
    enabled: false,
    url: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3-8b-instruct:free',
    apiKey: '',
    priority: 3,
    status: 'idle'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai_compatible',
    enabled: false,
    url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: '',
    priority: 4,
    status: 'idle'
  },
  {
    id: 'groq',
    name: 'Groq',
    type: 'openai_compatible',
    enabled: false,
    url: 'https://api.groq.com/openai/v1',
    model: 'llama3-8b-8192',
    apiKey: '',
    priority: 5,
    status: 'idle'
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    type: 'claude',
    enabled: false,
    url: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-latest',
    apiKey: '',
    priority: 6,
    status: 'idle'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    type: 'ollama',
    enabled: false,
    url: 'http://localhost:11434',
    model: 'llama3',
    apiKey: '',
    priority: 7,
    status: 'idle'
  },
  {
    id: 'lm-studio',
    name: 'LM Studio (Local)',
    type: 'openai_compatible',
    enabled: false,
    url: 'http://localhost:1234/v1',
    model: 'meta-llama-3-8b-instruct',
    apiKey: '',
    priority: 8,
    status: 'idle'
  }
];

// Cargar proveedores desde LocalStorage y sincronizarlos con Firestore
function loadProviders() {
  try {
    const cached = localStorage.getItem('vivi_llm_providers');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(p => {
          if (p.model === 'gemini-2.5-flash') {
            return { ...p, model: 'gemini-3.5-flash' };
          }
          return p;
        });
      }
    }
  } catch (err) {
    console.warn('[aiProvider] Error leyendo proveedores de localStorage:', err);
  }
  return [...DEFAULT_PROVIDERS];
}

function saveProviders(newList) {
  try {
    localStorage.setItem('vivi_llm_providers', JSON.stringify(newList));
    authClient.me().then(user => {
      if (user) {
        authClient.updateMe({ llm_providers: newList }).catch(err => {
          console.warn('[aiProvider] Error guardando proveedores en Firestore:', err);
        });
      }
    }).catch(() => {});
  } catch (err) {
    console.warn('[aiProvider] Error guardando proveedores en localStorage:', err);
  }
}

// Suscribirse a cambios de sesión para cargar proveedores del usuario
authClient.onAuthStateChanged((user) => {
  if (user && user.llm_providers && Array.isArray(user.llm_providers)) {
    localStorage.setItem('vivi_llm_providers', JSON.stringify(user.llm_providers));
    diagnosticsStore.updateStep('ai', 'idle', 'Proveedores de IA sincronizados desde Firestore');
  }
});

let lastActiveProviderId = 'gemini-server';

function resolveModel(modelName) {
  let name = String(modelName || '').toLowerCase();
  if (name.includes('pro')) return 'gemini-3.1-pro-preview';
  if (name.includes('flash-lite') || name.includes('lite')) return 'gemini-3.1-flash-lite';
  if (name.includes('flash')) return 'gemini-3.5-flash';
  return 'gemini-3.5-flash';
}

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

async function fetchWithTimeoutAndSignal(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const { signal } = options;
  
  let onAbort;
  if (signal) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    onAbort = () => {
      controller.abort();
    };
    signal.addEventListener('abort', onAbort);
  }
  
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
    if (signal && onAbort) {
      signal.removeEventListener('abort', onAbort);
    }
  }
}

async function invokeGeminiDirect({ prompt, response_json_schema, file_urls, model, apiKey, signal }) {
  const parts = [{ text: prompt }];

  for (const url of file_urls || []) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      parts.push({ inlineData: { mimeType: blob.type || 'image/jpeg', data: base64 } });
    } catch (err) {
      console.warn('[aiProvider] No se pudo adjuntar archivo al prompt:', url, err?.message);
    }
  }

  const body = {
    contents: [{ role: 'user', parts }],
  };

  if (response_json_schema) {
    body.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: normalizeSchema(response_json_schema),
    };
  }

  const resolvedModel = resolveModel(model || import.meta.env?.VITE_GEMINI_MODEL);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent`;

  const keyToUse = apiKey || GEMINI_API_KEY;
  if (!keyToUse) {
    throw new Error('Gemini API Key faltante o no configurada.');
  }

  const startTime = performance.now();
  const res = await fetchWithTimeoutAndSignal(`${endpoint}?key=${keyToUse}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }, 12000);

  const duration = performance.now() - startTime;

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    diagnosticsStore.recordGeminiCall({
      apiKey: keyToUse,
      model: resolvedModel,
      endpoint,
      httpCode: res.status,
      responseTime: Math.round(duration),
      prompt,
      responseBody: errText,
      errorMessage: `HTTP ${res.status}: ${errText}`,
    });
    throw new Error(`Gemini Direct API returned HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

  if (!text) {
    throw new Error('Gemini devolvió una respuesta vacía o bloqueada por políticas de seguridad.');
  }

  diagnosticsStore.recordGeminiCall({
    apiKey: keyToUse,
    model: resolvedModel,
    endpoint,
    httpCode: 200,
    responseTime: Math.round(duration),
    prompt,
    responseBody: text,
  });

  return response_json_schema ? JSON.parse(text) : text;
}

// Ejecutar la llamada específica a un proveedor
async function executeProviderCall(provider, params) {
  const { prompt, response_json_schema, file_urls, signal } = params;

  if (provider.type === 'gemini') {
    // 1. Server Proxy
    const response = await fetchWithTimeoutAndSignal(provider.url || '/api/gemini/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        model: provider.model
      }),
      signal
    }, 12000);
    if (!response.ok) {
      throw new Error(`Server Proxy returned HTTP ${response.status}`);
    }
    return await response.json();
  }

  if (provider.type === 'gemini_direct') {
    // 2. Gemini Direct
    return await invokeGeminiDirect({
      prompt,
      response_json_schema,
      file_urls,
      model: provider.model,
      apiKey: provider.apiKey || GEMINI_API_KEY,
      signal
    });
  }

  if (provider.type === 'openai_compatible') {
    // OpenAI, OpenRouter, Groq, LM Studio o Custom OpenAI compatible
    const headers = {
      'Content-Type': 'application/json',
    };
    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }
    if (provider.url.includes('openrouter')) {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'Vivi AI';
    }

    const messages = [{ role: 'user', content: prompt }];
    const body = {
      model: provider.model,
      messages: messages,
      temperature: 0.7,
    };

    if (response_json_schema) {
      body.response_format = { type: 'json_object' };
      // Forzar que devuelva JSON en el prompt por si el backend no es 100% estricto
      body.messages[0].content += '\n\nIMPORTANTE: Tu respuesta debe ser ESTRICTAMENTE un objeto JSON válido.';
    }

    const endpoint = provider.url.endsWith('/') ? `${provider.url}chat/completions` : `${provider.url}/chat/completions`;

    const res = await fetchWithTimeoutAndSignal(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    }, 12000);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenAI Compatible HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';

    if (!text) {
      throw new Error('El proveedor compatible con OpenAI devolvió una respuesta vacía.');
    }

    if (response_json_schema) {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      return JSON.parse(cleaned);
    }

    return text;
  }

  if (provider.type === 'claude') {
    // Anthropic Claude Direct API
    if (!provider.apiKey) {
      throw new Error('API Key de Anthropic faltante');
    }
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true'
    };

    const body = {
      model: provider.model || 'claude-3-5-sonnet-latest',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    };

    const res = await fetchWithTimeoutAndSignal('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    }, 12000);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Anthropic Claude Direct HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text || '';

    if (!text) {
      throw new Error('Claude devolvió una respuesta vacía.');
    }

    if (response_json_schema) {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      return JSON.parse(cleaned);
    }

    return text;
  }

  if (provider.type === 'ollama') {
    // Ollama Local direct API
    const res = await fetchWithTimeoutAndSignal(`${provider.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: provider.model || 'llama3',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        format: response_json_schema ? 'json' : undefined
      }),
      signal
    }, 12000);

    if (!res.ok) {
      throw new Error(`Ollama Direct API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data?.message?.content || '';

    if (!text) {
      throw new Error('Ollama devolvió una respuesta vacía.');
    }

    if (response_json_schema) {
      return JSON.parse(text);
    }

    return text;
  }

  throw new Error(`Tipo de proveedor no soportado: ${provider.type}`);
}

export const AI = {
  getProviders() {
    return loadProviders();
  },

  saveProviders(newList) {
    saveProviders(newList);
  },

  resetProviders() {
    localStorage.removeItem('vivi_llm_providers');
    const reset = [...DEFAULT_PROVIDERS];
    saveProviders(reset);
    return reset;
  },

  getLastActiveProvider() {
    return lastActiveProviderId;
  },

  async InvokeLLM(params = {}) {
    diagnosticsStore.updateStep('ai', 'procesando', 'Seleccionando proveedor de la lista de prioridad...');
    const startTime = performance.now();

    const providers = loadProviders();
    const enabled = providers
      .filter(p => p.enabled)
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));

    if (enabled.length === 0) {
      // Forzar fallback de emergencia
      enabled.push({
        id: 'gemini-server',
        name: 'Gemini (Server Proxy)',
        type: 'gemini',
        enabled: true,
        url: '/api/gemini/generate',
        model: 'gemini-3.5-flash',
        apiKey: ''
      });
    }

    let lastError = null;
    for (const provider of enabled) {
      try {
        diagnosticsStore.updateStep('gemini', 'llamando', `Llamando a ${provider.name}...`);
        const result = await executeProviderCall(provider, params);
        
        lastActiveProviderId = provider.id;
        const duration = Math.round(performance.now() - startTime);
        
        diagnosticsStore.updateStep('gemini', 'exitoso', `Completado via ${provider.name} en ${duration}ms`);
        diagnosticsStore.updateStep('ai', 'exitoso', `Respondido con ${provider.name}`);
        
        return result;
      } catch (err) {
        console.warn(`[aiProvider] Falló llamada con ${provider.name}. Intentando siguiente proveedor...`, err.message);
        lastError = err;
        diagnosticsStore.updateStep('gemini', 'error', `Fallo con ${provider.name}: ${err.message}`);
      }
    }

    // Si todos fallan
    diagnosticsStore.updateStep('ai', 'error', 'Todos los proveedores de la lista de prioridad fallaron.');
    throw lastError || new Error('No hay proveedores disponibles o todos fallaron.');
  },
};
