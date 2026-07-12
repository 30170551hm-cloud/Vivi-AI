import React from 'react';
import { Brain, Folder, Target, CheckCircle } from 'lucide-react';

export default function MemoryStats({ stats }) {
  const items = [
    { icon: Brain, label: 'Total recuerdos', value: stats?.total || 0, color: 'text-purple-300' },
    { icon: Folder, label: 'Proyectos activos', value: stats?.activeProjects || 0, color: 'text-cyan-300' },
    { icon: Target, label: 'Metas activas', value: stats?.activeGoals || 0, color: 'text-fuchsia-300' },
    { icon: CheckCircle, label: 'Tareas activas', value: stats?.activeTasks || 0, color: 'text-amber-300' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((it) => (
        <div key={it.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
          <it.icon className={`w-5 h-5 mb-2 ${it.color}`} />
          <div className="text-2xl font-bold text-white">{it.value}</div>
          <div className="text-xs text-white/50">{it.label}</div>
        </div>
      ))}
    </div>
  );
}