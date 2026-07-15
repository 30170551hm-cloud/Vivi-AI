// KnowledgeQueryTool — Query the Base Brain for relevant knowledge.
// Searches memories by relevance and returns organized context.

import { ToolBase } from './ToolBase';

export default class KnowledgeQueryTool extends ToolBase {
  constructor() {
    super({
      name: 'knowledge_query',
      description: 'Consulta la base de conocimiento de Vivi. Busca recuerdos, proyectos, metas y contexto relevante por tema.',
      category: 'knowledge',
      permissions: ['memory:read'],
    });
  }

  async execute(params, context) {
    const memory = context?.registry?.get('memory');
    if (!memory) return { success: false, data: null, error: 'Módulo de memoria no disponible' };

    const query = params?.query || '';
    const relevant = await memory.recallRelevant(query, 15);
    const contextBlock = memory.buildContextBlock(null);

    return {
      success: true,
      data: {
        relevantMemories: relevant,
        fullContext: contextBlock,
        activeSummary: memory.getActiveContextSummary(),
      },
    };
  }
}