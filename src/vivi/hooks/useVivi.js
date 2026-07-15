// useVivi — React hook that bridges the modular system to the UI.
// The UI NEVER imports modules directly. It reads state from this hook
// and calls action methods. This is the only React-facing surface.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getVivi } from '../index';
import { EVENTS } from '../events';

export function useVivi() {
  const viviRef = useRef(null);
  if (!viviRef.current) viviRef.current = getVivi();
  const vivi = viviRef.current;

  const [avatarState, setAvatarState] = useState('idle');
  const [avatarGesture, setAvatarGesture] = useState(null);
  const [avatarEmotion, setAvatarEmotion] = useState('neutral');
  const [caption, setCaption] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState({ stt: false, tts: false });
  const [user, setUser] = useState(null);
  const [voiceDiag, setVoiceDiag] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState('idle');
  const [lastConfidence, setLastConfidence] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubs = [
      vivi.on(EVENTS.AVATAR_STATE_CHANGE, setAvatarState),
      vivi.on(EVENTS.AVATAR_GESTURE, setAvatarGesture),
      vivi.on(EVENTS.AVATAR_EMOTION, setAvatarEmotion),
      vivi.on(EVENTS.UI_CAPTION, (text) => { setInterim(''); setCaption(text); }),
      vivi.on(EVENTS.VOICE_INTERIM, setInterim),
      vivi.on(EVENTS.VOICE_LISTENING_START, () => setListening(true)),
      vivi.on(EVENTS.VOICE_LISTENING_END, () => setListening(false)),
      vivi.on(EVENTS.VOICE_SPEAKING_START, () => setSpeaking(true)),
      vivi.on(EVENTS.VOICE_SPEAKING_END, () => setSpeaking(false)),
      vivi.on(EVENTS.VOICE_DIAGNOSTIC, setVoiceDiag),
      vivi.on(EVENTS.VOICE_STATUS, setVoiceStatus),
      vivi.on(EVENTS.VOICE_AUDIO_LEVEL, setAudioLevel),
      vivi.on(EVENTS.NETWORK_STATUS, ({ online }) => setOnline(online)),
      vivi.on(EVENTS.CORE_REPLY, (payload) => {
        if (payload?.confidence) setLastConfidence(payload.confidence);
      }),
      vivi.on(EVENTS.SETTINGS_UPDATED, () => {
        const settings = vivi.registry.get('settings');
        if (settings) setUser(settings.getUser());
      }),
    ];

    // Load initial state.
    const settings = vivi.registry.get('settings');
    const netDiag = vivi.registry.get('network_diagnostics');
    if (netDiag) {
      setOnline(netDiag.isOnline());
    }
    if (settings) {
      setUser(settings.getUser());
      setVoiceSupported(vivi.voice?.isSupported() || { stt: false, tts: false });
    }

    return () => unsubs.forEach((u) => u && u());
  }, [vivi]);

  // Actions — delegate to modules, never touch module internals.
  const toggleMic = useCallback(() => {
    if (!vivi.voice) return;
    if (vivi.voice?.isListening()) {
      vivi.voice.stopListening();
    } else {
      vivi.voice.startListening();
    }
  }, [vivi]);

  const sendText = useCallback((text) => {
    vivi.core?.handleInput(text);
  }, [vivi]);

  const sendWithImage = useCallback((text, imageUrl) => {
    vivi.core?.handleInputWithImage(text, imageUrl);
  }, [vivi]);

  const sendWithFile = useCallback((text, fileUrl) => {
    vivi.core?.handleInputWithFile(text, fileUrl);
  }, [vivi]);

  const cancelSpeech = useCallback(() => {
    vivi.voice?.cancelSpeech();
  }, [vivi]);

  const stopListening = useCallback(() => {
    vivi.voice?.stopListening();
  }, [vivi]);

  const testVoice = useCallback(() => {
    vivi.voice?.speak('¡Hola! Así sueno cuando hablo. ¿Cómo estás?', vivi.settings?.getLanguage());
  }, [vivi]);

  const deliverGreeting = useCallback(() => {
    return vivi.core?.deliverFounderGreeting();
  }, [vivi]);

  const hasPendingGreeting = useCallback(() => {
    return vivi.core?.hasPendingGreeting() || false;
  }, [vivi]);

  const updateSettings = useCallback(async (patch) => {
    const settings = vivi.registry.get('settings');
    if (settings) {
      const prefs = await settings.update(patch);
      setUser(settings.getUser());
      return prefs;
    }
  }, [vivi]);

  const displayCaption = interim || caption;

  return {
    // State
    avatarState,
    avatarGesture,
    avatarEmotion,
    caption: displayCaption,
    listening,
    speaking,
    voiceSupported,
    user,
    online,
    // Actions
    toggleMic,
    sendText,
    sendWithImage,
    sendWithFile,
    cancelSpeech,
    stopListening,
    testVoice,
    deliverGreeting,
    hasPendingGreeting,
    updateSettings,
    // Diagnostics
    voiceDiag,
    voiceStatus,
    lastConfidence,
    audioLevel,
    // Raw system (for advanced UI like founder panel)
    vivi,
  };
}