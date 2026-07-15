// ViviVoice — Speech recognition (STT) and synthesis (TTS).
//
// ════════════════════════════════════════════════════════════════════
// STRICT STATE MACHINE — HALF-DUPLEX (no self-listening)
// ════════════════════════════════════════════════════════════════════
//
//   IDLE ──[mic press]──→ LISTENING ──[final speech]──→ THINKING ──→ SPEAKING ──→ IDLE
//    ↑                                                                      │
//    └──────────────────────────────────────────────────────────────────────┘
//
// HALF-DUPLEX: STT and TTS NEVER run simultaneously.
//   When Vivi starts speaking, recognition is STOPPED immediately.
//   This prevents Vivi from hearing her own voice through the microphone,
//   which would create spurious "user input" and trigger concurrent LLM
//   requests — the root cause of topic switching and response mixing.
//
// BARGE-IN: The user can interrupt Vivi by pressing the mic button.
//   This cancels speech and restarts listening manually.
//   Automatic listening during speech is DISABLED.
//
// INVARIANTS:
//   1. STT is STOPPED before TTS starts — no self-listening, ever.
//   2. STT resumes automatically AFTER TTS finishes (with a short delay).
//   3. onresult only processes speech when state === 'listening'.
//   4. abort() is ONLY called in _forceReset() and destroy().
//   5. 'aborted' and 'no-speech' STT events are NORMAL, not errors.
//
// ════════════════════════════════════════════════════════════════════
// TRANSITION LOG (last 100 entries)
// ════════════════════════════════════════════════════════════════════
// Every state change records: old state, new state, caller (stack trace
// origin), timestamp, file, line. Accessible via getTransitionHistory().

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { backend } from '@/lib/backendClient';
import { EMOTION_VOICE, normalizeEmotion } from '../emotionConfig';
import { diagnosticsStore } from '@/lib/diagnosticsStore';
import { safeJsonStringify } from '@/lib/utils';

const DEFAULT_VOICE_CONFIG = { name: '', rate: 0.85, pitch: 1.0, volume: 1.0 };
const FEMALE_HINTS = /female|mujer|mónica|monica|paulina|helena|sabina|laura|mariana|soledad|google.*(español|spanish)|samantha|zira|microsoft.*(valentina|sabina|helena|paulina|renata)|amazon.*(laura|miguel|conchita|lucia)/i;
const LANG_PRIORITY = ['es-VE', 'es-AR', 'es-MX', 'es-CO', 'es-CL', 'es-419', 'es-ES', 'es-US', 'es'];

// Vivi's permanent voice — Paulina. Locked for the entire session, never switches.
const PREFERRED_VOICE_NAME = 'Paulina';
const MAX_WORDS_PER_CHUNK = 45;

// Delays
const ONEND_RESTART_MS = 0;         // Zero-delay auto-resume — instant transition speak→listen

// STT errors that are NORMAL — never logged as errors, never trigger recovery
const BENIGN_STT_ERRORS = new Set(['aborted', 'no-speech']);

export default class ViviVoice extends ModuleBase {
  constructor(bus) {
    super('voice', bus);
    this._recognition = null;
    this._synthesis = null;
    this._voices = [];
    this._lang = 'es-ES';

    // ── State machine ──
    this._state = 'idle'; // 'idle' | 'listening' | 'thinking' | 'speaking'
    this._conversationActive = false;

    // ── Recognition tracking ──
    this._recognitionActive = false;  // Is the SpeechRecognition instance currently running?
    this._restartTimer = null;        // Single restart timer — one owner at a time
    this._restartReason = null;       // Who scheduled the current restart?

    // ── Capabilities ──
    this._supported = { stt: false, tts: false };
    this._unlocked = false;
    this._voiceConfig = { ...DEFAULT_VOICE_CONFIG };
    this._unlockHandlers = null;
    this._audioFallback = null;
    this._voicesReady = false;
    this._selectedVoiceInfo = null;
    this._voiceStatus = 'idle';
    this._lastError = null;
    this._env = null;
    this._emotion = 'neutral';
    this._lockedVoice = null;  // Single voice — locked for the entire session
    this._speechGeneration = 0;  // Increments on each speak() — prevents stale utterances from barge-in

    // ── Audio analysis for lip sync ──
    // Real amplitude data from AnalyserNode (cloud TTS) or natural simulation (browser TTS).
    // Emitted as VOICE_AUDIO_LEVEL events (0.0–1.0) for the avatar to drive lip sync.
    this._lipSyncTimer = null;
    this._audioAnalyser = null;
    this._analysisSource = null;
    this._analysisAudioCtx = null;

    // ── Transition history (last 100) ──
    this._transitionHistory = [];
    this._maxHistory = 100;

    // ── Silence-based auto-finalization ──
    this._latestInterimText = '';
    this._interimSilenceTimer = null;
  }

  async init(registry) {
    await super.init(registry);
    this._env = this._detectEnvironment();
    this._setupSTT();
    this._setupTTS();
    this._loadVoiceConfig();
    this._diag('Environment detected', this._env);
    this._diag('Support', { stt: this._supported.stt, tts: this._supported.tts });

    this.subscribe(EVENTS.SETTINGS_UPDATED, () => this._loadVoiceConfig());
    this.subscribe(EVENTS.AVATAR_EMOTION, (emotion) => { this._emotion = normalizeEmotion(emotion); });
    this.subscribe(EVENTS.CORE_REPLY, ({ text, lang }) => this.speak(text, lang));
    this.subscribe(EVENTS.VAD_BARGE_IN, () => this._handleBargeIn());
    this._setupGlobalUnlock();
  }

  // ════════════════════════════════════════════════════════════════════
  // TRANSITION LOG
  // ════════════════════════════════════════════════════════════════════

  /**
   * Record a state transition with full provenance.
   * Captures: old state, new state, caller, timestamp, file, line.
   */
  _logTransition(oldState, newState, reason) {
    const stack = new Error().stack || '';
    // Extract the 3rd stack frame (1=Error, 2=_logTransition, 3=caller)
    const frames = stack.split('\n').map((l) => l.trim());
    const callerFrame = frames[2] || 'unknown';
    // Extract file and line from the frame
    const match = callerFrame.match(/at\s+(.+?)\s+\((.+?):(\d+):\d+\)/);
    const caller = match ? match[1] : 'anonymous';
    const file = match ? match[2] : 'unknown';
    const line = match ? match[3] : '?';

    const entry = {
      oldState,
      newState,
      reason: reason || 'unspecified',
      caller,
      file,
      line,
      timestamp: new Date().toISOString(),
      recognitionActive: this._recognitionActive,
      conversationActive: this._conversationActive,
    };

    this._transitionHistory.push(entry);
    if (this._transitionHistory.length > this._maxHistory) {
      this._transitionHistory.shift();
    }

    console.log(
      `[ViviVoice] STATE: ${oldState} → ${newState} | reason: ${reason} | caller: ${caller} | ${file}:${line} | ${entry.timestamp}`
    );
  }

  getTransitionHistory() {
    return [...this._transitionHistory];
  }

  // ════════════════════════════════════════════════════════════════════
  // STATE MACHINE — STRICT TRANSITIONS
  // ════════════════════════════════════════════════════════════════════

