import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, Keyboard, Settings2, LogOut, Power, Hand, PhoneCall } from 'lucide-react';
import { useVivi } from '@/vivi/hooks/useVivi';
import { useAuth } from '@/lib/AuthContext';
import { EVENTS } from '@/vivi/events';
import ViviAvatar from '@/components/vivi/ViviAvatar';
import ViviStatusIndicator from '@/components/vivi/ViviStatusIndicator';
import { useNavigate } from 'react-router-dom';
import SettingsPanel from '@/components/vivi/SettingsPanel';
import PageTransition from '@/components/PageTransition';

// Minimal interface — only avatar + essential controls.
// Auto-starts listening on first tap — no manual button pressing needed.
export default function Vivi() {
  const { avatarState, avatarGesture, avatarEmotion, caption, listening, audioLevel, toggleMic, cancelSpeech, stopListening, updateSettings, user, vivi, deliverGreeting, hasPendingGreeting } = useVivi();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);

  const handleLogout = () => logout(true);
  const handlePowerOff = () => {
    cancelSpeech();
    if (listening) stopListening();
  };

  // ── Auto-start conversation on first user interaction ──
  // Browser autoplay policies require a user gesture before audio/mic.
  // Once started, the conversation flows continuously like a phone call:
  //   listen → think → speak → auto-listen → speak → ...
  // The user never needs to press the mic button again — Vivi auto-resumes
  // listening after every response. The user can interrupt anytime (VAD barge-in).
  const startConversation = useCallback(() => {
    if (conversationStarted) return;
    setConversationStarted(true);

    // Start listening FIRST — this sets _conversationActive=true and unlocks audio.
    // If there's a greeting, speak() will stop recognition, deliver the greeting,
    // then _handleSpeechEnd auto-resumes listening because _conversationActive is true.
    if (vivi?.voice) {
      vivi.voice.startListening();
    }

    // If Vivi has a personalized greeting ready (founder), deliver it.
    // speak() stops STT (half-duplex), speaks the greeting, then auto-resumes
    // listening — no button press needed.
    if (hasPendingGreeting()) {
      // Small delay to let startListening() set _conversationActive before speak() stops it.
      setTimeout(() => deliverGreeting(), 100);
    }
  }, [conversationStarted, vivi, hasPendingGreeting, deliverGreeting]);

  // Listen for founder greeting readiness — triggers re-render when ready
  useEffect(() => {
    if (!vivi) return;
    const handler = () => { /* greeting prepared by core */ };
    vivi.on(EVENTS.FOUNDER_GREETING, handler);
    return () => vivi.off(EVENTS.FOUNDER_GREETING, handler);
  }, [vivi]);

  // Listen for first interaction anywhere on screen
  useEffect(() => {
    if (conversationStarted) return;
    const handler = () => startConversation();
    window.addEventListener('click', handler);
    window.addEventListener('touchend', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('touchend', handler);
    };
  }, [conversationStarted, startConversation]);

  return (
    <PageTransition>
    <div className="fixed inset-0 overflow-hidden overscroll-none bg-[#0A0A0C] text-white">
      <div className="absolute inset-0 opacity-50" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(138,79,255,0.18), transparent 55%)' }} />
      <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 80% 70%, rgba(0,229,255,0.10), transparent 50%)' }} />

      {/* Avatar — centered, full screen, ALWAYS visible */}
      <div className="relative h-full flex flex-col items-center justify-center px-6">
        <ViviAvatar state={avatarState} gesture={avatarGesture} emotion={avatarEmotion} audioLevel={audioLevel} />

        <div className="mt-8 w-full flex justify-center">
          <ViviStatusIndicator state={avatarState} emotion={avatarEmotion} caption={caption} />
        </div>
      </div>

      {/* ── Tap-to-start overlay — shown until first interaction ── */}
      <AnimatePresence>
        {!conversationStarted && (
          <motion.div
            className="absolute inset-0 z-40 flex items-end justify-center pb-32 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
          >
            <motion.div
              className="flex flex-col items-center gap-2 pointer-events-auto cursor-pointer"
              onClick={startConversation}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="px-5 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-sm font-medium">
                Toca para iniciar la llamada
              </div>
              <Hand className="w-5 h-5 text-white/40" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-right: exit + power off */}
      <div className="absolute right-4 z-30 flex items-center gap-2" style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}>
        <button
          onClick={handlePowerOff}
          className="p-3 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all touch-manipulation"
          aria-label="Apagar"
        >
          <Power className="w-5 h-5 text-white/80" />
        </button>
        <button
          onClick={handleLogout}
          className="p-3 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all touch-manipulation"
          aria-label="Salir"
        >
          <LogOut className="w-5 h-5 text-white/80" />
        </button>
      </div>

      {/* Bottom center: escuchar + hablar + configuración */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 sm:gap-5 z-30" style={{ bottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}>
        <button
          onClick={() => navigate('/chat')}
          className="p-4 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all touch-manipulation"
          aria-label="Hablar"
        >
          <Keyboard className="w-5 h-5 text-white/80" />
        </button>

        <motion.button
          onClick={toggleMic}
          whileTap={{ scale: 0.92 }}
          className={`p-6 rounded-full border transition-all shadow-xl touch-manipulation relative ${conversationStarted ? 'bg-gradient-to-br from-emerald-500 to-green-600 border-green-300' : 'bg-white/10 border-white/20 hover:bg-white/15'}`}
          aria-label={conversationStarted ? 'Llamada en vivo' : 'Escuchar'}
        >
          {conversationStarted ? <PhoneCall className="w-7 h-7 text-white" /> : (listening ? <Mic className="w-7 h-7 text-white" /> : <MicOff className="w-7 h-7 text-white/80" />)}
          {conversationStarted && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          )}
        </motion.button>

        <button
          onClick={() => setSettingsOpen(true)}
          className="p-4 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all touch-manipulation"
          aria-label="Configuración"
        >
          <Settings2 className="w-5 h-5 text-white/80" />
        </button>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={user}
        onUpdateSettings={updateSettings}
      />
    </div>
    </PageTransition>
  );
}