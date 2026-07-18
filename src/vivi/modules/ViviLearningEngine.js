// ViviLearningEngine — Knowledge acquisition and organization.
// Learns from authorized sources and conversations, then relates new
// knowledge to existing memory. This is NOT the memory store itself
// (ViviMemory owns storage) — this module decides WHAT is worth learning
// and HOW it connects to what Vivi already knows.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { CoreIntegrations } from '@/lib/llmProviders';

export default class ViviLearningEngine extends ModuleBase {
  constructor(bus) {
    super('learning_engine', bus);
    this._knowledgeGraph = new Map(); // topic -> { facts: [], related: [] }
  }

  async init(registry) {
    await super.init(registry);
    // Listen for new memories stored by the memory module.
    this.subscribe(EVENTS.MEMORY_STORED, (entry) => this._organize(entry));
  }

  /** Learn a new fact or piece of knowledge. */
  async learn(topic, content, source = 'conversacion') {
    if (!topic || !content) return null;

    // Use the LLM to extract structured knowledge.
    const extracted = await this.safe(() =>
      CoreIntegrations.InvokeLLM({
        prompt: `Extrae conocimiento estructurado de este contenido.

Tema: ${topic}
Contenido: ${content}

Devuelve un JSON con:
- key_facts: lista de hechos clave (frases cortas)
- related_topics: temas relacionados que Vivi ya podría conocer
- category: categoría del conocimiento`,
        response_json_schema: {
          type: 'object',
          properties: {
            key_facts: { type: 'array', items: { type: 'string' } },
            related_topics: { type: 'array', items: { type: 'string' } },
            category: { type: 'string' },
          },
          required: ['key_facts', 'related_topics', 'category'],
        },
      }),
      null
    );

    if (extracted) {
      const existing = this._knowledgeGraph.get(topic) || { facts: [], related: [], category: '' };
      existing.facts = [...new Set([...existing.facts, ...extracted.key_facts])];
      existing.related = [...new Set([...existing.related, ...extracted.related_topics])];
      existing.category = extracted.category;
      this._knowledgeGraph.set(topic, existing);

      this.emit(EVENTS.LEARN_STORED, { topic, factsCount: existing.facts.length });
    }

    return extracted;
  }

  /** Organize a memory entry into the knowledge graph. */
  _organize(entry) {
    if (!entry?.category || !entry?.value) return;
    this._knowledgeGraph.set(entry.category, {
      facts: [...(this._knowledgeGraph.get(entry.category)?.facts || []), entry.value],
      related: [],
      category: entry.category,
    });
  }

  /** Query the knowledge graph for a topic. */
  query(topic) {
    return this._knowledgeGraph.get(topic) || null;
  }

  /** Get all known topics. */
  getTopics() {
    return Array.from(this._knowledgeGraph.keys());
  }

  health() {
    return {
      name: this.name,
      healthy: this._initialized,
      topics: this._knowledgeGraph.size,
    };
  }
}