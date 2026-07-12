// ViviSettings — User preferences management.
// Reads/writes to the User entity via auth.updateMe.
// Independent: Core reads language from here; Voice reads language from here.
// If Settings is swapped, Core and Voice fall back to defaults.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { authClient } from '@/lib/authClient';

const DEFAULTS = {
  display_name: '',
  preferred_language: 'auto',
  voice_enabled: true,
  is_founder: false,
  voice_name: '',
  voice_rate: 0.85,
  voice_pitch: 1.0,
  voice_volume: 1.0,
  precise_mode: true,
};

export default class ViviSettings extends ModuleBase {
  constructor(bus) {
    super('settings', bus);
    this._user = null;
    this._prefs = { ...DEFAULTS };
  }

  async init(registry) {
    await super.init(registry);
    await this.refresh();
  }

  /** Fetch the current user and their preferences. */
  async refresh() {
    this._user = await this.safe(() => authClient.me(), null);
    if (this._user) {
      this._prefs = {
        display_name: this._user.display_name || DEFAULTS.display_name,
        preferred_language: this._user.preferred_language || DEFAULTS.preferred_language,
        voice_enabled: this._user.voice_enabled !== false,
        is_founder: this._user.is_founder || false,
        voice_name: this._user.voice_name ?? DEFAULTS.voice_name,
        voice_rate: this._user.voice_rate ?? DEFAULTS.voice_rate,
        voice_pitch: this._user.voice_pitch ?? DEFAULTS.voice_pitch,
        voice_volume: this._user.voice_volume ?? DEFAULTS.voice_volume,
        precise_mode: this._user.precise_mode !== false,
      };
    }
    this.emit(EVENTS.SETTINGS_UPDATED, this._prefs);
    return this._prefs;
  }

  /** Update a preference and persist to the user entity. */
  async update(patch) {
    const updated = await this.safe(() => authClient.updateMe(patch), null);
    if (updated) {
      this._user = updated;
      Object.assign(this._prefs, patch);
      this.emit(EVENTS.SETTINGS_UPDATED, this._prefs);

      // Notify Voice module if language changed.
      if (patch.preferred_language) {
        const voice = this.registry?.get('voice');
        if (voice) voice.setLanguage(this.getLanguage());
      }
    }
    return this._prefs;
  }

  /** Resolve the effective language ('auto' → 'es-ES'). */
  getLanguage() {
    const lang = this._prefs.preferred_language;
    return lang && lang !== 'auto' ? lang : 'es-ES';
  }

  getPrefs() {
    return { ...this._prefs };
  }

  /** Voice configuration subset (consumed by ViviVoice). */
  getVoiceConfig() {
    return {
      name: this._prefs.voice_name,
      rate: this._prefs.voice_rate,
      pitch: this._prefs.voice_pitch,
      volume: this._prefs.voice_volume,
    };
  }

  getUser() {
    return this._user;
  }

  isFounder() {
    return this._prefs.is_founder || this._user?.role === 'admin';
  }
}