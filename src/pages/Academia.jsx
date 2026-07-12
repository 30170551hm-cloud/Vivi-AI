import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACADEMIA_LEVELS, MANUAL_MODULES } from '@/vivi/modules/ViviVenezuelaManual';

// One level card — expands to show module content when clicked.
function LevelCard({ level, modules, isOpen, onToggle }) {
  return (
    <motion.div
      layout
      className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden"
      whileHover={{ borderColor: 'rgba(168,85,247,0.4)' }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 text-left touch-manipulation"
      >
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/30 to-fuchsia-500/20 border border-purple-400/30 flex items-center justify-center text-2xl">
          {level.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-purple-400/70">Nivel {level.level}</span>
          </div>
          <h3 className="text-white font-semibold text-base sm:text-lg truncate">{level.title}</h3>
          <p className="text-white/50 text-sm truncate">{level.description}</p>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} className="text-white/40 flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {modules.map((mod) => (
                <div key={mod.id} className="rounded-xl bg-black/30 border border-white/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{mod.icon}</span>
                    <h4 className="text-purple-300 font-medium text-sm">
                      Módulo {mod.id}: {mod.title}
                    </h4>
                  </div>
                  <p className="text-white/40 text-xs mb-3">{mod.summary}</p>
                  <pre className="text-white/70 text-sm whitespace-pre-wrap font-body leading-relaxed">
                    {mod.content}
                  </pre>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Academia() {
  const [openLevel, setOpenLevel] = useState(null);
  const levels = ACADEMIA_LEVELS;
  const allModules = MANUAL_MODULES;

  const getFullModulesForLevel = (level) => {
    return level.moduleIds
      .map((id) => allModules.find((m) => m.id === id))
      .filter(Boolean);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0512] via-[#0d0820] to-[#05030a] text-white">
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 20%, rgba(124,58,237,0.2), transparent 60%)' }} />

      <div className="relative max-w-3xl mx-auto px-4 py-8 sm:py-12" style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top))' }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-300 text-xs font-medium mb-4">
            🇻🇪 Manual memorizado por Vivi
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-300 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
            Academia Venezolana
          </h1>
          <p className="text-white/50 text-sm sm:text-base mt-3 max-w-md mx-auto">
            10 niveles del Castellano Venezolano que Vivi domina. Toca cada nivel para ver el contenido completo.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-8">
          {levels.map((l) => (
            <div
              key={l.level}
              className={`w-2 h-2 rounded-full transition-all ${openLevel === l.level ? 'bg-purple-400 w-6' : 'bg-white/20'}`}
            />
          ))}
        </div>

        {/* Level cards */}
        <div className="space-y-3">
          {levels.map((level) => (
            <LevelCard
              key={level.level}
              level={level}
              modules={getFullModulesForLevel(level)}
              isOpen={openLevel === level.level}
              onToggle={() => setOpenLevel(openLevel === level.level ? null : level.level)}
            />
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-10 text-center">
          <p className="text-white/30 text-xs">
            Vivi aplica este manual activamente en cada conversación. No es decorativo — es su conocimiento operativo.
          </p>
        </div>
      </div>
    </div>
  );
}