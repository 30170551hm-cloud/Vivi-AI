// ViviIntegrations — Registry for external service connectors.
// Each integration (Google Calendar, Gmail, Spotify, etc.) registers here.
// Modules request an integration by name; Integrations handles the OAuth lifecycle.
// Adding a new service = register it here; no other module changes.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';

// Registry of available integrations. Each has a connector type (for OAuth)
// and a friendly name. Actual connections are authorized separately.
const AVAILABLE = {
  google_calendar: { type: 'googlecalendar', label: 'Google Calendar' },
  gmail: { type: 'gmail', label: 'Gmail' },
  google_drive: { type: 'googledrive', label: 'Google Drive' },
  spotify: { type: null, label: 'Spotify' },
  weather: { type: null, label: 'Weather' },
};

export default class ViviIntegrations extends ModuleBase {
  constructor(bus) {
    super('integrations', bus);
    this._connected = new Set();
  }

  async init(registry) {
    await super.init(registry);
  }

  /** List all available integrations with their connection status. */
  listAvailable() {
    return Object.entries(AVAILABLE).map(([key, def]) => ({
      key,
      ...def,
      connected: this._connected.has(key),
    }));
  }

  /** Mark an integration as connected (after OAuth flow completes). */
  markConnected(key) {
    this._connected.add(key);
  }

  /** Mark an integration as disconnected. */
  markDisconnected(key) {
    this._connected.delete(key);
  }

  /** Check if an integration is connected. */
  isConnected(key) {
    return this._connected.has(key);
  }

  /**
   * Request OAuth authorization for a connector-backed integration.
   * Delegates to the Base44 OAuth flow (handled by the platform layer).
   */
  getConnectorType(key) {
    return AVAILABLE[key]?.type || null;
  }

  health() {
    return {
      name: this.name,
      healthy: this._initialized,
      connected: Array.from(this._connected),
    };
  }
}