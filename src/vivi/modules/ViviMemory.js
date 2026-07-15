// ViviMemory — Persistent, intelligent memory store.
// Fully independent of the AI model — if you swap ViviCore's LLM, Memory is untouched.
//
// CAPABILITIES:
//   • Auto-loads permanent context on init (memories + conversation history)
//   • Organizes memories by category for structured prompt building
//   • Extracts facts autonomously from every conversation turn
//   • Recalls relevant context based on the current conversation topic
//   • Supports export/import for full memory portability
//   • Each user's memory is isolated by Base44 row-level security (created_by_id)

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { backend } from '@/lib/backendClient';
import { authClient } from '@/lib/authClient';
import { AI } from '@/lib/aiProvider';

const CATEGORY_LABELS = {
  name: 'Nombre',
  preference: 'Preferencias',
  work: 'Trabajo',
  company: 'Empresa',
  routine: 'Rutinas',
  goal: 'Metas',
  idea: 'Ideas',
  reminder: 'Recordatorios',
  calendar: 'Calendario',
  fact: 'Hechos',
  relationship: 'Relaciones personales',
  story: 'Chismes e historias',
  project: 'Proyectos',
  decision: 'Decisiones',
  document: 'Documentos',
  task: 'Tareas',
  milestone: 'Hitos importantes',
};

const EXTRACTION_CATEGORIES = [
  'name', 'preference', 'work', 'company', 'routine', 'goal', 'idea',
  'reminder', 'calendar', 'fact', 'relationship', 'story',
  'project', 'decision', 'document', 'task', 'milestone',
];

const MILESTONE_TYPES = [
  'achievement', 'decision', 'change', 'meeting', 'discovery',
  'commitment', 'loss', 'celebration', 'other',
];

export default class ViviMemory extends ModuleBase {
  constructor(bus) {
    super('memory', bus);
    this._cache = null;
    this._contextLoaded = false;
    this._stats = null;
  }

  async init(registry) {
    await super.init(registry);
    this.subscribe(EVENTS.SETTINGS_UPDATED, (evt) => {
      this._cache = null;
      if (evt && evt.user_changed) {
        this._diag('User changed, reloading permanent memory context...');
        this.loadPermanentContext();
      }
    });
    // Load permanent context immediately on init — every session starts
    // with the full memory of the user restored.
    this.loadPermanentContext();
  }

  // ════════════════════════════════════════════════════════════════════
  // PERMANENT CONTEXT — Auto-loaded on every session start
  // ════════════════════════════════════════════════════════════════════

  /**
   * Load the user's permanent memory on session start.
   * This is the backbone of conversation continuity — Vivi wakes up
   * already knowing who the user is, what they're working on, and
   * what they've discussed before.
   */
  async loadPermanentContext() {
    const memories = await this.safe(() => backend.entities.Memory.list('-importance', 200), []);
    this._cache = memories || [];
    this._computeStats();

    const history = await this.safe(() => this.recallConversationHistory(20), []);
    this._contextLoaded = true;

    this.emit(EVENTS.MEMORY_RECALLED, {
      count: this._cache.length,
      historyCount: history.length,
      contextLoaded: true,
    });

    this._diag(`Permanent context loaded: ${this._cache.length} memories, ${history.length} past messages`);
    return { memories: this._cache, history };
  }

  /** Check if the permanent context has been loaded for this session. */
  isContextLoaded() { return this._contextLoaded; }

  // ════════════════════════════════════════════════════════════════════
  // RECALL — Retrieve memories for the conversation prompt
  // ════════════════════════════════════════════════════════════════════

  /** Retrieve all memories, most important first. Cached per session. */
  async recall() {
    if (this._cache) return this._cache;
    const memories = await this.safe(() => backend.entities.Memory.list('-importance', 200), []);
    this._cache = memories || [];
    this._computeStats();
    this.emit(EVENTS.MEMORY_RECALLED, { count: this._cache.length });
    return this._cache;
  }

