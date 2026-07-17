import { callGemini } from './aiService';

/**
 * Administra el flujo conversacional de Vivi AI sin capas de fallback intermedias.
 * * @param {string} userInput - Texto ingresado por el usuario.
 * @param {Array} [chatHistory=[]] - Historial de mensajes previos.
 * @returns {Promise<string>} - Respuesta limpia de Gemini.
 */
export async function processConversation(userInput, chatHistory = []) {
  if (!userInput || typeof userInput !== 'string') {
    throw new Error('Entrada de usuario inválida para procesar la conversación.');
  }

  // Llamada directa al servicio de Gemini (sin bloqueos ni textos enlatados)
  const aiResponseText = await callGemini(userInput, chatHistory);
  
  return aiResponseText;
}
