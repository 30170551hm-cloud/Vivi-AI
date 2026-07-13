import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Sparkles, Check, MessageSquare } from 'lucide-react';
import FileDelivery from '@/components/chat/FileDelivery';

// Renders the full message list with role-based styling, file attachments,
// copy button, and a typing indicator while Vivi processes.
export default function ChatMessageList({ messages, sending }) {
  const scrollRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleCopy = (id, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (messages.length === 0 && !sending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-purple-600/20 border border-fuchsia-400/20 flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 text-fuchsia-300/60" />
        </div>
        <p className="text-white/50 text-sm max-w-xs leading-relaxed">
          Inicia una conversación con Vivi.
          <br />
          Puedes enviar texto, imágenes, documentos, audio, video o generar imágenes con IA.
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      <AnimatePresence>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white'
                : 'bg-white/5 border border-white/10 text-white/90'
            }`}>
              {msg.message_type === 'image' && msg.file_url && (
                <img src={msg.file_url} alt={msg.file_name || 'Imagen'} className="rounded-lg max-w-full mb-2" />
              )}
              {msg.message_type === 'generated_image' && msg.file_url && (
                <div>
                  <img src={msg.file_url} alt="Generada por IA" className="rounded-lg max-w-full mb-2" />
                  <span className="text-xs text-fuchsia-300 flex items-center gap-1 mb-1">
                    <Sparkles className="w-3 h-3" /> Generada por IA
                  </span>
                </div>
              )}
              {msg.message_type === 'audio' && msg.file_url && (
                <audio controls src={msg.file_url} className="w-full mb-2" />
              )}
              {msg.message_type === 'video' && msg.file_url && (
                <video controls src={msg.file_url} className="rounded-lg max-w-full mb-2" />
              )}
              {msg.message_type === 'document' && msg.file_url && (
                <FileDelivery fileName={msg.file_name} fileUrl={msg.file_url} />
              )}
              {msg.message_type === 'generated_document' && msg.file_url && (
                <FileDelivery fileName={msg.file_name} fileUrl={msg.file_url} generated />
              )}

              {msg.content && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
              )}

              {msg.content && (
                <button
                  onClick={() => handleCopy(msg.id, msg.content)}
                  className="mt-2 text-xs text-white/40 hover:text-white/80 flex items-center gap-1 transition-colors"
                >
                  {copiedId === msg.id ? (
                    <><Check className="w-3 h-3" /> Copiado</>
                  ) : (
                    <><Copy className="w-3 h-3" /> Copiar</>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {sending && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-fuchsia-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-fuchsia-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-fuchsia-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}