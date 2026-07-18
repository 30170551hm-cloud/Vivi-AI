// ViviFounderAuth — Founder recognition and memory restoration.
// When the founder logs in, this module:
//   1. Identifies the account automatically (via security + email match).
//   2. Restores authorized memory (projects, conversations, preferences).
//   3. Emits FOUNDER_RECOGNIZED so other modules can personalize the experience.
//
// This module does NOT contain UI or voice logic — it only detects and restores.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { firebaseAuthAdapter } from '@/firebase/firebaseAuthAdapter';

const envEmails = import.meta.env.VITE_FOUNDER_EMAILS
  ? import.meta.env.VITE_FOUNDER_EMAILS.split(',').map((e) => e.trim().toLowerCase())
  : [];

const FOUNDER_EMAILS = [
  ...envEmails,
  'henrrygarciarojas@gmail.com',
  'henrry.garcia@hryet.com',
  'hryet.venezuela@gmail.com',
];

export default class ViviFounderAuth extends ModuleBase {
  constructor(bus) {
    super('founder_auth', bus);
    this._isFounder = false;
    this._founderMemory = null;
    this._checked = false;
  }

  async init(registry) {
    await super.init(registry);
    await this.checkAndRestore();

    // Re-check when auth state changes.
    this.subscribe(EVENTS.SETTINGS_UPDATED, () => this.checkAndRestore());
  }

  /** Detect if the current authenticated user is the founder. */
  async checkAndRestore() {
    const security = this.registry?.get('security');
    const user = security?.getUser() || await this.safe(() => firebaseAuthAdapter.me(), null);

    if (!user) {
      this._isFounder = false;
      this._checked = true;
      return false;
    }

    const email = (user.email || '').toLowerCase().trim();
    const wasFounder = this._isFounder;
    this._isFounder = security?.isFounder() === true ||
      FOUNDER_EMAILS.includes(email) ||
      (user.role === 'admin' && user.is_founder !== false);

    this._checked = true;

    if (this._isFounder && !wasFounder) {
      this.emit(EVENTS.FOUNDER_RECOGNIZED, { user, email });
      this._log(`Founder reconocido: ${email}`);
      await this._restoreFounderMemory(user);
    }

    return this._isFounder;
  }

  /** Restore the founder's persistent memory on login. */
  async _restoreFounderMemory(user) {
    const memory = this.registry?.get('memory');
    if (!memory) return;

    try {
      await memory.recall();
      const context = await this.safe(() => memory.loadPermanentContext(), null);
      this._founderMemory = context;
      this.emit(EVENTS.FOUNDER_MEMORY_RESTORED, {
        user,
        memories: context?.memories?.length || 0,
        history: context?.history?.length || 0,
      });
      this._log(`Memoria del founder restaurada: ${context?.memories?.length || 0} recuerdos, ${context?.history?.length || 0} mensajes`);
    } catch (err) {
      this._log(`Error restaurando memoria: ${err.message}`);
    }
  }

  isFounder() {
    return this._isFounder;
  }

  getFounderMemory() {
    return this._founderMemory;
  }

  hasChecked() {
    return this._checked;
  }

  _log(message) {
    this.emit(EVENTS.LOG_ADDED, { module: this.name, message, timestamp: Date.now() });
  }

  health() {
    return {
      name: this.name,
      healthy: this._initialized,
      isFounder: this._isFounder,
      checked: this._checked,
    };
  }
}