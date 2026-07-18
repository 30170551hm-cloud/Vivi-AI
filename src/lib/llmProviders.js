// llmProviders.js — Cliente para las Cloud Functions callLLM/generateImage
// (ver functions/index.js). Reemplaza `base44.integrations.Core.InvokeLLM` y
// `base44.integrations.Core.GenerateImage` con la MISMA forma de entrada/salida,
// verificada contra los 18 call sites reales del repo (ver informe §6):
//
//   await CoreIntegrations.InvokeLLM({ prompt, response_json_schema?, file_urls? })
//   await CoreIntegrations.GenerateImage({ prompt })
//
// ESTADO: escrito y verificado sintácticamente. NO conectado a ningún módulo
// de producción todavía — requiere que functions/index.js esté desplegado en
// un proyecto Firebase real con al menos un proveedor (OPENAI_API_KEY o
// GEMINI_API_KEY) configurado como secret.

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

let functions = null;
let callLLMFn = null;
let generateImageFn = null;
let generateSpeechFn = null;

try {
  if (app) {
    functions = getFunctions(app);
    callLLMFn = httpsCallable(functions, 'callLLM');
    generateImageFn = httpsCallable(functions, 'generateImage');
    generateSpeechFn = httpsCallable(functions, 'generateSpeech');
  }
} catch (e) {
  console.warn("Firebase Functions client failed to initialize:", e);
}

export const CoreIntegrations = {
  /**
   * Reemplazo directo de base44.integrations.Core.InvokeLLM.
   * @param {{prompt: string, response_json_schema?: object, file_urls?: string[], provider?: 'openai'|'gemini', model?: string, add_context_from_internet?: boolean}} params
   * @returns {Promise<object|string>} objeto JSON si hay schema, string si no
   */
  async InvokeLLM({ prompt, response_json_schema, file_urls, provider, model, add_context_from_internet }) {
    if (!callLLMFn) throw new Error("Firebase Functions is not initialized. Ensure Firebase config environment variables are set correctly.");
    const { data } = await callLLMFn({ prompt, response_json_schema, file_urls, provider, model, add_context_from_internet });
    return /** @type {object|string} */ (data);
  },

  /**
   * Reemplazo directo de base44.integrations.Core.GenerateImage.
   * @param {{prompt: string}} params
   * @returns {Promise<{url: string}>}
   */
  async GenerateImage({ prompt }) {
    if (!generateImageFn) throw new Error("Firebase Functions is not initialized. Ensure Firebase config environment variables are set correctly.");
    const { data } = await generateImageFn({ prompt });
    return /** @type {{url: string}} */ (data);
  },

  /**
   * Reemplazo directo de base44.integrations.Core.GenerateSpeech.
   * Nota: el parámetro `language_code` del contrato original de Base44 no se
   * usa aquí (OpenAI TTS detecta el idioma del texto); se acepta igual para
   * no romper la firma de llamada existente en ViviVoice.js.
   * @param {{text: string, language_code?: string}} params
   * @returns {Promise<{url: string}>}
   */
  async GenerateSpeech({ text, language_code }) {
    if (!generateSpeechFn) throw new Error("Firebase Functions is not initialized. Ensure Firebase config environment variables are set correctly.");
    const { data } = await generateSpeechFn({ text, language_code });
    return /** @type {{url: string}} */ (data);
  },
};
