# Mivi — Vivi AI Migration Status

## Architecture
- **Runtime**: Firebase (Auth, Firestore, Storage, Functions)
- **Deployment**: Vercel
- **Source of truth**: This repository (main branch)
- **Base44 dependency**: NONE (fully decoupled)

## Backend Functions (functions/index.js)
| Endpoint | Purpose |
|---|---|
| callLLM | LLM inference (OpenAI / Gemini) |
| generateSpeech | Text-to-speech |
| generateImage | AI image generation |
| getRepoTree | List repo files |
| getRepoFile | Read repo file |
| proposeRepoChanges | Propose code edits (allowlist-gated) |
| approveRepoChanges | Approve and apply proposed edits |

## Frontend Modules (27 registered)
ViviCore, ViviVoice, ViviAvatar, ViviMemory, ViviKnowledge, ViviIntegrations,
ViviNotifications, ViviSettings, ViviFounderConsole, ViviSecurity, ViviApi,
ViviLogger, ViviRealtimeFacts, ViviVenezuela, ViviVenezuelaManual, ViviVAD,
ViviTOOR, ViviBaseBrain, ViviVDE, ViviFounderAuth, ViviReasoning,
ViviEmotionEngine, ViviVisionEngine, ViviAudioEngine, ViviLearningEngine,
ViviConversationEngine, ViviCodeAnalyzer

## Firebase Abstraction Layer (src/lib/)
| File | Replaces |
|---|---|
| backendClient.js | @/api/base44Client |
| firebase.js | Base44 SDK init |
| firebaseAuthAdapter.js | base44.auth.* |
| firebaseEntities.js | base44.entities.* |
| firebaseStorageAdapter.js | base44.integrations.Core.UploadFile |
| llmProviders.js | base44.integrations.Core.InvokeLLM |
| aiProvider.js | base44.integrations.Core.* |
| authClient.js | base44.auth.* |

## Pages (12)
Login, Register, ForgotPassword, ResetPassword, Vivi, FounderPanel,
VoiceDiagnostic, Academia, SelfImprovement, VDEConsole, Chat, Memoria

## Migration Status
- [x] Firebase abstraction layer
- [x] Core modules (27)
- [x] Firebase Functions backend
- [x] Vercel deployment config
- [x] Firestore security rules
- [x] CI/CD workflows
- [ ] Port advanced modules from Base44 app
- [ ] Verify npm install + npm run build
- [ ] Deploy to Vercel
- [ ] Configure Firebase secrets (OPENAI_API_KEY, GEMINI_API_KEY)

## Last Updated
2026-07-13
