// harness_founder.mjs — Pruebas reales de ViviSecurity + ViviFounderAuth,
// AHORA a través de la cadena real: authClient → (authMode) → localAuthAdapter,
// exactamente como corre en producción cuando no hay Base44/Firebase
// configurado. Antes este archivo mockeaba base44.auth.me() directamente,
// pero ViviSecurity ya no llama a eso — llama a authClient.me(). Se
// actualiza el arnés para reflejar el cambio real de arquitectura.
import '../test-harness/localStorage_polyfill.mjs'; // Node no tiene localStorage — los navegadores sí.
import assert from 'node:assert/strict';
import { EventBus } from '../src/vivi/core/EventBus.js';
import { ModuleRegistry } from '../src/vivi/core/ModuleRegistry.js';
import ViviSecurity from '../src/vivi/modules/ViviSecurity.js';
import ViviFounderAuth from '../src/vivi/modules/ViviFounderAuth.js';
import ViviMemory from '../src/vivi/modules/ViviMemory.js';
import { EVENTS } from '../src/vivi/events.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`✓ PASS: ${name}`); passed++; }
  catch (err) { console.log(`✗ FAIL: ${name}\n  ${err.message}`); failed++; }
}

function seedLocalFounder(email) {
  localStorage.setItem('vivi_local_users', JSON.stringify({
    [email]: {
      email, password: 'test123', display_name: 'Henrry',
      preferred_language: 'auto', voice_enabled: true,
      is_founder: true, voice_name: '', voice_rate: 0.85,
      voice_pitch: 1.0, voice_volume: 1.0, precise_mode: true,
    },
  }));
  localStorage.setItem('vivi_local_session', email);
}

function seedLocalNonFounder(email) {
  localStorage.setItem('vivi_local_users', JSON.stringify({
    [email]: {
      email, password: 'test123', display_name: 'Otro',
      is_founder: false,
    },
  }));
  localStorage.setItem('vivi_local_session', email);
}

await test('ViviSecurity: refresh() detecta al usuario founder real (vía authClient → localAuthAdapter)', async () => {
  localStorage.clear();
  seedLocalFounder('henrrygarciarojas@gmail.com');
  const bus = new EventBus();
  const registry = new ModuleRegistry(bus);
  const security = new ViviSecurity(bus);
  registry.register(security);
  await registry.initAll();
  assert.equal(security.isAuthenticated(), true);
  assert.equal(security.isAuthorized(), true);
  assert.equal(security.isFounder(), true);
});

await test('ViviFounderAuth: reconoce al founder y emite FOUNDER_RECOGNIZED (vía authClient real)', async () => {
  localStorage.clear();
  seedLocalFounder('henrrygarciarojas@gmail.com');
  const bus = new EventBus();
  const registry = new ModuleRegistry(bus);
  registry.register(new ViviSecurity(bus));
  registry.register(new ViviMemory(bus));
  const founderAuth = new ViviFounderAuth(bus);
  registry.register(founderAuth);

  let recognizedPayload = null;
  bus.on(EVENTS.FOUNDER_RECOGNIZED, (p) => { recognizedPayload = p; });

  await registry.initAll();

  assert.equal(founderAuth.isFounder(), true);
  assert.equal(founderAuth.hasChecked(), true);
  assert.ok(recognizedPayload, 'FOUNDER_RECOGNIZED debía emitirse');
  assert.equal(recognizedPayload.email, 'henrrygarciarojas@gmail.com');
});

await test('ViviFounderAuth: con un usuario NO founder, isFounder() es false', async () => {
  localStorage.clear();
  seedLocalNonFounder('otro@ejemplo.com');
  const bus = new EventBus();
  const registry = new ModuleRegistry(bus);
  registry.register(new ViviSecurity(bus));
  registry.register(new ViviMemory(bus));
  const founderAuth = new ViviFounderAuth(bus);
  registry.register(founderAuth);
  await registry.initAll();
  assert.equal(founderAuth.isFounder(), false);
});

console.log(`\n${passed} pasaron, ${failed} fallaron (de ${passed + failed} pruebas totales)`);
if (failed > 0) process.exit(1);
