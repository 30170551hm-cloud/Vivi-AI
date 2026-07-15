# Vivi AI - Module Registry & Ecosystem

This document catalogues the full suite of **28 modules** that constitute the core intelligence of Vivi AI. All modules extend `ModuleBase` and reside in `/src/vivi/modules/`.

---

## 1. Core Architecture Pattern

All modules follow a strict base lifecycle specification defined in `ModuleBase.js`:

```javascript
class MyModule extends ModuleBase {
  constructor(bus) {
    super('mymodule', bus); // Unique identifier
  }

  async init() {
    // Lifecycle setup (listen to events, load databases, build clients)
  }

  async destroy() {
    // Teardown processes (remove timers, cancel subscriptions)
  }
}
```

---

## 2. Directory of Active Modules

### 1. ViviCore (`ViviCore.js`)
- **Category**: Conversation & Orchestration
- **Responsibilities**: The main cognitive coordinator. Handles user text and file inputs, builds dynamic prompts, queries LLM providers, parses emotional responses, and triggers text-to-speech rendering.
- **Events Emitted**: `core:thinking`, `core:reply`, `core:error`

### 2. ViviVoice (`ViviVoice.js`)
- **Category**: Voice I/O
- **Responsibilities**: Wraps the Web Speech Recognition API (STT) and local/cloud Synthesis engines (TTS). Manages speaking rates, custom pitches, and speech cancelation.
- **Events Emitted**: `voice:listening_start`, `voice:listening_end`, `voice:speaking_start`, `voice:speaking_end`

### 3. ViviAvatar (`ViviAvatar.js`)
- **Category**: Interactive Interface
- **Responsibilities**: Maps the assistant's emotional states (idle, talking, happy, thinking) to visual parameters. Emits pure layout gestures with zero hard logic constraints.
- **Events Emitted**: `avatar:state_change`, `avatar:gesture`, `avatar:emotion`

### 4. ViviMemory (`ViviMemory.js`)
- **Category**: Knowledge Persistence
- **Responsibilities**: Interacts with the backend client to query, store, and update semantic memories. Keeps a sliding history of the last 200 interaction logs.
- **Events Emitted**: `memory:stored`, `memory:recalled`

### 5. ViviKnowledge (`ViviKnowledge.js`)
- **Category**: Search & RAG
- **Responsibilities**: Formulates semantic vectors, coordinates vector searches via localized RAG engines, and provides search-grounded text context.
- **Events Emitted**: `knowledge:search`, `knowledge:result`

### 6. ViviIntegrations (`ViviIntegrations.js`)
- **Category**: Integrations
- **Responsibilities**: Sets up programmatic linkages to external channels such as Google Workspace APIs, GitHub repositories, and custom developer microservices.

### 7. ViviNotifications (`ViviNotifications.js`)
- **Category**: UI Polish
- **Responsibilities**: Bridges system events to immediate visual toasts and push notifications in the web client.
- **Events Emitted**: `notification:show`

### 8. ViviSettings (`ViviSettings.js`)
- **Category**: User Preferences
- **Responsibilities**: Stores and reads application configurations, including voice names, audio gain, micro-vibrations, and default LLM provider settings.
- **Events Emitted**: `settings:updated`

### 9. ViviFounderConsole (`ViviFounderConsole.js`)
- **Category**: Control Panel
- **Responsibilities**: Serves as the primary operational terminal for Henrry Moyses García Rojas (Founder). Exposes developer utilities, database entity stats, and raw log downloads.

### 10. ViviSecurity (`ViviSecurity.js`)
- **Category**: Threat Mitigation
- **Responsibilities**: Analyzes incoming instructions for safety, prevents injection attempts, and locks access to high-privilege operations when unauthenticated.
- **Events Emitted**: `security:access_denied`

### 11. ViviApi (`ViviApi.js`)
- **Category**: Core Utilities
- **Responsibilities**: Exposes programmatic HTTP-fallback handlers to let background workers query the active assistant context.

### 12. ViviLogger (`ViviLogger.js`)
- **Category**: Diagnostics
- **Responsibilities**: Records all inter-module message exchanges on the Event Bus, structuring them for diagnostic display in the developer tools.
- **Events Emitted**: `log:added`, `log:cleared`

