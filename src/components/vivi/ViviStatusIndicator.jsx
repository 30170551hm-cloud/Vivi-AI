import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Volume2 } from 'lucide-react';
import { EMOTION_EMOJI, EMOTION_LABEL, normalizeEmotion } from '@/vivi/emotionConfig';

// Thinking steps cycled while Vivi processes
const THINKING_STEPS = ['Analizando', 'Razonando', 'Buscando', 'Generando'];

/**
 * Shows a prominent status badge when Vivi is thinking or speaking.
 * When speaking, displays the current emotion emoji + label alongside the caption.
 */
export default function ViviStatusIndicator({ state, emotion, caption }) {
  const emo = normalizeEmotion(emotion);
  const emoji = EMOTION_EMOJI[emo];
  const label = EMOTION_LABEL[emo];
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';

  // Cycle through thinking steps
  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    if (!isThinking) return;
    const id = setInterval(() => setStepIdx((i) => (i + 1) % THINKING_STEPS.length), 1400);
    return () => clearInterval(id);
  }, [isThinking]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md">
      {/* ── Status badge ── */}
      <AnimatePresence mode="wait">
        {isThinking && (
          <motion.div
            key="thinking-badge"
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9, transition: { duration: 0.25 } }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/15 border border-indigo-400/30 backdrop-blur-md"
          >
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Brain className="w-4 h-4 text-indigo-300" />
            </motion.div>
            <span className="text-sm font-medium text-indigo-200">
              {THINKING_STEPS[stepIdx]}
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >...</motion.span>
            </span>
          </motion.div>
        )}

        {isSpeaking && (
          <motion.div
            key="speaking-badge"
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9, transition: { duration: 0.25 } }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/30 backdrop-blur-md"
          >
            <Volume2 className="w-4 h-4 text-fuchsia-300" />
            {emoji && (
              <motion.span
                className="text-lg leading-none"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {emoji}
              </motion.span>
            )}
            <span className="text-sm font-medium text-fuchsia-200">
              {label || 'Hablando'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Caption with emotion emoji ── */}
      <AnimatePresence mode="wait">
        {caption && (
          <motion.div
            key={caption.slice(0, 40)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10, transition: { duration: 0.2 } }}
            className="flex items-start gap-2 min-h-[3rem]"
          >
            {emoji && isSpeaking && (
              <motion.span
                className="text-2xl leading-tight mt-0.5"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {emoji}
              </motion.span>
            )}
            <p className="text-center text-white/80 text-lg leading-relaxed">
              {caption}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}