// harness_authmode.mjs — Prueba real de la lógica de selección de modo,
// con los 3 escenarios: sin nada, Firebase parcial, Firebase completo.
// Nota: authMode.js lee import.meta.env en el momento del import, así que
// cada escenario se prueba relanzando el import con un query distinto
// (cache-busting) y variables de entorno distintas vía el loader.
import assert from 'node:assert/strict';

// El loader inyecta TEST_FIREBASE_ENV como el objeto import.meta.env
// — ver esm_loader.mjs. Aquí probamos el escenario configurado al lanzar.
const { AUTH_MODE, isFirebaseConfigured } = await import('../src/lib/authMode.js');

const expected = process.env.EXPECTED_MODE;
console.log(`AUTH_MODE detectado: ${AUTH_MODE} (esperado: ${expected})`);
assert.equal(AUTH_MODE, expected);
console.log('✓ PASS');
