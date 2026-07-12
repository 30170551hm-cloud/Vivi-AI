// ViviAudioEngine — Audio intelligence beyond speech recognition.
// While ViviVoice handles STT (speech-to-text), this module adds:
//   - Noise detection (is the environment noisy?)
//   - Voice emotion detection (is the user's tone angry, calm, excited?)
//   - Audio level pattern analysis
//
// This module does NOT do speech recognition — ViviVoice owns that.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';

export default class ViviAudioEngine extends ModuleBase {
  constructor(bus) {
    super('audio_engine', bus);
    this._levelHistory = [];
    this._noiseFloor = 0.01;
    this._userTone = 'neutral';
  }

  async init(registry) {
    await super.init(registry);
    // Listen to audio level events from the voice module.
    this.subscribe(EVENTS.VOICE_AUDIO_LEVEL, (level) => this.processLevel(level));
  }

  /** Process an audio level reading and detect patterns. */
  processLevel(level) {
    if (typeof level !== 'number') return;

    this._levelHistory.push(level);
    if (this._levelHistory.length > 100) this._levelHistory.shift();

    // Update noise floor estimate (background noise level).
    const sorted = [...this._levelHistory].sort((a, b) => a - b);
    this._noiseFloor = sorted[Math.floor(sorted.length * 0.25)] || 0.01;

    // Detect tone from audio patterns.
    if (this._levelHistory.length >= 10) {
      const recent = this._levelHistory.slice(-10);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const variance = recent.reduce((a, b) => a + (b - avg) ** 2, 0) / recent.length;

      if (avg > 0.15 && variance > 0.02) this._userTone = 'excited';
      else if (avg > 0.1) this._userTone = 'energetic';
      else if (avg < 0.03) this._userTone = 'calm';
      else this._userTone = 'neutral';

      this.emit(EVENTS.AUDIO_ANALYZE, { level: avg, tone: this._userTone, noiseFloor: this._noiseFloor });
    }
  }

  /** Is the environment currently noisy? */
  isNoisy() {
    return this._noiseFloor > 0.05;
  }

  /** Get the detected user tone. */
  getUserTone() {
    return this._userTone;
  }

  /** Get the estimated noise floor. */
  getNoiseFloor() {
    return this._noiseFloor;
  }

  health() {
    return {
      name: this.name,
      healthy: this._initialized,
      tone: this._userTone,
      noiseFloor: this._noiseFloor,
    };
  }
}