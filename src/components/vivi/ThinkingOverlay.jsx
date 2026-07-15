import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Brain, Lightbulb, MessageSquare } from 'lucide-react';

// ThinkingOverlay — redesigned per Vivi AI character sheet.
// Shows: holographic halo above avatar, progress bar "PROCESANDO...",
// and the 4 processing steps that cycle through.
//
// Pure presentational — active prop controls visibility. No logic.

const STEPS = [
  { icon: Search,        label: 'Analizando información' },
  { icon: Brain,         label: 'Razonando' },
  { icon: Lightbulb,     label: 'Buscando soluciones' },
  { icon: MessageSquare, label: 'Generando respuesta' },
];

export default function ThinkingOverlay({ active }) {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      setStepIndex(0);
      return;
    }

    const progressTimer = setInterval(() => {
      setProgress((p) => (p >= 95 ? 95 : p + Math.random() * 8 + 2));
    }, 250);

    const stepTimer = setInterval(() => {
      setStepIndex((i) => (i + 1) % STEPS.length);
    }, 1100);

    return () => {
      clearInterval(progressTimer);
      clearInterval(stepTimer);
    };
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* ── Holographic halo above the avatar ── */}
          <motion.div
            className="absolute"
            style={{ top: '-12%', width: 200, height: 200 }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* Rotating holo ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-dashed"
              style={{ borderColor: 'rgba(0,229,255,0.5)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
            {/* Inner glow ring */}
            <motion.div
              className="absolute inset-4 rounded-full border"
              style={{ borderColor: 'rgba(138,79,255,0.6)' }}
              animate={{ rotate: -360, scale: [1, 1.05, 1] }}
              transition={{ rotate: { duration: 6, repeat: Infinity, ease: 'linear' }, scale: { duration: 2, repeat: Infinity } }}
            />
            {/* Core glow */}
            <div
              className="absolute inset-8 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(138,79,255,0.4) 0%, transparent 70%)' }}
            />
            {/* Orbiting data particles */}
            {[0, 90, 180, 270].map((angle, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{
                  top: '50%',
                  left: '50%',
                  background: '#00E5FF',
                  boxShadow: '0 0 8px rgba(0,229,255,0.8)',
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear', delay: i * 0.5 }}
              >
                <div style={{ transform: `rotate(${angle}deg) translateX(90px)` }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00E5FF' }} />
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Floating ambient particles ── */}
          {Array.from({ length: 10 }).map((_, i) => (
            <motion.span
              key={`particle-${i}`}
              className="absolute rounded-full"
              style={{
                width: 3,
                height: 3,
                left: `${(i * 37 + 15) % 80 + 10}%`,
                top: `${(i * 53) % 80 + 10}%`,
                background: i % 2 === 0 ? 'rgba(138,79,255,0.7)' : 'rgba(0,229,255,0.7)',
              }}
              animate={{ y: [0, -25, 0], opacity: [0, 0.9, 0], scale: [0.5, 1.3, 0.5] }}
              transition={{ duration: 2.5 + (i % 4) * 0.4, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
            />
          ))}

          {/* ── Progress bar + steps (positioned below the avatar) ── */}
          <motion.div
            className="absolute w-64 sm:w-72"
            style={{ bottom: '-14%' }}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {/* Steps list */}
            <div className="space-y-1.5 mb-3">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isCurrent = i === stepIndex;
                const isDone = i < stepIndex;
                return (
                  <motion.div
                    key={i}
                    className="flex items-center gap-2"
                    animate={{ opacity: isCurrent || isDone ? 1 : 0.3 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div
                      animate={{
                        scale: isCurrent ? [1, 1.2, 1] : 1,
                        color: isCurrent ? '#00E5FF' : isDone ? '#8A4FFF' : 'rgba(255,255,255,0.3)',
                      }}
                      transition={{ duration: 1, repeat: isCurrent ? Infinity : 0 }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </motion.div>
                    <span
                      className="text-[11px] font-medium uppercase tracking-wide"
                      style={{ color: isCurrent ? '#00E5FF' : isDone ? '#8A4FFF' : 'rgba(255,255,255,0.3)' }}
                    >
                      {step.label}
                    </span>
                    {isDone && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-[10px] text-purple-400"
                      >
                        ✓
                      </motion.span>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400/80">
                PROCESANDO
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #8A4FFF, #00E5FF)' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                />
              </div>
              <span className="text-[10px] font-mono text-cyan-400/80 w-8 text-right">
                {Math.round(progress)}%
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}