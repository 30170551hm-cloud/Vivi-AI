# Vivi AI (Firebase-only)

Este proyecto ya no usa Base44 en runtime. Autenticación, datos y archivos funcionan con Firebase.

## Requisitos

1. Node.js 20+
2. `npm install`
3. Proyecto Firebase con Auth, Firestore, Storage y Functions habilitados

## Variables de entorno frontend

Crea `.env.local` con:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Solo fallback temporal (opcional)
VITE_GEMINI_API_KEY=
VITE_GEMINI_MODEL=gemini-1.5-flash

# Solo para desarrollo local controlado sin Firebase completo
VITE_ALLOW_LOCAL_AUTH=false
```

## Desarrollo

```bash
npm run dev
```

## Validación

```bash
npm run lint
npm run build
```

## Functions (backend)

Configura secrets en Firebase Functions (nunca en frontend):

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `GITHUB_TOKEN`
- `REPO_EDIT_ALLOWLIST` (CSV de prefijos permitidos)
- `REPO_EDIT_REQUIRE_APPROVAL` (`true|false`)

Luego despliega:

```bash
firebase deploy --only functions
```
