import { appParams, normalizeEnvValue } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// ── Base44 es ahora OPCIONAL y de carga perezosa ──
// El paquete '@base44/sdk' fue eliminado de package.json por decisión del
// usuario (el build de Vercel fallaba al no encontrarlo). Este archivo ya
// NO lo importa estáticamente: solo intenta cargarlo dinámicamente si
// VITE_BASE44_APP_ID está configurado con un valor válido.
//
// - Sin appId (el caso actual de producción): se exporta un stub que lanza
//   un error claro al primer acceso — cero dependencia de Base44, el build
//   no necesita el paquete para nada.
// - Con appId válido: se intenta import('@base44/sdk') en tiempo de
//   ejecución. Para reactivar Base44 en el futuro: `npm install @base44/sdk`
//   y quitar el comentario /* @vite-ignore */ para que Vite lo empaquete.
const normalizedAppId = normalizeEnvValue(appId);

function createUnconfiguredStub(reason) {
  return new Proxy({}, {
    get(_target, prop) {
      throw new Error(
        `[base44Client] Se intentó acceder a "base44.${String(prop)}" pero Base44 no está disponible: ${reason}. ` +
        'Vivi funciona en modo local/Firebase para autenticación (ver src/lib/authMode.js); ' +
        'las entidades/integraciones de Base44 requieren reinstalar @base44/sdk y configurar VITE_BASE44_APP_ID.'
      );
    },
  });
}

let base44Instance;

if (!normalizedAppId) {
  console.warn(
    '[base44Client] Base44 no configurado (VITE_BASE44_APP_ID ausente/inválido) — usando stub. ' +
    'La app funciona en modo local/Firebase.'
  );
  base44Instance = createUnconfiguredStub('appId no configurado');
} else {
  try {
    // Carga dinámica: solo se ejecuta si Base44 está configurado.
    // /* @vite-ignore */ evita que Vite intente resolver el paquete en
    // tiempo de build (ya no está instalado).
    const sdk = await import(/* @vite-ignore */ '@base44/sdk');
    base44Instance = sdk.createClient({
      appId: normalizedAppId,
      token,
      functionsVersion,
      serverUrl: '',
      requiresAuth: false,
      appBaseUrl,
    });
  } catch (err) {
    console.error(
      '[base44Client] VITE_BASE44_APP_ID está configurado pero el paquete @base44/sdk no está instalado. ' +
      'Instálalo con: npm install @base44/sdk — o elimina VITE_BASE44_APP_ID del .env para usar modo local/Firebase.',
      err?.message
    );
    base44Instance = createUnconfiguredStub('@base44/sdk no instalado');
  }
}

export const base44 = base44Instance;
