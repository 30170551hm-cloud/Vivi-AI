// ViviAvatar — Pure animation state controller.
// CRITICAL: This module contains ZERO AI, ZERO voice, ZERO business logic.
// It is a state machine that listens to events from other modules and
// emits visual state + gesture events for the UI to render.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';

const STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
};

const GESTURES = {
  NOD: 'nod',
  DOUBT: 'doubt',
};

const GESTURE_DURATION = 1500;

export default class ViviAvatar extends ModuleBase {
  constructor(bus) {
    super('avatar', bus);
    this._state = STATES.IDLE;
    this._gesture = null;
    this._gestureTimer = null;
  }

  async init(registry) {
    await super.init(registry);

    // Map other modules' events → avatar visual states.
    this.subscribe(EVENTS.VOICE_LISTENING_START, () => this.setState(STATES.LISTENING));
    this.subscribe(EVENTS.VOICE_LISTENING_END, () => {
      if (this._state === STATES.LISTENING) this.setState(STATES.IDLE);
    });
    this.subscribe(EVENTS.CORE_THINKING, () => this.setState(STATES.THINKING));
    this.subscribe(EVENTS.VOICE_SPEAKING_START, () => this.setState(STATES.SPEAKING));
    this.subscribe(EVENTS.VOICE_SPEAKING_END, () => {
      if (this._state === STATES.SPEAKING) this.setState(STATES.IDLE);
    });

    // Listen for gesture hints from Core. _applyGesture does NOT re-emit
    // (would cause an infinite loop: emit → subscribe → emit → …).
    // It only manages the auto-clear timer. The UI hook receives the
    // original event directly from Core.
    this.subscribe(EVENTS.AVATAR_GESTURE, (gesture) => this._applyGesture(gesture));
  }

  /** Transition to a new primary state and notify subscribers. */
  setState(newState) {
    if (this._state === newState) return;
    this._state = newState;
    this.emit(EVENTS.AVATAR_STATE_CHANGE, newState);
  }

  /**
   * Internal: apply a gesture and manage the auto-clear timer.
   * Does NOT re-emit the event — the caller already emitted it on the bus.
   */
  _applyGesture(gesture) {
    this._gesture = gesture;

    if (this._gestureTimer) {
      clearTimeout(this._gestureTimer);
      this._gestureTimer = null;
    }

    // After GESTURE_DURATION, emit a clear (null) so the UI resets.
    if (gesture) {
      this._gestureTimer = setTimeout(() => {
        this._gesture = null;
        this.emit(EVENTS.AVATAR_GESTURE, null);
      }, GESTURE_DURATION);
    }
  }

  /**
   * Public: set a gesture programmatically (emits the event for the UI).
   * Use this only when calling directly — not from within a subscription.
   */
  setGesture(gesture) {
    this._applyGesture(gesture);
    this.emit(EVENTS.AVATAR_GESTURE, gesture);
  }

  getState() { return this._state; }
  getGesture() { return this._gesture; }

  /** Force idle (used by settings or manual reset). */
  reset() {
    this.setState(STATES.IDLE);
    this._applyGesture(null);
  }

  async destroy() {
    await super.destroy();
    if (this._gestureTimer) clearTimeout(this._gestureTimer);
  }
}

ViviAvatar.STATES = STATES;
ViviAvatar.GESTURES = GESTURES;