  /**
   * The ONLY way to change state. Validates transitions and logs them.
   * Allowed transitions:
   *   idle → listening
   *   listening → thinking
   *   listening → idle
   *   thinking → speaking
   *   thinking → idle
   *   speaking → idle
   *   speaking → listening (barge-in)
   *   any → idle (force reset)
   */
  _transition(newState, reason = 'unspecified') {
    if (this._state === newState) return;

    const old = this._state;
    const allowed = this._isTransitionAllowed(old, newState);

    if (!allowed) {
      console.warn(
        `[ViviVoice] BLOCKED transition: ${old} → ${newState} (reason: ${reason}). ` +
        `Current state: ${this._state}`
      );
      this._logTransition(old, newState, `BLOCKED: ${reason}`);
      return;
    }

    this._state = newState;
    this._logTransition(old, newState, reason);
  }

  _isTransitionAllowed(from, to) {
    // Half-duplex: STT and TTS never run simultaneously.
    // Linear flow: idle → listening → thinking → speaking → idle
    // Manual barge-in allows speaking → idle → listening.
    // listening → speaking is allowed for the greeting flow (speak() called
    // while listening). _forceStopRecognition ensures STT is stopped first.
    const valid = {
      'idle': ['listening', 'speaking', 'thinking', 'idle'],
      'listening': ['thinking', 'idle', 'listening', 'speaking'],
      'thinking': ['speaking', 'idle', 'thinking'],
      'speaking': ['idle', 'thinking', 'speaking'],
    };
    return (valid[from] || []).includes(to);
  }

  // ════════════════════════════════════════════════════════════════════
  // RECOGNITION CONTROL — GUARDED WRAPPERS
  // ════════════════════════════════════════════════════════════════════

  /**
   * Start recognition with a guard against double-start.
   * Returns true if started, false if skipped (already running or wrong state).
   */
  _startRecognition(reason = 'unspecified') {
    if (!this._recognition) return false;

    // Full-duplex: recognition can start in ANY state, including speaking.
    // Vivi listens while she talks — the user can interrupt anytime.
    if (this._recognitionActive) {
      this._diag('Blocked _startRecognition: already active', { reason });
      return false;
    }

    try {
      this._recognition.start();
      this._recognitionActive = true;
      this._diag('Recognition started', { reason });
      return true;
    } catch (e) {
      // InvalidStateError: recognition is still active browser-side (onend
      // from a previous stop/abort hasn't fired yet). Force-abort and retry
      // after a short delay — gives the browser time to process the abort.
      if (e.name === 'InvalidStateError' || String(e.message).includes('already started')) {
        this._diag('Recognition still active — aborting and retrying', { reason });
        try { this._recognition.abort(); } catch { /* noop */ }
        this._recognitionActive = false;
        this._clearRestartTimer();
        this._restartReason = `InvalidStateError retry: ${reason}`;
        this._restartTimer = setTimeout(() => {
          this._restartTimer = null;
          this._restartReason = null;
          if (this._conversationActive && !this._recognitionActive) {
            this._startRecognition(`retry: ${reason}`);
          }
        }, 250); // Safe 250ms delay for browser to clear state
        return false;
      }
      this._diagError('recognition.start() threw', this._extractError(e));
      return false;
    }
  }

  /**
   * Stop recognition gracefully. Uses stop(), NOT abort().
   * Safe to call even if recognition is not active.
   */
  _stopRecognition(reason = 'unspecified') {
    if (!this._recognition) return;
    if (!this._recognitionActive) {
      this._diag('Recognition stop skipped: not active', { reason });
      return;
    }
    try {
      this._recognition.stop();
      this._diag('Recognition stopped', { reason });
    } catch (e) {
      this._diag('Recognition stop() threw (ignoring)', { reason, error: e.message });
    }
    // Note: _recognitionActive is set to false in onend, not here —
    // stop() is async; recognition is truly inactive when onend fires.
  }

  /**
   * Force-stop recognition immediately using abort().
   * Unlike _stopRecognition (which uses stop() and waits for onend),
   * this sets _recognitionActive = false RIGHT AWAY — needed when we
   * want to restart STT quickly (barge-in, speak start, toggle mic).
   * abort() discards pending results, which is fine in these cases
   * because we're either about to speak or about to listen fresh.
   */
  _forceStopRecognition(reason = 'unspecified') {
    this._clearInterimSilenceTimer();
    this._latestInterimText = '';
    if (!this._recognition) return;
    if (this._recognitionActive) {
      try { this._recognition.abort(); } catch { /* noop */ }
    }
    this._recognitionActive = false;
    this._diag('Recognition force-stopped', { reason });
  }

  /**
   * Cancel any pending restart timer.
   */
  _clearRestartTimer() {
    if (this._restartTimer) {
      clearTimeout(this._restartTimer);
      this._restartTimer = null;
      this._restartReason = null;
    }
  }

  /**
   * Schedule a single restart. Only one timer can exist at a time.
   */
  _scheduleRestart(delayMs, reason) {
    this._clearRestartTimer();
    this._restartReason = reason;
    this._restartTimer = setTimeout(() => {
      this._restartTimer = null;
      this._restartReason = null;
      // Restart recognition if the conversation is active and STT isn't running.
      // Handles two cases:
      //   - state 'idle': after speech ended → transition to listening, start STT
      //   - state 'listening': STT ended unexpectedly (silence timeout) → just restart STT
      // Never restart during 'speaking' or 'thinking' — prevents self-listening.
      if (this._conversationActive && !this._recognitionActive) {
        if (this._state === 'idle') {
          this._transition('listening', `restart: ${reason}`);
        }
        if (this._state === 'idle' || this._state === 'listening') {
          this._startRecognition(`restart: ${reason}`);
        }
      }
    }, delayMs);
  }

  // ════════════════════════════════════════════════════════════════════
  // ENVIRONMENT
  // ════════════════════════════════════════════════════════════════════

  _detectEnvironment() {
    if (typeof window === 'undefined') return { platform: 'server' };
    const ua = navigator.userAgent || '';
    const env = {
      userAgent: ua.slice(0, 120),
      platform: 'unknown',
      browser: 'unknown',
      inIframe: false,
      isBuilderPreview: false,
      speechSynthesisExists: 'speechSynthesis' in window,
    };
    try {
      env.inIframe = window.self !== window.top;
      env.isBuilderPreview = window.location.hostname.includes('base44') || window.location.hostname.includes('run.app') || env.inIframe;
    } catch { env.isBuilderPreview = true; env.inIframe = true; }
    if (/iPhone|iPad|iPod/i.test(ua)) { env.platform = 'ios'; env.browser = /CriOS/i.test(ua) ? 'chrome-ios' : 'safari'; }
    else if (/Android/i.test(ua)) { env.platform = 'android'; env.browser = /Chrome/i.test(ua) ? 'chrome' : 'webview'; }
    else if (/Mac/i.test(ua)) { env.platform = 'macos'; env.browser = /Safari/i.test(ua) && !/Chrome/i.test(ua) ? 'safari' : 'chrome'; }
    else if (/Win/i.test(ua)) { env.platform = 'windows'; env.browser = /Edg/i.test(ua) ? 'edge' : 'chrome'; }
    else if (/Linux/i.test(ua)) { env.platform = 'linux'; env.browser = 'chrome'; }
    if (/wv|WebView/i.test(ua)) { env.platform = 'webview'; env.browser = 'webview'; }
    return env;
  }

