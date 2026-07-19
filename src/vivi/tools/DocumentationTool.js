// DocumentationTool — Generate documentation from code or specifications.

import { ToolBase } from './ToolBase';
import { CoreIntegrations } from '@/lib/llmProviders';

export default class DocumentationTool extends ToolBase {
  constructor() {
    super({
      name: 'documentation',
      description: 'Genera documentación técnica: README, API docs, guías de uso, comentarios de código.',
      category: 'development',
      permissions: ['docs:generate'],
      requiresFounder: true,
    });
  }

  async execute(params, _context) {
    const type = params?.type || 'general';
    const prompts = {
      readme: `Genera un README.md completo y profesional para este proyecto. Incluye: descripción, instalación, uso, estructura, tecnologías.\n\nProyecto: ${params.content}`,
      api: `Genera documentación de API en formato markdown. Incluye endpoints, parámetros, respuestas y ejemplos.\n\nEspecificación: ${params.content}`,
      guide: `Crea una guía de uso paso a paso, clara y concisa.\n\nTema: ${params.content}`,
      general: `Genera documentación técnica clara y estructurada.\n\nTema: ${params.content}`,
    };

    const prompt = prompts[type] || prompts.general;
    const response = await CoreIntegrations.InvokeLLM({ prompt });
    const text = typeof response === 'string' ? response.trim() : '';
    return { success: true, data: { documentation: text } };
  }
}