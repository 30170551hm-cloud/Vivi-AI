import '../test-harness/localStorage_polyfill.mjs';
// harness_conversation.mjs — Invoca ViviCore.handleInput() de verdad, con
// TODOS los módulos reales registrados (igual que getVivi()), para ver si
// el pipeline completo de "iniciar una conversación" corre sin crashear
// ahora que this.registry funciona. El LLM está mockeado explícitamente
// (sin red/API key aquí) — esto NO prueba que la respuesta de la IA sea
// coherente, solo que el pipeline de código no se rompe.
import { EventBus } from '../src/vivi/core/EventBus.js';
import { ModuleRegistry } from '../src/vivi/core/ModuleRegistry.js';
import ViviCore from '../src/vivi/modules/ViviCore.js';
import ViviMemory from '../src/vivi/modules/ViviMemory.js';
import ViviSettings from '../src/vivi/modules/ViviSettings.js';
import ViviSecurity from '../src/vivi/modules/ViviSecurity.js';
import ViviEmotionEngine from '../src/vivi/modules/ViviEmotionEngine.js';
import ViviConversationEngine from '../src/vivi/modules/ViviConversationEngine.js';
import { EVENTS } from '../src/vivi/events.js';
import { base44 } from '../src/api/base44Client.js';

// Respuesta simulada con el contrato REAL que ViviCore.js espera
// (objeto estructurado, no un string plano — confirmado leyendo el código real).
base44.integrations.Core.InvokeLLM = async () => ({
  reply: 'Hola, soy Vivi. Esta es una respuesta simulada para verificar el pipeline.',
  confidence: 'alta',
  source: 'conocimiento',
  emotion: 'feliz',
});

const bus = new EventBus();
const registry = new ModuleRegistry(bus);
registry.register(new ViviSettings(bus));
registry.register(new ViviSecurity(bus));
registry.register(new ViviMemory(bus));
registry.register(new ViviEmotionEngine(bus));
registry.register(new ViviConversationEngine(bus));
registry.register(new ViviCore(bus));

let replyReceived = null;
let errorEmitted = null;
bus.on(EVENTS.CORE_REPLY, (payload) => { replyReceived = payload; });
bus.on(EVENTS.MODULE_ERROR, (payload) => { errorEmitted = payload; });
bus.on(EVENTS.CORE_ERROR, (payload) => { errorEmitted = payload; });

await registry.initAll();

console.log('--- Enviando mensaje de prueba a ViviCore.handleInput() ---');
try {
  await registry.get('core').handleInput('Hola Vivi, ¿cómo estás?');
} catch (err) {
  console.log('RESULTADO: handleInput() LANZÓ una excepción no capturada:');
  console.log(err.stack);
  process.exit(1);
}

console.log('RESULTADO: handleInput() terminó sin lanzar excepción.');
console.log('CORE_REPLY recibido:', replyReceived);
console.log('Algún module:error/core:error emitido:', errorEmitted);
