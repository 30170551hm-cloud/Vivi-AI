// aiProvider.js — El cerebro de IA de Vivi, sin Base44.
//
// Implementa el MISMO contrato que base44.integrations.Core.InvokeLLM
// (verificado contra los 18+ call sites reales del proyecto):
//   AI.InvokeLLM({ prompt, response_json_schema?, file_urls?, add_context_from_internet? })
//     → objeto JSON (si hay schema) o string (si no)
//
// Selección de proveedor, en orden:
//   1. Base44 — si VITE_BASE44_APP_ID está configurado (compatibilidad).
//   2. Gemini directo — si VITE_GEMINI_API_KEY está configurado.
//   3. Error claro con instrucciones — si no hay ninguno.
//
// ⚠️ NOTA DE SEGURIDAD (honesta, no escondida): usar VITE_GEMINI_API_KEY
// incrusta la API key en el bundle del navegador — cualquiera que abra
// DevTools puede verla. Para una app personal/privada es un riesgo
// aceptable SI restringes la key: en Google AI Studio / Cloud Console →
// restricción por "HTTP referrers" limitada a tu dominio de Vercel.
// Para una app pública con usuarios reales, migra esto a la Cloud
// Function `callLLM` (functions/index.js, ya escrita) donde la key vive
// como secret del servidor.

import { normalizeEnvValue } from '@/lib/app-params';

const GEMINI_API_KEY = normalizeEnvValue(import.meta.env?.VITE_GEMINI_API_KEY);
const GEMINI_MODEL = normalizeEnvValue(import.meta.env?.VITE_GEMINI_MODEL) || 'gemini-1.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function invokeGeminiDirect({ prompt, response_json_schema, file_urls }) {
  const parts = [{ text: prompt }];

  // Soporte multimodal: descarga cada imagen y la envía inline (Gemini
  // REST no acepta URLs remotas directamente en generateContent).
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
      responseSchema: response_json_schema,
    };
  }

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(blockReason
      ? `Gemini bloqueó la respuesta (${blockReason})`
      : 'Gemini devolvió una respuesta vacía');
  }

  return response_json_schema ? JSON.parse(text) : text;
}

async function invokeBase44(params) {
  const { base44 } = await import('@/api/base44Client');
  return base44.integrations.Core.InvokeLLM(params);
}

/**
 * AI — punto único de acceso al LLM para todo Vivi.
 * Los módulos llaman AI.InvokeLLM(...) con el mismo contrato de siempre.
 */
export const AI = {
  async InvokeLLM(params = {}) {
    const { normalizeEnvValue: n } = await import('@/lib/app-params');
    const base44AppId = n(import.meta.env?.VITE_BASE44_APP_ID);

    if (base44AppId) return invokeBase44(params);
    if (GEMINI_API_KEY) return invokeGeminiDirect(params);

    throw new Error(
      '[aiProvider] Vivi no tiene ningún proveedor de IA configurado. ' +
      'Opción rápida: crea una API key gratis en https://aistudio.google.com/apikey, ' +
      'agrégala en Vercel → Settings → Environment Variables como VITE_GEMINI_API_KEY, ' +
      'y haz Redeploy. (Restringe la key por HTTP referrer a tu dominio.)'
    );
  },
};
