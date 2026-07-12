// harness_appid_bug.mjs — Prueba REAL de la causa raíz reportada por el
// usuario: VITE_BASE44_APP_ID configurado como el texto literal "null"
// (en vez de estar vacío) hacía que appId se resolviera como un string
// truthy real, en vez de tratarse como "no configurado".
import assert from 'node:assert/strict';
import { normalizeEnvValue } from '../src/lib/app-params.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✓ PASS: ${name}`); passed++; }
  catch (err) { console.log(`✗ FAIL: ${name}\n  ${err.message}`); failed++; }
}

test('normalizeEnvValue: el string literal "null" se trata como no configurado', () => {
  assert.equal(normalizeEnvValue('null'), undefined);
});
test('normalizeEnvValue: el string literal "NULL" (mayúsculas) también', () => {
  assert.equal(normalizeEnvValue('NULL'), undefined);
});
test('normalizeEnvValue: el string literal "undefined" también', () => {
  assert.equal(normalizeEnvValue('undefined'), undefined);
});
test('normalizeEnvValue: string vacío o solo espacios también', () => {
  assert.equal(normalizeEnvValue(''), undefined);
  assert.equal(normalizeEnvValue('   '), undefined);
});
test('normalizeEnvValue: undefined/null reales pasan igual', () => {
  assert.equal(normalizeEnvValue(undefined), undefined);
  assert.equal(normalizeEnvValue(null), undefined);
});
test('normalizeEnvValue: un app_id REAL se conserva intacto', () => {
  assert.equal(normalizeEnvValue('app_6f8a2b1c'), 'app_6f8a2b1c');
  assert.equal(normalizeEnvValue('  app_6f8a2b1c  '), 'app_6f8a2b1c');
});

console.log(`\n${passed} pasaron, ${failed} fallaron (de ${passed + failed} pruebas totales)`);
if (failed > 0) process.exit(1);
