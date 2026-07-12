// Prueba MÍNIMA y aislada: ¿ModuleBase realmente guarda la referencia al
// registry que recibe en init()? Si esto falla, TODO módulo que use
// this.registry.get(...) internamente está roto en silencio.
import assert from 'node:assert/strict';
import { EventBus } from '../src/vivi/core/EventBus.js';
import { ModuleBase } from '../src/vivi/core/ModuleBase.js';
import { ModuleRegistry } from '../src/vivi/core/ModuleRegistry.js';

const bus = new EventBus();
const registry = new ModuleRegistry(bus);
const mod = new ModuleBase('probe', bus);
registry.register(mod);

console.log('this.registry ANTES de initAll():', mod.registry);
await registry.initAll();
console.log('this.registry DESPUÉS de initAll():', mod.registry);

assert.equal(mod.registry, registry, 'ModuleBase.init() debía guardar la referencia real al registry');
console.log('✓ CONFIRMADO: this.registry queda asignado correctamente');
