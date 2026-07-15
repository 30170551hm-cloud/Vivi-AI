// ModuleBase — the contract every Vivi module follows.
// Provides lifecycle hooks, error isolation, and event helpers.
// Modules extend this and implement their own init/destroy logic.

import { safeJsonStringify } from '@/lib/utils';

export class ModuleBase {
  /**
   * @param {string} name — unique module identifier
   * @param {import('./EventBus').EventBus} bus
   */
  constructor(name, bus) {
    this.name = name;
    this.bus = bus;
    this.registry = null; // injected by ModuleRegistry during init
    this._initialized = false;
    this._unsubs = [];
  }

  /** Called by the registry after all modules are registered. Override in subclass. */
  async init(registry) {
    this.registry = registry;
    this._initialized = true;
    this.bus.emit('module:ready', { name: this.name });
  }

  /** Tear down listeners and resources. Override in subclass, call super. */
  async destroy() {
    this._unsubs.forEach((u) => {
      try { u(); } catch { /* noop */ }
    });
    this._unsubs = [];
    this._initialized = false;
  }

  /** Subscribe to an event; auto-tracked for cleanup on destroy. */
  subscribe(event, handler) {
    const unsub = this.bus.on(event, handler);
    this._unsubs.push(unsub);
    return unsub;
  }

  /** Emit an event on the bus. */
  emit(event, payload) {
    this.bus.emit(event, payload);
  }

  /**
   * Wrap an async operation with error isolation. On failure, emits
   * a module:error event and returns the fallback value instead of throwing.
   */
  async safe(fn, fallback = null) {
    try {
      return await fn();
    } catch (err) {
      const msg = err.message || String(err);
      const isAuthError = msg.includes('No hay usuario autenticado') || msg.includes('No hay sesión activa');
      const isAbortError = err.name === 'AbortError' || msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('cancel');
      
      if (isAbortError) {
        console.log(`[ModuleBase] Module "${this.name}" operation was cancelled/aborted.`);
        return fallback;
      }

      if (isAuthError) {
        console.warn(`[ModuleBase] Module "${this.name}" skipped operation: ${msg}`);
      } else {
        console.error(`[ModuleBase] Error in safe() inside module "${this.name}":`, err);
      }
      
      this.bus.emit('module:error', {
        module: this.name,
        error: msg,
        isAuthError,
      });
      return fallback;
    }
  }

  /** Synchronous variant of safe. */
  safeSync(fn, fallback = null) {
    try {
      return fn();
    } catch (err) {
      const msg = err.message || String(err);
      const isAuthError = msg.includes('No hay usuario autenticado') || msg.includes('No hay sesión activa');
      const isAbortError = err.name === 'AbortError' || msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('cancel');
      
      if (isAbortError) {
        console.log(`[ModuleBase] Module "${this.name}" sync operation was cancelled/aborted.`);
        return fallback;
      }

      if (isAuthError) {
        console.warn(`[ModuleBase] Module "${this.name}" skipped sync operation: ${msg}`);
      } else {
        console.error(`[ModuleBase] Error in safeSync() inside module "${this.name}":`, err);
      }
      
      this.bus.emit('module:error', {
        module: this.name,
        error: msg,
        isAuthError,
      });
      return fallback;
    }
  }

  /** Report module health status. */
  health() {
    return { name: this.name, healthy: this._initialized };
  }

  /** Diagnostic logs */
  _diag(message, data = null) {
    const prefix = `[${this.constructor.name || this.name}]`;
    console.log(prefix, message, data || '');
    try {
      this.emit('log:added', {
        module: this.name,
        message: data ? `${message} ${safeJsonStringify(data)}` : message,
        timestamp: Date.now()
      });
    } catch { /* noop */ }
  }

  _diagError(message, error = null) {
    const prefix = `[${this.constructor.name || this.name}]`;
    const errMsg = error?.message || String(error || 'Unknown error');
    console.error(prefix, message, error || '');
    try {
      this.emit('log:added', {
        module: this.name,
        message: `${message}: ${errMsg}`,
        level: 'error',
        timestamp: Date.now()
      });
    } catch { /* noop */ }
  }
}