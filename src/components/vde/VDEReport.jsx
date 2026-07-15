import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCode, CheckCircle, AlertTriangle, FlaskConical, FileText, Code2 } from 'lucide-react';
import { backend } from '@/lib/backendClient';

function Section({ icon: Icon, title, children, color = 'text-white/60' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg bg-black/30 border border-white/5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 p-3 text-left touch-manipulation"
      >
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs font-medium text-white/70 flex-1">{title}</span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-white/30 text-xs">▸</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VDEReport({ proposal, onUpdate }) {
  let files = [];
  try { files = JSON.parse(proposal.files_affected || '[]'); } catch { files = []; }

  const advanceStatus = async (newStatus) => {
    await backend.entities.ImprovementProposal.update(proposal.id, { status: newStatus });
    onUpdate();
  };

  return (
    <motion.div layout className="space-y-2.5 mt-2">
      {/* Files affected */}
      {files.length > 0 && (
        <Section icon={FileCode} title={`Archivos afectados (${files.length})`} color="text-cyan-300">
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded font-mono ${f.action === 'create' ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}>
                  {f.action === 'create' ? '+ nuevo' : '~ editar'}
                </span>
                <div>
                  <code className="text-white/70">{f.path}</code>
                  {f.description && <p className="text-white/40 mt-0.5">{f.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Benefits */}
      {proposal.benefits && (
        <Section icon={CheckCircle} title="Beneficios" color="text-green-300">
          <p className="text-white/60 text-sm whitespace-pre-wrap">{proposal.benefits}</p>
        </Section>
      )}

      {/* Risks */}
      {proposal.risks && (
        <Section icon={AlertTriangle} title="Riesgos" color="text-amber-300">
          <p className="text-white/60 text-sm whitespace-pre-wrap">{proposal.risks}</p>
        </Section>
      )}

      {/* Test results */}
      {proposal.test_results && (
        <Section icon={FlaskConical} title="Resultados de pruebas" color="text-blue-300">
          <p className="text-white/60 text-sm whitespace-pre-wrap font-mono">{proposal.test_results}</p>
        </Section>
      )}

      {/* Generated code */}
      {proposal.generated_code && (
        <Section icon={Code2} title="Código generado" color="text-purple-300">
          <pre className="text-white/60 text-xs whitespace-pre-wrap font-mono bg-black/40 p-3 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
            {proposal.generated_code}
          </pre>
        </Section>
      )}

      {/* Generated docs */}
      {proposal.generated_docs && (
        <Section icon={FileText} title="Documentación" color="text-indigo-300">
          <p className="text-white/60 text-sm whitespace-pre-wrap">{proposal.generated_docs}</p>
        </Section>
      )}

      {/* Autonomous mode — no approval needed */}
      {proposal.status === 'desplegada' && (
        <div className="flex items-center gap-2 pt-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-xs">
          <CheckCircle className="w-3.5 h-3.5" /> Desplegado automáticamente por Vivi
        </div>
      )}
    </motion.div>
  );
}