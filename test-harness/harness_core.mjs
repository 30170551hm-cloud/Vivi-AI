// harness_core.mjs — Ejecuta pruebas reales contra el código de producción
// SIN MODIFICAR, importado directamente desde el repo. Usa solo el módulo
// 'assert' incorporado de Node — no requiere instalar nada.
import assert from 'node:assert/strict';
import { EventBus } from '../src/vivi/core/EventBus.js';
import { ModuleBase } from '../src/vivi/core/ModuleBase.js';
import { ModuleRegistry } from '../src/vivi/core/ModuleRegistry.js';
import ViviAvatar from '../src/vivi/modules/ViviAvatar.js';
import { EVENTS } from '../src/vivi/events.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`✗ FAIL: ${name}`);
    console.log(`  ${err.message}`);
    failed++;
  }
}

// ── EventBus: pub/sub real ──
await test('EventBus.on/emit entrega el payload al handler', () => {
  const bus = new EventBus();
  let received = null;
  bus.on('test:event', (payload) => { received = payload; });
  bus.emit('test:event', { hello: 'vivi' });
  assert.deepEqual(received, { hello: 'vivi' });
});

await test('EventBus.off detiene la entrega de eventos', () => {
  const bus = new EventBus();
  let count = 0;
  const handler = () => { count++; };
  bus.on('x', handler);
  bus.emit('x');
  bus.off('x', handler);
  bus.emit('x');
  assert.equal(count, 1);
});

await test('EventBus.once se autodesuscribe tras el primer disparo', () => {
  const bus = new EventBus();
  let count = 0;
  bus.once('x', () => { count++; });
  bus.emit('x');
  bus.emit('x');
  assert.equal(count, 1);
});

await test('EventBus aísla errores: un handler que lanza no detiene a los demás', () => {
  const bus = new EventBus();
  let secondRan = false;
  bus.on('x', () => { throw new Error('handler roto'); });
  bus.on('x', () => { secondRan = true; });
  bus.emit('x'); // no debe lanzar hacia afuera
  assert.equal(secondRan, true);
});

// ── ModuleRegistry: ciclo de vida real ──
await test('ModuleRegistry.register + get devuelve el mismo módulo', () => {
  const bus = new EventBus();
  const registry = new ModuleRegistry(bus);
  const mod = new ModuleBase('dummy', bus);
  registry.register(mod);
  assert.equal(registry.get('dummy'), mod);
});

await test('ModuleRegistry.register lanza si el nombre ya existe (detecta duplicados)', () => {
  const bus = new EventBus();
  const registry = new ModuleRegistry(bus);
  registry.register(new ModuleBase('dup', bus));
  assert.throws(() => registry.register(new ModuleBase('dup', bus)), /already registered/);
});

await test('ModuleRegistry.get devuelve null para un módulo no registrado (no lanza)', () => {
  const bus = new EventBus();
  const registry = new ModuleRegistry(bus);
  assert.equal(registry.get('no_existe'), null);
});

// ── initAll: verifica que un módulo roto no tumba a los demás ──
{
  const bus = new EventBus();
  const registry = new ModuleRegistry(bus);

  class BrokenModule extends ModuleBase {
    async init() { throw new Error('init roto a propósito'); }
  }
  class HealthyModule extends ModuleBase {
    async init(r) { await super.init(r); this.ok = true; }
  }

  registry.register(new BrokenModule('broken', bus));
  const healthy = new HealthyModule('healthy', bus);
  registry.register(healthy);

  let moduleErrorEmitted = false;
  bus.on(EVENTS.MODULE_ERROR, () => { moduleErrorEmitted = true; });

  await registry.initAll();

  await test('initAll: el módulo sano SÍ se inicializa aunque otro falle', () => {
    assert.equal(healthy.ok, true);
  });
  await test('initAll: el fallo del módulo roto se reporta vía EventBus, no lanza', () => {
    assert.equal(moduleErrorEmitted, true);
  });
}

// ── ViviAvatar: máquina de estados real, reaccionando a eventos reales ──
await test('ViviAvatar: arranca en estado idle', async () => {
  const bus = new EventBus();
  const registry = new ModuleRegistry(bus);
  const avatar = new ViviAvatar(bus);
  registry.register(avatar);
  await registry.initAll();
  assert.equal(avatar._state, 'idle');
});

await test('ViviAvatar: VOICE_LISTENING_START lo mueve a listening', async () => {
  const bus = new EventBus();
  const registry = new ModuleRegistry(bus);
  const avatar = new ViviAvatar(bus);
  registry.register(avatar);
  await registry.initAll();

  let emittedState = null;
  bus.on(EVENTS.AVATAR_STATE_CHANGE, (s) => { emittedState = s; });

  bus.emit(EVENTS.VOICE_LISTENING_START);
  assert.equal(avatar._state, 'listening');
  assert.equal(emittedState, 'listening');
});

await test('ViviAvatar: CORE_THINKING lo mueve a thinking (comunicación entre módulos vía bus)', async () => {
  const bus = new EventBus();
  const registry = new ModuleRegistry(bus);
  const avatar = new ViviAvatar(bus);
  registry.register(avatar);
  await registry.initAll();

  bus.emit(EVENTS.CORE_THINKING);
  assert.equal(avatar._state, 'thinking');
});

console.log(`\n${passed} pasaron, ${failed} fallaron (de ${passed + failed} pruebas totales)`);
if (failed > 0) process.exit(1);
