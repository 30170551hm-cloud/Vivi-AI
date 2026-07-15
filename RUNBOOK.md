# Runbook — Firebase-only

## 1) Setup

```bash
cp .env.example .env.local
npm install
```

Completa Firebase (`VITE_FIREBASE_*`).

## 2) Validate

```bash
npm run lint
npm run build
```

## 3) Run

```bash
npm run dev
```

## 4) Cloud Functions secrets (production)

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set GITHUB_TOKEN
firebase functions:secrets:set REPO_EDIT_ALLOWLIST
firebase functions:secrets:set REPO_EDIT_REQUIRE_APPROVAL
```

## 5) Deploy

```bash
firebase deploy --only functions
```

## 6) Quick checks

- Auth login/logout (email + Google)
- Conversaciones y memoria persisten en Firestore
- Upload de archivos en Storage
- Voz/avatar/chat sin errores de consola
- Flujo de edición repo: propuesta → validación backend → rama+PR
