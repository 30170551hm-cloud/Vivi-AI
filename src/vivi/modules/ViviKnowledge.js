// ViviKnowledge — Web search and knowledge retrieval.
// Uses InvokeLLM with add_context_from_internet for real-time information.
// Independent of Core: Core can call knowledge.search(), but Knowledge
// works standalone (e.g. a scheduled workflow could trigger searches).

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { AI } from '@/lib/aiProvider';

export default class ViviKnowledge extends ModuleBase {
  constructor(bus) {
    super('knowledge', bus);
  }

  async init(registry) {
    await super.init(registry);
    // Allow other modules to request a search via event.
    this.subscribe(EVENTS.KNOWLEDGE_SEARCH, ({ query, requestId }) => {
      this.search(query, requestId);
    });
  }

  /**
   * Search the web for information and return a structured answer.
   * Uses Gemini (the only model that supports add_context_from_internet).
   */
  async search(query, requestId = null) {
    const result = await this.safe(async () => {
      const response = await AI.InvokeLLM({
        prompt: `Busca información actualizada sobre: ${query}\n\nProporciona una respuesta clara, concisa y factual.`,
        add_context_from_internet: true,
        model: 'gemini-3.5-flash',
      });
      return typeof response === 'string' ? response.trim() : String(response);
    }, null);

    this.emit(EVENTS.KNOWLEDGE_RESULT, { query, result, requestId });
    return result;
  }

  /** Ask the LLM to extract structured data from the web. */
  async searchStructured(query, schema) {
    return this.safe(async () => {
      const response = await AI.InvokeLLM({
        prompt: `Busca y extrae información sobre: ${query}`,
        add_context_from_internet: true,
        model: 'gemini-3.5-flash',
        response_json_schema: schema,
      });
      return response;
    }, null);
  }
}