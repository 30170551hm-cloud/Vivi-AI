// esm_loader.mjs — Herramienta de MI arnés de pruebas (no toca el código
// fuente de Vivi en disco). Resuelve lo que Vite resuelve automáticamente
// pero Node ESM puro no:
//   1. Imports relativos sin extensión ('./EventBus' → './EventBus.js')
//   2. El alias '@/x' definido en jsconfig.json → 'src/x'
//   3. Redirige '@base44/sdk' (no instalado, sin red) a un MOCK explícito
//   4. Neutraliza `import.meta.env` (global exclusivo de Vite) SOLO EN
//      MEMORIA durante esta ejecución — el archivo real nunca se modifica
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = pathToFileURL(path.resolve(HERE, '../src') + '/');
const MOCK_BASE44 = pathToFileURL(path.resolve(HERE, './MOCK_base44_sdk.mjs')).href;
const MOCK_FIREBASE = pathToFileURL(path.resolve(HERE, './MOCK_firebase.mjs')).href;

function findWithExtension(baseHref) {
  for (const ext of ['.js', '.jsx', '.mjs']) {
    const candidate = baseHref + ext;
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  if (existsSync(fileURLToPath(baseHref))) return baseHref;
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@base44/sdk' || specifier.startsWith('@base44/sdk/')) {
    return nextResolve(MOCK_BASE44, context);
  }
  if (specifier === 'firebase' || specifier.startsWith('firebase/')) {
    return nextResolve(MOCK_FIREBASE, context);
  }

  if (specifier.startsWith('@/')) {
    const targetHref = new URL(specifier.slice(2), SRC_DIR).href;
    const resolved = findWithExtension(targetHref);
    if (!resolved) throw new Error(`[esm_loader] No se encontró el archivo para alias: ${specifier} → ${targetHref}`);
    return nextResolve(resolved, context);
  }

  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) {
      const targetHref = new URL(specifier, context.parentURL).href;
      const resolved = findWithExtension(targetHref);
      if (resolved) return nextResolve(resolved, context);
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!url.includes('/src/')) return result;

  const isBuffer = result.source && typeof result.source !== 'string';
  const sourceText = isBuffer ? Buffer.from(result.source).toString('utf-8') : result.source;

  if (typeof sourceText === 'string' && sourceText.includes('import.meta.env')) {
    // Por defecto, import.meta.env se neutraliza a un objeto vacío (simula
    // el caso real de "sin .env configurado"). Variables TEST_* permiten
    // simular configuraciones específicas por escenario de prueba.
    const envEntries = [];
    if (process.env.TEST_BASE44_APPID) envEntries.push(`VITE_BASE44_APP_ID: ${JSON.stringify(process.env.TEST_BASE44_APPID)}`);
    if (process.env.TEST_FIREBASE_APIKEY) envEntries.push(`VITE_FIREBASE_API_KEY: ${JSON.stringify(process.env.TEST_FIREBASE_APIKEY)}`);
    if (process.env.TEST_FIREBASE_AUTHDOMAIN) envEntries.push(`VITE_FIREBASE_AUTH_DOMAIN: ${JSON.stringify(process.env.TEST_FIREBASE_AUTHDOMAIN)}`);
        if (process.env.TEST_GEMINI_KEY) envEntries.push(`VITE_GEMINI_API_KEY: ${JSON.stringify(process.env.TEST_GEMINI_KEY)}`);
    if (process.env.TEST_FIREBASE_PROJECTID) envEntries.push(`VITE_FIREBASE_PROJECT_ID: ${JSON.stringify(process.env.TEST_FIREBASE_PROJECTID)}`);
    const fakeEnv = `({ ${envEntries.join(', ')} })`;
    const patched = sourceText.replaceAll('import.meta.env', fakeEnv);
    return { ...result, source: patched };
  }
  return result;
}
