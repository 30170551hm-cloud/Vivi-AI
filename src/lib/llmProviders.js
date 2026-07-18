// llmProviders.js — Cliente para las Cloud Functions callLLM/generateImage
// (ver functions/index.js). Reemplaza `base44.integrations.Core.InvokeLLM` y
// `base44.integrations.Core.GenerateImage` con la MISMA forma de entrada/salida,
// verificada contra los 18 call sites reales del repo (ver informe §6):
//
//   await CoreIntegrations.InvokeLLM({ prompt, response_json_schema?, file_urls? })
//   await CoreIntegrations.GenerateImage({ prompt })
//
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app, 'us-central1');
const callLLMFn = httpsCallable(functions, 'callLLM');
const generateImageFn = httpsCallable(functions, 'generateImage');
const generateSpeechFn = httpsCallable(functions, 'generateSpeech');

function rethrowCallableError(err, fnName) {
  const code = err?.code || 'functions/unknown';
  const message = err?.message || 'Error desconocido en Cloud Functions';
  throw new Error(`[${fnName}] ${code}: ${message}`);
}

export const CoreIntegrations = {
  /**
   * Reemplazo directo de base44.integrations.Core.InvokeLLM.
   * @param {{prompt: string, response_json_schema?: object, file_urls?: string[], provider?: 'openai'|'gemini', model?: string, add_context_from_internet?: boolean}} params
   * @returns {Promise<object|string>} objeto JSON si hay schema, string si no
   */
  async InvokeLLM({ prompt, response_json_schema, file_urls, provider, model, add_context_from_internet }) {
    try {
      const { data } = await callLLMFn({ prompt, response_json_schema, file_urls, provider, model, add_context_from_internet });
      return /** @type {object|string} */ (data);
    } catch (err) {
      rethrowCallableError(err, 'callLLM');
    }
  },

  /**
   * Reemplazo directo de base44.integrations.Core.GenerateImage.
   * @param {{prompt: string}} params
   * @returns {Promise<{url: string}>}
   */
  async GenerateImage({ prompt }) {
    try {
      const { data } = await generateImageFn({ prompt });
      return /** @type {{url: string}} */ (data);
    } catch (err) {
      rethrowCallableError(err, 'generateImage');
    }
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
    try {
      const { data } = await generateSpeechFn({ text, language_code });
      return /** @type {{url: string}} */ (data);
    } catch (err) {
      rethrowCallableError(err, 'generateSpeech');
    }
  },
};
