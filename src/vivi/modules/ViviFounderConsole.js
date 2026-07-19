// ViviFounderConsole — Admin/Founder panel data and operations.
// Contains NO UI. The React page reads data from here.
// Access is gated by ViviSecurity; this module assumes the caller is authorized.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { FirestoreEntities } from '@/lib/firebaseEntities';

export default class ViviFounderConsole extends ModuleBase {
  constructor(bus) {
    super('founder_console', bus);
  }

  async init(registry) {
    await super.init(registry);
  }

  /** Gather aggregate stats for the dashboard. */
  async getStats() {
    const security = this.registry?.get('security');
    if (!security?.isAuthorized()) {
      this.emit(EVENTS.SECURITY_ACCESS_DENIED, { module: this.name, action: 'getStats' });
      return null;
    }

    const [users, memories, messages] = await Promise.all([
      this.safe(() => FirestoreEntities.User.list(), []),
      this.safe(() => FirestoreEntities.Memory.list(), []),
      this.safe(() => FirestoreEntities.ChatMessage.list(), []),
    ]);

    return {
      users: users?.length || 0,
      memories: memories?.length || 0,
      messages: messages?.length || 0,
    };
  }

  /** List all users (admin-only operation). */
  async listUsers() {
    const security = this.registry?.get('security');
    if (!security?.isAuthorized()) return [];
    return this.safe(() => FirestoreEntities.User.list(), []);
  }

  /** List all stored memories across all users. */
  async listMemories() {
    const security = this.registry?.get('security');
    if (!security?.isAuthorized()) return [];
    return this.safe(() => FirestoreEntities.Memory.list('-importance', 100), []);
  }

  health() {
    return { name: this.name, healthy: this._initialized };
  }
}