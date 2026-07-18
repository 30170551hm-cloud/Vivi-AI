import { GoogleGenerativeAI } from '@google/generative-ai';

// Validación estricta de la API Key en tiempo de ejecución
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error('[Gemini Service] Error crítico: VITE_GEMINI_API_KEY no está definida en las variables de entorno.');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

/**
 * Envía un mensaje directamente al modelo de Gemini y retorna la respuesta de texto.
 * Propaga cualquier error real sin ocultarlo tras mensajes de respaldo.
 * * @param {string} prompt - El texto o mensaje del usuario.
 * @param {Array<{role: string, content: string}>} [history=[]] - Historial de conversación opcional.
 * @returns {Promise<string>} - Respuesta generada por la IA.
 */
export async function callGemini(prompt, history = []) {
  if (!apiKey) {
    throw new Error('API Key de Gemini no configurada en el cliente.');
  }

  try {
    // Usamos el modelo estándar y estable para producción
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Si hay historial, formateamos la sesión de chat
    if (history && history.length > 0) {
      const formattedHistory = history.map(item => ({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: item.content || item['text'] || "" }]
      }));

      const chat = model.startChat({ history: formattedHistory });
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      return response.text();
    } else {
      // Petición directa sin historial previo
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    }
  } catch (error) {
    console.error('[Gemini Service Error Real]:', {
      message: error.message,
      status: error.status || 'N/A',
      stack: error.stack
    });
    // Lanzamos el error original para que la capa superior conozca el fallo exacto
    throw error;
  }
}
