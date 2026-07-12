// ViviVAD — Voice Activity Detection for real-time barge-in.
//
// PROBLEM: SpeechRecognition (STT) is stopped during TTS (half-duplex)
// to prevent Vivi from hearing herself. But this means the user can only
// interrupt by pressing the mic button — not by just speaking.
//
// SOLUTION: A lightweight VAD that runs ONLY during TTS, using a separate
// getUserMedia stream with echoCancellation enabled. When it detects user
// speech above a threshold, it emits VAD_BARGE_IN → ViviVoice cancels TTS
// and starts listening immediately.
//
// MIC CONFLICT AVOIDANCE:
//   STT (SpeechRecognition) and VAD (getUserMedia) NEVER run simultaneously.
//   When TTS starts → STT stops, VAD starts.
//   When TTS ends   → VAD stops, STT resumes.
//   They share the microphone sequentially, never concurrently.
//
// ECHO CANCELLATION:
//   getUserMedia is called with echoCancellation: true, noiseSuppression: true.
//   This prevents Vivi's TTS output (from speakers) from triggering barge-in.
//   Works best with headphones; with speakers, the higher threshold compensates.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';

// RMS threshold for detecting speech — lowered for more responsive barge-in.
// Echo cancellation + noise suppression handle Vivi's own voice;
// this threshold catches normal-to-quiet user speech.
const BARGE_IN_THRESHOLD = 0.015;

// How long (ms) the audio must stay above threshold before confirming
// barge-in. Minimal confirmation for near-instant interruption.
const BARGE_IN_CONFIRM_MS = 120;

// Audio analysis poll interval — fast polling for low-latency detection.
const POLL_INTERVAL_MS = 30;

export default class ViviVAD extends ModuleBase {
  constructor(bus) {
    super('vad', bus);
    this._audioContext = null;
    this._analyser = null;
    this._mediaStream = null;
    this._source = null;
    this._pollTimer = null;
    this._active = false;
    this._aboveThresholdSince = 0;
  }

  async init(registry) {
    await super.init(registry);
  }

  /**
   * Start monitoring microphone for user speech (barge-in detection).
   * Called by ViviVoice when TTS begins.
   * Acquires a separate audio stream with echo cancellation.
   */
  async startBargeInDetection() {
    if (this._active) return;
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

    try {
      this._mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this._audioContext = new AC();
      if (this._audioContext.state === 'suspended') {
        await this._audioContext.resume();
      }

      this._source = this._audioContext.createMediaStreamSource(this._mediaStream);
      this._analyser = this._audioContext.createAnalyser();
      this._analyser.fftSize = 512;
      this._analyser.smoothingTimeConstant = 0.3;
      this._source.connect(this._analyser);

      this._active = true;
      this._aboveThresholdSince = 0;
      this._poll();
      this._diag('Barge-in detection active');
    } catch (err) {
      // Permission denied or hardware unavailable — barge-in simply won't work.
      // The manual mic button still functions as fallback.
      this._diag('Barge-in detection unavailable', err?.message || 'unknown error');
    }
  }

  /**
   * Audio analysis loop. Calculates RMS amplitude and checks against threshold.
   */
  _poll() {
    if (!this._active || !this._analyser) return;

    const buffer = new Uint8Array(this._analyser.frequencyBinCount);
    this._analyser.getByteTimeDomainData(buffer);
    const rms = this._calculateRMS(buffer);

    const now = Date.now();
    if (rms > BARGE_IN_THRESHOLD) {
      if (this._aboveThresholdSince === 0) {
        this._aboveThresholdSince = now;
      } else if (now - this._aboveThresholdSince >= BARGE_IN_CONFIRM_MS) {
        // Confirmed: user is speaking — trigger barge-in.
        this._diag('Barge-in detected', { rms: rms.toFixed(4) });
        this.emit(EVENTS.VAD_BARGE_IN, { rms });
        this.stopBargeInDetection();
        return;
      }
    } else {
      this._aboveThresholdSince = 0;
    }

    this._pollTimer = setTimeout(() => this._poll(), POLL_INTERVAL_MS);
  }

  /** Calculate RMS (root mean square) of audio samples — a measure of loudness. */
  _calculateRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const normalized = (buffer[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Stop monitoring and release all audio resources.
   * Called by ViviVoice when TTS ends or is cancelled.
   */
  stopBargeInDetection() {
    if (!this._active && !this._audioContext) return;
    this._active = false;

    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
    this._aboveThresholdSince = 0;

    if (this._source) {
      try { this._source.disconnect(); } catch { /* noop */ }
      this._source = null;
    }
    if (this._analyser) {
      try { this._analyser.disconnect(); } catch { /* noop */ }
      this._analyser = null;
    }
    if (this._mediaStream) {
      this._mediaStream.getTracks().forEach((track) => track.stop());
      this._mediaStream = null;
    }
    if (this._audioContext) {
      try { this._audioContext.close(); } catch { /* noop */ }
      this._audioContext = null;
    }
  }

  isActive() {
    return this._active;
  }

  health() {
    return {
      name: this.name,
      healthy: this._initialized,
      active: this._active,
      supported: typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    };
  }

  async destroy() {
    this.stopBargeInDetection();
    await super.destroy();
  }
}