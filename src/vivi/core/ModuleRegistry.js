// ModuleRegistry — manages module lifecycle.
// Modules can be registered, initialized, replaced, or destroyed independently
// without affecting the others.

import { EventBus } from './EventBus';

export class ModuleRegistry {
  constructor(bus) {
    this.bus = bus || new EventBus();
    this._modules = new Map();
  }

  /** Register a module instance. Returns the module for chaining. */
  register(module) {
    if (this._modules.has(module.name)) {
      throw new Error(`Module "${module.name}" is already registered.`);
    }
    this._modules.set(module.name, module);
    return module;
  }

  /** Initialize all registered modules in registration order. */
  async initAll() {
    for (const [name, mod] of this._modules) {
      try {
        await mod.init(this);
      } catch (err) {
        this.bus.emit('module:error', { module: name, error: err.message });
      }
    }
  }

  /** Get a module by name (returns null if not found). */
  get(name) {
    return this._modules.get(name) || null;
  }

  /** Check if a module is registered. */
  has(name) {
    return this._modules.has(name);
  }

  /** List all module names. */
  list() {
    return Array.from(this._modules.keys());
  }

  /** Get all registered module instances (for diagnostics). */
  getAll() {
    return Array.from(this._modules.values());
  }

  /** Health check across all modules. */
  healthCheck() {
    const results = [];
    for (const [name, mod] of this._modules) {
      results.push(mod.health());
    }
    return results;
  }

  /**
   * Hot-swap a module: destroy the old one, register and init the new one.
   * Other modules are unaffected — they communicate via events, not references.
   */
  async swap(name, newModule) {
    const old = this._modules.get(name);
    if (old) await old.destroy();
    this._modules.delete(name);
    this.register(newModule);
    await newModule.init(this);
    return newModule;
  }

  /** Destroy all modules and clear the registry. */
  async destroyAll() {
    for (const [, mod] of this._modules) {
      try { await mod.destroy(); } catch { /* noop */ }
    }
    this._modules.clear();
  }
}