// CodeTool — Code analysis, generation, and error review.
// Uses InvokeLLM for all code-related tasks.

import { ToolBase } from './ToolBase';
import { AI } from '@/lib/aiProvider';

export default class CodeTool extends ToolBase {
  constructor() {
    super({
      name: 'code',
      description: 'Análisis de código, generación de código, revisión de errores y sugerencias de mejora.',
      category: 'development',
      permissions: ['code:read'],
      requiresFounder: true,
    });
  }

  async execute(params, _context) {
    const action = params?.action;
    const lang = params?.language || 'javascript';

    const prompts = {
      analyze: `Analiza el siguiente código. Identifica problemas, bugs, mala prácticas y oportunidades de optimización. Sé específico y directo.\n\nLenguaje: ${lang}\n\nCódigo:\n${params.code}`,
      generate: `Genera código en ${lang} que cumpla con esta especificación. Solo devuelve el código, sin explicaciones.\n\nEspecificación: ${params.specification}`,
      review: `Revisa el siguiente código en busca de errores. Si hay bugs, explica el problema y la solución. Si no hay errores, dilo.\n\nCódigo:\n${params.code}`,
      refactor: `Refactoriza el siguiente código para que sea más limpio, eficiente y mantenible. Devuelve solo el código refactorizado.\n\nCódigo:\n${params.code}`,
    };

    const prompt = prompts[action];
    if (!prompt) return { success: false, data: null, error: `Acción desconocida: ${action}` };

    const response = await AI.InvokeLLM({ prompt });
    const text = typeof response === 'string' ? response.trim() : '';
    return { success: true, data: { result: text } };
  }
}