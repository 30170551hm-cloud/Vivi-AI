import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, X, Clock, AlertTriangle, Zap, ChevronRight, FileCode } from 'lucide-react';
import { FirestoreEntities } from '@/lib/firebaseEntities';
import VDERequestForm from '@/components/vde/VDERequestForm';
import VDEReport from '@/components/vde/VDEReport';

const STATUS_CONFIG = {
  detectada:   { label: 'Detectada',   color: 'text-blue-300 bg-blue-500/10 border-blue-400/30',     icon: Clock },
  analizada:   { label: 'Analizada',   color: 'text-cyan-300 bg-cyan-500/10 border-cyan-400/30',     icon: Clock },
  diseñada:    { label: 'Diseñada',    color: 'text-indigo-300 bg-indigo-500/10 border-indigo-400/30', icon: Clock },
  implementada:{ label: 'Implementada',color: 'text-purple-300 bg-purple-500/10 border-purple-400/30', icon: Zap },
  probada:     { label: 'Probada',     color: 'text-amber-300 bg-amber-500/10 border-amber-400/30',  icon: AlertTriangle },
  aprobada:    { label: 'Aprobada',    color: 'text-green-300 bg-green-500/10 border-green-400/30',  icon: Check },
  rechazada:   { label: 'Rechazada',   color: 'text-red-300 bg-red-500/10 border-red-400/30',        icon: X },
  desplegada:  { label: 'Desplegada',  color: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30', icon: Check },
};

const PRIORITY_CONFIG = {
  baja:    'text-white/40',
  media:   'text-yellow-400/70',
  alta:    'text-orange-400/70',
  critica: 'text-red-400/80',
};

const CATEGORIES = ['voz', 'avatar', 'memoria', 'conocimiento', 'razonamiento', 'seguridad', 'ui', 'api', 'rendimiento', 'venezuela', 'otro'];

const CYCLE_STEPS = [
  'Detecta una limitación',
  'Analiza posibles soluciones',
  'Diseña la arquitectura',
  'Genera el código',
  'Ejecuta pruebas automáticas',
  'Verifica que no rompa funciones',
  'Te presenta un informe',
  'Tú apruebas o rechazas',
  'Si apruebas, despliega el cambio',
];

function ProposalCard({ proposal, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(proposal.founder_notes || '');
  const status = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.detectada;
  const StatusIcon = status.icon;


  const saveNotes = async () => {
    try {
      await FirestoreEntities.ImprovementProposal.update(proposal.id, { founder_notes: notes });
      onUpdate();
    } catch (err) {
      console.error('Error saving notes:', err);
    }
  };

  return (
    <motion.div
      layout
      className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left touch-manipulation"
      >
        <div className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg border flex items-center justify-center ${status.color}`}>
          <StatusIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-medium text-sm sm:text-base">{proposal.title}</h3>
            <span className={`text-[10px] font-mono uppercase ${PRIORITY_CONFIG[proposal.priority] || PRIORITY_CONFIG.media}`}>
              {proposal.priority}
            </span>
            <span className="text-[10px] font-mono text-white/30 uppercase">{proposal.category}</span>
          </div>
          <p className="text-white/50 text-xs sm:text-sm mt-0.5 line-clamp-2">{proposal.description}</p>
          <span className={`inline-block mt-2 px-2 py-0.5 rounded-full border text-[10px] font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} className="text-white/30 flex-shrink-0 mt-1">
          <ChevronRight className="w-4 h-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {proposal.current_limitation && (
                <div className="rounded-lg bg-black/30 border border-white/5 p-3">
                  <p className="text-xs font-medium text-red-300/70 mb-1">Limitación detectada</p>
                  <p className="text-white/60 text-sm">{proposal.current_limitation}</p>
                </div>
              )}
              {proposal.proposed_solution && (
                <div className="rounded-lg bg-black/30 border border-white/5 p-3">
                  <p className="text-xs font-medium text-green-300/70 mb-1">Solución propuesta</p>
                  <p className="text-white/60 text-sm whitespace-pre-wrap">{proposal.proposed_solution}</p>
                </div>
              )}

              {/* VDE Report — full technical details for VDE-generated proposals */}
              {proposal.source === 'vde' && (
                <VDEReport proposal={proposal} onUpdate={onUpdate} />
              )}

              <div>
                <label className="text-xs text-white/40 mb-1 block">Notas del Founder</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="Escribe tu feedback..."
                  className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-400/40 resize-none"
                  rows={2}
                />
              </div>

              {/* Autonomous mode — Vivi deploys without asking */}
              {proposal.status === 'desplegada' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-xs">
                  <Check className="w-3 h-3" /> Desplegado automáticamente
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NewProposalForm({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'voz', priority: 'media', current_limitation: '', proposed_solution: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await FirestoreEntities.ImprovementProposal.create({ ...form, status: 'detectada' });
      onCreated();
    } catch (err) {
      console.error('Error creating proposal:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rounded-2xl border border-purple-400/30 bg-purple-500/5 backdrop-blur-md p-5 space-y-3"
    >
      <h3 className="text-white font-semibold text-base">Nueva propuesta de mejora</h3>
      <input
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Título de la mejora"
        className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/40"
      />
      <textarea
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Descripción detallada"
        rows={2}
        className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/40 resize-none"
      />
      <div className="grid grid-cols-2 gap-3">
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white focus:outline-none focus:border-purple-400/40"
        >
          {CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#0d0820]">{c}</option>)}
        </select>
        <select
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          className="rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white focus:outline-none focus:border-purple-400/40"
        >
          {['baja', 'media', 'alta', 'critica'].map((p) => <option key={p} value={p} className="bg-[#0d0820]">{p}</option>)}
        </select>
      </div>
      <textarea
        value={form.current_limitation}
        onChange={(e) => setForm({ ...form, current_limitation: e.target.value })}
        placeholder="Limitación detectada..."
        rows={2}
        className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/40 resize-none"
      />
      <textarea
        value={form.proposed_solution}
        onChange={(e) => setForm({ ...form, proposed_solution: e.target.value })}
        placeholder="Solución propuesta..."
        rows={2}
        className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/40 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving || !form.title.trim()}
          className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {saving ? 'Guardando...' : 'Crear propuesta'}
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors">
          Cancelar
        </button>
      </div>
    </motion.div>
  );
}

export default function SelfImprovement() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showVDEForm, setShowVDEForm] = useState(false);

  const load = async () => {
    try {
      const data = await FirestoreEntities.ImprovementProposal.list('-created_date', 100);
      setProposals(data || []);
    } catch (err) {
      console.error('Error loading proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = {
    total: proposals.length,
    pending: proposals.filter((p) => ['detectada', 'analizada', 'diseñada', 'implementada', 'probada'].includes(p.status)).length,
    approved: proposals.filter((p) => p.status === 'aprobada' || p.status === 'desplegada').length,
    rejected: proposals.filter((p) => p.status === 'rechazada').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0512] via-[#0d0820] to-[#05030a] text-white">
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 20%, rgba(124,58,237,0.2), transparent 60%)' }} />

      <div className="relative max-w-3xl mx-auto px-4 py-8 sm:py-12" style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top))' }}>
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-300 text-xs font-medium mb-4">
            🔄 Ciclo de automejora controlado
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-300 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
            Automejora
          </h1>
          <p className="text-white/50 text-sm sm:text-base mt-3">
            Vivi tiene control total: crea, despliega y gestiona su código de forma autónoma. Modo automático activado.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'En proceso', value: stats.pending, color: 'text-blue-300' },
            { label: 'Aprobadas', value: stats.approved, color: 'text-green-300' },
            { label: 'Rechazadas', value: stats.rejected, color: 'text-red-300' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/[0.03] border border-white/10 p-3 text-center">
              <div className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] sm:text-xs text-white/40 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Cycle steps */}
        <div className="mb-6 rounded-2xl bg-white/[0.02] border border-white/10 p-4">
          <p className="text-xs text-white/40 mb-3 font-medium">Ciclo de mejora (9 pasos)</p>
          <div className="flex flex-wrap gap-1.5">
            {CYCLE_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="px-2 py-1 rounded-md bg-purple-500/10 border border-purple-400/20 text-purple-300/80 text-[10px] sm:text-xs">
                  {i + 1}. {step}
                </span>
                {i < CYCLE_STEPS.length - 1 && <span className="text-white/20 text-xs">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* VDE Request — send development request to the Vivi Development Engine */}
        <button
          onClick={() => setShowVDEForm(!showVDEForm)}
          className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600/30 to-purple-600/30 border border-fuchsia-400/40 text-fuchsia-200 text-sm font-medium hover:from-fuchsia-600/40 hover:to-purple-600/40 transition-colors touch-manipulation"
        >
          <FileCode className="w-4 h-4" /> Solicitar al VDE
        </button>

        <AnimatePresence>
          {showVDEForm && <VDERequestForm onClose={() => setShowVDEForm(false)} onCreated={() => { setShowVDEForm(false); load(); }} />}
        </AnimatePresence>

        {/* Manual proposal button */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 border border-purple-400/30 text-purple-200 text-sm font-medium hover:from-purple-500/30 hover:to-fuchsia-500/30 transition-colors touch-manipulation"
        >
          <Plus className="w-4 h-4" /> Nueva propuesta manual
        </button>

        <AnimatePresence>
          {showForm && <NewProposalForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load(); }} />}
        </AnimatePresence>

        {/* Proposals list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm">
            No hay propuestas todavía. Crea la primera.
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => (
              <ProposalCard key={p.id} proposal={p} onUpdate={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}