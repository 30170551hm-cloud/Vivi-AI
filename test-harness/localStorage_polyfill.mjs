// localStorage_polyfill.mjs — Node no tiene `localStorage` (los navegadores sí).
// Este polyfill in-memory es SOLO para que el arnés de pruebas pueda ejecutar
// código que en producción corre en el navegador (localAuthAdapter.js).
// Se importa por sus efectos secundarios (define globalThis.localStorage).
const store = new Map();

globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: (key) => { store.delete(key); },
  clear: () => { store.clear(); },
};
