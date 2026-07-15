// ViviConversationEngine — Conversation context management.
// Handles:
//   - Topic detection and tracking
//   - Context recovery for long conversations
//   - Topic change detection
//   - Conversation summarization
//
// This module does NOT generate replies — it provides context intelligence
// that ViviCore uses to maintain coherent, long, natural conversations.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { AI } from '@/lib/aiProvider';

const TOPIC_KEYWORDS = {
  trabajo: ['trabajo', 'oficina', 'proyecto', 'jefe', 'compa[ñn]ero', 'reunion', 'tarea'],
  personal: ['familia', 'amigo', 'pareja', 'hijo', 'madre', 'padre', 'hermano'],
  salud: ['salud', 'doctor', 'enfermo', 'gym', 'ejercicio', 'dieta', 'sueno'],
  finanzas: ['dinero', 'pago', 'banco', 'inversion', 'dolar', 'bs', 'sueldo', 'gasto'],
  tecnologia: ['codigo', 'programa', 'app', 'computadora', 'telefono', 'internet', 'sistema'],
  ocio: ['pelicula', 'serie', 'musica', 'juego', 'videojuego', 'vacaciones', 'viaje'],
  comida: ['comida', 'almuerzo', 'cena', 'desayuno', 'restaurante', 'receta', 'comprar'],
};

export default class ViviConversationEngine extends ModuleBase {
  constructor(bus) {
    super('conversation_engine', bus);
    this._currentTopic = 'general';
    this._topicHistory = [];
    this._turnCount = 0;
  }

  async init(registry) {
    await super.init(registry);
    this.subscribe(EVENTS.VOICE_USER_SPEECH, (text) => this.trackTurn(text));
  }

  /** Track a conversation turn and detect topic. */
  trackTurn(userText) {
    if (!userText) return;
    this._turnCount++;

    const newTopic = this.detectTopic(userText);
    if (newTopic !== this._currentTopic && newTopic !== 'general') {
      this._topicHistory.push({ from: this._currentTopic, to: newTopic, turn: this._turnCount, timestamp: Date.now() });
      this._currentTopic = newTopic;
      this.emit(EVENTS.CONVERSATION_TOPIC, { topic: newTopic, previous: this._topicHistory.slice(-1)[0]?.from });
    }
  }

  /** Detect the conversation topic from user text. */
  detectTopic(text) {
    if (!text) return 'general';
    const lower = text.toLowerCase();

    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      for (const kw of keywords) {
        const regex = new RegExp(kw, 'i');
        if (regex.test(lower)) return topic;
      }
    }
    return 'general';
  }

  /** Summarize a long conversation history to preserve context. */
  async summarize(history, lang = 'es-ES') {
    if (!history || history.length < 6) return null;

    const historyText = history
      .slice(-20)
      .map((m) => `${m.role === 'user' ? 'Usuario' : 'Vivi'}: ${m.content}`)
      .join('\n');

    const summary = await this.safe(() =>
      AI.InvokeLLM({
        prompt: `Resume esta conversación en ${lang} en 3-5 puntos clave. Incluye temas principales, decisiones tomadas y información personal mencionada.

Conversación:
${historyText}

Devuelve un JSON con:
- summary: resumen breve en texto natural
- key_points: lista de puntos importantes
- open_topics: temas que quedaron pendientes`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            key_points: { type: 'array', items: { type: 'string' } },
            open_topics: { type: 'array', items: { type: 'string' } },
          },
          required: ['summary', 'key_points', 'open_topics'],
        },
      }),
      null
    );

    this.emit(EVENTS.CONVERSATION_CONTEXT, { summary: summary?.summary, turn: this._turnCount });
    return summary;
  }

  /** Get the current conversation topic. */
  getCurrentTopic() {
    return this._currentTopic;
  }

  /** Get topic change history. */
  getTopicHistory() {
    return [...this._topicHistory];
  }

  /** Get the conversation turn count. */
  getTurnCount() {
    return this._turnCount;
  }

  /** Was there a topic change recently? */
  hadTopicChange() {
    const last = this._topicHistory[this._topicHistory.length - 1];
    if (!last) return false;
    return Date.now() - last.timestamp < 30000; // within 30 seconds
  }

  health() {
    return {
      name: this.name,
      healthy: this._initialized,
      topic: this._currentTopic,
      turns: this._turnCount,
    };
  }
}