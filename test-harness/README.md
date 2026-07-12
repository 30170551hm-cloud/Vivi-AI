# Test Harness — evidencia reproducible

Estos archivos permiten repetir exactamente las pruebas ejecutadas en esta sesión, con Node.js puro (no requiere `npm install`, no requiere red).

## Requisito
Node.js 18+ (probado con Node v22.22.2).

## Cómo correr las pruebas puras (EventBus, ModuleRegistry, ViviAvatar)
```bash
cd VIVI-AI-main
node --experimental-loader=./test-harness/esm_loader.mjs test-harness/harness_core.mjs
```
Resultado esperado: `12 pasaron, 0 fallaron`.

## Cómo correr la prueba de arranque completo (getVivi(), 27 módulos)
```bash
cd VIVI-AI-main
node --experimental-loader=./test-harness/esm_loader.mjs test-harness/harness_boot.mjs
```
Resultado esperado: `RESULTADO: getVivi() retornó sin lanzar excepción síncrona.` + lista de 27 módulos registrados.

## Qué son los archivos `MOCK_*.mjs`
Son mocks **explícitos y declarados**, no el SDK real de Base44 ni el SDK real de Firebase (ninguno de los dos está instalado — este entorno no tiene acceso a red para `npm install`). Sirven únicamente para verificar que la cadena de imports/registro de los 27 módulos de Vivi no tiene errores de referencia ni de import — NO verifican que la autenticación, memoria o LLM funcionen contra un backend real.

## Qué es `esm_loader.mjs`
Un loader de Node que resuelve tres cosas que Vite resuelve automáticamente pero Node ESM puro no:
1. Imports relativos sin extensión (`'./EventBus'` → `'./EventBus.js'`)
2. El alias `@/x` de `jsconfig.json` → `src/x`
3. Neutraliza `import.meta.env` (global exclusivo de Vite) solo en memoria durante la ejecución de prueba — nunca modifica los archivos reales en disco

No es parte de la aplicación — es una herramienta de verificación, no se importa desde `src/`.
