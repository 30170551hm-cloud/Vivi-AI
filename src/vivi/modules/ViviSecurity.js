// ViviSecurity — Authentication and authorization gate.
// Checks user roles and founder status. Other modules ask security.isAuthorized()
// before performing privileged operations. Contains NO UI.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { authClient } from '@/lib/authClient';

export default class ViviSecurity extends ModuleBase {
  constructor(bus) {
    super('security', bus);
    this._user = null;
  }

  async init(registry) {
    await super.init(registry);
    await this.refresh();

    // Subscribe to auth state changes from authClient
    const unsubAuth = authClient.onAuthStateChanged(async (user) => {
      const oldUid = this._user?.id || this._user?.uid;
      const newUid = user?.id || user?.uid;
      
      this._user = user;
      
      if (oldUid !== newUid) {
        this._diag('Auth state changed, user ID transitioned', { oldUid, newUid });
        // Emit settings:updated with user_changed: true to trigger other modules to reload
        this.emit(EVENTS.SETTINGS_UPDATED, { user_changed: true, uid: newUid });
      }
    });
    this._unsubs.push(unsubAuth);

    // Re-check when settings are updated (user may have changed).
    this.subscribe(EVENTS.SETTINGS_UPDATED, (evt) => {
      if (evt && evt.user_changed) return;
      this.refresh();
    });
  }

  /** Refresh the current user from the auth backend. */
  async refresh() {
    this._user = await this.safe(() => authClient.me(), null);
    return this._user;
  }

  /** Is there an authenticated user? */
  isAuthenticated() {
    return !!this._user;
  }

  /** Does the user have founder or admin access? */
  isAuthorized() {
    return this._user && (this._user.is_founder || this._user.role === 'admin');
  }

  isFounder() {
    return this._user?.is_founder === true;
  }

  isAdmin() {
    return this._user?.role === 'admin';
  }

  getUser() {
    return this._user;
  }

  /** Check a specific permission (extensible for future granular roles). */
  can(action) {
    if (!this._user) return false;
    // Founder/admin can do everything.
    if (this.isAuthorized()) return true;
    // Regular users can perform these actions.
    const userActions = ['chat', 'voice', 'memory', 'settings'];
    return userActions.includes(action);
  }

  health() {
    return {
      name: this.name,
      healthy: this._initialized,
      authenticated: this.isAuthenticated(),
      authorized: this.isAuthorized(),
    };
  }
}