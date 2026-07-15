# Vivi AI - Voice & Speech Processing

This document explains the voice intelligence engine (`src/vivi/modules/ViviVoice.js`), describing the state machines, half-duplex constraints, Speech-to-Text (STT) listeners, Text-to-Speech (TTS) synthesizers, and real-time lip-sync integrations.

---

## 1. Strict State Machine (Half-Duplex)

To prevent acoustic feedback—where the assistant hears its own speech through the microphone, leading to echo loops—Vivi AI operates on a **strict half-duplex state machine**:

```
 IDLE ──[User Mic Click]──► LISTENING ──[Final Speech detected]──► THINKING
  ▲                                                                   │
  │                                                                   ▼
 IDLE ◄────────[Speech End]──────── SPEAKING ◄───────────[Response]───┘
```

### State Machine Invariants:
- **No Self-Listening**: Speech recognition (STT) is stopped immediately before Text-to-Speech (TTS) starts.
- **Auto-Resume**: Speech recognition resumes automatically after TTS finishes, with an optional safety delay.
- **Benign Events**: Handlers ignore standard WebSpeech failures like `no-speech` or `aborted` to prevent flashing error screens.

---

## 2. Speech-to-Text (STT) Recognition

- **Native Interface**: Uses the browser's `window.SpeechRecognition` or `window.webkitSpeechRecognition`.
- **Language Priority Matrix**: Optimizes matching with regional locale priorities: `es-VE` (Venezuelan Spanish), `es-AR`, `es-MX`, `es-CO`, `es-CL`, `es-ES`, and falling back to general `es`.
- **Interim Buffering**: Processes intermediate speech segments, displaying real-time captions via the `ui:caption` event before compiling the final block.
- **Barge-In**: If the user begins speaking or manually presses the mic button while Vivi is vocalizing, the active speech generation counter (`this._speechGeneration`) increments. This invalidates any active synthesis channels and halts sound immediately.

---

## 3. Text-to-Speech (TTS) Synthesis

- **Voice Lock**: Locked to the session-preferred voice—**"Paulina"**—to ensure assistant persona continuity.
- **Chunk-Based Rendering**: Large paragraphs are split into logical text blocks of up to **45 words** to bypass WebSpeech character-limit truncations.
- **Synthesis Tuning**: Configured for maximum intelligibility:
  - Default rate: `0.85` (slightly slower, enhancing comprehension)
  - Pitch: `1.0`
  - Volume: `1.0`

---

## 4. Audio Analysis & Lip-Sync

To animate Vivi's avatar during voice responses, the Voice module emits real-time amplitude signals:

- **Browser TTS (Simulation)**: Analyzes text length and phonetics, generating simulated frequency levels between `0.0` and `1.0` to drive fluid jaw and mouth gestures.
- **Cloud TTS (Web Audio API)**: Routes the audio stream through an `AnalyserNode` connected to an `AudioContext`. Calculates real-time Root-Mean-Square (RMS) amplitude values:
  $$\text{Amplitude} = \sqrt{\frac{1}{N}\sum_{i=1}^{N} x_i^2}$$
- **Event Dispatch**: Emits `voice:audio_level` levels at a **30fps refresh rate**, which the `ViviAvatar` module maps to expressive keyframes.
