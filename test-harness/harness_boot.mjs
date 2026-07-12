import '../test-harness/localStorage_polyfill.mjs';
// harness_boot.mjs — Intenta ejecutar getVivi() (el bootstrap real, sin
// modificar) fuera de un navegador. Se espera que módulos que dependen de
// Base44 (import.meta.env) o del DOM fallen — eso se documenta con
// exactitud, no se oculta. El objetivo de ESTA prueba es una sola cosa:
// verificar si el ReferenceError original (ViviSecurity is not defined)
// reaparece o no.
import { getVivi } from '../src/vivi/index.js';

try {
  const vivi = getVivi();
  console.log('RESULTADO: getVivi() retornó sin lanzar excepción síncrona.');
  console.log('Módulos registrados:', vivi.registry.list());
} catch (err) {
  console.log('RESULTADO: getVivi() LANZÓ una excepción síncrona:');
  console.log(err.stack);
}
