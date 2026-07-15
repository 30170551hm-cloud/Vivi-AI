// llmProviders.js — Cliente para las Cloud Functions callLLM/generateImage
// (ver functions/index.js). Reemplaza `backend.integrations.Core.InvokeLLM` y
// `backend.integrations.Core.GenerateImage` con la MISMA forma de entrada/salida,
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
import app from './firebase';

const functions = getFunctions(app);
const callLLMFn = httpsCallable(functions, 'callLLM');
const generateImageFn = httpsCallable(functions, 'generateImage');
const generateSpeechFn = httpsCallable(functions, 'generateSpeech');

export const CoreIntegrations = {
  /**
   * Reemplazo directo de backend.integrations.Core.InvokeLLM.
   * @param {{prompt: string, response_json_schema?: object, file_urls?: string[], provider?: 'openai'|'gemini'}} params
   * @returns {Promise<object|string>} objeto JSON si hay schema, string si no
   */
  async InvokeLLM({ prompt, response_json_schema, file_urls, provider, model } = {}) {
    const { data } = await callLLMFn({ prompt, response_json_schema, file_urls, provider, model });
    return data;
  },

  /**
   * Reemplazo directo de backend.integrations.Core.GenerateImage.
   * @param {{prompt: string}} params
   * @returns {Promise<{url: string}>}
   */
  async GenerateImage({ prompt } = {}) {
    const { data } = await generateImageFn({ prompt });
    return data;
  },

  /**
   * Reemplazo directo de backend.integrations.Core.GenerateSpeech.
   * Nota: el parámetro `language_code` del contrato original de Base44 no se
   * usa aquí (OpenAI TTS detecta el idioma del texto); se acepta igual para
   * no romper la firma de llamada existente en ViviVoice.js.
   * @param {{text: string, language_code?: string}} params
   * @returns {Promise<{url: string}>}
   */
  async GenerateSpeech({ text } = {}) {
    const { data } = await generateSpeechFn({ text });
    return data;
  },
};