### 13. ViviRealtimeFacts (`ViviRealtimeFacts.js`)
- **Category**: Grounding
- **Responsibilities**: Synchronizes dynamic environmental metadata (IP data, current UTC time, system locations) to feed current reality constraints to the prompt builder.

### 14. ViviVenezuela & ViviVenezuelaManual (`ViviVenezuela.js` / `ViviVenezuelaManual.js`)
- **Category**: Localization
- **Responsibilities**: Provide regional, cultural, historical, and geopolitical grounding contexts when user interactions reference Venezuelan terms.

### 15. ViviVAD (`ViviVAD.js`)
- **Category**: Audio Processing
- **Responsibilities**: Continuously monitors micro-amplitude variations (RMS) from the microphone. Dispatches barge-in signals to immediately silence synthesis when user voice activity is detected.
- **Events Emitted**: `vad:barge_in`

### 16. ViviTOOR (`ViviTOOR.js`)
- **Category**: Execution Engine
- **Responsibilities**: Resolves, checks, and executes advanced functional tool payloads returned by LLMs (e.g. database querying, calculator calls, file modifications).
- **Events Emitted**: `vde:activity`

### 17. ViviBaseBrain (`ViviBaseBrain.js`)
- **Category**: Grounding
- **Responsibilities**: Generates quick-response fillers, conversational patterns, and default answers when the server-side API key is unconfigured or slow.

### 18. ViviVDE (`ViviVDE.js`)
- **Category**: Self-Improvement
- **Responsibilities**: Handles the Vivi Development Environment logic. Evaluates code execution logs, receives improvement proposals, and catalogs repository updates.

### 19. ViviFounderAuth (`ViviFounderAuth.js`)
- **Category**: Access Control
- **Responsibilities**: Governs elevated administrative rights for the Founder's terminal, interfacing with Auth state changes.
- **Events Emitted**: `founder:recognized`

### 20. ViviReasoning (`ViviReasoning.js`)
- **Category**: Cognitive Logic
- **Responsibilities**: Manages structured reasoning threads, chain-of-thought prompt injection, and result validation checks.
- **Events Emitted**: `reasoning:analyze`, `reasoning:verified`

### 21. ViviEmotionEngine (`ViviEmotionEngine.js`)
- **Category**: Sentiment Analysis
- **Responsibilities**: Evaluates user input sentiment and updates the assistant's general mood context.
- **Events Emitted**: `emotion:change`

### 22. ViviVisionEngine (`ViviVisionEngine.js`)
- **Category**: Cognitive Logic
- **Responsibilities**: Processes raw camera frames or file attachments to generate descriptive tags and ground visual user inputs.
- **Events Emitted**: `vision:analyze`, `vision:result`

### 23. ViviAudioEngine (`ViviAudioEngine.js`)
- **Category**: Sound Processing
- **Responsibilities**: Analyzes frequency spectrum elements and maintains optimal audio filters.
- **Events Emitted**: `audio:analyze`

### 24. ViviLearningEngine (`ViviLearningEngine.js`)
- **Category**: Knowledge Persistence
- **Responsibilities**: Identifies conversation breakthroughs, user correction habits, and extracts permanent metadata for memory storage.
- **Events Emitted**: `learn:stored`

### 25. ViviConversationEngine (`ViviConversationEngine.js`)
- **Category**: Cognitive Logic
- **Responsibilities**: Analyzes the general subject matter, keeps track of the active topic index, and handles context transitions.
- **Events Emitted**: `conversation:topic`, `conversation:context`

### 26. ViviCodeAnalyzer (`ViviCodeAnalyzer.js`)
- **Category**: Self-Improvement
- **Responsibilities**: Runs code analysis and scans active project files to detect bugs, architecture drifts, or styling deviations.
- **Events Emitted**: `code_analyzer:start`, `code_analyzer:complete`

### 27. ViviNetworkDiagnostics (`ViviNetworkDiagnostics.js`)
- **Category**: Diagnostics
- **Responsibilities**: Runs ping checks, monitors API connection rates, and tracks Firestore reachability.
- **Events Emitted**: `network:status`