  /**
   * Recall memories relevant to the current conversation topic.
   * Uses keyword matching against memory values, keys, and tags.
   * Returns a ranked list of the most relevant memories.
   */
  async recallRelevant(query, limit = 15) {
    const all = await this.recall();
    if (!all || all.length === 0) return [];
    if (!query || query.trim().length < 3) return all.slice(0, limit);

    const words = query.toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.replace(/[^\wáéíóúñ]/gi, ''));

    const scored = all.map((mem) => {
      const text = `${mem.key || ''} ${mem.value || ''} ${(mem.tags || []).join(' ')}`.toLowerCase();
      let score = 0;
      for (const word of words) {
        if (text.includes(word)) score += 1;
      }
      // Boost by importance
      score += (mem.importance || 1) * 0.1;
      return { mem, score };
    });

    return scored
      .filter((s) => s.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.mem);
  }

  /**
   * Load recent conversation history from persisted ChatMessage records.
   * Restores the thread of past conversations across sessions.
   */
  async recallConversationHistory(limit = 20) {
    const messages = await this.safe(() => backend.entities.ChatMessage.list('-created_date', limit), []);
    if (!messages || messages.length === 0) return [];
    return messages.reverse().map((m) => ({ role: m.role, content: m.content }));
  }

  // ════════════════════════════════════════════════════════════════════
  // MILESTONE & DATE RECOVERY — Retrieve memories by date and relevance
  // ════════════════════════════════════════════════════════════════════

  /**
   * Retrieve all milestones, sorted by date (newest first) then importance.
   * Milestones are the key moments Vivi considers worth remembering.
   */
  async getMilestones(limit = 50) {
    const all = await this.recall();
    return (all || [])
      .filter((m) => m.is_milestone || m.category === 'milestone')
      .sort((a, b) => {
        // Sort by timeline_date (newest first), then by importance (highest first)
        const dateA = a.timeline_date || '';
        const dateB = b.timeline_date || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.importance || 1) - (a.importance || 1);
      })
      .slice(0, limit);
  }

  /**
   * Retrieve memories from a specific date or date range.
   * @param {string} startDate - ISO date string (YYYY-MM-DD)
   * @param {string} endDate - Optional end date (inclusive)
   * @param {number} limit - Max results
   */
  async recallByDate(startDate, endDate, limit = 50) {
    const all = await this.recall();
    if (!all || all.length === 0) return [];

    return all
      .filter((m) => {
        if (!m.timeline_date) return false;
        if (endDate) {
          return m.timeline_date >= startDate && m.timeline_date <= endDate;
        }
        return m.timeline_date === startDate;
      })
      .sort((a, b) => (b.importance || 1) - (a.importance || 1))
      .slice(0, limit);
  }

  /**
   * Retrieve memories from the last N days, sorted by relevance.
   * Combines recency + importance + keyword matching for fast context recovery.
   * @param {number} days - Number of days to look back
   * @param {string} query - Optional keyword filter
   * @param {number} limit - Max results
   */
  async recallRecent(days = 7, query = '', limit = 20) {
    const all = await this.recall();
    if (!all || all.length === 0) return [];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    let filtered = all.filter((m) => {
      const memDate = m.timeline_date || (m.created_date || '').split('T')[0];
      return memDate >= cutoffStr;
    });

    // If a query is provided, rank by relevance
    if (query && query.trim().length > 2) {
      const words = query.toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .map((w) => w.replace(/[^\wáéíóúñ]/gi, ''));

      filtered = filtered.map((mem) => {
        const text = `${mem.key || ''} ${mem.value || ''} ${(mem.tags || []).join(' ')}`.toLowerCase();
        let score = 0;
        for (const word of words) {
          if (text.includes(word)) score += 1;
        }
        score += (mem.importance || 1) * 0.2;
        if (mem.is_milestone) score += 0.5;
        return { mem, score };
      })
        .filter((s) => s.score > 0.2)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.mem);
    } else {
      // Sort by importance then date
      filtered = filtered
        .sort((a, b) => {
          const impDiff = (b.importance || 1) - (a.importance || 1);
          if (impDiff !== 0) return impDiff;
          const dateA = a.timeline_date || '';
          const dateB = b.timeline_date || '';
          return dateB.localeCompare(dateA);
        })
        .slice(0, limit);
    }

    return filtered;
  }

  /**
   * Get a chronological timeline of all dated memories.
   * Useful for "what happened when" queries.
   */
  async getTimeline(limit = 100) {
    const all = await this.recall();
    return (all || [])
      .filter((m) => m.timeline_date)
      .sort((a, b) => {
        const dateA = a.timeline_date || '';
        const dateB = b.timeline_date || '';
        return dateB.localeCompare(dateA); // newest first
      })
      .slice(0, limit);
  }

  /**
   * Quick search: find memories matching a keyword, ranked by relevance + date.
   * This is the fast path for "do you remember when..." queries.
   */
  async search(query, limit = 15) {
    if (!query || query.trim().length < 2) return [];
    const all = await this.recall();
    if (!all || all.length === 0) return [];

    const words = query.toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.replace(/[^\wáéíóúñ]/gi, ''));

    return all.map((mem) => {
      const text = `${mem.key || ''} ${mem.value || ''} ${(mem.tags || []).join(' ')}`.toLowerCase();
      let score = 0;
      for (const word of words) {
        if (text.includes(word)) score += 1;
      }
      score += (mem.importance || 1) * 0.15;
      if (mem.is_milestone) score += 0.4;
      return { mem, score };
    })
      .filter((s) => s.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.mem);
  }

  // ════════════════════════════════════════════════════════════════════
  // CONTEXT BUILDING — Structured prompt context for the LLM
  // ════════════════════════════════════════════════════════════════════

  /**
   * Build a rich, structured context block for the conversation prompt.
   * Groups memories by category so Vivi has an organized view of everything
   * she knows about the user — projects, goals, tasks, preferences, etc.
   */
  buildContextBlock(user) {
    const memories = this._cache || [];
    const lines = [];

    if (user?.display_name) {
      lines.push(`Nombre del usuario: ${user.display_name}`);
    }

    // Group memories by category
    const byCat = {};
    for (const m of memories) {
      const cat = m.category || 'fact';
      (byCat[cat] = byCat[cat] || []).push(m);
    }

    // ── Hitos importantes (milestones) — shown first, with dates ──
    const milestones = memories.filter((m) => m.is_milestone || m.category === 'milestone');
    if (milestones.length > 0) {
      const sortedMilestones = [...milestones].sort((a, b) => {
        const dateA = a.timeline_date || '';
        const dateB = b.timeline_date || '';
        return dateB.localeCompare(dateA);
      });
      lines.push('[Hitos importantes]');
      for (const m of sortedMilestones.slice(0, 15)) {
        const date = m.timeline_date ? `${m.timeline_date} — ` : '';
        const type = m.milestone_type ? `(${m.milestone_type}) ` : '';
        const key = m.key ? `${m.key}: ` : '';
        lines.push(`  • ${date}${type}${key}${m.value}`);
      }
    }

    // Render each category group with status where relevant
    const structuredCats = ['project', 'goal', 'task', 'decision', 'idea', 'document'];
    const personalCats = ['name', 'preference', 'work', 'company', 'routine', 'reminder', 'calendar', 'fact', 'relationship', 'story'];

    // Structured items first (projects, goals, tasks)
    for (const cat of structuredCats) {
      const items = byCat[cat];
      if (!items || items.length === 0) continue;
      const label = CATEGORY_LABELS[cat] || cat;
      const itemLines = items.map((m) => {
        const status = m.status && m.status !== 'active' ? ` [${m.status}]` : '';
        const date = m.timeline_date ? ` (${m.timeline_date})` : '';
        const key = m.key ? `${m.key}: ` : '';
        return `  • ${key}${m.value}${status}${date}`;
      });
      lines.push(`[${label}]`);
      lines.push(itemLines.join('\n'));
    }

    // Personal context
    for (const cat of personalCats) {
      const items = byCat[cat];
      if (!items || items.length === 0) continue;
      const label = CATEGORY_LABELS[cat] || cat;
      const values = items.map((m) => {
        const date = m.timeline_date ? ` (${m.timeline_date})` : '';
        return m.key ? `${m.key}: ${m.value}${date}` : `${m.value}${date}`;
      });
      lines.push(`[${label}]: ${values.join('; ')}`);
    }

    return lines.length > (user?.display_name ? 1 : 0)
      ? lines.join('\n')
      : 'Aún no hay datos memorizados sobre el usuario.';
  }

  /**
   * Get a brief summary of active projects, goals, and tasks.
   * Used by ViviCore to give Vivi a quick overview of what's in progress.
   */
  getActiveContextSummary() {
    const memories = this._cache || [];
    const active = memories.filter((m) =>
      ['project', 'goal', 'task'].includes(m.category) &&
      (!m.status || m.status === 'active')
    );
    if (active.length === 0) return '';
    return active
      .slice(0, 10)
      .map((m) => `${CATEGORY_LABELS[m.category] || m.category}: ${m.key || m.value}`)
      .join('; ');
  }

  // ════════════════════════════════════════════════════════════════════
  // CRUD — Store, update, forget
  // ════════════════════════════════════════════════════════════════════

  /** Store a new memory. */
  async store({ category, key, value, importance = 1, status, tags, timeline_date, is_milestone, milestone_type, conversation_ref }) {
    const record = await this.safe(() =>
      backend.entities.Memory.create({
        category, key, value,
        importance,
        status: status || 'active',
        tags: tags || [],
        timeline_date: timeline_date || undefined,
        is_milestone: is_milestone || false,
        milestone_type: milestone_type || undefined,
        conversation_ref: conversation_ref || undefined,
      })
    );
    if (record) {
      this._cache = null;
      this.emit(EVENTS.MEMORY_STORED, record);
    }
    return record;
  }

  /** Update an existing memory. */
  async update(id, patch) {
    const record = await this.safe(() => backend.entities.Memory.update(id, patch));
    if (record) {
      this._cache = null;
      this._computeStats();
      this.emit(EVENTS.MEMORY_STORED, record);
    }
    return record;
  }

  /** Delete a memory by id. */
  async forget(id) {
    await this.safe(() => backend.entities.Memory.delete(id));
    this._cache = null;
    this._computeStats();
  }

  /** Delete all memories (full reset). */
  async forgetAll() {
    await this.safe(() => backend.entities.Memory.deleteMany({}));
    this._cache = [];
    this._computeStats();
  }

  /** List all memories for the admin panel. */
  async listAll() {
    const memories = await this.safe(() => backend.entities.Memory.list('-created_date', 500), []);
    return memories || [];
  }

  // ════════════════════════════════════════════════════════════════════
  // EXPORT / IMPORT — Full memory portability
  // ════════════════════════════════════════════════════════════════════

  /** Export all memories as a JSON-serializable object. */
  async exportMemory() {
    const memories = await this.listAll();
    return {
      version: 1,
      exported_at: new Date().toISOString(),
      count: memories.length,
      memories: memories.map((m) => ({
        category: m.category,
        key: m.key,
        value: m.value,
        importance: m.importance,
        status: m.status,
        tags: m.tags,
        timeline_date: m.timeline_date,
        created_date: m.created_date,
      })),
    };
  }

  /** Import memories from a JSON object. Appends to existing memories. */
  async importMemory(data) {
    if (!data?.memories || !Array.isArray(data.memories)) {
      throw new Error('Formato de importación inválido');
    }
    const records = data.memories
      .filter((m) => m.category && m.value)
      .map((m) => ({
        category: m.category,
        key: m.key || '',
        value: m.value,
        importance: typeof m.importance === 'number' ? Math.max(1, Math.min(5, m.importance)) : 2,
        status: m.status || 'active',
        tags: Array.isArray(m.tags) ? m.tags : [],
        timeline_date: m.timeline_date || undefined,
      }));
    if (records.length === 0) return { imported: 0 };
    const created = await this.safe(() => backend.entities.Memory.bulkCreate(records), []);
    this._cache = null;
    this._computeStats();
    return { imported: created?.length || 0 };
  }

  // ════════════════════════════════════════════════════════════════════
  // STATS — For the admin panel
  // ════════════════════════════════════════════════════════════════════

  _computeStats() {
    const memories = this._cache || [];
    const byCat = {};
    let activeGoals = 0;
    let activeTasks = 0;
    let activeProjects = 0;

    for (const m of memories) {
      const cat = m.category || 'fact';
      byCat[cat] = (byCat[cat] || 0) + 1;
      if ((!m.status || m.status === 'active')) {
        if (cat === 'goal') activeGoals++;
        if (cat === 'task') activeTasks++;
        if (cat === 'project') activeProjects++;
      }
    }

    let milestones = 0;
    for (const m of memories) {
      if (m.is_milestone || m.category === 'milestone') milestones++;
    }

    this._stats = {
      total: memories.length,
      byCategory: byCat,
      activeGoals,
      activeTasks,
      activeProjects,
      milestones,
    };
  }

  getStats() {
    if (!this._stats) this._computeStats();
    return this._stats;
  }

  getCategoryLabel(cat) { return CATEGORY_LABELS[cat] || cat; }
  getCategoryLabels() { return { ...CATEGORY_LABELS }; }

  // ════════════════════════════════════════════════════════════════════
  // AUTO-EXTRACTION — Learn from every conversation turn
  // ════════════════════════════════════════════════════════════════════

  /**
   * Automatic LLM-powered extraction of facts worth remembering.
   * Runs on EVERY conversation turn — Core calls this after generating a reply.
   * The LLM analyzes the conversation and extracts structured memories:
   * names, preferences, work, routines, goals, ideas, projects, tasks, decisions, etc.
   */
  async maybeExtract(userText, viviReply) {
    if (!userText || userText.trim().length < 2) return;

    // Fast path: name extraction (no LLM needed — instant + reliable)
    const nameMatch = userText.match(/(?:me llamo|mi nombre es|soy)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]{2,20})/i);
    if (nameMatch) {
      const name = nameMatch[1];
      try {
        await authClient.updateMe({ display_name: name });
        const settings = this.registry?.get('settings');
        if (settings) settings.refresh();
        this.emit(EVENTS.SETTINGS_UPDATED, { display_name: name });
      } catch { /* non-critical */ }
    }

    // LLM-powered extraction
    try {
      const todayISO = new Date().toISOString().split('T')[0];
      const response = await AI.InvokeLLM({
        isBackground: true,
        prompt: `Analiza esta conversación y extrae TODA la información personal digna de recordar sobre el usuario.

Fecha de hoy: ${todayISO}

Conversación:
Usuario: ${userText}
Vivi: ${viviReply || ''}

Extrae memories para: nombre, preferencias (gustos/disgustos), trabajo/profesión, empresa, rutinas diarias, objetivos/metas, ideas/proyectos, recordatorios, eventos/calendario, hechos importantes, relaciones personales (pareja, familia, amigos, compañeros), ubicación, habilidades, cumpleaños, fechas importantes, proyectos activos (con estado), tareas pendientes (con estado), decisiones tomadas, documentos importantes.

IMPORTANTE — CAPTURA CHISMES Y HISTORIAS PERSONALES:
- Si el usuario cuenta algo personal, una anécdota, un chisme, o una historia, guárdalo como "story".
- Si menciona a alguien con quien tiene relación (pareja, amigo, jefe, familiar), guárdalo como "relationship" con el nombre y la relación.
- Si hay un tema recurrente o algo que el usuario claramente quiere retomar después, guárdalo.

IMPORTANTE — PROYECTOS, METAS Y TAREAS:
- Si el usuario menciona un proyecto en el que está trabajando, guárdalo como "project" con un estado (active/completed/paused/abandoned).
- Si el usuario menciona una meta u objetivo, guárdalo como "goal" con estado.
- Si el usuario menciona una tarea pendiente, guárdalo como "task" con estado.
- Si el usuario tomó una decisión, guárdalo como "decision".

IMPORTANTE — HITOS Y FECHAS:
- Si el usuario menciona un logro, un cambio importante, un compromiso, un descubrimiento, una reunión clave, una celebración o una pérdida, márcalo como HITO.
- Para hitos: usa "is_milestone": true, "milestone_type" (achievement/decision/change/meeting/discovery/commitment/loss/celebration/other), y "importance" mínimo 4.
- SIEMPRE que se mencione una fecha (explícita o implícita como "ayer", "la semana pasada", "mañana"), incluye "timeline_date" en formato YYYY-MM-DD. Si dice "hoy", usa ${todayISO}.
- Los hitos deben tener timeline_date para poder recuperarlos cronológicamente.

REGLAS:
- Solo extrae información REAL y específica del usuario, no genérica.
- Si el usuario solo saluda, hace preguntas triviales, o no revela información personal, devuelve lista vacía.
- Cada memory debe ser concisa y específica.
- "importance": 1=trivial, 3=normal, 5=critico (nombre, cumpleaños, alergias, relaciones cercanas, proyectos clave, hitos).
- "tags": añade tags relevantes para cruzar información (ej: ["trabajo", "urgente"], ["familia", "vacaciones"]).
- "timeline_date": formato YYYY-MM-DD. Inclúyelo siempre que haya una fecha mencionada o implícita.`,
        response_json_schema: {
          type: 'object',
          properties: {
            memories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string', enum: EXTRACTION_CATEGORIES },
                  key: { type: 'string', description: 'Etiqueta corta descriptiva' },
                  value: { type: 'string', description: 'El contenido a recordar, en el idioma del usuario' },
                  importance: { type: 'number', description: '1-5, donde 5 es crítico' },
                  status: { type: 'string', enum: ['active', 'completed', 'paused', 'abandoned'], description: 'Estado para proyectos, metas, tareas y decisiones' },
                  tags: { type: 'array', items: { type: 'string' }, description: 'Tags para cruzar información' },
                  timeline_date: { type: 'string', description: 'Fecha YYYY-MM-DD cuando ocurrió o ocurrirá' },
                  is_milestone: { type: 'boolean', description: 'True si es un hito o evento clave' },
                  milestone_type: { type: 'string', enum: MILESTONE_TYPES, description: 'Tipo de hito' }
                },
                required: ['category', 'value']
              }
            }
          },
          required: ['memories']
        }
      });

      if (response?.memories && Array.isArray(response.memories) && response.memories.length > 0) {
        for (const mem of response.memories) {
          if (mem.value && mem.category) {
            await this.store({
              category: mem.category,
              key: mem.key || '',
              value: mem.value,
              importance: typeof mem.importance === 'number' ? Math.max(1, Math.min(5, mem.importance)) : 2,
              status: mem.status || 'active',
              tags: Array.isArray(mem.tags) ? mem.tags : [],
              timeline_date: mem.timeline_date || undefined,
              is_milestone: mem.is_milestone || false,
              milestone_type: mem.milestone_type || undefined,
            });
          }
        }
        this._diag(`Auto-learned ${response.memories.length} memories from conversation`);
      }
    } catch (err) {
      this._diagError('Auto-extraction failed', err?.message);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // DIAGNOSTICS
  // ════════════════════════════════════════════════════════════════════

  _diag(message) {
    console.log(`[ViviMemory] ${message}`);
    this.emit(EVENTS.LOG_ADDED, { module: 'memory', message, timestamp: Date.now() });
  }

  _diagError(message, error) {
    const errMsg = error?.message || String(error || 'Unknown error');
    console.error(`[ViviMemory] ${message}`, error || '');
    this.emit(EVENTS.LOG_ADDED, { module: 'memory', message: `${message}: ${errMsg}`, level: 'error', timestamp: Date.now() });
  }

  health() {
    return {
      name: this.name,
      healthy: this._initialized,
      cached: this._cache?.length || 0,
      contextLoaded: this._contextLoaded,
      stats: this._stats,
    };
  }
}