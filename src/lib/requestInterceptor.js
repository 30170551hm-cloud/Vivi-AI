// requestInterceptor.js — Interceptor global de peticiones HTTP, para
// diagnóstico forense en un navegador real. Registra CADA petición hecha
// vía fetch() o XMLHttpRequest (que es lo que usan por debajo tanto
// nuestro código como el SDK de Base44 y su plugin de Vite), con:
//   - método, URL, body, headers
//   - stack trace completo (para saber qué archivo/función la disparó)
//   - respuesta y código HTTP
//   - timestamp
//
// USO: se importa por sus efectos secundarios, UNA SOLA VEZ, al principio
// de main.jsx — ANTES de montar React — para no perderse ninguna petición,
// incluida cualquiera que dispare el propio plugin de Vite de Base44 antes
// de que la app React exista.
//
// Los resultados se imprimen en consola con el prefijo [REQUEST-LOG] y
// también quedan disponibles en `window.__viviRequestLog` (array) para
// poder inspeccionarlos o copiarlos después de reproducir el error.

const LOG_PREFIX = '[REQUEST-LOG]';

function initRequestLog() {
  if (typeof window === 'undefined') return; // No-op fuera del navegador (SSR/tests)
  
  try {
    if (window.__viviRequestLogInstalled) return; // Evita instalarlo dos veces
    window.__viviRequestLogInstalled = true;
  } catch (e) {
    console.warn(`${LOG_PREFIX} No se pudo establecer la variable __viviRequestLogInstalled en window:`, e);
    return; // Si no podemos escribir en window, cancelamos la instalación
  }

  try {
    window.__viviRequestLog = window.__viviRequestLog || [];
  } catch (e) {
    console.warn(`${LOG_PREFIX} No se pudo inicializar window.__viviRequestLog:`, e);
  }

  try {
    const originalFetch = window.fetch;
    if (originalFetch) {
      window.fetch = async function interceptedFetch(input, init) {
        const url = typeof input === 'string' ? input : input?.url;
        const method = init?.method || (typeof input === 'object' && input?.method) || 'GET';
        const stack = new Error().stack;
        const timestamp = new Date().toISOString();
        const entry = {
          transport: 'fetch', method, url, body: init?.body || null,
          headers: init?.headers || null, timestamp, stack,
        };

        console.groupCollapsed(`${LOG_PREFIX} fetch ${method} ${url}`);
        console.log('Timestamp:', timestamp);
        console.log('Body:', entry.body);
        console.log('Headers:', entry.headers);
        console.log('Stack trace (quién disparó esta petición):', stack);
        console.groupEnd();

        try {
          const response = await originalFetch.call(this, input, init);
          entry.status = response.status;
          entry.ok = response.ok;
          console.log(`${LOG_PREFIX} fetch ${method} ${url} → ${response.status}`);
          if (window.__viviRequestLog) window.__viviRequestLog.push(entry);
          return response;
        } catch (err) {
          entry.error = err.message;
          console.error(`${LOG_PREFIX} fetch ${method} ${url} → ERROR: ${err.message}`);
          if (window.__viviRequestLog) window.__viviRequestLog.push(entry);
          throw err;
        }
      };
    }
  } catch (e) {
    console.warn(`${LOG_PREFIX} No se pudo interceptar window.fetch (propiedad de solo lectura):`, e);
  }

  try {
    const OriginalXHR = window.XMLHttpRequest;
    if (OriginalXHR) {
      function InterceptedXHR() {
        const xhr = new OriginalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        let method, url, stack;

        xhr.open = function (m, u, ...rest) {
          method = m; url = u; stack = new Error().stack;
          return originalOpen.call(xhr, m, u, ...rest);
        };

        xhr.send = function (body) {
          const timestamp = new Date().toISOString();
          const entry = { transport: 'XMLHttpRequest', method, url, body: body || null, timestamp, stack };

          console.groupCollapsed(`${LOG_PREFIX} XHR ${method} ${url}`);
          console.log('Timestamp:', timestamp);
          console.log('Body:', entry.body);
          console.log('Stack trace (quién disparó esta petición):', stack);
          console.groupEnd();

          xhr.addEventListener('loadend', () => {
            entry.status = xhr.status;
            entry.response = xhr.responseText?.slice(0, 500);
            console.log(`${LOG_PREFIX} XHR ${method} ${url} → ${xhr.status}`);
            if (window.__viviRequestLog) window.__viviRequestLog.push(entry);
          });

          return originalSend.call(xhr, body);
        };

        return xhr;
      }
      window.XMLHttpRequest = InterceptedXHR;
    }
  } catch (e) {
    console.warn(`${LOG_PREFIX} No se pudo interceptar window.XMLHttpRequest (propiedad de solo lectura):`, e);
  }

  console.log(
    `${LOG_PREFIX} Interceptor global configurado. Todas las peticiones fetch/XHR quedarán registradas ` +
    'en consola (agrupadas, con stack trace) y en window.__viviRequestLog si es accesible. ' +
    'Para exportar el log tras reproducir un error: copy(JSON.stringify(window.__viviRequestLog, null, 2))'
  );
}

// Solo se instala en modo desarrollo (npm run dev) — es una herramienta de
// diagnóstico para esta investigación, no algo que deba correr en producción.
const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
if (isDev) {
  initRequestLog();
} else if (typeof window !== 'undefined') {
  console.log(`${LOG_PREFIX} Interceptor NO instalado (modo producción). Para activarlo, corre con "npm run dev".`);
}
