// EventBus — internal pub/sub system for decoupled module communication.
// Modules communicate exclusively through events; no direct imports between modules.

export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   * @param {string} event
   * @param {(payload: any) => void} handler
   * @returns {() => void} unsubscribe
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /** Subscribe to an event, auto-unsubscribe after first fire. */
  once(event, handler) {
    const unsub = this.on(event, (payload) => {
      unsub();
      handler(payload);
    });
    return unsub;
  }

  /** Remove a specific handler from an event. */
  off(event, handler) {
    const set = this._listeners.get(event);
    if (set) set.delete(handler);
  }

  /**
   * Emit an event. Each handler runs in isolation — one handler throwing
   * does not prevent the others from executing.
   */
  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    // Snapshot to array so handlers can safely unsubscribe during iteration.
    const handlers = Array.from(set);
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (err) {
        // Emit the error but never crash the bus.
        if (event !== 'module:error') {
          this.emit('module:error', { event, error: err.message });
        }
      }
    }
  }

  /** Remove all listeners (used in tests / teardown). */
  clear() {
    this._listeners.clear();
  }
}