// WebSearchTool — Authorized web navigation and intelligent search.
// Prioritizes Wikipedia and reliable sources. Verifies information before returning.

import { ToolBase } from './ToolBase';
import { CoreIntegrations } from '@/lib/llmProviders';

export default class WebSearchTool extends ToolBase {
  constructor() {
    super({
      name: 'web_search',
      description: 'Busca información actualizada en internet. Prioriza Wikipedia y fuentes confiables. Verifica antes de responder.',
      category: 'research',
      permissions: ['web:read'],
    });
  }

  async execute(params, _context) {
    const query = params?.query?.trim();
    if (!query) return { success: false, data: null, error: 'Query requerida' };

    const lang = params?.lang || 'es-ES';
    const response = await CoreIntegrations.InvokeLLM({
      prompt: `Busca la respuesta en internet, DANDO PRIORIDAD a Wikipedia como fuente principal y complementando con otras fuentes confiables si es necesario. Responde en ${lang}.

IMPORTANTE:
- Verifica la información consultando al menos 2 fuentes antes de responder.
- Responde de forma concisa y directa.
- Cita la fuente de forma natural al final: "Lo vi en Wikipedia" o "Según fuentes oficiales...".
- Si no encuentras información confiable, dilo claramente.

Consulta: ${query}`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
    });

    const text = typeof response === 'string' ? response.trim() : '';
    if (!text) return { success: false, data: null, error: 'Sin resultados' };
    return { success: true, data: { reply: text, source: 'web' } };
  }
}