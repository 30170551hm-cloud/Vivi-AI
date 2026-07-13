# Vivi AI

Asistente personal inteligente con avatar animado, gestión de rutinas, objetivos y memoria diaria.

## Arquitectura

- **Frontend**: React 18 + Vite 6 + Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Storage, Functions)
- **Deployment**: Vercel
- **Source of truth**: Este repositorio (rama main)
- **Dependencia de Base44**: NINGUNA (completamente independiente)

## Estructura del Proyecto

```
src/
├── lib/                    # Capa de abstracción Firebase
│   ├── backendClient.js    # Reemplaza @/api/base44Client
│   ├── firebase.js         # Inicialización Firebase
│   ├── firebaseAuthAdapter.js  # Auth (reemplaza base44.auth)
│   ├── firebaseEntities.js     # Entities (reemplaza base44.entities)
│   ├── firebaseStorageAdapter.js  # Storage (reemplaza UploadFile)
│   ├── llmProviders.js     # LLM vía Cloud Functions
│   └── aiProvider.js       # Wrapper de IA
├── vivi/
│   ├── modules/            # 30+ módulos del sistema Vivi
│   ├── core/               # EventBus, ModuleBase, ModuleRegistry
│   ├── hooks/              # useVivi (React hook)
│   └── index.js           # Bootstrap del sistema
├── pages/                  # 12 páginas
├── components/             # Componentes UI (shadcn/ui + vivi)
└── App.jsx                 # Router principal

functions/
└── index.js                # Firebase Cloud Functions (callLLM, generateSpeech, etc.)
```

## Requisitos

1. Node.js 20+
2. Proyecto Firebase con Auth, Firestore, Storage y Functions habilitados
3. Cuenta de Vercel

## Configuración

### 1. Variables de entorno frontend

Crea `.env.local`:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### 2. Firebase Cloud Functions secrets

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set GITHUB_TOKEN
```

### 3. Instalación

```bash
npm install
cd functions && npm install && cd ..
```

## Desarrollo

```bash
npm run dev
```

## Compilación

```bash
npm run build
npm run lint
```

## Despliegue en Vercel

1. Conecta este repositorio en [vercel.com](https://vercel.com)
2. Configura las variables de entorno en el dashboard de Vercel
3. Vercel detectará automáticamente Vite (Build: `npm run build`, Output: `dist`)
4. Deploy automático en cada push a main

## Despliegue de Firebase Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

## Backend Cloud Functions

| Endpoint | Propósito |
|---|---|
| callLLM | Inferencia LLM (OpenAI / Gemini) |
| generateSpeech | Text-to-speech |
| generateImage | Generación de imágenes IA |
| getRepoTree | Listar archivos del repo |
| getRepoFile | Leer archivo del repo |
| proposeRepoChanges | Proponer cambios (con allowlist) |
| approveRepoChanges | Aprobar y aplicar cambios |

## Módulos del Sistema

ViviCore, ViviVoice, ViviAvatar, ViviMemory, ViviKnowledge, ViviIntegrations,
ViviNotifications, ViviSettings, ViviFounderConsole, ViviSecurity, ViviApi,
ViviLogger, ViviRealtimeFacts, ViviVenezuela, ViviVenezuelaManual, ViviVAD,
ViviTOOR, ViviBaseBrain, ViviVDE, ViviFounderAuth, ViviReasoning,
ViviEmotionEngine, ViviVisionEngine, ViviAudioEngine, ViviLearningEngine,
ViviConversationEngine, ViviCodeAnalyzer, ViviPermissionManager,
ViviUniversity, ViviAnalytics

## Licencia

Propiedad de HRYET. Fundador: Henrry Moyses García Rojas.
