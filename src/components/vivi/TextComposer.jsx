import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, X, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';
import { UploadFile } from '@/lib/firebaseStorageAdapter';

// Pure presentational component — receives onSend / onSendWithImage / onSendWithFile callbacks from parent.
// Supports image uploads (vision) and document uploads (PDF, text, etc. for analysis).
export default function TextComposer({ open, onClose, onSend, onSendWithImage, onSendWithFile }) {
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  if (!open) return null;

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await UploadFile({ file });
      setSelectedImage(result.file_url);
      setSelectedFile(null);
    } catch (err) {
      console.error('Image upload failed', err);
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await UploadFile({ file });
      setSelectedFile({ url: result.file_url, name: file.name });
      setSelectedImage(null);
    } catch (err) {
      console.error('File upload failed', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const submit = () => {
    const t = text.trim();
    if (!t && !selectedImage && !selectedFile) return;
    if (selectedImage && onSendWithImage) {
      onSendWithImage(t, selectedImage);
    } else if (selectedFile && onSendWithFile) {
      onSendWithFile(t, selectedFile.url);
    } else {
      onSend(t);
    }
    setText('');
    setSelectedImage(null);
    setSelectedFile(null);
    onClose();
  };

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
      className="fixed bottom-28 left-1/2 -translate-x-1/2 w-[92%] max-w-lg z-40"
    >
      {selectedImage && (
        <div className="mb-2 relative inline-block">
          <img src={selectedImage} alt="Preview" className="max-h-32 rounded-lg border border-white/10" />
          <button onClick={() => setSelectedImage(null)} className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-black/80 transition-colors">
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      )}
      {selectedFile && (
        <div className="mb-2 relative inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
          <FileText className="w-4 h-4 text-purple-300" />
          <span className="text-sm text-white/80 max-w-[180px] truncate">{selectedFile.name}</span>
          <button onClick={() => setSelectedFile(null)} className="p-0.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors">
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-2 shadow-2xl">
        <input type="file" ref={imageInputRef} accept="image/*" onChange={handleImageSelect} className="hidden" />
        <input type="file" ref={fileInputRef} accept=".pdf,.txt,.md,.doc,.docx,.csv,.json,.html" onChange={handleFileSelect} className="hidden" />
        <button
          onClick={() => imageInputRef.current?.click()}
          disabled={uploading}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 select-none touch-manipulation"
          aria-label="Adjuntar imagen"
        >
          {uploading ? <Loader2 className="w-4 h-4 text-white/60 animate-spin" /> : <ImageIcon className="w-4 h-4 text-white/70" />}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 select-none touch-manipulation"
          aria-label="Adjuntar documento"
        >
          {uploading ? <Loader2 className="w-4 h-4 text-white/60 animate-spin" /> : <FileText className="w-4 h-4 text-white/70" />}
        </button>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
          placeholder="Escribe a Vivi..."
          className="flex-1 bg-transparent px-3 py-2 text-base text-white placeholder:text-white/40 outline-none"
        />
        <button onClick={submit} className="p-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 transition-colors select-none touch-manipulation" aria-label="Enviar">
          <Send className="w-4 h-4 text-white" />
        </button>
        <button onClick={onClose} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors select-none touch-manipulation" aria-label="Cerrar">
          <X className="w-4 h-4 text-white/70" />
        </button>
      </div>
    </motion.div>
  );
}