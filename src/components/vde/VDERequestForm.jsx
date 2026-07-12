import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Send, FileCode, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useVivi } from '@/vivi/hooks/useVivi';

const CATEGORIES = [
  { value: 'otro', label: 'General' },
  { value: 'voz', label: 'Voz' },
  { value: 'avatar', label: 'Avatar' },
  { value: 'memoria', label: 'Memoria' },
  { value: 'conocimiento', label: 'Conocimiento' },
  { value: 'razonamiento', label: 'Razonamiento' },
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'ui', label: 'Interfaz' },
  { value: 'api', label: 'API' },
  { value: 'rendimiento', label: 'Rendimiento' },
];

const PRIORITIES = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
];

export default function VDERequestForm({ onClose, onCreated }) {
  const { vivi } = useVivi();
  const [request, setRequest] = useState('');
  const [category, setCategory] = useState('otro');
  const [priority, setPriority] = useState('media');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!request.trim()) return;
    setLoading(true);
    setError('');
    try {
      const proposal = await vivi?.vde?.analyzeRequest(request, { category, priority });
      if (proposal) {
        onCreated();
      } else {
        setError('No se pudo generar la propuesta. Intenta de nuevo.');
      }
    } catch (err) {
      setError(err?.message || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/5 backdrop-blur-md p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <FileCode className="w-5 h-5 text-fuchsia-300" />
        <h3 className="text-white font-semibold text-base">Solicitud al VDE</h3>
      </div>

      <p className="text-white/50 text-xs">
        Describe qué quieres que Vivi desarrolle. El VDE analizará, diseñará la arquitectura, generará código, pruebas y documentación, y te presentará un informe para tu aprobación.
      </p>

      <textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder="Ej: Crea un módulo que permita a Vivi gestionar recordatorios con notificaciones push..."
        rows={4}
        className="w-full rounded-lg bg-black/40 border border-white/10 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-fuchsia-400/40 resize-none"
        disabled={loading}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 mb-1 block">Categoría</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-400/40"
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value} className="bg-[#0d0820]">{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1 block">Prioridad</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-400/40"
          >
            {PRIORITIES.map((p) => <option key={p.value} value={p.value} className="bg-[#0d0820]">{p.label}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-300 text-xs">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={loading || !request.trim()}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analizando y generando...</>
          ) : (
            <><Send className="w-4 h-4" /> Generar informe VDE</>
          )}
        </button>
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </motion.div>
  );
}