  _setupGlobalUnlock() {
    if (typeof window === 'undefined') return;
    this._unlockHandlers = {
      click: () => this._tryUnlock(),
      touchend: () => this._tryUnlock(),
      keydown: () => this._tryUnlock(),
    };
    Object.entries(this._unlockHandlers).forEach(([evt, handler]) => {
      window.addEventListener(evt, handler, { once: true, passive: true });
    });
  }

  _tryUnlock() {
    if (this._unlocked) return;
    this._diag('Attempting global audio and speech unlock via user gesture');
    
    // 1. Unlock Web Speech Synthesis & force voice population on Safari/iOS
    if (this._supported.tts && this._synthesis) {
      try {
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        this._synthesis.speak(u);
        
        // Force re-fetch of voices immediately during user gesture to populate Safari voices list
        const voices = this._synthesis.getVoices() || [];
        if (voices.length > 0) {
          this._voices = voices;
          this._voicesReady = true;
          this._setVoiceStatus('voice_ready');
          this.emit(EVENTS.VOICE_VOICES_LOADED, voices.length);
          this._diag('Voices populated successfully during user unlock', voices.length);
        }
      } catch (e) {
        console.warn('[ViviVoice] Failed to trigger empty speechSynthesis utterance:', e);
      }
    }

    // 2. Create and unlock a persistent HTMLAudioElement for iOS Safari Cloud TTS fallback
    try {
      if (!this._unlockedAudio && typeof window !== 'undefined') {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        // Tiny base64 silent WAV file to warm up and unlock the hardware audio channel
        audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA';
        audio.play()
          .then(() => {
            this._unlockedAudio = audio;
            this._diag('HTMLAudioElement successfully unlocked for Safari iOS');
          })
          .catch((err) => {
            this._diag('HTMLAudioElement unlock playback was skipped or postponed', err?.message);
          });
      }
    } catch (err) {
      console.warn('[ViviVoice] Failed to configure unlocked HTMLAudioElement fallback:', err);
    }

    this._unlocked = true;
    this._removeUnlockListeners();
  }

  _removeUnlockListeners() {
    if (!this._unlockHandlers || typeof window === 'undefined') return;
    Object.entries(this._unlockHandlers).forEach(([evt, handler]) => {
      window.removeEventListener(evt, handler);
    });
    this._unlockHandlers = null;
  }

  _loadVoiceConfig() {
    const settings = this.registry?.get('settings');
    if (!settings) return;
    const prefs = settings.getPrefs();

    // Voice rate/pitch/volume from settings — but the voice NAME is locked to Paulina.
    // Once Paulina is locked, NEVER unlock — settings changes must not switch the voice.
    this._voiceConfig = {
      name: this._lockedVoice?.name || PREFERRED_VOICE_NAME,
      rate: prefs.voice_rate ?? DEFAULT_VOICE_CONFIG.rate,
      pitch: prefs.voice_pitch ?? DEFAULT_VOICE_CONFIG.pitch,
      volume: prefs.voice_volume ?? DEFAULT_VOICE_CONFIG.volume,
    };
    this._lang = settings.getLanguage();
    if (this._recognition) this._recognition.lang = this._lang;
  }

  // ════════════════════════════════════════════════════════════════════
  // ERROR EXTRACTION & DIAGNOSTICS
  // ════════════════════════════════════════════════════════════════════

  _extractError(error) {
    if (!error) return { name: 'Unknown', message: 'No error details available', stack: null };
    if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
    if (typeof error === 'string') return { name: 'Error', message: error, stack: null };
    return {
      name: error.name || error.error || 'Error',
      message: error.message || error.error || error.detail || safeJsonStringify(error),
      stack: error.stack || null,
    };
  }

  _diag(message, data = null) {
    console.log(`[ViviVoice] ${message}`, data || '');
    this.emit(EVENTS.VOICE_DIAGNOSTIC, { message, data, timestamp: Date.now() });
  }

  _diagError(message, error = null) {
    const ext = this._extractError(error);
    console.log(`[ViviVoice] [Error] ${message}`, ext);
    this._lastError = { message, ...ext, timestamp: Date.now() };
    const dataStr = `${ext.name}: ${ext.message}${ext.stack ? '\n' + ext.stack.split('\n').slice(0, 5).join('\n') : ''}`;
    this.emit(EVENTS.VOICE_DIAGNOSTIC, { message, data: dataStr, isError: true, timestamp: Date.now() });
    this.emit(EVENTS.VOICE_STATUS, 'error');
    setTimeout(() => {
      if (this._voiceStatus === 'error') {
        this._setVoiceStatus(this._state === 'speaking' ? 'speaking' : 'idle');
      }
    }, 2000);
  }

  _setVoiceStatus(status) {
    this._voiceStatus = status;
    this.emit(EVENTS.VOICE_STATUS, status);
  }

  // ════════════════════════════════════════════════════════════════════
  // SILENCE-BASED AUTO-FINALIZATION
  // ════════════════════════════════════════════════════════════════════

  _startInterimSilenceTimer() {
    this._clearInterimSilenceTimer();
    this._interimSilenceTimer = setTimeout(() => {
      this._interimSilenceTimer = null;
      if (this._state === 'listening' && this._latestInterimText.trim()) {
        const text = this._latestInterimText.trim();
        this._latestInterimText = '';
        this._diag('Interim silence auto-finalization triggered', { text });
        diagnosticsStore.updateStep('stt', 'exitoso', `Texto auto-finalizado por silencio: "${text}"`);
        this._transition('thinking', 'interim silence auto-finalization');
        this.emit(EVENTS.VOICE_LISTENING_END);
        this._forceStopRecognition('interim silence auto-finalization');
        this.emit(EVENTS.VOICE_USER_SPEECH, text);
      }
    }, 1800); // 1.8 seconds of silence to auto-finalize
  }

  _clearInterimSilenceTimer() {
    if (this._interimSilenceTimer) {
      clearTimeout(this._interimSilenceTimer);
      this._interimSilenceTimer = null;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // STT (Speech-to-Text)
  // ════════════════════════════════════════════════════════════════════

  _setupSTT() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;

    this._supported.stt = true;
    const rec = new SR();
    rec.continuous = true;   // Full-duplex: continuous listening even while speaking
    rec.interimResults = true;
    rec.lang = this._lang;

    rec.onstart = () => {
      this._recognitionActive = true;
      this._diag('Recognition onstart');
      diagnosticsStore.updateStep('mic', 'activo', 'Micrófono activo');
      diagnosticsStore.updateStep('stt', 'escuchando', 'Escuchando al usuario...');
      diagnosticsStore.updateStep('avatar', 'activo', 'Avatar escuchando (animación activa)');
    };

    rec.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }

      // Guard: only process speech when in 'listening' state.
      // STT is stopped during 'speaking' and 'thinking' to prevent
      // Vivi from hearing herself or processing partial echoes.
      if (this._state !== 'listening') {
        this._diag('onresult ignored (not listening)', { state: this._state });
        return;
      }

      if (interim) {
        this.emit(EVENTS.VOICE_INTERIM, interim);
        if (interim.trim()) {
          this._latestInterimText = interim;
          this._startInterimSilenceTimer();
        }
      }

      if (final.trim()) {
        this._clearInterimSilenceTimer();
        this._latestInterimText = '';
        diagnosticsStore.updateStep('stt', 'exitoso', `Texto final: "${final.trim()}"`);
        this._transition('thinking', 'final speech result');
        this.emit(EVENTS.VOICE_LISTENING_END);
        this.emit(EVENTS.VOICE_USER_SPEECH, final.trim());
      }
    };

