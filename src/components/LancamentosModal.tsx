import React, { useState, useEffect } from 'react';
import {
  X,
  Building,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Tag,
  DollarSign,
  Sparkles,
  ExternalLink,
  Edit2,
  Eye,
  EyeOff,
} from 'lucide-react';

export interface LancamentoItem {
  id: string;
  nome: string;
  bairro: string;
  cidade?: string;
  construtora?: string;
  tipologias: string;
  precoAPartirDe?: string;
  diferenciais?: string;
  linkBookPdf?: string;
  active: boolean;
  createdAt: string;
}

interface LancamentosModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
}

export function LancamentosModal({ isOpen, onClose, companyName }: LancamentosModalProps) {
  const [lancamentos, setLancamentos] = useState<LancamentoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [nome, setNome] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('Rio de Janeiro');
  const [construtora, setConstrutora] = useState('');
  const [tipologias, setTipologias] = useState('');
  const [precoAPartirDe, setPrecoAPartirDe] = useState('');
  const [diferenciais, setDiferenciais] = useState('');
  const [linkBookPdf, setLinkBookPdf] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const fetchLancamentos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lancamentos');
      if (res.ok) {
        setLancamentos(await res.json());
      }
    } catch (err) {
      console.error('Erro ao buscar lançamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLancamentos();
      setIsAdding(false);
      setEditingId(null);
      setMessage(null);
    }
  }, [isOpen]);

  const resetForm = () => {
    setNome('');
    setBairro('');
    setCidade('Rio de Janeiro');
    setConstrutora('');
    setTipologias('');
    setPrecoAPartirDe('');
    setDiferenciais('');
    setLinkBookPdf('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleStartEdit = (item: LancamentoItem) => {
    setEditingId(item.id);
    setNome(item.nome);
    setBairro(item.bairro);
    setCidade(item.cidade || 'Rio de Janeiro');
    setConstrutora(item.construtora || '');
    setTipologias(item.tipologias);
    setPrecoAPartirDe(item.precoAPartirDe || '');
    setDiferenciais(item.diferenciais || '');
    setLinkBookPdf(item.linkBookPdf || '');
    setIsAdding(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !bairro.trim()) {
      setMessage({ success: false, text: 'Nome do empreendimento e bairro são obrigatórios.' });
      return;
    }

    try {
      if (editingId) {
        // Update
        const res = await fetch(`/api/lancamentos/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome,
            bairro,
            cidade,
            construtora,
            tipologias,
            precoAPartirDe,
            diferenciais,
            linkBookPdf,
          }),
        });
        if (res.ok) {
          setMessage({ success: true, text: 'Lançamento atualizado com sucesso!' });
          fetchLancamentos();
          resetForm();
        }
      } else {
        // Create
        const res = await fetch('/api/lancamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome,
            bairro,
            cidade,
            construtora,
            tipologias,
            precoAPartirDe,
            diferenciais,
            linkBookPdf,
            active: true,
          }),
        });
        if (res.ok) {
          setMessage({ success: true, text: 'Novo lançamento cadastrado com sucesso!' });
          fetchLancamentos();
          resetForm();
        }
      }
    } catch (err: any) {
      setMessage({ success: false, text: err.message || 'Erro ao salvar lançamento.' });
    }
  };

  const handleToggleActive = async (item: LancamentoItem) => {
    try {
      const res = await fetch(`/api/lancamentos/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !item.active }),
      });
      if (res.ok) {
        setLancamentos((prev) =>
          prev.map((l) => (l.id === item.id ? { ...l, active: !item.active } : l))
        );
      }
    } catch (err) {
      console.error('Erro ao alternar status do lançamento:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/lancamentos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLancamentos((prev) => prev.filter((l) => l.id !== id));
        setDeletingId(null);
        setMessage({ success: true, text: 'Lançamento excluído com sucesso.' });
      }
    } catch (err) {
      console.error('Erro ao excluir lançamento:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Catálogo de Lançamentos & Books</h3>
              <p className="text-xs text-indigo-200">
                Empreendimentos na planta integrados à Inteligência Artificial no WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Status Message */}
          {message && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 ${
                message.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Add / Edit Form or Toggle Button */}
          {!isAdding ? (
            <div className="flex items-center justify-between bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Cadastre seus Empreendimentos
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  A IA consultará estes dados automaticamente quando o cliente demonstrar interesse em lançamentos.
                </p>
              </div>
              <button
                onClick={() => {
                  resetForm();
                  setIsAdding(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Novo Lançamento
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-indigo-600" />
                  {editingId ? 'Editar Lançamento' : 'Cadastrar Novo Lançamento'}
                </h4>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Empreendimento *</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Reserva Jardim Barra"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bairro / Região *</label>
                  <input
                    type="text"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    placeholder="Ex: Barra da Tijuca, RJ"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Construtora / Incorporadora</label>
                  <input
                    type="text"
                    value={construtora}
                    onChange={(e) => setConstrutora(e.target.value)}
                    placeholder="Ex: Cyrela / Calçada / Direct Houses"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preço Inicial (A partir de)</label>
                  <input
                    type="text"
                    value={precoAPartirDe}
                    onChange={(e) => setPrecoAPartirDe(e.target.value)}
                    placeholder="Ex: R$ 450.000"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipologias Disponíveis *</label>
                  <input
                    type="text"
                    value={tipologias}
                    onChange={(e) => setTipologias(e.target.value)}
                    placeholder="Ex: Studios, 2 e 3 Quartos com Suíte, Coberturas Lineares"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Diferenciais & Destaques de Venda</label>
                  <input
                    type="text"
                    value={diferenciais}
                    onChange={(e) => setDiferenciais(e.target.value)}
                    placeholder="Ex: Varanda gourmet, lazer completo tipo resort, piscina, academia, 1 vaga coberta"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Link do Book / Apresentação PDF (Opcional)</label>
                  <input
                    type="url"
                    value={linkBookPdf}
                    onChange={(e) => setLinkBookPdf(e.target.value)}
                    placeholder="Ex: https://seusite.com.br/book-reserva.pdf"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Empreendimento'}
                </button>
              </div>
            </form>
          )}

          {/* List of Registered Lançamentos */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Empreendimentos Cadastrados ({lancamentos.length})</span>
              <span className="text-[11px] text-indigo-600 font-semibold lowercase">
                {lancamentos.filter((l) => l.active).length} ativos no catálogo
              </span>
            </h4>

            {lancamentos.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                Nenhum lançamento cadastrado no momento.
              </div>
            ) : (
              <div className="space-y-3">
                {lancamentos.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      item.active
                        ? 'bg-white border-slate-200 shadow-2xs hover:border-indigo-200'
                        : 'bg-slate-50/80 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          <Building className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-bold text-slate-900 text-sm">{item.nome}</h5>
                            {item.active ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Ativo na IA
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                                Pausado
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {item.bairro} {item.cidade ? `• ${item.cidade}` : ''}
                            {item.construtora ? ` • ${item.construtora}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          onClick={() => handleToggleActive(item)}
                          className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                            item.active
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                              : 'text-slate-600 bg-slate-100 border-slate-200 hover:bg-slate-200'
                          }`}
                          title={item.active ? 'Pausar este empreendimento na IA' : 'Ativar no catálogo'}
                        >
                          {item.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span className="text-[11px]">{item.active ? 'Ativo' : 'Inativo'}</span>
                        </button>

                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {deletingId === item.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="px-2 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                            >
                              Sim
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Details in card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5 text-xs text-slate-700">
                      <div>
                        <span className="font-bold text-slate-500">Tipologias: </span>
                        <span>{item.tipologias}</span>
                      </div>
                      {item.precoAPartirDe && (
                        <div>
                          <span className="font-bold text-slate-500">Valor: </span>
                          <span className="font-semibold text-emerald-700">{item.precoAPartirDe}</span>
                        </div>
                      )}
                      {item.diferenciais && (
                        <div className="sm:col-span-2 text-slate-600">
                          <span className="font-bold text-slate-500">Destaques: </span>
                          <span>{item.diferenciais}</span>
                        </div>
                      )}
                      {item.linkBookPdf && (
                        <div className="sm:col-span-2">
                          <a
                            href={item.linkBookPdf}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Ver Book / Apresentação PDF
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
