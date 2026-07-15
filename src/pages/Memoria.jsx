import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Download, Upload, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVivi } from '@/vivi/hooks/useVivi';
import PageTransition from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import MemoryStats from '@/components/memoria/MemoryStats';
import MemoryCard from '@/components/memoria/MemoryCard';
import MemoryForm from '@/components/memoria/MemoryForm';

export default function Memoria() {
  const { vivi } = useVivi();
  const navigate = useNavigate();
  const [memories, setMemories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await vivi?.memory?.listAll();
    setMemories(all || []);
    setStats(vivi?.memory?.getStats());
    setLoading(false);
  }, [vivi]);

  useEffect(() => { load(); }, [load]);

  const categoryLabels = vivi?.memory?.getCategoryLabels() || {};
  const availableCats = [...new Set(memories.map((m) => m.category))];
  const filtered = filter === 'all' ? memories : memories.filter((m) => m.category === filter);

  const handleSave = async (data) => {
    if (editing) {
      await vivi?.memory?.update(editing.id, data);
    } else {
      await vivi?.memory?.store(data);
    }
    setFormOpen(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (memory) => {
    if (window.confirm('¿Eliminar este recuerdo permanentemente?')) {
      await vivi?.memory?.forget(memory.id);
      load();
    }
  };

  const handleExport = async () => {
    const data = await vivi?.memory?.exportMemory();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vivi-memoria-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await vivi?.memory?.importMemory(data);
      alert(`${result?.imported || 0} recuerdos importados`);
      load();
    } catch {
      alert('Archivo inválido. Debe ser un JSON exportado desde Vivi.');
    }
    e.target.value = '';
  };

  return (
    <PageTransition>
      <div className="fixed inset-0 overflow-y-auto overscroll-none bg-[#0A0A0C] text-white">
        <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(138,79,255,0.15), transparent 50%)' }} />

        <div className="relative max-w-2xl mx-auto px-4 py-6 pb-24" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <ArrowLeft className="w-5 h-5 text-white/80" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">Memoria Permanente</h1>
                <p className="text-xs text-white/50">Tu contexto personal, siempre disponible</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6">
            <MemoryStats stats={stats} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mb-6">
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-90">
              <Plus className="w-4 h-4 mr-1.5" /> Nuevo
            </Button>
            <Button variant="outline" onClick={handleExport} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              <Download className="w-4 h-4 mr-1.5" /> Exportar
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              <Upload className="w-4 h-4 mr-1.5" /> Importar
            </Button>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImport} className="hidden" />
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${filter === 'all' ? 'bg-purple-500 border-purple-400 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
            >
              Todos ({memories.length})
            </button>
            {availableCats.sort().map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${filter === cat ? 'bg-purple-500 border-purple-400 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
              >
                {categoryLabels[cat] || cat} ({memories.filter((m) => m.category === cat).length})
              </button>
            ))}
          </div>

          {/* Memory list */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-purple-400/60 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-white/40">
              <p className="text-sm">No hay recuerdos en esta categoría.</p>
              <p className="text-xs mt-1">Vivi aprende automáticamente de tus conversaciones.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence>
                {filtered.map((mem) => (
                  <MemoryCard
                    key={mem.id}
                    memory={mem}
                    categoryLabel={categoryLabels[mem.category] || mem.category}
                    onEdit={(m) => { setEditing(m); setFormOpen(true); }}
                    onDelete={handleDelete}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <MemoryForm
          open={formOpen}
          onOpenChange={setFormOpen}
          memory={editing}
          onSave={handleSave}
        />
      </div>
    </PageTransition>
  );
}