    rec.onend = () => {
      this._recognitionActive = false;
      this._diag('Recognition onend', { state: this._state, conversationActive: this._conversationActive });

      // Auto-restart recognition if the conversation is active and we're in
      // a state where listening should continue:
      //   - 'idle': after Vivi finishes speaking → resume listening
      //   - 'listening': STT ended unexpectedly (silence timeout on mobile) → keep listening
      // During 'speaking' and 'thinking', recognition stays OFF — it will be
      // resumed by _handleSpeechEnd() after Vivi finishes talking.
      if (this._conversationActive && (this._state === 'idle' || this._state === 'listening')) {
        this._scheduleRestart(ONEND_RESTART_MS, `onend: restart during ${this._state}`);
      }
    };

    rec.onerror = (e) => {
      this._recognitionActive = false;

      // 'aborted' and 'no-speech' are NORMAL events, not errors.
      // They fire every time stop()/abort() is called or when silence is detected.
      // Do NOT log them as errors or trigger recovery.
      if (BENIGN_STT_ERRORS.has(e.error)) {
        this._diag(`Recognition benign event: ${e.error}`, { state: this._state });
        diagnosticsStore.updateStep('stt', 'idle', `Silencio: ${e.error}`);
        return;
      }

      // Real errors — log and recover
      diagnosticsStore.updateStep('mic', 'error', `Fallo de hardware / permisos: ${e.error}`);
      diagnosticsStore.updateStep('stt', 'error', `Error STT: ${e.error}`);
      this._diagError('SpeechRecognition error', {
        name: 'SpeechRecognitionError',
        message: e.error || 'Unknown STT error',
        type: e.type,
        stack: new Error().stack,
      });

      // Permission errors — stop conversation
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this._conversationActive = false;
        this._forceReset('STT permission denied');
        return;
      }

