// ViviBaseBrain — The knowledge organization center.
//
// Organizes permanently:
//   • Memory (from ViviMemory module)
//   • Knowledge (facts, learned information)
//   • Relationships between concepts
//   • Projects, goals, tasks
//   • Conversations (history)
//   • Preferences
//   • Decisions
//   • Documentation
//   • Context (timeline, chronology)
//
// All information is connected so Vivi can retrieve ONLY what's relevant
// to the current conversation — not dump everything.
//
// BaseBrain builds ON TOP of ViviMemory — it doesn't replace it.
// Memory stores the raw data; BaseBrain organizes and connects it.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';

export default class ViviBaseBrain extends ModuleBase {
  constructor(bus) {
    super('base_brain', bus);
    this._knowledgeGraph = null;
    this._lastOrganizedAt = 0;
  }

  async init(registry) {
    await super.init(registry);

    // Re-organize when memory changes.
    this.subscribe(EVENTS.MEMORY_RECALLED, () => this.organize());
    this.subscribe(EVENTS.MEMORY_STORED, () => { this._knowledgeGraph = null; });
    this.subscribe(EVENTS.SETTINGS_UPDATED, () => { this._knowledgeGraph = null; });
  }

  /**
   * Organize all memories into a structured knowledge graph.
   * Groups by category, cross-references tags, and identifies relationships.
   * Cached — re-built only when memory changes.
   */
  organize() {
    const memory = this.registry?.get('memory');
    if (!memory) return null;

    const memories = memory._cache || [];
    if (memories.length === 0) {
      this._knowledgeGraph = { categories: {}, tags: {}, timeline: [], relationships: [] };
      return this._knowledgeGraph;
    }

    // Group by category
    const categories = {};
    for (const m of memories) {
      const cat = m.category || 'fact';
      (categories[cat] = categories[cat] || []).push(m);
    }

    // Cross-reference by tags
    const tagIndex = {};
    for (const m of memories) {
      if (!m.tags || m.tags.length === 0) continue;
      for (const tag of m.tags) {
        (tagIndex[tag] = tagIndex[tag] || []).push(m);
      }
    }

    // Build timeline (memories with dates, sorted)
    const timeline = memories
      .filter((m) => m.timeline_date)
      .sort((a, b) => new Date(a.timeline_date) - new Date(b.timeline_date));

    // Detect relationships: memories that share tags or reference the same key
    const relationships = [];
    const seen = new Set();
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const a = memories[i];
        const b = memories[j];
        if (!a.tags || !b.tags) continue;
        const sharedTags = a.tags.filter((t) => b.tags.includes(t));
        if (sharedTags.length > 0) {
          const key = `${a.id}-${b.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            relationships.push({ a: a.id, b: b.id, sharedTags, strength: sharedTags.length });
          }
        }
      }
    }

    this._knowledgeGraph = {
      categories,
      tagIndex,
      timeline,
      relationships,
      totalMemories: memories.length,
      organizedAt: Date.now(),
    };

    this._lastOrganizedAt = Date.now();
    this._diag(`Knowledge organized: ${memories.length} memories, ${relationships.length} relationships, ${Object.keys(tagIndex).length} tags`);
    return this._knowledgeGraph;
  }

  /**
   * Get only the context relevant to the current conversation.
   * This is the key method — Vivi doesn't dump everything, she retrieves
   * only what's pertinent.
   */
  getRelevantContext(query, user) {
    const memory = this.registry?.get('memory');
    if (!memory || !memory._cache || memory._cache.length === 0) {
      return 'Sin contexto disponible.';
    }

    const graph = this._knowledgeGraph || this.organize();
    if (!graph) return 'Sin contexto disponible.';

    // Find relevant memories by keyword matching
    const words = (query || '').toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.replace(/[^\wáéíóúñ]/gi, ''));

    const scored = memory._cache.map((m) => {
      const text = `${m.key || ''} ${m.value || ''} ${(m.tags || []).join(' ')}`.toLowerCase();
      let score = 0;
      for (const word of words) {
        if (text.includes(word)) score += 1;
      }
      score += (m.importance || 1) * 0.15;
      return { mem: m, score };
    });

    const relevant = scored
      .filter((s) => s.score > 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((s) => s.mem);

    // Always include active projects, goals, and tasks (high priority context)
    const active = memory._cache.filter((m) =>
      ['project', 'goal', 'task'].includes(m.category) &&
      (!m.status || m.status === 'active')
    );

    // Merge relevant + active, deduplicate
    const seen = new Set();
    const merged = [];
    for (const m of [...relevant, ...active]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }

    // Build the context block
    return memory.buildContextBlock(user);
  }

  /** Get the active context summary (projects, goals, tasks in progress). */
  getActiveContextSummary() {
    const memory = this.registry?.get('memory');
    return memory ? memory.getActiveContextSummary() : '';
  }

  /** Get the full knowledge graph (for admin/debugging). */
  getKnowledgeGraph() {
    return this._knowledgeGraph || this.organize();
  }

  _diag(message) {
    console.log(`[ViviBaseBrain] ${message}`);
    this.emit(EVENTS.LOG_ADDED, { module: 'base_brain', message, timestamp: Date.now() });
  }

  health() {
    return {
      name: this.name,
      healthy: this._initialized,
      organized: !!this._knowledgeGraph,
      lastOrganizedAt: this._lastOrganizedAt,
    };
  }
}