import React, { useState, useRef } from 'react';
import { Send, Paperclip, Sparkles, X } from 'lucide-react';

// Input bar with: text input, file upload, AI image generation mode.
// Enter to send, Shift+Enter for newline.
export default function ChatInput({ onSend, onGenerateImage, sending }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [imageMode, setImageMode] = useState(false);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!text.trim() && !file) return;

    if (imageMode) {
      onGenerateImage(text);
    } else {
      onSend(text, file);
    }
    setText('');
    setFile(null);
    setImageMode(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  return (
    <div
      className="border-t border-white/10 p-4 bg-[#0A0A0C]"
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      {file && (
        <div className="flex items-center gap-2 mb-2 text-sm text-white/60">
          <Paperclip className="w-4 h-4 flex-shrink-0" />
          <span className="truncate flex-1">{file.name}</span>
          <button onClick={() => setFile(null)} className="text-white/40 hover:text-white/80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {imageMode && (
        <div className="flex items-center gap-2 mb-2 text-sm text-fuchsia-300">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">Modo generación de imagen — describe lo que quieres crear</span>
          <button onClick={() => setImageMode(false)} className="text-white/40 hover:text-white/80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={imageMode}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 disabled:opacity-30 transition-colors"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        <button
          type="button"
          onClick={() => { setImageMode(!imageMode); setFile(null); }}
          className={`p-2.5 rounded-xl border transition-colors ${
            imageMode
              ? 'bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-300'
              : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/60'
          }`}
        >
          <Sparkles className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={imageMode ? 'Describe la imagen a generar...' : 'Escribe un mensaje...'}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-fuchsia-400/40"
        />

        <button
          type="submit"
          disabled={sending || (!text.trim() && !file)}
          className="p-2.5 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white disabled:opacity-30 transition-opacity"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}