import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit3, Save, X, Code2, FileCode, ChevronLeft, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FirestoreEntities } from '@/lib/firebaseEntities';
import { useVivi } from '@/vivi/hooks/useVivi';
import PageTransition from '@/components/PageTransition';
import VDEActivityDashboard from '@/components/vde/VDEActivityDashboard';

const CATEGORIES = ['voz', 'avatar', 'memoria', 'conocimiento', 'razonamiento', 'seguridad', 'ui', 'api', 'rendimiento', 'venezuela', 'otro'];
const PRIORITIES = ['baja', 'media', 'alta', 'critica'];

const STATUS_LABELS = {
  detectada: 'Detectada', analizada: 'Analizada', diseñada: 'Diseñada',
  implementada: 'Implementada', probada: 'Probada', aprobada: 'Aprobada',
  rechazada: 'Rechazada', desplegada: 'Desplegada',
};

export default function VDEConsole() {
  const navigate = useNavigate();
  const { vivi } = useVivi();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // proposal being edited
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await FirestoreEntities.ImprovementProposal.list('-created_date', 100);
      setProposals(data || []);
    } catch (err) {
      console.error('Error loading proposals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta propuesta de código?')) return;
    await vivi?.vde?.deleteProposal(id);
    load();
  };

  const handleSave = async (id, updates) => {
    await vivi?.vde?.editProposal(id, updates);
    setEditing(null);
    load();
  };

  const handleCreate = async (data) => {
    await vivi?.vde?.createAlgorithm(data);
    setCreating(false);
    load();
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-b from-[#0a0512] via-[#0d0820] to-[#05030a] text-white">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 20%, rgba(124,58,237,0.2), transparent 60%)' }} />

        <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-12" style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top))' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors touch-manipulation"
            >
              <ChevronLeft className="w-5 h-5 text-white/70" />
            </button>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-300 text-xs font-medium mb-2">
                <Cpu className="w-3 h-3" /> VDE Console — Control total
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-fuchsia-300 via-purple-300 to-fuchsia-300 bg-clip-text text-transparent">
                Consola de Desarrollo
              </h1>
              <p className="text-white/50 text-xs sm:text-sm mt-1">
                Vivi crea, edita y elimina sus propios algoritmos y código. El Founder aprueba antes de desplegar.
              </p>
            </div>
          </div>

          {/* Real-time activity dashboard */}
          <VDEActivityDashboard />

          {/* Create button */}
          <button
            onClick={() => setCreating(!creating)}
            className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600/30 to-purple-600/30 border border-fuchsia-400/40 text-fuchsia-200 text-sm font-medium hover:from-fuchsia-600/40 hover:to-purple-600/40 transition-colors touch-manipulation"
          >
            <Plus className="w-4 h-4" /> Crear nuevo algoritmo
          </button>

          <AnimatePresence>
            {creating && <CodeEditor onSave={handleCreate} onCancel={() => setCreating(false)} />}
          </AnimatePresence>

          {/* Proposals list */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-fuchsia-500/20 border-t-fuchsia-400 rounded-full animate-spin" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">
              <Code2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              No hay código todavía. Vivi puede crear su primer algoritmo.
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => (
                <ProposalRow
                  key={p.id}
                  proposal={p}
                  isEditing={editing === p.id}
                  onDelete={() => handleDelete(p.id)}
                  onEdit={() => setEditing(p.id)}
                  onSave={(updates) => handleSave(p.id, updates)}
                  onCancelEdit={() => setEditing(null)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function ProposalRow({ proposal, isEditing, onDelete, onEdit, onSave, onCancelEdit }) {
  const [code, setCode] = useState(proposal.generated_code || '');
  const [title, setTitle] = useState(proposal.title || '');
  const [description, setDescription] = useState(proposal.description || '');

  useEffect(() => {
    setCode(proposal.generated_code || '');
    setTitle(proposal.title || '');
    setDescription(proposal.description || '');
  }, [proposal]);

  let files = [];
  try { files = JSON.parse(proposal.files_affected || '[]'); } catch { files = []; }

  return (
    <motion.div layout className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
      {isEditing ? (
        <div className="p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-400/40"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white/80 focus:outline-none focus:border-fuchsia-400/40 resize-none"
          />
          <div>
            <label className="text-xs text-white/40 mb-1 block flex items-center gap-1">
              <Code2 className="w-3 h-3" /> Código fuente
            </label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={12}
              className="w-full rounded-lg bg-black/60 border border-white/10 p-3 text-xs text-green-300 font-mono focus:outline-none focus:border-fuchsia-400/40 resize-y"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSave({ title, description, generated_code: code })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500/15 border border-green-400/30 text-green-300 text-xs font-medium hover:bg-green-500/25 transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Guardar
            </button>
            <button
              onClick={onCancelEdit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-fuchsia-500/15 border border-fuchsia-400/30 flex items-center justify-center">
              <FileCode className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium text-sm">{proposal.title}</h3>
              {proposal.description && (
                <p className="text-white/50 text-xs mt-0.5 line-clamp-2">{proposal.description}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="text-[10px] font-mono text-white/30 uppercase">{proposal.category}</span>
                <span className="text-[10px] font-mono text-white/30">·</span>
                <span className="text-[10px] font-mono text-white/30">{STATUS_LABELS[proposal.status] || proposal.status}</span>
                {proposal.source === 'vde' && (
                  <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-300 text-[10px] font-mono">VDE</span>
                )}
                {files.length > 0 && (
                  <span className="text-[10px] text-cyan-300/60">{files.length} archivo(s)</span>
                )}
              </div>
              {proposal.generated_code && (
                <pre className="mt-2 text-[10px] text-green-300/50 font-mono bg-black/40 p-2 rounded-lg overflow-hidden max-h-20">
                  {proposal.generated_code.slice(0, 300)}{proposal.generated_code.length > 300 ? '...' : ''}
                </pre>
              )}
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors touch-manipulation"
              >
                <Edit3 className="w-3.5 h-3.5 text-white/60" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg bg-red-500/10 border border-red-400/20 hover:bg-red-500/20 transition-colors touch-manipulation"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-300/70" />
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function CodeEditor({ onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('otro');
  const [priority, setPriority] = useState('media');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !code.trim()) return;
    setSaving(true);
    await onSave({ title, description, code, category, priority });
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/5 backdrop-blur-md p-5 space-y-3 mb-4"
    >
      <h3 className="text-white font-semibold text-base flex items-center gap-2">
        <Code2 className="w-5 h-5 text-fuchsia-300" /> Nuevo algoritmo
      </h3>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nombre del algoritmo o módulo"
        className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-fuchsia-400/40"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción de qué hace este código..."
        rows={2}
        className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-fuchsia-400/40 resize-none"
      />
      <div className="grid grid-cols-2 gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-400/40"
        >
          {CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#0d0820]">{c}</option>)}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-400/40"
        >
          {PRIORITIES.map((p) => <option key={p} value={p} className="bg-[#0d0820]">{p}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-white/40 mb-1 block flex items-center gap-1">
          <Code2 className="w-3 h-3" /> Código fuente
        </label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={12}
          className="w-full rounded-lg bg-black/60 border border-white/10 p-3 text-xs text-green-300 font-mono focus:outline-none focus:border-fuchsia-400/40 resize-y"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving || !title.trim() || !code.trim()}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Crear algoritmo'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </motion.div>
  );
}