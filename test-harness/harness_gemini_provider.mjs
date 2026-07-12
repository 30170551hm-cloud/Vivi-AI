// harness_gemini_provider.mjs — Prueba real del proveedor Gemini directo:
// mockea únicamente fetch (la frontera de red — no hay red aquí) y verifica
// que el request a Gemini se construye con el contrato correcto y que la
// respuesta se parsea como esperan los 18+ call sites de Vivi.
import '../test-harness/localStorage_polyfill.mjs';
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`✓ PASS: ${name}`); passed++; }
  catch (err) { console.log(`✗ FAIL: ${name}\n  ${err.message}`); failed++; }
}

let lastRequest = null;
globalThis.fetch = async (url, opts) => {
  lastRequest = { url, body: JSON.parse(opts.body) };
  const hasSchema = !!lastRequest.body.generationConfig?.responseSchema;
  const text = hasSchema
    ? JSON.stringify({ reply: 'Hola Henrry', confidence: 'alta', source: 'conocimiento', emotion: 'feliz' })
    : 'Hola, soy Vivi con Gemini.';
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
};

// TEST_GEMINI_KEY inyectado por el loader como VITE_GEMINI_API_KEY
const { AI } = await import('../src/lib/aiProvider.js');

await test('InvokeLLM sin schema → devuelve string y llama al endpoint de Gemini con la key', async () => {
  const result = await AI.InvokeLLM({ prompt: 'Hola Vivi' });
  assert.equal(result, 'Hola, soy Vivi con Gemini.');
  assert.match(lastRequest.url, /generativelanguage\.googleapis\.com.*gemini-1\.5-flash.*key=fake_gemini_key/);
  assert.equal(lastRequest.body.contents[0].parts[0].text, 'Hola Vivi');
});

await test('InvokeLLM con response_json_schema → configura JSON mode y devuelve objeto parseado', async () => {
  const schema = { type: 'object', properties: { reply: { type: 'string' } } };
  const result = await AI.InvokeLLM({ prompt: 'Responde', response_json_schema: schema });
  assert.equal(lastRequest.body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(lastRequest.body.generationConfig.responseSchema, schema);
  assert.equal(result.reply, 'Hola Henrry');
  assert.equal(result.emotion, 'feliz');
});

await test('Error de Gemini (HTTP 400) → lanza con mensaje claro, no falla en silencio', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 400, text: async () => 'API key not valid' });
  await assert.rejects(() => AI.InvokeLLM({ prompt: 'x' }), /Gemini API 400.*API key not valid/);
});

console.log(`\n${passed} pasaron, ${failed} fallaron (de ${passed + failed} pruebas totales)`);
if (failed > 0) process.exit(1);
