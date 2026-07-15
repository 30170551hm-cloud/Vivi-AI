import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

// AvatarEyes — Animated eye system that gives Vivi a sense of "presence".
//
// Since the avatar is a static image, these floating glowing eyes orbit
// around the avatar as an expressive overlay — they saccade (quick darting
// movements), blink, and change shape based on emotion and state.
//
// STATE BEHAVIORS:
//   idle       → gentle saccades, slow blink
//   listening  → eyes wide, focused, occasional nod-style movement
//   thinking   → eyes look up-right (processing), narrowed
//   speaking   → eyes move naturally with conversation rhythm
//
// EMOTION BEHAVIORS:
//   surprised  → wide open
//   angry      → narrowed, angled
//   sad        → half-closed, drooping
//   happy      → curved (smiling eyes)
//   focused    → centered, steady

const EMOTION_EYE_STYLE = {
  neutral:       { width: 28, height: 28, borderRadius: '50%', rotate: 0 },
  feliz:         { width: 30, height: 18, borderRadius: '50%', rotate: 0 },
  sorprendida:   { width: 34, height: 34, borderRadius: '50%', rotate: 0 },
  preocupada:    { width: 24, height: 20, borderRadius: '50%', rotate: -5 },
  triste:        { width: 26, height: 16, borderRadius: '50%', rotate: 8 },
  enojada:       { width: 28, height: 14, borderRadius: '50%', rotate: -10 },
  curiosa:       { width: 28, height: 26, borderRadius: '50%', rotate: 0 },
  divertida:     { width: 30, height: 16, borderRadius: '50%', rotate: 0 },
  concentrada:   { width: 24, height: 22, borderRadius: '50%', rotate: 0 },
  relajada:      { width: 28, height: 14, borderRadius: '50%', rotate: 0 },
  segura:        { width: 28, height: 24, borderRadius: '50%', rotate: 0 },
  empatica:      { width: 28, height: 22, borderRadius: '50%', rotate: 0 },
  avergonzada:   { width: 26, height: 18, borderRadius: '50%', rotate: 5 },
  cansada:       { width: 28, height: 10, borderRadius: '50%', rotate: 0 },
};

// Saccade targets — where the pupils dart to.
// Different per state to convey attention pattern.
const SACCADE_TARGETS = {
  idle:      [{ x: -3, y: -1 }, { x: 3, y: 1 }, { x: 0, y: 2 }, { x: -2, y: 0 }],
  listening: [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 2, y: 0 }, { x: 0, y: -1 }],
  thinking:  [{ x: 4, y: -4 }, { x: 5, y: -3 }, { x: 3, y: -5 }, { x: 5, y: -2 }],
  speaking:  [{ x: -2, y: 0 }, { x: 2, y: -1 }, { x: 0, y: 1 }, { x: -3, y: 0 }],
};

export default function AvatarEyes({ state = 'idle', emotion = 'neutral' }) {
  const [saccadeIndex, setSaccadeIndex] = useState(0);
  const [blinking, setBlinking] = useState(false);
  const saccadeTimerRef = useRef(null);
  const blinkTimerRef = useRef(null);

  // Saccades — quick eye movements every 1.5-4s depending on state
  useEffect(() => {
    const interval = state === 'thinking' ? 1200 : state === 'listening' ? 2000 : 3000;
    const run = () => {
      setSaccadeIndex((prev) => (prev + 1) % (SACCADE_TARGETS[state]?.length || 4));
      saccadeTimerRef.current = setTimeout(run, interval + Math.random() * 1500);
    };
    saccadeTimerRef.current = setTimeout(run, interval);
    return () => { if (saccadeTimerRef.current) clearTimeout(saccadeTimerRef.current); };
  }, [state]);

  // Blinking — natural rhythm: every 3-7s, quick close-open
  useEffect(() => {
    const run = () => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 120);
      blinkTimerRef.current = setTimeout(run, 3000 + Math.random() * 4000);
    };
    blinkTimerRef.current = setTimeout(run, 2000 + Math.random() * 3000);
    return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
  }, []);

  const eyeStyle = EMOTION_EYE_STYLE[emotion] || EMOTION_EYE_STYLE.neutral;
  const saccade = SACCADE_TARGETS[state]?.[saccadeIndex] || SACCADE_TARGETS.idle[0];
  const isThinking = state === 'thinking';
  const isListening = state === 'listening';

  // Eye glow color shifts with state
  const eyeColor = isThinking ? 'rgba(139,148,223,0.9)' :
                   isListening ? 'rgba(0,229,255,0.9)' :
                   'rgba(138,79,255,0.85)';

  return (
    <div className="absolute z-15 pointer-events-none" style={{ top: '28%', width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div className="flex gap-6 items-center">
        {/* Left eye */}
        <motion.div
          className="relative"
          animate={{
            width: blinking ? eyeStyle.width : eyeStyle.width,
            height: blinking ? 2 : eyeStyle.height,
          }}
          transition={{ duration: 0.08 }}
          style={{
            width: eyeStyle.width,
            height: eyeStyle.height,
            borderRadius: eyeStyle.borderRadius,
            background: `radial-gradient(circle, ${eyeColor} 0%, transparent 75%)`,
            transform: `rotate(${eyeStyle.rotate}deg)`,
            boxShadow: `0 0 12px ${eyeColor}`,
          }}
        >
          {/* Pupil */}
          <motion.div
            className="absolute rounded-full"
            style={{ width: 6, height: 6, background: eyeColor, top: '50%', left: '50%' }}
            animate={{
              x: saccade.x * 3,
              y: saccade.y * 3,
              opacity: blinking ? 0 : 1,
            }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          />
        </motion.div>

        {/* Right eye */}
        <motion.div
          className="relative"
          animate={{
            height: blinking ? 2 : eyeStyle.height,
          }}
          transition={{ duration: 0.08 }}
          style={{
            width: eyeStyle.width,
            height: eyeStyle.height,
            borderRadius: eyeStyle.borderRadius,
            background: `radial-gradient(circle, ${eyeColor} 0%, transparent 75%)`,
            transform: `rotate(${-eyeStyle.rotate}deg)`,
            boxShadow: `0 0 12px ${eyeColor}`,
          }}
        >
          <motion.div
            className="absolute rounded-full"
            style={{ width: 6, height: 6, background: eyeColor, top: '50%', left: '50%' }}
            animate={{
              x: saccade.x * 3,
              y: saccade.y * 3,
              opacity: blinking ? 0 : 1,
            }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          />
        </motion.div>
      </div>
    </div>
  );
}