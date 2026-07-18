// ViviVisionEngine — Visual processing.
// Understands images, documents, screenshots, diagrams, and graphs.
// Uses the LLM's vision capability (file_urls) to analyze visual content.
//
// This module does NOT capture or display images — it only analyzes them.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { CoreIntegrations } from '@/lib/llmProviders';

export default class ViviVisionEngine extends ModuleBase {
  constructor(bus) {
    super('vision_engine', bus);
  }

  async init(registry) {
    await super.init(registry);
  }

  /** Analyze an image or document with a question. Returns a text description/answer. */
  async analyze(fileUrl, question) {
    if (!fileUrl) return null;

    const prompt = `Eres Vivi, una asistente venezolana inteligente. Analiza la imagen o documento adjunto.

Pregunta del usuario: ${question || '¿Qué puedes decirme sobre esto?'}

Instrucciones:
- Describe lo que ves de forma clara y natural.
- Si es un documento, extrae la información clave.
- Si es un diagrama o gráfico, explica los datos.
- Responde en español venezolano, cercana y conversacional.
- Sé precisa. Si no puedes leer algo claramente, dilo.`;

    this.emit(EVENTS.VISION_ANALYZE, { fileUrl, question });

    const result = await this.safe(() =>
      CoreIntegrations.InvokeLLM({
        prompt,
        file_urls: [fileUrl],
      }),
      null
    );

    const text = typeof result === 'string' ? result.trim() : '';
    if (text) {
      this.emit(EVENTS.VISION_RESULT, { fileUrl, summary: text.slice(0, 200) });
    }

    return text || null;
  }

  /** Detect the type of content in an image (photo, document, diagram, screenshot). */
  async detectType(fileUrl) {
    const result = await this.safe(() =>
      base44.integrations.Core.InvokeLLM({
        prompt: 'Identifica el tipo de contenido de esta imagen. Responde solo con una palabra: foto, documento, diagrama, grafico, captura, otro.',
        file_urls: [fileUrl],
        response_json_schema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['foto', 'documento', 'diagrama', 'grafico', 'captura', 'otro'] },
            description: { type: 'string' },
          },
          required: ['type', 'description'],
        },
      }),
      null
    );
    return result;
  }

  health() {
    return { name: this.name, healthy: this._initialized };
  }
}