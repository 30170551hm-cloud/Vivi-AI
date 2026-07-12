// functions/index.js — Reemplazo de base44.integrations.Core.{InvokeLLM,GenerateImage}
// como Cloud Functions 2nd gen, con una capa de proveedores intercambiable
// (OpenAI y Gemini soportados; añadir otro proveedor = un archivo nuevo en
// providers/, sin tocar el resto).
//
// ESTADO: escrito y revisado, NO DESPLEGADO. Requiere:
//   1. Un proyecto Firebase real con Cloud Functions habilitado (plan Blaze).
//   2. Configurar los secrets:  firebase functions:secrets:set OPENAI_API_KEY
//                               firebase functions:secrets:set GEMINI_API_KEY
//   3. firebase deploy --only functions
//
// CONTRATO (idéntico al de base44.integrations.Core.InvokeLLM, verificado
// contra los 18 call sites reales del repo — ver informe de auditoría §6):
//   Input:  { prompt: string, response_json_schema?: object, file_urls?: string[] }
//   Output: si hay response_json_schema → objeto JSON parseado que cumple el schema
//           si no hay schema           → string de texto plano
//
// generateImage: { prompt: string } → { url: string }  (mismo shape que
// base44.integrations.Core.GenerateImage usado en useChat.js)

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

initializeApp();

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const GITHUB_TOKEN = defineSecret('GITHUB_TOKEN');

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

// ── Selección de proveedor ──
// Por defecto usa el primero que tenga API key configurada. Se puede forzar
// con el campo opcional `provider: 'openai' | 'gemini'` en la llamada.
function pickProvider(requested, keys) {
  if (requested) return requested;
  if (keys.openai) return 'openai';
  if (keys.gemini) return 'gemini';
  throw new HttpsError('failed-precondition', 'No hay ningún proveedor de IA configurado (OPENAI_API_KEY / GEMINI_API_KEY).');
}

// ── Proveedor: OpenAI ──
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

// Reemplazo de base44.integrations.Core.GenerateSpeech — usado por
// ViviVoice.js como respaldo en la nube cuando el navegador no tiene voces
// compatibles (Web Speech API ausente o sin voz para el idioma pedido).
// Contrato verificado contra el call site real:
//   base44.integrations.Core.GenerateSpeech({ text, language_code }) → { url }
async function generateSpeechOpenAI({ apiKey, text, uid }) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: text,
    // El SDK de OpenAI detecta el idioma del texto automáticamente; no toma
    // un parámetro de idioma explícito como sí hacía Base44.
  });
  const buffer = Buffer.from(await response.arrayBuffer());

  const bucket = getStorage().bucket();
  const path = `tts-cache/${uid}/${Date.now()}.mp3`;
  const file = bucket.file(path);
  await file.save(buffer, { contentType: 'audio/mpeg' });
  // URL firmada de larga duración — suficiente para reproducir inmediatamente
  // en el cliente; el archivo puede limpiarse luego con una regla de ciclo
  // de vida del bucket (no configurada aún, pendiente cuando exista el
  // proyecto real).
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
  return { url };
}

// ── Proveedor: Gemini ──
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
    // Gemini requiere los bytes o una referencia inline; para archivos ya
    // subidos a Firebase Storage, se resuelve la URL pública antes de llamar.
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

// Gemini no genera imágenes de forma nativa vía este SDK en este momento —
// si se elige Gemini como proveedor por defecto, generateImage exige OpenAI
// explícitamente o lanza un error claro en vez de fallar en silencio.

// ── Función pública: callLLM (reemplaza InvokeLLM) ──
export const callLLM = onCall(
  { secrets: [OPENAI_API_KEY, GEMINI_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
    }
    const { prompt, response_json_schema, file_urls, provider } = request.data || {};
    if (!prompt || typeof prompt !== 'string') {
      throw new HttpsError('invalid-argument', 'Falta "prompt" (string).');
    }

    const keys = { openai: OPENAI_API_KEY.value(), gemini: GEMINI_API_KEY.value() };
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
  }
);

// ── Función pública: generateSpeech (reemplaza GenerateSpeech) ──
export const generateSpeech = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
    }
    const { text } = request.data || {};
    if (!text || typeof text !== 'string') {
      throw new HttpsError('invalid-argument', 'Falta "text" (string).');
    }
    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Generación de voz requiere OPENAI_API_KEY configurada.');
    }
    try {
      return await generateSpeechOpenAI({ apiKey, text: text.slice(0, 5000), uid: request.auth.uid });
    } catch (err) {
      throw new HttpsError('internal', `Fallo generando voz: ${err.message}`);
    }
  }
);
export const generateImage = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
    }
    const { prompt } = request.data || {};
    if (!prompt || typeof prompt !== 'string') {
      throw new HttpsError('invalid-argument', 'Falta "prompt" (string).');
    }
    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Generación de imágenes requiere OPENAI_API_KEY configurada.');
    }
    try {
      return await generateImageOpenAI({ apiKey, prompt });
    } catch (err) {
      throw new HttpsError('internal', `Fallo generando imagen: ${err.message}`);
    }
  }
);

// ── GitHub — acceso de solo lectura al propio código fuente de Vivi ──
// Usado por ViviCodeAnalyzer.js. El token vive únicamente aquí (secret de
// Cloud Functions); el navegador nunca lo ve. Requiere:
//   firebase functions:secrets:set GITHUB_TOKEN
// (Personal Access Token de solo lectura sobre el repo, o GitHub App token.)
const GITHUB_API = 'https://api.github.com';

async function githubFetch(path, token) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'vivi-ai-code-analyzer',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Lista recursiva del árbol de archivos de un repo/rama.
 * Input:  { owner, repo, branch? } (branch por defecto: 'main')
 * Output: { files: [{ path, type, size }] }  (type: 'blob' | 'tree')
 */
export const getRepoTree = onCall(
  { secrets: [GITHUB_TOKEN] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
    const { owner, repo, branch = 'main' } = request.data || {};
    if (!owner || !repo) throw new HttpsError('invalid-argument', 'Faltan "owner" y/o "repo".');

    const token = GITHUB_TOKEN.value();
    if (!token) throw new HttpsError('failed-precondition', 'GITHUB_TOKEN no configurado.');

    try {
      const data = await githubFetch(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, token);
      const files = (data.tree || []).map((n) => ({ path: n.path, type: n.type, size: n.size || 0 }));
      return { files, truncated: !!data.truncated };
    } catch (err) {
      throw new HttpsError('internal', `Fallo leyendo el árbol del repo: ${err.message}`);
    }
  }
);

/**
 * Contenido de un archivo puntual del repo (decodificado de base64).
 * Input:  { owner, repo, path, branch? }
 * Output: { path, content, sha, size }
 */
export const getRepoFile = onCall(
  { secrets: [GITHUB_TOKEN] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
    const { owner, repo, path, branch = 'main' } = request.data || {};
    if (!owner || !repo || !path) throw new HttpsError('invalid-argument', 'Faltan "owner", "repo" y/o "path".');

    const token = GITHUB_TOKEN.value();
    if (!token) throw new HttpsError('failed-precondition', 'GITHUB_TOKEN no configurado.');

    try {
      const data = await githubFetch(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, token);
      if (Array.isArray(data)) {
        throw new Error(`"${path}" es un directorio, no un archivo — usa getRepoTree para listar.`);
      }
      const content = data.encoding === 'base64'
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : data.content;
      return { path, content, sha: data.sha, size: data.size };
    } catch (err) {
      throw new HttpsError('internal', `Fallo leyendo el archivo: ${err.message}`);
    }
  }
);
