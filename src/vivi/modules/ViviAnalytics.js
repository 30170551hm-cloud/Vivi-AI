// ViviAnalytics — Event tracking and metrics.
// Listens to all meaningful events and forwards them to the analytics backend.
// Adding a new metric = subscribe to a new event here; no other module changes.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { backend as base44 } from '@/lib/backendClient';

export default class ViviAnalytics extends ModuleBase {
  constructor(bus) {
    super('analytics', bus);
    this._counters = {};
  }

  async init(registry) {
    await super.init(registry);

    // Track conversation flow.
    this.subscribe(EVENTS.VOICE_USER_SPEECH, () => this._track('user_message'));
    this.subscribe(EVENTS.CORE_REPLY, () => this._track('vivi_reply'));
    this.subscribe(EVENTS.VOICE_LISTENING_START, () => this._track('voice_session_start'));
    this.subscribe(EVENTS.VOICE_SPEAKING_START, () => this._track('tts_utterance'));

    // Track errors.
    this.subscribe(EVENTS.MODULE_ERROR, ({ module }) => {
      this._track('module_error', { module });
    });

    // Track memory usage.
    this.subscribe(EVENTS.MEMORY_STORED, () => this._track('memory_stored'));
  }

  /** Track a custom event. */
  track(eventName, properties = {}) {
    this._track(eventName, properties);
  }

  _track(eventName, properties = {}) {
    this._counters[eventName] = (this._counters[eventName] || 0) + 1;
    // Optional chaining — analytics may not be available in all backends
    this.safe(() => base44.analytics?.track({ eventName, properties }));
  }

  /** Get in-memory counters (useful for debugging / founder panel). */
  getCounters() {
    return { ...this._counters };
  }

  health() {
    return { name: this.name, healthy: this._initialized, events: Object.keys(this._counters).length };
  }
}