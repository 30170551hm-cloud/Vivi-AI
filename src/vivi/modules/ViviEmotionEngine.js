// ViviEmotionEngine — Dedicated emotion management.
// Tracks Vivi's current emotional state, manages transitions, and maps
// emotions to voice parameters and avatar visuals.
//
// Emotions influence ONLY communication style, never reasoning logic.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { normalizeEmotion, EMOTION_VOICE, EMOTION_AURA, EMOTION_EMOJI, EMOTION_LABEL } from '../emotionConfig';

export default class ViviEmotionEngine extends ModuleBase {
  constructor(bus) {
    super('emotion_engine', bus);
    this._current = 'neutral';
    this._previous = 'neutral';
    this._history = [];
  }

  async init(registry) {
    await super.init(registry);

    // Listen for emotion directives from core/LLM (when Vivi replies).
    this.subscribe(EVENTS.AVATAR_EMOTION, (emotion) => this.setEmotion(emotion));

    // ── REAL-TIME emotion tracking ──
    // Vivi's face reacts DYNAMICALLY while the user speaks, not just when she replies.
    // This creates a live, responsive conversation partner.
    //
    // FLOW:
    //   listening → attention (curiosa) by default
    //   user speaks interim → tone detected from words → face shifts in real-time
    //   thinking → reflection (concentrada)
    //   speaking → LLM-provided emotion (feliz, divertida, etc.)

    // When listening starts → show ATTENTION expression
    this.subscribe(EVENTS.VOICE_LISTENING_START, () => {
      this.setEmotion('curiosa');
    });

    // Interim speech results → detect tone from what the user is saying RIGHT NOW
    // This makes Vivi's face react as the user talks, not after.
    this.subscribe(EVENTS.VOICE_INTERIM, (text) => {
      if (!text) return;
      const detected = this.detectFromText(text);
      if (detected !== 'neutral') {
        this.setEmotion(detected);
      }
    });

    // When Vivi starts thinking → show REFLECTION expression
    this.subscribe(EVENTS.CORE_THINKING, () => {
      this.setEmotion('concentrada');
    });
  }

  /**
   * Set the current emotion with validation and transition tracking.
   * Emits AVATAR_EMOTION so the UI updates in real-time — this is the
   * single source of truth for Vivi's facial expression.
   */
  setEmotion(emotion) {
    const normalized = normalizeEmotion(emotion);
    if (normalized === this._current) return;

    this._previous = this._current;
    this._current = normalized;
    this._history.push({ emotion: normalized, timestamp: Date.now() });
    if (this._history.length > 50) this._history = this._history.slice(-50);

    this.emit(EVENTS.AVATAR_EMOTION, normalized);
    this.emit(EVENTS.EMOTION_CHANGE, { current: this._current, previous: this._previous });
  }

  /** Get the current emotion. */
  getEmotion() {
    return this._current;
  }

  /** Get voice parameters for the current emotion. */
  getVoiceParams() {
    return EMOTION_VOICE[this._current] || EMOTION_VOICE.neutral;
  }

  /** Get visual config (aura color, emoji, label) for the current emotion. */
  getVisualConfig() {
    return {
      aura: EMOTION_AURA[this._current] || EMOTION_AURA.neutral,
      emoji: EMOTION_EMOJI[this._current] || null,
      label: EMOTION_LABEL[this._current] || '',
    };
  }

  /**
   * Detect emotion from text using heuristics (fast, no LLM call).
   * Tuned for REAL-TIME detection during conversation — reacts to the user's
   * tone as they speak, mapping to three core expressions:
   *   🟢 FELICIDAD (feliz/divertida) — joy, excitement, humor
   *   🟣 REFLEXIÓN (concentrada/curiosa) — deep thought, questioning, analysis
   *   🔵 ATENCIÓN (curiosa/sorprendida) — interest, surprise, engagement
   */
  detectFromText(text) {
    if (!text) return 'neutral';
    const lower = text.toLowerCase();

    // ── FELICIDAD — joy, laughter, excitement ──
    if (/[!]{2,}|jajaj|jejej|jijij|jajaj|🤣|😂|😀|😄|😍|divertid|chist|grac|risa|s[ií] súper|what/i.test(lower)) return 'divertida';
    if (/(feliz|alegr|ch[eé]vere|genial|excelente|buen[ií]simo|fant[aá]stico|emocionad|incre[ií]ble|wow|guau|qu[eé] ch[oé]vere|me encanta|súper bien)/i.test(lower)) return 'feliz';

    // ── ATENCIÓN — surprise, interest, engagement ──
    if (/(no me digas|en serio|de verdad|c[oó]mo|qu[eé] cosa|asombro|sorprend|increible|no sab[ií]a|ah s[ií]|epa|ah bueno)/i.test(lower)) return 'sorprendida';
    if (/(curios|interesa|quiero saber|cu[eé]ntame|c[oó]mo funciona|por qu[eé]|qu[ié]n es|d[oó]nde|cu[aá]ndo|qu[eé] significa)/i.test(lower)) return 'curiosa';

    // ── REFLEXIÓN — deep thought, analysis, questioning ──
    if (/(analiz|estud|concentr|pensand|calcul|verific|comprob|repas|evalu[oó]|consider|reflexion|medit|entender|comprender)/i.test(lower)) return 'concentrada';
    if (/(tal vez|puede ser|no s[eé]|dud|no estoy segur|pienso|creo que|me parece)/i.test(lower)) return 'preocupada';

    // ── Negative emotions ──
    if (/(triste|pena|lamento|dif[ií]cil|duro|feo|mala noticia|perd[ió]o|fallec|muri|deprim)/i.test(lower)) return 'triste';
    if (/(enojad|molest|furios|cabread|hastiad|irritad|col[eé]rico|verga|coño|pela|hijueputa|pendejo|comemierda)/i.test(lower)) return 'enojada';
    if (/(preocup|inquiet|ansios|mied|nervios|angustiad|desesperad)/i.test(lower)) return 'preocupada';

    return 'neutral';
  }

  getHistory() {
    return [...this._history];
  }

  health() {
    return { name: this.name, healthy: this._initialized, current: this._current };
  }
}