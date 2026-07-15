import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Code2, FileCode, ChevronLeft, Cpu, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { backend } from '@/lib/backendClient';
import PageTransition from '@/components/PageTransition';
import VDEActivityDashboard from '@/components/vde/VDEActivityDashboard';

const STATUS_LABELS = {
  detectada: 'Detectada', analizada: 'Analizada', diseñada: 'Diseñada',
  implementada: 'Implementada', probada: 'Probada', aprobada: 'Aprobada',
  rechazada: 'Rechazada', desplegada: 'Desplegada',
};

export default function VDEConsole() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await backend.entities.ImprovementProposal.list('-created_date', 100);
      setProposals(data || []);
    } catch (err) {
      console.error('Error loading proposals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-b from-[#0a0512] via-[#0d0820] to-[#05030a] text-white">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 20%, rgba(124,58,237,0.2), transparent 60%)' }} />

        <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-12" style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => navigate('/')} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors touch-manipulation">
              <ChevronLeft className="w-5 h-5 text-white/70" />
            </button>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-300 text-xs font-medium mb-2">
                <Cpu className="w-3 h-3" /> VDE Console — Flujo seguro
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-fuchsia-300 via-purple-300 to-fuchsia-300 bg-clip-text text-transparent">
                Consola de Desarrollo
              </h1>
              <p className="text-white/50 text-xs sm:text-sm mt-1">
                La edición directa de código en navegador está deshabilitada. Vivi propone cambios y el backend abre PR segura en GitHub.
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-200 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Edición runtime bloqueada: solo flujo propuesto → validado → rama + PR.
          </div>

          <VDEActivityDashboard />

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-fuchsia-500/20 border-t-fuchsia-400 rounded-full animate-spin" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">
              <Code2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              No hay propuestas todavía.
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => <ProposalRow key={p.id} proposal={p} />)}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function ProposalRow({ proposal }) {
  let files = [];
  try { files = JSON.parse(proposal.files_affected || '[]'); } catch { files = []; }

  return (
    <motion.div layout className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-fuchsia-500/15 border border-fuchsia-400/30 flex items-center justify-center">
            <FileCode className="w-4 h-4 text-fuchsia-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium text-sm">{proposal.title}</h3>
            {proposal.description && <p className="text-white/50 text-xs mt-0.5 line-clamp-2">{proposal.description}</p>}
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className="text-[10px] font-mono text-white/30 uppercase">{proposal.category}</span>
              <span className="text-[10px] font-mono text-white/30">·</span>
              <span className="text-[10px] font-mono text-white/30">{STATUS_LABELS[proposal.status] || proposal.status}</span>
              {proposal.source === 'vde' && <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-300 text-[10px] font-mono">VDE</span>}
              {files.length > 0 && <span className="text-[10px] text-cyan-300/60">{files.length} archivo(s)</span>}
            </div>
            {proposal.generated_code && (
              <pre className="mt-2 text-[10px] text-green-300/50 font-mono bg-black/40 p-2 rounded-lg overflow-hidden max-h-20">
                {proposal.generated_code.slice(0, 300)}{proposal.generated_code.length > 300 ? '...' : ''}
              </pre>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
