// Basic tests for ViviAvatar state machine.
// Verifies the avatar has NO logic dependencies — it only reacts to events.

import { EventBus } from '../core/EventBus';
import ViviAvatar from '../modules/ViviAvatar';
import { EVENTS } from '../events';

export function runAvatarTests() {
  const results = [];
  const assert = (name, cond) => {
    results.push({ name, passed: !!cond });
    if (!cond) throw new Error(`Assertion failed: ${name}`);
  };

  const bus = new EventBus();
  const avatar = new ViviAvatar(bus);

  // Create a mock registry (avatar doesn't use it, but init requires it).
  const mockRegistry = { get: () => null };
  avatar.init(mockRegistry).then(() => {
    // 1. Starts idle
    assert('starts idle', avatar.getState() === 'idle');

    // 2. Listening event → listening state
    bus.emit(EVENTS.VOICE_LISTENING_START);
    assert('listening state', avatar.getState() === 'listening');

    // 3. Listening end → idle
    bus.emit(EVENTS.VOICE_LISTENING_END);
    assert('back to idle', avatar.getState() === 'idle');

    // 4. Thinking event → thinking state
    bus.emit(EVENTS.CORE_THINKING);
    assert('thinking state', avatar.getState() === 'thinking');

    // 5. Speaking event overrides thinking
    bus.emit(EVENTS.VOICE_SPEAKING_START);
    assert('speaking state', avatar.getState() === 'speaking');

    // 6. Speaking end → idle
    bus.emit(EVENTS.VOICE_SPEAKING_END);
    assert('idle after speaking', avatar.getState() === 'idle');

    // 7. State change emits event
    let lastEmitted = null;
    bus.on(EVENTS.AVATAR_STATE_CHANGE, (s) => { lastEmitted = s; });
    bus.emit(EVENTS.VOICE_LISTENING_START);
    assert('emits state change', lastEmitted === 'listening');

    // 8. reset() forces idle
    bus.emit(EVENTS.VOICE_SPEAKING_START);
    avatar.reset();
    assert('reset to idle', avatar.getState() === 'idle');
  });

  return results;
}