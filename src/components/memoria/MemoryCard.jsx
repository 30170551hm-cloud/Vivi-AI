import React from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';

const STATUS_STYLES = {
  active: 'bg-green-500/15 text-green-300 border-green-400/30',
  completed: 'bg-blue-500/15 text-blue-300 border-blue-400/30',
  paused: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  abandoned: 'bg-red-500/15 text-red-300 border-red-400/30',
};

const STATUS_LABELS = {
  active: 'Activo',
  completed: 'Completado',
  paused: 'Pausado',
  abandoned: 'Abandonado',
};

export default function MemoryCard({ memory, categoryLabel, onEdit, onDelete }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-400/30">
              {categoryLabel}
            </span>
            {memory.status && memory.status !== 'active' && (
              <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[memory.status] || ''}`}>
                {STATUS_LABELS[memory.status] || memory.status}
              </span>
            )}
            {memory.importance >= 4 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                ★ {memory.importance}/5
              </span>
            )}
          </div>
          {memory.key && <div className="text-sm font-medium text-white/90 mb-0.5">{memory.key}</div>}
          <p className="text-sm text-white/70 leading-relaxed">{memory.value}</p>
          {memory.tags && memory.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {memory.tags.map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">#{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(memory)} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors" aria-label="Editar">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(memory)} className="p-2 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors" aria-label="Eliminar">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}