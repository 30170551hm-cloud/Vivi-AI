# Flujo real de arranque y autenticación — Vivi AI

Reconstruido leyendo el código real (no un diagrama teórico). Cada paso referencia el archivo y línea exactos.

```
1. index.html carga src/main.jsx
   └─ src/main.jsx:1 → import '@/lib/requestInterceptor' (NUEVO — instala interceptor si import.meta.env.DEV)
   └─ src/main.jsx:6 → ReactDOM.createRoot(...).render(<App />)
      (Confirmado: NO hay <React.StrictMode> — ver src/main.jsx completo)

2. src/App.jsx:XX → <AuthProvider> envuelve TODA la app (fuera del Router)
   └─ src/lib/AuthContext.jsx:18 → useEffect(() => { checkAppState(); }, [])
      Se ejecuta UNA vez, al montar. Antes de cualquier ruta.

3. src/lib/AuthContext.jsx:checkAppState()
   ├─ isBase44Configured() === false (VITE_BASE44_APP_ID ausente/inválido)
   │  └─ checkUserAuth() directo, SIN tocar Base44 (corrección de esta sesión)
   │
   └─ isBase44Configured() === true
      └─ createAxiosClient({ baseURL: '/api/apps/public', headers: {'X-App-Id': appParams.appId} })
         └─ GET /api/apps/public/prod/public-settings/by-id/{appId}
            (Esta es la ÚNICA llamada de red que nuestro código dispara
            automáticamente al montar, y SOLO si Base44 está configurado)

4. src/lib/AuthContext.jsx:checkUserAuth()
   └─ authClient.me()  [src/lib/authClient.js]
      ├─ AUTH_MODE === 'base44' → base44.auth.me()
      │   └─ src/api/base44Client.js: si appId inválido → LANZA de inmediato
      │      (guardián nuevo de esta sesión — nunca llega a hacer la petición real)
      ├─ AUTH_MODE === 'firebase' → firebaseAuthAdapter.me()
      └─ AUTH_MODE === 'local' → localAuthAdapter.me() (localStorage)

5. React Router monta <AuthenticatedApp /> (src/App.jsx)
   └─ Si authError?.type === 'auth_required' → navigateToLogin() ANTES de las rutas
      └─ authClient.redirectToLogin(...)

6. Usuario navega a /register (Link de React Router — SIN red, confirmado
   por grep: no hay ninguna llamada hardcodeada a /api/apps/auth/login)
   └─ src/components/ProtectedRoute.jsx:15 → useEffect(() => {
        if (!authChecked && !isLoadingAuth) checkUserAuth();  ← SEGUNDA llamada
      }, [...])
      (/register NO está dentro de ProtectedRoute, así que esto NO se
      ejecuta al visitar /register — solo aplica a rutas protegidas: /, /founder, etc.)

7. Usuario envía el formulario de Register.jsx
   └─ authClient.register({email, password})
      ├─ 'base44' → base44.auth.register(...) [SDK real, requiere appId válido]
      ├─ 'firebase' → firebaseAuthAdapter.register(...)
      └─ 'local' → localAuthAdapter.register(...) [localStorage, sin red]

8. (Fuera de nuestro código React) @base44/vite-plugin, si está configurado
   con navigationNotifier/hmrNotifier/analyticsTracker/visualEditAgent:
   estas 4 funciones corren en el SERVIDOR DE DESARROLLO (no en React) y
   pueden llamar a Base44 en cada navegación/HMR. Condicionadas en esta
   sesión (vite.config.js) a que Base44 esté configurado.
```

## Puntos donde el 404 reportado podía originarse (y su estado)

| # | Origen posible | Estado |
|---|---|---|
| A | `checkAppState()` con `app_id` inválido (paso 3) | ✅ Corregido — ya no se ejecuta si `!isBase44Configured()`, y `isBase44Configured()` ahora filtra "null"/"undefined" como texto |
| B | `@base44/vite-plugin` notifiers (paso 8) | ✅ Mitigado — condicionados a Base44 configurado en `vite.config.js` |
| C | `base44Client.js` construyendo el cliente real con `appId` inválido | ✅ Corregido — guardián nuevo, nunca inicializa el SDK real con un `appId` inválido, lanza error claro en su lugar |
| D | Doble llamada `checkUserAuth()` (pasos 4 y 6) en rutas protegidas | ✅ **Descartado tras verificación más cuidadosa** — `AuthenticatedApp` (src/App.jsx) NO renderiza `<Routes>`/`<ProtectedRoute>` mientras `isLoadingPublicSettings \|\| isLoadingAuth` sea true. Como `authChecked` se pone en `true` en la MISMA función que pone `isLoadingAuth` en `false` (`checkUserAuth()`), `ProtectedRoute` nunca llega a montarse con `authChecked === false`. Su propio guard (`!authChecked && !isLoadingAuth`) por lo tanto nunca dispara una segunda llamada en el flujo normal. *(Corrección de una afirmación anterior mía que no había verificado con suficiente cuidado el orden de montaje.)* |
| E | Algo hardcodeado en nuestro código apuntando a `/api/apps/auth/login` | ✅ Descartado — 0 coincidencias en todo `src/` (grep exhaustivo) |
