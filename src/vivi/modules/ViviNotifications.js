// ViviNotifications — Centralized notification system.
// Supports browser notifications and in-app toast events.
// Any module can emit NOTIFICATION_SHOW; this module handles delivery.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';

export default class ViviNotifications extends ModuleBase {
  constructor(bus) {
    super('notifications', bus);
    this._permission = 'default';
  }

  async init(registry) {
    await super.init(registry);
    this._checkPermission();

    // Listen for notification requests from other modules.
    this.subscribe(EVENTS.NOTIFICATION_SHOW, ({ title, body, type = 'info' }) => {
      this.show(title, body, type);
    });
  }

  _checkPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    this._permission = Notification.permission;
  }

  /** Request browser notification permission. */
  async requestPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      this._permission = 'granted';
      return true;
    }
    const result = await Notification.requestPermission();
    this._permission = result;
    return result === 'granted';
  }

  /** Show a notification (browser + in-app toast via event). */
  show(title, body, type = 'info') {
    // Browser notification
    if (this._permission === 'granted' && typeof Notification !== 'undefined') {
      try {
        new Notification(title, { body });
      } catch { /* noop */ }
    }
    // In-app toast is handled by UI subscribers to NOTIFICATION_SHOW
    // (the original emitter's event). Do NOT re-emit here — that would
    // re-trigger this subscription and cause an infinite loop.
  }

  getPermission() {
    return this._permission;
  }

  health() {
    return { name: this.name, healthy: this._initialized, permission: this._permission };
  }
}