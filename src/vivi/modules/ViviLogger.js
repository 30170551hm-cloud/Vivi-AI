// ViviLogger — Centralized error and event logging for the Founder.
// Captures module errors, voice errors, and security events in a ring buffer.
// The Founder panel reads from this module in real-time via LOG_ADDED events.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';

const MAX_LOGS = 200;

const LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
};

export default class ViviLogger extends ModuleBase {
  constructor(bus) {
    super('logger', bus);
    this._logs = [];
    this._onGlobalError = null;
    this._onUnhandledRejection = null;
  }

  async init(registry) {
    await super.init(registry);

    // Capture module-level errors.
    this.subscribe(EVENTS.MODULE_ERROR, ({ module, error, event }) => {
      this._add(LEVELS.ERROR, module || 'unknown', error || 'Unknown error', { event });
    });

    // Capture voice errors.
    this.subscribe(EVENTS.VOICE_ERROR, ({ error }) => {
      this._add(LEVELS.ERROR, 'voice', error || 'Voice error');
    });

    // Capture security access denials.
    this.subscribe(EVENTS.SECURITY_ACCESS_DENIED, ({ module, action }) => {
      this._add(LEVELS.WARN, module || 'security', `Acceso denegado: ${action || 'acción'}`);
    });

    // Capture uncaught browser errors.
    if (typeof window !== 'undefined') {
      this._onGlobalError = (event) => {
        this._add(LEVELS.ERROR, 'browser', event.message || 'Error no capturado', {
          filename: event.filename,
          line: event.lineno,
        });
      };
      this._onUnhandledRejection = (event) => {
        const reason = event.reason;
        this._add(LEVELS.ERROR, 'browser', reason?.message || String(reason), {
          type: 'unhandledrejection',
        });
      };
      window.addEventListener('error', this._onGlobalError);
      window.addEventListener('unhandledrejection', this._onUnhandledRejection);
    }
  }

  _add(level, module, message, extra = {}) {
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      ...extra,
    };
    this._logs.push(entry);
    if (this._logs.length > MAX_LOGS) this._logs.shift();
    this.emit(EVENTS.LOG_ADDED, entry);
  }

  /** Manually log an entry. */
  log(level, module, message, extra = {}) {
    this._add(level, module, message, extra);
  }

  /** Get all stored log entries (oldest first, newest last). */
  getLogs() {
    return [...this._logs];
  }

  /** Clear all logs. */
  clear() {
    this._logs = [];
    this.emit(EVENTS.LOG_CLEARED, null);
  }

  async destroy() {
    if (typeof window !== 'undefined') {
      if (this._onGlobalError) window.removeEventListener('error', this._onGlobalError);
      if (this._onUnhandledRejection) window.removeEventListener('unhandledrejection', this._onUnhandledRejection);
    }
    await super.destroy();
  }

  health() {
    return { name: this.name, healthy: this._initialized, logCount: this._logs.length };
  }
}

ViviLogger.LEVELS = LEVELS;