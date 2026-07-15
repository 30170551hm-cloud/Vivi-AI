# Vivi AI - Event Bus & central communication contract

This document details the central event-driven architecture of Vivi AI, specifying the event bus, central registry (`src/vivi/events.js`), events directory, and a complete interaction lifecycle.

---

## 1. Event Bus Engine (`EventBus.js`)

Decoupled modules communicate via a centralized publish-subscribe system implemented in `src/vivi/core/EventBus.js`:

```javascript
export class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => this.off(event, callback); // Unsubscribe helper
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[EventBus] Error in listener for ${event}:`, err);
      }
    });
  }
}
```

---

## 2. Centralized Events Catalogue

All event strings are registered in the `EVENTS` dictionary, preventing path typos or spelling errors.

### A. Voice & Audio Channel
- **`voice:listening_start` / `voice:listening_end`**: Fired when browser speech recognition begins or stops.
- **`voice:interim`**: Dispatched during active speech matching with provisional text fragments.
- **`voice:user_speech`**: Emitted when speech recognition is finalized. Payload: `{ text: string }`.
- **`voice:speaking_start` / `voice:speaking_end`**: Sent when synthesis audio outputs begin or conclude.
- **`voice:audio_level`**: Streamed at 30fps with active voice amplitudes to coordinate UI lip sync. Payload: `{ level: number }` (Range: `0.0` - `1.0`).
- **`vad:barge_in`**: Fired when user speech is detected during speech synthesis, causing immediate audio muting.

### B. Core Intelligence
- **`core:thinking`**: Fired when the query is sent to the LLM. Displays loading states or thinking animations.
- **`core:reply`**: Dispatched when a final text response is received. Payload: `{ text: string }`.
- **`core:error`**: Fired if prompting, parsing, or server proxies encounter failures.

### C. Aesthetic Avatar Engine
- **`avatar:state_change`**: Changes general expression states. Payload: `{ state: 'idle' | 'listening' | 'thinking' | 'speaking' }`.
- **`avatar:gesture`**: Triggers animations like nods, tilts, or waves.
- **`avatar:emotion`**: Alters visual moods (e.g. `neutral`, `happy`, `sad`, `analytical`).

### D. System Diagnostics & Administration
- **`log:added` / `log:cleared`**: Real-time logging telemetry synced to the Founder Console.
- **`founder:recognized`**: Emitted when an authorized founder session is loaded, enabling privileged tools.
- **`network:status`**: Regularly logs latency, offline statuses, and API connectivity metrics.

---

## 3. Visual Sequence of a Conversational Loop

The diagram below maps the propagation of events through the Event Bus during a standard conversational interaction:

```
[User Speaks] ──► (Speech Detected) 
                       │
                       ▼ Emit 'voice:interim' (Updates UI Caption)
                       │
                       ▼ Emit 'voice:user_speech' (Final text)
                       │
                       ├─────────────────────────────────┐
                       ▼ Disable Recognition             ▼ Dispatch to Core
               Emit 'voice:listening_end'           Emit 'core:thinking'
                       │                                 │
                       ▼                                 ▼ Update Avatar State
               (Silence Mic)                        Emit 'avatar:state_change'
                       │                                 │
                       │                                 ▼ Request LLM Context
                       │                             (Resolves Memories & Tools)
                       │                                 │
                       ◄─────────────────────────────────┘
                       │
                       ▼ LLM Return Payload
                       │
                       ├─────────────────────────────────┐
                       ▼ Trigger Audio Synthesis         ▼ Display Text Reply
               Emit 'voice:speaking_start'           Emit 'core:reply'
                       │
                       ▼ Stream Amplitude (lip-sync)
               Emit 'voice:audio_level' (0.0 - 1.0)
                       │
                       ▼ Synthesis Completed
               Emit 'voice:speaking_end'
                       │
                       ▼ Re-enable STT
               Emit 'voice:listening_start' (Restores IDLE/Listening loop)
```
