import React, { useState } from 'react';
import { X, Download, Trash2, Copy, Check, Calendar, Phone, Home } from 'lucide-react';
import { SavedLead } from '../types';

interface LeadHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: SavedLead[];
  onDeleteLead: (id: string) => void;
  onClearAll: () => void;
}

export function LeadHistoryModal({
  isOpen,
  onClose,
  leads,
  onDeleteLead,
  onClearAll,
}: LeadHistoryModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    if (leads.length === 0) return;
    const headers = [
      'ID',
      'Data/Hora',
      'Empresa',
      'Nome',
      'Telefone',
      'Tipo de Atendimento',
      'Produto/Imóvel',
      'Observações',
      'Consentimento',
      'Status',
    ];

    const rows = leads.map((item) => [
      `"${item.id}"`,
      `"${item.createdAt}"`,
      `"${item.companyName}"`,
      `"${item.lead.nome || ''}"`,
      `"${item.lead.telefone || ''}"`,
      `"${item.lead.tipoAtendimento || ''}"`,
      `"${item.lead.produtoImovel || ''}"`,
      `"${item.lead.observacoes || ''}"`,
      `"${item.lead.consentimento || ''}"`,
      `"${item.lead.status || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      id="history-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="history-modal-content"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Histórico de Leads Captados</h3>
            <p className="text-xs text-slate-500">
              {leads.length} {leads.length === 1 ? 'lead arquivado' : 'leads arquivados'} no banco local
            </p>
          </div>
          <div className="flex items-center gap-2">
            {leads.length > 0 && (
              <>
                <button
                  id="export-csv-btn"
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar CSV
                </button>
                <button
                  id="clear-all-history-btn"
                  onClick={onClearAll}
                  className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg transition-colors"
                >
                  Limpar Todos
                </button>
              </>
            )}
            <button
              id="close-history-modal-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {leads.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">Nenhum lead salvo no histórico ainda.</p>
              <p className="text-xs mt-1 text-slate-500">
                Conclua uma qualificação no chat e clique em &quot;Salvar Lead&quot; para registrar aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {item.lead.nome || 'Lead Sem Nome'}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                          {item.lead.tipoAtendimento || 'Atendimento'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {item.createdAt}
                        </span>
                        {item.lead.telefone && (
                          <span className="flex items-center gap-1 font-mono text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            {item.lead.telefone}
                          </span>
                        )}
                        {item.lead.produtoImovel && (
                          <span className="flex items-center gap-1">
                            <Home className="w-3.5 h-3.5 text-slate-400" />
                            {item.lead.produtoImovel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopy(item.id, item.formattedText)}
                        className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Copiar texto do lead"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => onDeleteLead(item.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Excluir do histórico"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <pre className="p-3 bg-slate-900 text-emerald-400 text-[11px] font-mono rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {item.formattedText}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
