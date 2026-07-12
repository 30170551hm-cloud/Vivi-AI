import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ear, Brain, Volume2, Loader2 } from 'lucide-react';
import { EMOTION_AURA, EMOTION_EMOJI, normalizeEmotion } from '@/vivi/emotionConfig';
import AvatarEyes from '@/components/vivi/AvatarEyes';

const AVATAR_URL = 'https://media.base44.com/images/public/6a4d47f51ee7a49c8890fdcc/d7fbc6250_generated_image.png';
const AVATAR_SIZE = 'w-48 h-48 sm:w-56 sm:h-56 md:w-72 md:h-72';

// Cross-faded aura layers — each state has its own color layer.
// Color palette per Vivi AI character sheet:
// Purple #8A4FFF · Deep Purple #5E35B1 · Cyan #00E5FF
const AURA_COLORS = {
  idle: 'rgba(138,79,255,0.22)',
  listening: 'rgba(0,229,255,0.42)',
  thinking: 'rgba(139,148,223,0.38)',
  speaking: 'rgba(138,79,255,0.48)',
  doubt: 'rgba(245,158,11,0.42)',
};

const STATE_CONFIG = {
  idle:       { label: '',             icon: null,     labelClass: '' },
  listening:  { label: 'Escuchando',   icon: Ear,      labelClass: 'text-cyan-300 bg-cyan-500/15 border-cyan-400/30' },
  thinking:   { label: 'Pensando',     icon: Brain,    labelClass: 'text-indigo-300 bg-indigo-500/15 border-indigo-400/30' },
  speaking:   { label: 'Hablando',     icon: Volume2,  labelClass: 'text-fuchsia-300 bg-fuchsia-500/15 border-fuchsia-400/30' },
};

// Base head pose per state.
const HEAD_BASE = {
  idle:       { y: 0,  rotate: 0 },
  listening:  { y: 3,  rotate: 0 },
  thinking:   { y: -5, rotate: -1.5 },
  speaking:   { y: 0,  rotate: 0 },
};

// Looping micro-motion per state — subtle, organic, continuous.
const HEAD_LOOP = {
  idle:       { y: [0, -3, 0],                rotate: [0, 0.7, 0, -0.7, 0] },
  listening:  { y: [0, 2, 0, 3, 0],           rotate: [0, 0.8, 0, -0.4, 0] },
  thinking:   { y: [0, -2, 0],                rotate: [0, -1.2, 0, 1.2, 0] },
  speaking:   { y: [0, -3, 0, -2, 0],         rotate: [0, 1.2, -0.8, 0.4, 0] },
};

const HEAD_LOOP_TRANSITION = {
  idle:       { duration: 6.5, ease: 'easeInOut' },
  listening:  { duration: 4.5, ease: 'easeInOut' },
  thinking:   { duration: 5.5, ease: 'easeInOut' },
  speaking:   { duration: 1.8, ease: 'easeInOut' },
};

// Thinking process steps shown as orbiting indicators
const THINKING_STEPS = ['Analizando', 'Razonando', 'Buscando', 'Generando'];