      // Other errors — force reset and recover
      this._forceReset(`STT error: ${e.error}`);
    };

    this._recognition = rec;
  }

  // ════════════════════════════════════════════════════════════════════
  // TTS (Text-to-Speech)
  // ════════════════════════════════════════════════════════════════════

  _setupTTS() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this._diagError('speechSynthesis NOT available', {
        name: 'NoTTS',
        message: `Platform: ${this._env?.platform}, Browser: ${this._env?.browser}`,
      });
      return;
    }
    this._supported.tts = true;
    this._synthesis = window.speechSynthesis;
    this._voices = this._synthesis.getVoices();
    this._diag('TTS initialized. Initial voices:', this._voices.length);

    if (this._voices.length > 0) {
      this._voicesReady = true;
      this._setVoiceStatus('voice_ready');
      this.emit(EVENTS.VOICE_VOICES_LOADED, this._voices.length);
    } else {
      this._setVoiceStatus('loading_voices');
    }

    this._synthesis.onvoiceschanged = () => {
      this._voices = this._synthesis.getVoices();
      if (this._voices.length > 0 && !this._voicesReady) {
        this._voicesReady = true;
        this._setVoiceStatus('voice_ready');
        this.emit(EVENTS.VOICE_VOICES_LOADED, this._voices.length);
        this._diag('Voices loaded:', this._voices.length);
      }
      // Re-pick Paulina if she wasn't available before but is now.
      if (this._voices.length > 0 && (!this._lockedVoice || this._lockedVoice.name.toLowerCase() !== PREFERRED_VOICE_NAME.toLowerCase())) {
        const paulina = this._voices.find((v) => v.name && v.name.toLowerCase().includes(PREFERRED_VOICE_NAME.toLowerCase()));
        if (paulina) this._lockVoice(paulina);
      }
    };
  }

  _ensureVoices() {
    if (this._voicesReady && this._voices.length > 0) return Promise.resolve(true);
    if (!this._supported.tts) return Promise.resolve(false);
    this._setVoiceStatus('loading_voices');
    return new Promise((resolve) => {
      let elapsed = 0;
      const interval = setInterval(() => {
        const voices = this._synthesis?.getVoices() || [];
        if (voices.length > 0) {
          clearInterval(interval);
          this._voices = voices;
          this._voicesReady = true;
          this._setVoiceStatus('voice_ready');
          this.emit(EVENTS.VOICE_VOICES_LOADED, voices.length);
          resolve(true);
        } else if (elapsed >= 3000) {
          clearInterval(interval);
          resolve(false);
        }
        elapsed += 200;
      }, 200);
    });
  }

  _pickVoice(lang) {
    if (!this._voices.length) return null;

    // ── Locked voice policy ──
    // Vivi uses Paulina for the entire session. Once locked, it never changes.
    if (this._lockedVoice) {
      const stillExists = this._voices.find((v) => v.name === this._lockedVoice.name);
      if (stillExists) return stillExists;
    }

    // First priority: find Paulina by exact name (case-insensitive).
    const paulina = this._voices.find(
      (v) => v.name && v.name.toLowerCase() === PREFERRED_VOICE_NAME.toLowerCase()
    );
    if (paulina) { this._lockVoice(paulina); return paulina; }

    // Second priority: any voice with "Paulina" in the name (partial match).
    const paulinaPartial = this._voices.find(
      (v) => v.name && v.name.toLowerCase().includes(PREFERRED_VOICE_NAME.toLowerCase())
    );
    if (paulinaPartial) { this._lockVoice(paulinaPartial); return paulinaPartial; }

    // Fallback: best Spanish female voice if Paulina isn't available.
    const spanishFemale = this._voices.filter((v) => FEMALE_HINTS.test(v.name) && /^es/i.test(v.lang));
    for (const code of LANG_PRIORITY) {
      const match = spanishFemale.find((v) => v.lang?.toLowerCase().startsWith(code.toLowerCase()));
      if (match) { this._lockVoice(match); return match; }
    }
    const anySpanish = this._voices.find((v) => /^es/i.test(v.lang));
    if (anySpanish) { this._lockVoice(anySpanish); return anySpanish; }
    const fallback = this._voices[0];
    if (fallback) this._lockVoice(fallback);
    return fallback;
  }

  /**
   * Lock a single voice for the entire session.
   * Once locked, _pickVoice always returns this voice — no switching.
   */
  _lockVoice(voice) {
    this._lockedVoice = voice;
    this._persistVoiceName(voice.name);
    this._diag('Voice locked for session', { name: voice.name, lang: voice.lang });
  }

  _loadSavedVoiceName() {
    try { return localStorage.getItem('vivi_voice_name') || ''; } catch { return ''; }
  }

  _persistVoiceName(name) {
    if (!name || name === this._voiceConfig.name) return;
    this._voiceConfig.name = name;
    try { localStorage.setItem('vivi_voice_name', name); } catch { /* noop */ }
  }

  _splitText(text) {
    // Split into natural sentence units, preserving the delimiter so the
    // TTS engine sees punctuation (which controls its own micro-pauses).
    // Ellipsis (…) and commas create natural breathing points.
    const sentences = text.match(/[^.!?;…]+[.!?;…]+|[^.!?;…]+$/g) || [text];
    const chunks = [];
    let current = '';
    let wordCount = 0;
    for (const sentence of sentences) {
      const sw = sentence.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount + sw > MAX_WORDS_PER_CHUNK && current) {
        chunks.push(current.trim());
        current = sentence;
        wordCount = sw;
      } else {
        current += sentence;
        wordCount += sw;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length ? chunks : [text];
  }

  // ════════════════════════════════════════════════════════════════════
  // LISTENING CONTROLS (public API)
  // ════════════════════════════════════════════════════════════════════

  startListening() {
    if (!this._recognition) {
      this._diagError('STT not supported', { name: 'NotSupported', message: 'SpeechRecognition not available' });
      return;
    }
    this._tryUnlock();

    // Manual barge-in: if Vivi is speaking, cancel her speech first,
    // THEN start listening. This is the ONLY way to interrupt Vivi —
    // automatic listening during speech is disabled to prevent self-hearing.
    this._conversationActive = true;

    if (this._state === 'speaking') {
      this._diag('Mic pressed during speech — cancelling speech (manual barge-in)');
      this._cancelSpeechInternal('manual barge-in');
      this._transition('idle', 'manual barge-in');
      this._forceStopRecognition('manual barge-in');
    }

    this._clearRestartTimer();
    this._transition('listening', 'mic button pressed');
    this._startRecognition('startListening');
    this.emit(EVENTS.VOICE_LISTENING_START);
  }

  stopListening() {
    this._conversationActive = false;
    this._clearRestartTimer();
    this._forceStopRecognition('stopListening');
    this._transition('idle', 'stopListening');
    this.emit(EVENTS.VOICE_LISTENING_END);
  }

  testVoice() {
    const lang = this.registry?.get('settings')?.getLanguage() || this._lang;
    this.speak('Hola, soy Vivi. Así sueno cuando hablo. Esta es una prueba del sistema de voz.', lang);
  }

  // ════════════════════════════════════════════════════════════════════
  // SPEAKING
  // ════════════════════════════════════════════════════════════════════

  async speak(text, lang) {
    this._diag('speak() called', { text: text?.slice(0, 80), lang, state: this._state });
    console.log(`[ViviVoice CHECKPOINT] 1. speak() execution started. Text: "${text?.slice(0, 50)}..."`);

    if (!text) {
      this._diag('speak() aborted: empty text');
      this._handleSpeechEnd('empty text');
      return;
    }

    const settings = this.registry?.get('settings');
    if (settings && settings.getPrefs().voice_enabled === false) {
      this._diag('speak() aborted: voice_enabled is false');
      this._handleSpeechEnd('voice disabled');
      return;
    }

    // Pre-emptively cancel any stuck browser-level TTS queues to unblock speechSynthesis
    if (this._supported.tts && this._synthesis) {
      try {
        console.log(`[ViviVoice CHECKPOINT] 9. Pre-emptively calling speechSynthesis.cancel() to prevent/clear any blocked queues.`);
        this._synthesis.cancel();
      } catch (err) {
        console.warn('[ViviVoice] Error pre-emptively cancelling synthesis:', err);
      }
    }

    // Check AudioContext state for diagnostics
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      try {
        const testCtx = new AC();
        console.log(`[ViviVoice CHECKPOINT] 4. AudioContext state check: ${testCtx.state}`);
        testCtx.close().catch(() => {});
      } catch (e) {
        console.warn('[ViviVoice] AudioContext test check failed:', e);
      }
    } else {
      console.log(`[ViviVoice CHECKPOINT] 4. AudioContext not supported on this platform.`);
    }

    // ── CRITICAL: Stop STT when TTS starts speaking ──
    // This prevents Vivi from hearing her own voice through the microphone,
    // which would create spurious "user input" and trigger concurrent LLM
    // requests — the root cause of topic switching and response mixing.
    // The user can still interrupt by pressing the mic button (manual barge-in).
    this._clearRestartTimer();
    const wasListening = this._state === 'listening';
    this._forceStopRecognition('speak: stop STT to prevent self-listening');
    // If we were listening (e.g., greeting flow), signal the UI that
    // listening has ended before transitioning to speaking.
    if (wasListening) this.emit(EVENTS.VOICE_LISTENING_END);

    // Increment speech generation — stale utterances from a previous
    // (cancelled) speech won't be spoken when their 50ms delay fires.
    this._speechGeneration++;
    const gen = this._speechGeneration;

    this._transition('speaking', 'speak() called');
    this.emit(EVENTS.VOICE_SPEAKING_START);
    diagnosticsStore.updateStep('voice', 'generando', 'Procesando voz...');
    diagnosticsStore.updateStep('avatar', 'activo', 'Avatar gesticulando (hablando)');
    // Start VAD barge-in detection — listens for user speech during TTS.
    // Uses a separate audio stream; STT is already stopped, no mic conflict.
    this.registry?.get('vad')?.startBargeInDetection(this._supported.tts);
    // Start lip sync — simulated for browser TTS, real analysis for cloud TTS.
    this._startLipSync();

    if (this._supported.tts) {
      const voicesReady = await this._ensureVoices();
      if (this._state !== 'speaking') {
        this._diag('speak() interrupted during voice loading');
        return;
      }

      if (!voicesReady || this._voices.length === 0) {
        this._diagError('No voices available — cloud TTS fallback', {
          name: 'NoVoices', message: 'Voices not loaded after timeout',
        });
        await this._speakWithFallback(text, lang, gen);
        return;
      }

      const voice = this._pickVoice(lang || this._lang);
      if (!voice) {
        this._diagError('No compatible voice — cloud TTS fallback', {
          name: 'NoVoice', message: `No voice for lang ${lang || this._lang}`,
        });
        await this._speakWithFallback(text, lang, gen);
        return;
      }

      this._selectedVoiceInfo = { name: voice.name, lang: voice.lang };
      const chunks = this._splitText(text);
      this._diag('Speaking', { chunks: chunks.length, voice: voice.name });
      await this._speakChunks(chunks, voice, lang, gen);
      return;
    }

    await this._speakWithFallback(text, lang, gen);
  }

  async _speakChunks(chunks, voice, lang, gen) {
    this._startKeepAlive();
    try {
      const emotionParams = EMOTION_VOICE[this._emotion] || EMOTION_VOICE.neutral;

      // ── Breath before speaking (Paso 2: Respira) ──
      if (this._state === 'speaking' && emotionParams.breathMs > 0) {
        await new Promise((r) => setTimeout(r, emotionParams.breathMs));
        if (gen !== this._speechGeneration) return;  // barge-in started a new speech
      }

      for (let i = 0; i < chunks.length; i++) {
        // Check generation + state before each chunk — barge-in may have cancelled
        if (gen !== this._speechGeneration || this._state !== 'speaking') {
          this._diag('Speech interrupted, stopping chunks', { chunkIndex: i });
          break;
        }
        diagnosticsStore.updateStep('voice', 'reproduciendo', `Hablando fragmento ${i + 1} de ${chunks.length} via WebSpeech...`);
        const success = await this._speakSingleChunk(chunks[i], voice, lang, gen);
        
        // If the chunk failed to start speaking (stuck/blocked browser TTS engine), fall back to Cloud TTS
        if (!success) {
          this._diag('Chunk playback failed to start. Switching entire remaining text to Cloud TTS fallback.');
          const remainingText = chunks.slice(i).join(' ');
          await this._speakWithFallback(remainingText, lang, gen);
          return;
        }

        if (i < chunks.length - 1 && gen === this._speechGeneration && this._state === 'speaking') {
          await new Promise((r) => setTimeout(r, emotionParams.pauseMs));
        }
      }
    } finally {
      this._stopKeepAlive();
    }
    // Only handle speech end if this is still the current generation —
    // prevents a stale speech from interrupting a newer one.
    if (gen === this._speechGeneration) {
      this._handleSpeechEnd('all chunks finished');
    }
  }

  /**
   * Chrome/Edge bug: speechSynthesis stops after ~15 seconds.
   * Keep-alive: pause + resume every 10s to prevent cutoff.
   */
  _startKeepAlive() {
    this._stopKeepAlive();
    this._keepAliveTimer = setInterval(() => {
      if (!this._synthesis || this._state !== 'speaking') return;
      if (this._synthesis.speaking) {
        try {
          this._synthesis.pause();
          this._synthesis.resume();
        } catch { /* noop */ }
      }
    }, 10000);
  }

  _stopKeepAlive() {
    if (this._keepAliveTimer) {
      clearInterval(this._keepAliveTimer);
      this._keepAliveTimer = null;
    }
  }

  _speakSingleChunk(text, voice, lang, gen) {
    return new Promise((resolve) => {
      const emotionParams = EMOTION_VOICE[this._emotion] || EMOTION_VOICE.neutral;

      const utter = new SpeechSynthesisUtterance(text);
      this._activeUtterance = utter; // Keep active utterance referenced on instance scope to prevent GC cutoffs on iOS Safari/Chrome
      utter.voice = voice;
      utter.lang = lang || this._lang || voice.lang;
      utter.rate = emotionParams.rate;
      utter.pitch = this._voiceConfig.pitch * emotionParams.pitch;
      utter.volume = this._voiceConfig.volume * emotionParams.volumeMod;

      console.log(`[ViviVoice CHECKPOINT] 2. SpeechSynthesisUtterance created successfully. Text length: ${text.length} chars. Rate: ${utter.rate}, Pitch: ${utter.pitch}, Volume: ${utter.volume}`);

      const voices = this._synthesis?.getVoices() || [];
      console.log(`[ViviVoice CHECKPOINT] 3. speechSynthesis.getVoices() count: ${voices.length}. Picked voice: ${voice?.name || 'default'} (${voice?.lang || 'default'})`);

      let resolved = false;
      let started = false;

      const done = (success = true) => {
        if (this._activeUtterance === utter) {
          this._activeUtterance = null;
        }
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          clearTimeout(startTimeout);
          resolve(success);
        }
      };

      // 1.5s Startup check: if onstart doesn't fire, the browser speech engine is stuck or locked
      const startTimeout = setTimeout(() => {
        if (!started && !resolved) {
          this._diag('SpeechSynthesis failed to start speaking within 1500ms (stuck/blocked engine). Cancelling queue.');
          console.log('[ViviVoice CHECKPOINT] 8. SpeechSynthesis failed to start within 1500ms. Possible browser playback block or locked engine.');
          try { this._synthesis.cancel(); } catch { /* noop */ }
          done(false); // Return false to trigger Cloud TTS fallback
        }
      }, 1500);

      utter.onstart = () => {
        started = true;
        clearTimeout(startTimeout);
        this._diag('SpeechSynthesis chunk started speaking successfully');
        console.log('[ViviVoice CHECKPOINT] 1. speechSynthesis.speak() successfully started audio playback (onstart fired)');
      };

      // Safety net: if onend never fires (Chrome/iOS bug), resolve after a dynamic period based on text length
      const dynamicTimeoutMs = Math.max(5000, (text.length * 80) + 3000);
      const timeout = setTimeout(() => {
        if (!resolved) {
          this._diag('Chunk timeout safety net triggered (dynamic fallback)', { text: text.slice(0, 40), dynamicTimeoutMs });
          done(true);
        }
      }, dynamicTimeoutMs);

      utter.onend = () => {
        console.log('[ViviVoice CHECKPOINT] 6. SpeechSynthesisUtterance.onend fired naturally.');
        done(true);
      };

      utter.onerror = (e) => {
        console.log(`[ViviVoice CHECKPOINT] 5. SpeechSynthesisUtterance.onerror fired: "${e.error}"`, e);
        if (e.error === 'canceled' || e.error === 'interrupted') {
          this._diag(`Synthesis benign event: ${e.error}`);
        } else {
          this._diagError('SpeechSynthesis error', {
            name: 'SpeechSynthesisError',
            message: e.error || 'Unknown TTS error',
            type: e.type,
            stack: new Error().stack,
          });
        }
        done(true); // Don't crash but let it continue
      };

      // Speak immediately — no artificial delay for maximum real-time fluidity.
      // Check generation: if barge-in started a new speech, don't speak this stale utterance.
      if (gen !== this._speechGeneration || this._state !== 'speaking') { done(true); return; }
      try {
        this._synthesis.resume(); // Workaround to unfreeze speech engine on Chrome/iOS
        console.log('[ViviVoice CHECKPOINT] 1. Calling speechSynthesis.speak(utter)...');
        this._synthesis.speak(utter);
      }
      catch (e) {
        console.log('[ViviVoice CHECKPOINT] 7. Silent exception caught in synthesis.speak():', e);
        this._diagError('synthesis.speak() exception', this._extractError(e));
        done(false); // Trigger fallback immediately if speak() throws
      }
    });
  }

  async _speakWithFallback(text, lang, gen) {
    this._diag('Cloud TTS fallback', { text: text.slice(0, 60), lang });
    this.registry?.get('vad')?.setWebSpeech(false);
    diagnosticsStore.updateStep('voice', 'generando', 'Llamando servicio Cloud TTS (OpenAI)...');

    let result;
    try {
      result = await backend.integrations.Core.GenerateSpeech({
        text: text.slice(0, 5000),
        language_code: (lang || this._lang).slice(0, 2),
      });
    } catch (err) {
      diagnosticsStore.updateStep('voice', 'error', `Fallo Cloud TTS: ${err?.message}`);
      this._diagError('GenerateSpeech exception', this._extractError(err));
      if (gen === this._speechGeneration) this._handleSpeechEnd('TTS fallback failed');
      return;
    }

    if (!result?.url) {
      this._diagError('GenerateSpeech returned no URL', { name: 'NoUrl', message: 'Empty response' });
      if (gen === this._speechGeneration) this._handleSpeechEnd('TTS fallback no URL');
      return;
    }

    if (gen !== this._speechGeneration || this._state !== 'speaking') {
      this._diag('speak() interrupted during TTS API call');
      return;
    }

    if (this._audioFallback) {
      try { this._audioFallback.pause(); } catch { /* noop */ }
      try {
        this._audioFallback.onended = null;
        this._audioFallback.onerror = null;
      } catch { /* noop */ }
      this._audioFallback = null;
    }

    let audio;
    if (this._unlockedAudio) {
      this._diag('Using pre-unlocked global HTMLAudioElement for cloud TTS playback');
      audio = this._unlockedAudio;
      audio.src = result.url;
    } else {
      this._diag('No pre-unlocked HTMLAudioElement found. Creating new Audio instance (may be blocked on iOS)');
      audio = new Audio(result.url);
      audio.crossOrigin = 'anonymous';
    }
    this._audioFallback = audio;

    // Switch from simulated to REAL audio analysis — cloud TTS gives us an audio stream.
    this._setupRealAudioAnalysis(audio);

    const cleanupAndResolve = (reason) => {
      try {
        audio.onended = null;
        audio.onerror = null;
      } catch { /* noop */ }
      this._audioFallback = null;
      if (gen === this._speechGeneration) {
        this._handleSpeechEnd(reason);
      }
    };

    audio.onended = () => {
      this._diag('Cloud TTS playback finished naturally');
      cleanupAndResolve('audio ended');
    };

    audio.onerror = () => {
      diagnosticsStore.updateStep('voice', 'error', 'Error en reproducción de audio de voz');
      this._diagError('Audio playback error', {
        name: 'AudioError',
        message: audio.error?.message || `Code: ${audio.error?.code}`,
        stack: null,
      });
      cleanupAndResolve('audio error');
    };

    try {
      diagnosticsStore.updateStep('voice', 'reproduciendo', 'Reproduciendo voz sintetizada...');
      audio.volume = Math.max(0, Math.min(1, this._voiceConfig.volume));
      console.log(`[ViviVoice CHECKPOINT] 8. Attempting audio.play() for fallback cloud TTS. Volume: ${audio.volume}. Src: ${audio.src}`);
      await audio.play();
      console.log('[ViviVoice CHECKPOINT] 8. Fallback cloud TTS audio.play() succeeded.');
    } catch (err) {
      console.log('[ViviVoice CHECKPOINT] 8. Fallback cloud TTS audio.play() was blocked or failed:', err);
      this._diagError('audio.play() blocked or failed', this._extractError(err));
      cleanupAndResolve('audio play blocked');
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // SPEECH CANCELLATION & END HANDLING
  // ════════════════════════════════════════════════════════════════════

  /**
   * Cancel speech internally (for barge-in). Does NOT trigger _handleSpeechEnd —
   * the caller is responsible for managing the state transition.
   */
  _cancelSpeechInternal(reason = 'unspecified') {
    this.registry?.get('vad')?.stopBargeInDetection();
    this._stopLipSync();
    this._stopKeepAlive();
    this._activeUtterance = null; // Clear the GC reference
    // Increment generation so any in-flight chunk delays know they're stale
    this._speechGeneration++;
    if (this._supported.tts) { try { this._synthesis?.cancel(); } catch { /* noop */ } }
    if (this._audioFallback) { try { this._audioFallback.pause(); } catch { /* noop */ } this._audioFallback = null; }
    this._diag('Speech cancelled', { reason });
  }

  /**
   * Public: cancel speech and return to idle.
   */
  cancelSpeech() {
    this._cancelSpeechInternal('cancelSpeech()');
    this._handleSpeechEnd('cancelSpeech()');
  }

  // ════════════════════════════════════════════════════════════════════
  // LIP SYNC — Audio level analysis for avatar mouth animation
  // ════════════════════════════════════════════════════════════════════

  /**
   * Start lip sync amplitude emission.
   * Uses simulated natural patterns for browser TTS (speechSynthesis has no audio stream).
   * When cloud TTS audio plays, _setupRealAudioAnalysis switches to real amplitude data.
   */
  _startLipSync() {
    this._stopLipSync();
    let t = 0;
    this._lipSyncTimer = setInterval(() => {
      if (this._audioAnalyser) return; // Real analysis is active — skip simulation
      t += 0.06;
      // Natural speech pattern: base rhythm + syllable variation + emphasis spikes
      const syllable = Math.abs(Math.sin(t * 3.2)) * 0.35;
      const fastVar = Math.abs(Math.sin(t * 7.5)) * 0.2;
      const emphasis = Math.random() > 0.92 ? 0.3 : 0;
      const level = Math.min(1, syllable + fastVar + emphasis + 0.15);
      this.emit(EVENTS.VOICE_AUDIO_LEVEL, level);
    }, 50);
  }

  /**
   * Set up REAL audio analysis on a cloud TTS Audio element.
   * Routes the audio through an AnalyserNode to get actual amplitude data.
   * Replaces the simulated lip sync with real frequency data.
   */
  _setupRealAudioAnalysis(audio) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;

      // If we already set up analysis for this specific Audio element, just resume the polling loop!
      if (this._analysisSource && this._analysisSourceAudioElement === audio) {
        this._diag('Reusing existing MediaElementSource for lip sync analysis');
        if (this._analysisAudioCtx && this._analysisAudioCtx.state === 'suspended') {
          this._analysisAudioCtx.resume();
        }
        
        // Restart the polling RAF loop
        const buffer = new Uint8Array(this._audioAnalyser.frequencyBinCount);
        const poll = () => {
          if (!this._audioAnalyser || this._state !== 'speaking') return;
          this._audioAnalyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            const normalized = (buffer[i] - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / buffer.length);
          const level = Math.min(1, rms * 3.5);
          this.emit(EVENTS.VOICE_AUDIO_LEVEL, level);
          this._lipSyncRAF = requestAnimationFrame(poll);
        };
        poll();
        return;
      }

      this._diag('Creating new AudioContext and MediaElementSource for audio analysis');
      this._analysisAudioCtx = new AC();
      if (this._analysisAudioCtx.state === 'suspended') {
        this._analysisAudioCtx.resume();
      }
      this._analysisSource = this._analysisAudioCtx.createMediaElementSource(audio);
      this._analysisSourceAudioElement = audio; // Track the element connected
      this._audioAnalyser = this._analysisAudioCtx.createAnalyser();
      this._audioAnalyser.fftSize = 256;
      this._audioAnalyser.smoothingTimeConstant = 0.6;
      this._analysisSource.connect(this._audioAnalyser);
      this._analysisSource.connect(this._analysisAudioCtx.destination);

      // Start polling real amplitude data
      const buffer = new Uint8Array(this._audioAnalyser.frequencyBinCount);
      const poll = () => {
        if (!this._audioAnalyser || this._state !== 'speaking') return;
        this._audioAnalyser.getByteTimeDomainData(buffer);
        // Calculate RMS — a measure of loudness
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const normalized = (buffer[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / buffer.length);
        const level = Math.min(1, rms * 3.5); // Scale up for visibility
        this.emit(EVENTS.VOICE_AUDIO_LEVEL, level);
        this._lipSyncRAF = requestAnimationFrame(poll);
      };
      poll();
      this._diag('Real audio analysis active for lip sync');
    } catch (err) {
      // Cross-origin or other error — fall back to simulated lip sync (already running)
      this._diag('Real audio analysis failed, using simulated lip sync', err?.message);
    }
  }

  /**
   * Stop lip sync emission and clean up all audio analysis resources.
   */
  _stopLipSync() {
    if (this._lipSyncTimer) {
      clearInterval(this._lipSyncTimer);
      this._lipSyncTimer = null;
    }
    if (this._lipSyncRAF) {
      cancelAnimationFrame(this._lipSyncRAF);
      this._lipSyncRAF = null;
    }
    // Emit zero level so the avatar resets to closed mouth
    this.emit(EVENTS.VOICE_AUDIO_LEVEL, 0);

    if (this._analysisSource) {
      try { this._analysisSource.disconnect(); } catch { /* noop */ }
      this._analysisSource = null;
    }
    if (this._audioAnalyser) {
      try { this._audioAnalyser.disconnect(); } catch { /* noop */ }
      this._audioAnalyser = null;
    }
    if (this._analysisAudioCtx) {
      try { this._analysisAudioCtx.close(); } catch { /* noop */ }
      this._analysisAudioCtx = null;
    }
  }

  /**
   * VAD barge-in: the user started speaking while Vivi was talking.
   * Cancels speech and immediately starts listening — no button press needed.
   * This is what makes the conversation feel truly real-time.
   */
  _handleBargeIn() {
    this._diag('VAD barge-in: user interrupted speech');
    this._cancelSpeechInternal('vad barge-in');
    this._transition('idle', 'vad barge-in');
    this._clearRestartTimer();
    // Force-stop any pending STT whose onend hasn't fired yet —
    // ensures _startRecognition isn't blocked by stale _recognitionActive.
    this._forceStopRecognition('vad barge-in');
    this._transition('listening', 'vad barge-in: auto-listen');
    this._startRecognition('vad barge-in');
    this.emit(EVENTS.VOICE_LISTENING_START);
  }

  /**
   * Called when speech ends naturally or is cancelled.
   * Transitions to idle, then auto-resumes listening after 300ms
   * if the conversation is still active.
   */
  _handleSpeechEnd(reason = 'unspecified') {
    this.registry?.get('vad')?.stopBargeInDetection();
    this._stopLipSync();
    const wasSpeaking = this._state === 'speaking';
    const wasThinking = this._state === 'thinking';

    if (wasSpeaking || wasThinking) {
      this._transition('idle', `speech end: ${reason}`);
      diagnosticsStore.updateStep('voice', 'exitoso', 'Reproducción finalizada con éxito');
      diagnosticsStore.updateStep('avatar', 'idle', 'Avatar en reposo (parpadeo natural)');
    }
    this.emit(EVENTS.VOICE_SPEAKING_END);

    // After Vivi finishes speaking (or if speaking was skipped/disabled), resume listening IMMEDIATELY
    // if the conversation is still active. Zero delay for fluid real-time conversation.
    if ((wasSpeaking || wasThinking) && this._conversationActive && this._recognition && !this._recognitionActive) {
      this._scheduleRestart(ONEND_RESTART_MS, `auto-resume after speech: ${reason}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // FORCE RESET — error recovery only
  // ════════════════════════════════════════════════════════════════════

  /**
   * Force reset everything to IDLE. Only used for error recovery.
   * This is the ONLY place abort() is called (besides destroy()).
   */
  _forceReset(reason = 'unspecified') {
    this._diag(`Force reset to IDLE (was ${this._state})`, { reason });
    this._clearRestartTimer();
    this.registry?.get('vad')?.stopBargeInDetection();
    this._stopLipSync();
    this._stopKeepAlive();

    // Only call abort() if recognition is actually active
    if (this._recognition && this._recognitionActive) {
      try { this._recognition.abort(); } catch { /* noop */ }
      this._recognitionActive = false;
    }

    if (this._supported.tts) { try { this._synthesis?.cancel(); } catch { /* noop */ } }
    if (this._audioFallback) { try { this._audioFallback.pause(); } catch { /* noop */ } this._audioFallback = null; }

    this._transition('idle', `force reset: ${reason}`);
    this.emit(EVENTS.VOICE_LISTENING_END);
    this.emit(EVENTS.VOICE_SPEAKING_END);
  }

  // ════════════════════════════════════════════════════════════════════
  // STATUS & DIAGNOSTICS
  // ════════════════════════════════════════════════════════════════════

  isListening() { return this._state === 'listening'; }
  isSpeaking() { return this._state === 'speaking'; }
  isSupported() { return this._supported; }
  getVoiceStatus() { return this._voiceStatus; }
  getState() { return this._state; }
  getEmotion() { return this._emotion; }
  setEmotion(emotion) { this._emotion = normalizeEmotion(emotion); }
  getAvailableVoices() { return [...this._voices]; }
  getVoiceConfig() { return { ...this._voiceConfig }; }

  getDiagnosticInfo() {
    return {
      env: this._env || { platform: 'unknown', browser: 'unknown' },
      sttSupported: this._supported.stt,
      ttsSupported: this._supported.tts,
      ttsEngine: this._supported.tts ? 'Web Speech API (speechSynthesis)' : 'Cloud TTS (GenerateSpeech)',
      synthesisExists: typeof window !== 'undefined' && 'speechSynthesis' in window,
      synthesisPaused: !!this._synthesis?.paused,
      synthesisPending: !!this._synthesis?.pending,
      synthesisSpeaking: !!this._synthesis?.speaking,
      voiceCount: this._voices.length,
      voices: this._voices.map(v => ({ name: v.name, lang: v.lang, isFemale: FEMALE_HINTS.test(v.name) })),
      selectedVoice: this._selectedVoiceInfo || { name: this._voiceConfig.name || 'auto', lang: this._lang },
      rate: this._voiceConfig.rate,
      pitch: this._voiceConfig.pitch,
      volume: this._voiceConfig.volume,
      lang: this._lang,
      voiceStatus: this._voiceStatus,
      state: this._state,
      conversationActive: this._conversationActive,
      recognitionActive: this._recognitionActive,
      isSpeaking: this.isSpeaking(),
      isListening: this.isListening(),
      unlocked: this._unlocked,
      voicesReady: this._voicesReady,
      lastError: this._lastError,
      transitionHistory: this._transitionHistory.slice(-20),
    };
  }

  setLanguage(lang) {
    this._lang = lang;
    if (this._recognition) this._recognition.lang = lang;
  }

  async destroy() {
    this._clearInterimSilenceTimer();
    this._latestInterimText = '';
    this._removeUnlockListeners();
    this._clearRestartTimer();
    this._stopKeepAlive();
    this._stopLipSync();
    if (this._audioFallback) { try { this._audioFallback.pause(); } catch { /* noop */ } this._audioFallback = null; }
    await super.destroy();
    this._conversationActive = false;
    if (this._recognition) {
      try { this._recognition.abort(); } catch { /* noop */ }
      this._recognitionActive = false;
      this._recognition = null;
    }
    if (this._synthesis) {
      this._synthesis.onvoiceschanged = null;
      try { this._synthesis.cancel(); } catch { /* noop */ }
    }
  }

  health() {
    return { name: this.name, healthy: this._initialized, stt: this._supported.stt, tts: this._supported.tts };
  }
}