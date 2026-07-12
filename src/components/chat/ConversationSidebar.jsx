import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Trash2, Download, MessageSquare } from 'lucide-react';

// Slide-in drawer listing all conversations with search, delete, and export.
export default function ConversationSidebar({
  conversations, currentId, searchQuery, setSearchQuery,
  onCreate, onSelect, onDelete, onExport, open, onClose,
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-[#0a0512] border-r border-white/10 z-50 flex flex-col"
          >
            <div className="p-4 border-b border-white/10" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
              <button
                onClick={onCreate}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-medium text-sm"
              >
                <Plus className="w-4 h-4" /> Nueva conversación
              </button>
            </div>

            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar conversaciones..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-fuchsia-400/40"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <div className="text-center text-white/30 text-sm mt-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No hay conversaciones
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => onSelect(conv.id)}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer mb-1 transition-colors ${
                      currentId === conv.id
                        ? 'bg-fuchsia-500/15 border border-fuchsia-400/20'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate">{conv.title}</p>
                      <p className="text-xs text-white/30">
                        {new Date(conv.updated_date || conv.created_date).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onExport(conv.id); }}
                      className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-white/80 transition-opacity"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                      className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}