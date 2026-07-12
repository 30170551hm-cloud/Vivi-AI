// Basic tests for the ModuleRegistry and ModuleBase.
// Run via: import and call runRegistryTests().

import { EventBus } from '../core/EventBus';
import { ModuleBase } from '../core/ModuleBase';
import { ModuleRegistry } from '../core/ModuleRegistry';
import { EVENTS } from '../events';

// A minimal test module.
class TestModule extends ModuleBase {
  constructor(bus, name = 'test') {
    super(name, bus);
    this.initCalled = false;
    this.destroyCalled = false;
  }
  async init(registry) {
    await super.init(registry);
    this.initCalled = true;
  }
  async destroy() {
    await super.destroy();
    this.destroyCalled = true;
  }
}

export function runRegistryTests() {
  const results = [];
  const assert = (name, cond) => {
    results.push({ name, passed: !!cond });
    if (!cond) throw new Error(`Assertion failed: ${name}`);
  };

  // 1. Register and retrieve
  const bus = new EventBus();
  const reg = new ModuleRegistry(bus);
  const mod = new TestModule(bus, 'test1');
  reg.register(mod);
  assert('register + get', reg.get('test1') === mod);
  assert('has', reg.has('test1'));
  assert('list', reg.list().includes('test1'));

  // 2. Init all
  reg.initAll().then(() => {
    assert('init called', mod.initCalled);
    assert('registry injected', mod.registry === reg);
  });

  // 3. Duplicate registration throws
  try {
    reg.register(new TestModule(bus, 'test1'));
    assert('duplicate throws', false);
  } catch {
    assert('duplicate throws', true);
  }

  // 4. Health check
  const health = reg.healthCheck();
  assert('healthCheck returns array', Array.isArray(health) && health.length > 0);

  // 5. Swap (hot-replace)
  const mod2 = new TestModule(bus, 'test1');
  reg.swap('test1', mod2).then(() => {
    assert('swap replaces module', reg.get('test1') === mod2);
    assert('swap destroys old', mod.destroyCalled);
  });

  // 6. safe() catches errors
  class ErrorModule extends ModuleBase {
    constructor(bus) { super('error_mod', bus); }
    async fail() { throw new Error('expected'); }
  }
  const errMod = new ErrorModule(bus);
  let errorEmitted = false;
  bus.on(EVENTS.MODULE_ERROR, () => { errorEmitted = true; });
  errMod.safe(() => errMod.fail()).then((result) => {
    assert('safe returns fallback', result === null);
    assert('safe emits module:error', errorEmitted);
  });

  return results;
}