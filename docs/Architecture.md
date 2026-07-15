# Vivi AI - System Architecture

Welcome to the official system architecture reference for **Vivi AI**. This document provides an executive high-level overview of Vivi AI's design philosophy, core framework patterns, modular infrastructure, and data-flow pathways.

---

## 1. Overview & Core Philosophy

Vivi AI is a state-of-the-art virtual assistant platform built on a highly modular, event-driven, full-stack architecture. Unlike monolithic chatbot systems, Vivi AI is constructed using the **Modular Actor-Event Pattern** (MAEP), where individual subsystems (called **Modules**) are completely decoupled at compile-time and communicate exclusively through an asynchronous **Event Bus**.

### Key Architectural Pillars:
- **Zero Tight Coupling**: Modules never import or reference other modules directly. They depend only on a lightweight, central Event Bus.
- **Unified Event Registry**: A single source of truth (`src/vivi/events.js`) governs all message types.
- **Universal Provider Pattern**: Adapters allow backing infrastructure (like Firebase vs. local mock data) to be swapped without changing business logic (see ADR-0001).
- **Graceful Fault Isolation**: Any module error is isolated using try-catch safety boundaries, triggering a centralized `module:error` event without crashing the browser thread.

---

## 2. Global Architecture Layout

The following diagram illustrates the relationship between the visual UI components, the central controller/registry, the event-driven core modules, and the backend/external systems:

```
┌─────────────────────────────────────────────────────────────┐
│                       React Frontend                        │
│   (App.jsx, Vivi.jsx, useVivi Hook, Diagnostic Panel, etc.) │
└───────────────┬─────────────────────────────▲───────────────┘
                │ Actions / States            │ Events
                ▼                             │
┌─────────────────────────────────────────────┴───────────────┐
│                        Vivi Runtime                         │
│                    (Singleton Engine)                       │
│                                                             │
│   ┌───────────────────────┐       ┌─────────────────────┐   │
│   │    ModuleRegistry     │       │      EventBus       │   │
│   │                       │       │                     │   │
│   │  Holds loaded module  │◄─────►│   Dispatches the    │   │
│   │  instances in-memory  │       │  registered events  │   │
│   └───────────────────────┘       └─────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │ Orchestrates
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Active Module Ecosystem                   │
│                                                             │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│   │   ViviCore    │  │   ViviVoice   │  │  ViviMemory   │   │
│   └───────┬───────┘  └───────┬───────┘  └───────┬───────┘   │
│           │                  │                  │           │
│           │ Interacts        │ Synthesis        │ DB Sync   │
│           ▼                  ▼                  ▼           │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│   │   ViviTOOR    │  │  WebSpeech /  │  │   Firestore / │   │
│   │ (Tool Engine) │  │  ElevenLabs   │  │  LocalStorage │   │
│   └───────┬───────┘  └───────────────┘  └───────────────┘   │
│           │ Uses                                            │
│           ▼                                                 │
│   ┌───────────────┐                                         │
│   │  System Tools │ (WebSearch, Memory, MCP, Workspace, etc.)│
│   └─────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The Runtime Bootstrapper (`getVivi`)

The system bootstrap sequence resides in `src/vivi/index.js`. It exposes a singleton getter:

```javascript
export function getVivi() {
  if (_instance) return _instance;
  // Creates shared EventBus & ModuleRegistry
  // Registers all ~28 Modules
  // Triggers initAll()
}
```

The bootstrap process registers and instantiates modules sequentially, then calls their `init()` life cycle methods asynchronously. If initialization fails for any module, it emits a `module:error` but allows other systems to function normally, maintaining high application availability.

---

## 4. UI-to-Core Bridge (`useVivi`)

The React UI interfaces with the runtime singleton through a custom hook `src/vivi/hooks/useVivi.js`. 
- **State Hydration**: Listens to Event Bus updates (e.g. `avatar:state_change`, `ui:caption`, `log:added`) and maps them to local React state.
- **Command Dispatch**: Exposes clean functional callbacks (e.g. `toggleMic()`, `updateSettings()`, `deliverGreeting()`) that translate direct user gestures into event emissions or target-specific API calls.

---

## 5. Security & Isolation Boundaries

- **Sandboxed Execution**: External script analysis and code testing run inside a custom `SecuritySandboxTool` that isolates scope and prevents access to global context.
- **Authorization Context**: `ViviSecurity` intercepts safety violations and coordinates with Firebase Auth rules to lock down sensitive modules (such as VDE or the Founder Console) to certified user profiles.
- **Robust Serializer**: A central utility `safeJsonStringify` is built to prevent cycle-serialization failures across all logging pipelines and dynamic module event telemetry.
