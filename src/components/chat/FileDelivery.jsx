import React from 'react';
import { Download, FileText, FileCode, Table, File } from 'lucide-react';

// FileDelivery — renders a file attachment with icon, name, and download button.
// Used for both user-uploaded documents and Vivi-generated documents.

const TYPE_CONFIG = {
  pdf: { icon: FileText, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-400/20' },
  txt: { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-400/20' },
  md: { icon: FileCode, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-400/20' },
  markdown: { icon: FileCode, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-400/20' },
  doc: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-400/20' },
  docx: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-400/20' },
  csv: { icon: Table, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-400/20' },
  xls: { icon: Table, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-400/20' },
  xlsx: { icon: Table, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-400/20' },
  html: { icon: FileCode, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-400/20' },
};

function getFileExtension(fileName) {
  if (!fileName) return '';
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

export default function FileDelivery({ fileName, fileUrl, generated = false }) {
  const ext = getFileExtension(fileName);
  const config = TYPE_CONFIG[ext] || { icon: File, color: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10' };
  const Icon = config.icon;

  const handleDownload = (e) => {
    e.preventDefault();
    if (!fileUrl) return;
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = fileName || 'documento';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={`flex items-center gap-3 rounded-xl border ${config.border} ${config.bg} p-3 mb-2`}>
      <div className={`p-2 rounded-lg ${config.bg} ${config.border} border ${config.color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 truncate">{fileName || 'Documento'}</p>
        <p className="text-xs text-white/40 uppercase">
          {ext || 'archivo'}{generated ? ' · generado por Vivi' : ''}
        </p>
      </div>
      <button
        onClick={handleDownload}
        className="p-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 transition-colors text-white/60 hover:text-white"
        aria-label="Descargar archivo"
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
}