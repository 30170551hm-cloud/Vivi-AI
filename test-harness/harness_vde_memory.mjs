// harness_vde_memory.mjs — Pruebas reales de:
//  1. ViviMemory.buildContextBlock() — lógica pura, sin mocks (no toca Base44)
//  2. ViviVDE.analyzeRequest() end-to-end con una respuesta LLM simulada
//     realista, verificando que la propuesta queda en estado 'diseñada'
//     (el bug que corregimos antes) — NO 'desplegada'.
//  3. ViviCodeAnalyzer.proposeFixFor() → confirma que delega en
//     vde.detectBug() con los argumentos correctos (punto de integración
//     real entre los dos módulos).
import assert from 'node:assert/strict';
import { EventBus } from '../src/vivi/core/EventBus.js';
import { ModuleRegistry } from '../src/vivi/core/ModuleRegistry.js';
import ViviMemory from '../src/vivi/modules/ViviMemory.js';
import ViviVDE from '../src/vivi/modules/ViviVDE.js';
import ViviCodeAnalyzer from '../src/vivi/modules/ViviCodeAnalyzer.js';
import { base44 } from '../src/api/base44Client.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`✓ PASS: ${name}`); passed++; }
  catch (err) { console.log(`✗ FAIL: ${name}\n  ${err.message}`); failed++; }
}

// ── 1. ViviMemory.buildContextBlock — lógica pura sobre datos reales ──
await test('ViviMemory.buildContextBlock: agrupa por categoría y ordena hitos por fecha', () => {
  const bus = new EventBus();
  const memory = new ViviMemory(bus);
  // Inyectamos memorias directamente en el caché interno — esto SOLO prueba
  // la lógica de formateo, no la persistencia (eso ya está mockeado en otras pruebas).
  memory._cache = [
    { category: 'project', key: 'HRYET', value: 'Plataforma de moda', status: 'active' },
    { category: 'milestone', is_milestone: true, timeline_date: '2026-01-15', value: 'Lanzamiento beta', milestone_type: 'achievement' },
    { category: 'milestone', is_milestone: true, timeline_date: '2026-03-01', value: 'Primera venta', milestone_type: 'celebration' },
  ];
  const block = memory.buildContextBlock({ display_name: 'Henrry' });
  assert.match(block, /Nombre del usuario: Henrry/);
  assert.match(block, /\[Hitos importantes\]/);
  assert.match(block, /\[Proyectos|\[project\]|HRYET/i);
  // El hito más reciente (2026-03-01) debe aparecer ANTES que el de 2026-01-15
  const idx2026_03 = block.indexOf('Primera venta');
  const idx2026_01 = block.indexOf('Lanzamiento beta');
  assert.ok(idx2026_03 < idx2026_01, 'El hito más reciente debe listarse primero');
});

await test('ViviMemory.getActiveContextSummary: filtra solo proyectos/metas/tareas activos', () => {
  const bus = new EventBus();
  const memory = new ViviMemory(bus);
  memory._cache = [
    { category: 'project', key: 'A', value: 'Activo', status: 'active' },
    { category: 'project', key: 'B', value: 'Pausado', status: 'paused' },
    { category: 'fact', key: 'C', value: 'No debe salir' },
  ];
  const summary = memory.getActiveContextSummary();
  assert.match(summary, /A/);
  assert.doesNotMatch(summary, /Pausado|No debe salir/);
});

// ── 2. ViviVDE.analyzeRequest — end-to-end con LLM mockeado realista ──
base44.integrations.Core.InvokeLLM = async () => ({
  title: 'Corregir manejo nulo en X',
  description: 'Se detectó un acceso a propiedad de undefined',
  current_limitation: 'Crashea si el objeto es null',
  proposed_solution: 'Agregar guard de null antes del acceso',
  files: [{ path: 'src/example.js', action: 'modify', description: 'Agregar guard' }],
  generated_code: '// === ARCHIVO: src/example.js ===\nif (obj) { obj.prop }',
  generated_docs: 'Se agregó un guard de null.',
  benefits: 'Evita crashes',
  risks: 'Ninguno',
  test_results: 'Simulado: pasaría',
});
let createdProposal = null;
base44.entities.ImprovementProposal.create = async (data) => { createdProposal = data; return { id: 'fake-id', ...data }; };

await test('ViviVDE.analyzeRequest: la propuesta generada queda en estado "diseñada" (NO "desplegada")', async () => {
  const bus = new EventBus();
  const vde = new ViviVDE(bus);
  const proposal = await vde.analyzeRequest('Corrige el bug X', { category: 'otro', priority: 'alta' });
  assert.ok(proposal, 'Debe devolver una propuesta');
  assert.equal(proposal.status, 'diseñada', 'BUG SI FALLA: volvió a marcarse como desplegada sin revisión del founder');
  assert.equal(createdProposal.source, 'vde');
  assert.equal(createdProposal.title, 'Corregir manejo nulo en X');
});

// ── 3. Integración ViviCodeAnalyzer → ViviVDE ──
await test('ViviCodeAnalyzer.proposeFixFor delega en vde.detectBug con los datos del hallazgo', async () => {
  const bus = new EventBus();
  const registry = new ModuleRegistry(bus);
  const vde = new ViviVDE(bus);
  registry.register(vde);
  const analyzer = new ViviCodeAnalyzer(bus);
  registry.register(analyzer);
  await registry.initAll();

  let detectBugCalledWith = null;
  const originalDetectBug = vde.detectBug.bind(vde);
  vde.detectBug = async (errorDescription, codeContext) => {
    detectBugCalledWith = { errorDescription, codeContext };
    return originalDetectBug(errorDescription, codeContext);
  };

  const finding = {
    category: 'error_logico',
    explanation: 'Variable no definida antes de uso',
    line_hint: 'línea 42',
    risk: 'Crash en producción',
  };
  await analyzer.proposeFixFor('src/fake/File.js', finding);

  assert.ok(detectBugCalledWith, 'vde.detectBug() debía haber sido llamado');
  assert.match(detectBugCalledWith.errorDescription, /error_logico/);
  assert.match(detectBugCalledWith.codeContext, /src\/fake\/File\.js/);
  assert.match(detectBugCalledWith.codeContext, /línea 42/);
});

console.log(`\n${passed} pasaron, ${failed} fallaron (de ${passed + failed} pruebas totales)`);
if (failed > 0) process.exit(1);
