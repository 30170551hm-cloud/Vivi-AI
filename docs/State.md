# Vivi AI - State Management & Hydration Flow

This document outlines the state architecture of Vivi AI, detailing the separation of concerns between core engine state, React UI bindings, and persistent storage synchronization.

---

## 1. Tri-Layer State Separation

Vivi AI avoids storing all dynamic system variables in a single monolithic React state. Instead, it partitions state into three logical layers:

```
┌─────────────────────────────────────────────────────────────┐
│                 Layer 3: Permanent Storage                  │
│       (Firestore Collections / browserLocalPersistence)      │
└──────────────────────────────▲──────────────────────────────┘
                               │ Read / Sync
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Layer 2: React Context & UI                 │
│         (AuthContext, useVivi Hook, UI Component States)    │
└──────────────────────────────▲──────────────────────────────┘
                               │ Listen / Bind
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Layer 1: Runtime Engine                    │
│      (Module Memory, EventBus, Registry, Diagnostic Cache)  │
└─────────────────────────────────────────────────────────────┘
```

### A. Layer 1: Runtime Engine State
- **Storage**: Pure in-memory JavaScript objects within instantiated modules (e.g., `ViviVoice._state`, `ViviMemory._cache`).
- **Characteristics**: Fast, framework-agnostic, and unaffected by React rendering lifecycles.
- **Inter-Process Sync**: Read/write actions occur through methods and are communicated across systems via `EventBus` emissions.

### B. Layer 2: React Context & UI State
- **Storage**: Standard React hooks (`useState`, `useMemo`, `useContext`) in files like `src/lib/AuthContext.jsx` and `src/vivi/hooks/useVivi.js`.
- **Characteristics**: Reactive and optimized to trigger UI updates only when critical properties (like captions, listening flags, or user profiles) change.

### C. Layer 3: Permanent Storage
- **Storage**: Synchronized across Google Cloud Firestore and standard browser `localStorage` buckets.
- **Characteristics**: Survives browser crashes, F5 refreshes, and device switches.

---

## 2. Preventing Race Conditions & Rendering Loops

To maintain synchronization across these layers without causing performance-degrading infinite loops, Vivi AI implements several architectural guardrails:

### Dynamic Event Throttling:
- Fast-changing properties (such as real-time audio amplitudes from the microphone) bypass React state entirely or are heavily throttled.
- The `voice:audio_level` event communicates with the visual avatar canvas directly through standard refs or optimized animation frames, preventing React from executing heavy, repetitive rendering cycles at 30fps.

### Unidirectional Hydration Steps:
To ensure stable loads, especially during page refreshes (F5), the system enforces a strict, step-by-step loading sequence:
1. **Auth Hydration**: Firebase Auth resolves the active user session first.
2. **Profile Loading**: The user's matching Firestore document is retrieved.
3. **Engine Boot**: `getVivi()` is called, initializing modules and caching records in memory.
4. **UI Release**: The loading overlay fades out, releasing the interactive dashboard to the user.

---

## 3. Persistent State Hydration Flow Chart

The diagram below tracks the sequence of operations during a browser refresh (F5), ensuring the user's session and state are restored securely:

```
[Browser F5 / Refresh]
          │
          ▼
[Initialize Firebase App]
          │
          ▼
[Load Firebase Auth & Set local Persistence]
          │
          ▼
[onAuthStateChanged triggers]
          │
      ┌───┴──────────────────────────┐
      ▼ (Session Active)             ▼ (No Session)
[Fetch Users/{uid} profile]     [Redirect to /login]
          │
          ▼
[Instantiate & Boot Vivi via getVivi()]
          │
          ▼
[ViviMemory loads permanent context]
  (Restores memories & conversation history)
          │
          ▼
[Sync LLM Provider configs to Cache]
          │
          ▼
[Render Dashboard UI & Release interactive controls]
```
