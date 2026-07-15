// ViviApi — External programmatic API surface.
// Allows external callers (workflows, webhooks, other apps) to interact with Vivi
// through a clean, versioned interface. This is the ONLY module an external system
// should import. It delegates to other modules via the registry.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';

export default class ViviApi extends ModuleBase {
  constructor(bus) {
    super('api', bus);
    this.version = '1.0.0';
  }

  async init(registry) {
    await super.init(registry);
  }

  /** Send a text message to Vivi (triggers the full conversation pipeline). */
  async sendMessage(text) {
    const core = this.registry?.get('core');
    if (!core) throw new Error('ViviCore is not available.');
    const result = await core.handleInput(text);
    const history = core.getHistory();
    return { reply: history[history.length - 1]?.content || '' };
  }

  /** Retrieve the current conversation history. */
  getConversation() {
    return this.registry?.get('core')?.getHistory() || [];
  }

  /** Get the current avatar visual state. */
  getAvatarState() {
    return this.registry?.get('avatar')?.getState() || 'idle';
  }

  /** Subscribe to an internal event (for external integrations). */
  on(event, handler) {
    return this.bus.on(event, handler);
  }

  /** Emit an event (for external triggers). */
  emit(event, payload) {
    this.bus.emit(event, payload);
  }

  /** Get health status of all modules. */
  getSystemHealth() {
    return this.registry?.healthCheck() || [];
  }

  /** Get the API version. */
  getVersion() {
    return this.version;
  }

  health() {
    return { name: this.name, healthy: this._initialized, version: this.version };
  }
}