import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const CATEGORIES = [
  { value: 'name', label: 'Nombre' },
  { value: 'preference', label: 'Preferencia' },
  { value: 'work', label: 'Trabajo' },
  { value: 'company', label: 'Empresa' },
  { value: 'routine', label: 'Rutina' },
  { value: 'goal', label: 'Meta' },
  { value: 'idea', label: 'Idea' },
  { value: 'reminder', label: 'Recordatorio' },
  { value: 'calendar', label: 'Calendario' },
  { value: 'fact', label: 'Hecho' },
  { value: 'relationship', label: 'Relación' },
  { value: 'story', label: 'Historia' },
  { value: 'project', label: 'Proyecto' },
  { value: 'decision', label: 'Decisión' },
  { value: 'document', label: 'Documento' },
  { value: 'task', label: 'Tarea' },
];

const STATUSES = [
  { value: 'active', label: 'Activo' },
  { value: 'completed', label: 'Completado' },
  { value: 'paused', label: 'Pausado' },
  { value: 'abandoned', label: 'Abandonado' },
];

const EMPTY = { category: 'fact', key: '', value: '', importance: 2, status: 'active', tags: '' };

export default function MemoryForm({ open, onOpenChange, memory, onSave }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (memory) {
      setForm({
        category: memory.category || 'fact',
        key: memory.key || '',
        value: memory.value || '',
        importance: memory.importance || 2,
        status: memory.status || 'active',
        tags: Array.isArray(memory.tags) ? memory.tags.join(', ') : '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [memory, open]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isStructural = ['project', 'goal', 'task', 'decision'].includes(form.category);

  const handleSubmit = () => {
    if (!form.value.trim()) return;
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    onSave({
      category: form.category,
      key: form.key.trim(),
      value: form.value.trim(),
      importance: Number(form.importance),
      status: isStructural ? form.status : 'active',
      tags,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0713] border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{memory ? 'Editar recuerdo' : 'Nuevo recuerdo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-white/70">Categoría</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => set('category', c.value)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${form.category === c.value ? 'bg-purple-500 border-purple-400 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white/70">Etiqueta (opcional)</Label>
            <Input value={form.key} onChange={(e) => set('key', e.target.value)} placeholder="Ej: idioma_preferido" className="bg-white/5 border-white/10 text-white" />
          </div>

          <div className="space-y-2">
            <Label className="text-white/70">Contenido</Label>
            <Textarea value={form.value} onChange={(e) => set('value', e.target.value)} placeholder="Qué quieres recordar..." rows={3} className="bg-white/5 border-white/10 text-white resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-white/70">Importancia</Label>
              <div className="flex items-center gap-2">
                <input type="range" min={1} max={5} value={form.importance} onChange={(e) => set('importance', e.target.value)} className="flex-1 accent-purple-500" />
                <span className="text-sm text-white/70 w-6">{form.importance}</span>
              </div>
            </div>
            {isStructural && (
              <div className="space-y-2">
                <Label className="text-white/70">Estado</Label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                  {STATUSES.map((s) => <option key={s.value} value={s.value} className="bg-[#0b0713]">{s.label}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-white/70">Tags (separados por comas)</Label>
            <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="trabajo, urgente, familia" className="bg-white/5 border-white/10 text-white" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/60 hover:text-white">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.value.trim()} className="bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-90">
            {memory ? 'Guardar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}