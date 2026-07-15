# Vivi AI - Firebase Configuration & Authentication

This document outlines the **Firebase Infrastructure Layer** in Vivi AI, covering initial setup, auth adapter patterns, self-healing user profiles, and Firestore persistence rules.

---

## 1. Firebase Initialization & Fail-safe Boots

Vivi AI connects to Google Cloud Firebase services via `src/lib/firebase.js`. It parses credentials dynamically:

```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  ...
};
```

### Initialization Invariants:
- **Fallback Loading**: If credentials are unset or invalid, the app falls back gracefully to local storage mock databases to maintain interface rendering.
- **Explicit Database Sharding**: Dynamically reads custom database IDs (`firestoreDatabaseId`) from the root applet configuration to target localized Cloud regions.
- **Session Durability**: Runs an explicit initialization call:
  ```javascript
  setPersistence(auth, browserLocalPersistence)
  ```
  This ensures user tokens survive browser refreshes, F5 actions, and browser tab closing.

---

## 2. Authentication Adapter Pattern

To isolate visual components from third-party libraries, authentication processes are routed through the central `authClient` wrapper (`src/lib/authClient.js`).

This wrapper reads the `AUTH_MODE` and dynamically loads either `localAuthAdapter` or `firebaseAuthAdapter`.

```
                     ┌─────────────────────┐
                     │     AuthContext     │
                     └──────────┬──────────┘
                                │
                     ┌──────────▼──────────┐
                     │     authClient      │
                     └──────────┬──────────┘
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
     ┌───────────────────────┐     ┌───────────────────────┐
     │   localAuthAdapter    │     │  firebaseAuthAdapter  │
     │   (Local Storage)     │     │      (Firebase)       │
     └───────────────────────┘     └───────────────────────┘
```

---

## 3. Self-Healing Founder Profiles

To prevent unauthorized access to Vivi AI's system terminals and administrative dashboards, the `firebaseAuthAdapter.js` file maintains a hardcoded list of **Founder Emails**:

- `30170551hm@gmail.com` (Primary active user)
- `henrrygarciarojas@gmail.com`
- `henrry.garcia@hryet.com`
- `hryet.venezuela@gmail.com`

### Self-Healing Logic:
When a user signs in, `ensureUserProfile` checks if the user's email is in this list. 
- If the user document does not exist in the `users` Firestore collection, it provisions a profile setting `is_founder: true` and `display_name: 'Henrry Moyses García Rojas'`.
- If the document exists but lacks admin flags, it merges updates in Firestore (`setDoc(ref, { is_founder: true, display_name: ... }, { merge: true })`) to restore operational permissions.

---

## 4. Firestore Document Collections

Vivi AI stores permanent user context inside three major collections:

### A. Users Collection (`users/{uid}`)
Contains user-specific voice levels, display preferences, and authority metrics:
- `display_name` (string)
- `email` (string)
- `is_founder` (boolean)
- `voice_enabled` (boolean)
- `voice_rate` (number, default: `0.85`)
- `voice_pitch` (number, default: `1.0`)

### B. Memories Collection (`memories/{id}`)
Holds user-authored goals, routine facts, and timeline moments:
- `category` (string)
- `key` (string)
- `value` (string)
- `importance` (number, 1-10)
- `is_milestone` (boolean)
- `created_by_id` (string - matches current user UID)

### C. ChatMessage Collection (`chat_messages/{id}`)
Persists sliding history logs to provide assistant continuity:
- `role` (string: `'user'` or `'assistant'`)
- `content` (string)
- `created_by_id` (string - matches current user UID)
- `created_date` (timestamp)