export default function ViviAvatar({ state = 'idle', gesture = null, emotion = 'neutral', audioLevel = 0 }) {
  const cfg = STATE_CONFIG[state] || STATE_CONFIG.idle;
  const emo = normalizeEmotion(emotion);
  const emotionActive = emo !== 'neutral';
  const activeAura = gesture === 'doubt' ? 'doubt' : state;
  const StateIcon = cfg.icon;
  const isActive = state !== 'idle';

  // ── Image loading state — ensures avatar NEVER disappears ──
  // If the image URL fails (network, CORS, expired), we show a gradient
  // fallback with "Vivi" text so the avatar is ALWAYS visible.
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const handleImgError = useCallback(() => { setImgError(true); setImgLoaded(false); }, []);
  const handleImgLoad = useCallback(() => { setImgLoaded(true); setImgError(false); }, []);
  const handleRetry = useCallback(() => { setImgError(false); setImgLoaded(false); setRetryKey((k) => k + 1); }, []);

  const loopAnimate = useMemo(() => {
    if (gesture === 'nod') return { y: [0, 8, -1, 5, 0], rotate: 0 };
    if (gesture === 'doubt') return { y: -2, rotate: [-4, -2, -4, -2] };
    return HEAD_LOOP[state] || HEAD_LOOP.idle;
  }, [state, gesture]);

  const loopTransition = useMemo(() => {
    if (gesture === 'nod') return { duration: 0.9, ease: 'easeInOut' };
    if (gesture === 'doubt') return { y: { duration: 0.5, ease: 'easeOut' }, rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' } };
    return { ...(HEAD_LOOP_TRANSITION[state] || HEAD_LOOP_TRANSITION.idle), repeat: Infinity };
  }, [state, gesture]);

  // Audio-reactive scale — avatar subtly grows with voice amplitude (lip sync)
  const audioScale = state === 'speaking' ? 1 + audioLevel * 0.04 : 1;
  // Audio-reactive glow intensity
  const audioGlow = state === 'speaking' ? 40 + audioLevel * 50 : 60;

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* ── Cross-faded aura layers ── */}
      {Object.entries(AURA_COLORS).map(([key, color]) => (
        <motion.div
          key={key}
          className="absolute rounded-full"
          style={{ width: 340, height: 340, background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
          animate={{
            opacity: activeAura === key ? 1 : 0,
            scale: activeAura === key ? [1, 1.08, 1] : 1,
          }}
          transition={{
            opacity: { duration: 1.0, ease: 'easeInOut' },
            scale: { duration: state === 'speaking' ? 1.3 : 4, repeat: Infinity, ease: 'easeInOut' },
          }}
        />
      ))}

      {/* ── Emotion aura overlay ── */}
      <AnimatePresence>
        {emotionActive && (
          <motion.div
            key={`emotion-aura-${emo}`}
            className="absolute rounded-full"
            style={{ width: 300, height: 300, background: `radial-gradient(circle, ${EMOTION_AURA[emo]} 0%, transparent 65%)` }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: [1, 1.12, 1] }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.6, ease: 'easeOut' } }}
            transition={{
              opacity: { duration: 0.8, ease: 'easeInOut' },
              scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Emotion expression indicator (floating emoji) ── */}
      <AnimatePresence>
        {emotionActive && EMOTION_EMOJI[emo] && (
          <motion.div
            key={`emotion-emoji-${emo}`}
            className="absolute z-20 text-3xl select-none"
            style={{ top: '-2%' }}
            initial={{ opacity: 0, y: 12, scale: 0.3 }}
            animate={{ opacity: [0, 1, 0.7, 1], y: [12, 0, -6, 0], scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.3, transition: { duration: 0.4, ease: 'easeOut' } }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            {EMOTION_EMOJI[emo]}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LISTENING: concentric sound waves ── */}
      <AnimatePresence>
        {state === 'listening' && [0, 0.7, 1.4].map((delay) => (
          <motion.div
            key={`wave-${delay}`}
            className="absolute rounded-full border-2 border-cyan-400/40"
            style={{ width: 200, height: 200 }}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: [0.85, 1.5], opacity: [0.55, 0] }}
            exit={{ opacity: 0, scale: 1.3, transition: { duration: 0.6, ease: 'easeOut' } }}
            transition={{ duration: 2.2, repeat: Infinity, delay, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>

      {/* Listening mic pulse */}
      <AnimatePresence>
        {state === 'listening' && (
          <motion.div
            className="absolute z-30 flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/90 shadow-lg shadow-cyan-500/50"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.12, 1], opacity: 1 }}
            exit={{ scale: 0, opacity: 0, transition: { duration: 0.4, ease: 'easeOut' } }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ top: '8%' }}
          >
            <Ear className="w-5 h-5 text-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── THINKING: orbiting process indicators ── */}
      <AnimatePresence>
        {state === 'thinking' && (
          <motion.div
            className="absolute"
            style={{ width: 300, height: 300 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeOut' } }}
          >
            {/* Rotating orbit ring */}
            <motion.div
              className="absolute inset-0 rounded-full border border-dashed border-indigo-400/20"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
            {/* Orbiting thought dots */}
            {[0, 90, 180, 270].map((angle, i) => (
              <motion.div
                key={`think-${i}`}
                className="absolute w-2.5 h-2.5 rounded-full bg-indigo-400/60"
                style={{ top: '50%', left: '50%' }}
                animate={{
                  x: [Math.cos((angle * Math.PI) / 180) * 130, Math.cos(((angle + 360) * Math.PI) / 180) * 130],
                  y: [Math.sin((angle * Math.PI) / 180) * 130, Math.sin(((angle + 360) * Math.PI) / 180) * 130],
                  scale: [0.6, 1, 0.6],
                  opacity: [0.3, 0.8, 0.3],
                }}
                transition={{ duration: 4, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
              />
            ))}
            {/* Process step labels */}
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="text-xs font-medium text-indigo-300/70"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {THINKING_STEPS[Math.floor(Date.now() / 1500) % THINKING_STEPS.length]}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SPEAKING: radiating audio-reactive bars ── */}
      <AnimatePresence>
        {state === 'speaking' && (
          <motion.div
            className="absolute flex items-center justify-center"
            style={{ width: 320, height: 320 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6, ease: 'easeOut' } }}
          >
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <motion.div
                key={`bar-${i}`}
                className="absolute w-1 rounded-full bg-gradient-to-t from-fuchsia-500 to-purple-300"
                style={{ transform: `rotate(${angle}deg) translateY(-150px)`, transformOrigin: 'center' }}
                animate={{
                  height: [
                    10 + audioLevel * 10,
                    18 + audioLevel * 30,
                    12 + audioLevel * 15,
                    16 + audioLevel * 25,
                    10 + audioLevel * 10,
                  ],
                  opacity: [0.3 + audioLevel * 0.3, 0.85, 0.5, 0.75, 0.3 + audioLevel * 0.3],
                }}
                transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.05, ease: 'easeInOut' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Doubt indicator */}
      <AnimatePresence>
        {gesture === 'doubt' && (
          <motion.div
            className="absolute -top-2 z-20 text-3xl text-amber-300/80 font-bold"
            initial={{ opacity: 0, y: 10, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0.6, 1], y: [10, 0, -4, 0], scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.5, transition: { duration: 0.3, ease: 'easeOut' } }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            ?
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Avatar head: two-layer system for smooth state transitions ── */}
      <motion.div
        className="relative z-10"
        animate={HEAD_BASE[state] || HEAD_BASE.idle}
        transition={{ type: 'spring', stiffness: 50, damping: 11, mass: 0.9 }}
      >
        <motion.div
          animate={loopAnimate}
          transition={loopTransition}
        >
          {/* Avatar image — subtly scales with audio amplitude (lip sync effect) */}
          <motion.div
            className={`${AVATAR_SIZE} rounded-full overflow-hidden ring-1 ring-white/10 shadow-2xl relative`}
            animate={{ scale: audioScale }}
            transition={{ duration: 0.05 }}
            style={{ boxShadow: `0 0 ${audioGlow}px ${emotionActive ? EMOTION_AURA[emo] : AURA_COLORS[activeAura]}` }}
          >
            {/* Loading spinner — shown while image loads, never blocks the aura/eyes */}
            <AnimatePresence>
              {!imgLoaded && !imgError && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/40 to-indigo-900/40"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.4 } }}
                >
                  <Loader2 className="w-8 h-8 text-purple-300/60 animate-spin" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Fallback avatar — gradient circle with "Vivi" if image fails to load */}
            <AnimatePresence>
              {imgError && (
                <motion.div
                  className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-600/30 to-cyan-600/30 cursor-pointer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={handleRetry}
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                    V
                  </div>
                  <span className="mt-2 text-[10px] text-white/50">Tocar para reintentar</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* The actual avatar image — only rendered if no error */}
            {!imgError && (
              <img
                key={retryKey}
                src={AVATAR_URL}
                alt="Vivi"
                onLoad={handleImgLoad}
                onError={handleImgError}
                className={`w-full h-full object-cover object-top transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            )}

            {/* Natural blink — dark overlay flash */}
            <motion.div
              className="absolute inset-0 bg-black/0 pointer-events-none"
              animate={{ opacity: [0, 0, 0, 0.45, 0] }}
              transition={{ duration: 7, repeat: Infinity, times: [0, 0.92, 0.94, 0.96, 1], ease: 'easeInOut' }}
            />

            {/* Animated eyes overlay — gives Vivi a sense of presence */}
            <AvatarEyes state={state} emotion={emo} />
          </motion.div>

          {/* Speaking waveform (lip-sync visual) — driven by REAL audio amplitude */}
          <AnimatePresence>
            {state === 'speaking' && (
              <motion.div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-1 h-8"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5, transition: { duration: 0.35, ease: 'easeOut' } }}
              >
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 rounded-full bg-gradient-to-t from-fuchsia-500 to-purple-300"
                    animate={{
                      height: [
                        4 + audioLevel * 5,
                        12 + audioLevel * 25,
                        6 + audioLevel * 10,
                        10 + audioLevel * 20,
                        4 + audioLevel * 5,
                      ],
                    }}
                    transition={{ duration: 0.3, repeat: Infinity, delay: i * 0.06, ease: 'easeInOut' }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

    </div>
  );
}