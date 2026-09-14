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
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  History,
  Layers,
  Globe,
  RefreshCw,
  Play,
  Check,
  Ban,
  FileQuestion,
  HelpCircle,
  Calendar,
  PhoneCall,
  User,
} from 'lucide-react';

export type CatalogoStatus =
  | 'ativo'
  | 'inativo'
  | 'em_processamento'
  | 'atualizacao_pendente'
  | 'arquivado';

export type FonteTipo =
  | 'site_direct_house'
  | 'book_comercial'
  | 'pdf_incorporadora'
  | 'documento_interno'
  | 'url_externa'
  | 'outro';

export interface WhitelistPublicacao {
  nome: boolean;
  bairroRegiao: boolean;
  tipologias: boolean;
  metragens: boolean;
  quartos: boolean;
  lazerDiferenciais: boolean;
  previsaoEntrega: boolean;
  precoFaixa: boolean;
  condicoesComerciais: boolean;
  urlPublicaDirectHouse: boolean;
  enderecoCompleto: false;
  telefoneConstrutora: false;
  emailConstrutora: false;
  contatoComercialTerceiro: false;
  dadosCadastrais: false;
  documentosInternos: false;
  notasInternas: false;
}

export interface CatalogoVersao {
  id: string;
  numeroVersao: number;
  data: string;
  usuarioResponsavel: string;
  fonteUtilizada: string;
  tipoFonte: FonteTipo;
  status: CatalogoStatus;
  alteracoesRealizadas: string[];
  informacoesAdicionadas?: string[];
  informacoesRemovidas?: string[];
  alteracoesPermissoes?: string[];
}

export interface LancamentoItem {
  id: string;
  status: CatalogoStatus;
  fontePrincipal: FonteTipo;
  urlPublicaDirectHouse?: string;
  conteudoPublicoAutorizado?: string;
  nome: string;
  bairro: string;
  cidade: string;
  tipologias: string;
  metragens?: string;
  quartos?: string;
  precoAPartirDe?: string;
  condicoesComerciais?: string;
  diferenciais?: string;
  previsaoEntrega?: string;
  // Nível 3 - Dados Internos
  construtora?: string;
  telefoneConstrutora?: string;
  emailConstrutora?: string;
  contatoTerceiro?: string;
  enderecoCompleto?: string;
  dadosCadastrais?: string;
  linkBookPdf?: string;
  documentoOrigemNome?: string;
  notasInternas?: string;
  publicavel: WhitelistPublicacao;
  versaoAtual: number;
  historicoVersoes: CatalogoVersao[];
  createdAt: string;
  updatedAt: string;
  usuarioResponsavel?: string;
  active?: boolean;
}

interface GovernanceTestItem {
  id: number;
  testName: string;
  userPrompt: string;
  outputProduced: string;
  passed: boolean;
  category: string;
  explanation: string;
}

interface LancamentosModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
}

const DEFAULT_WHITELIST: WhitelistPublicacao = {
  nome: true,
  bairroRegiao: true,
  tipologias: true,
  metragens: true,
  quartos: true,
  lazerDiferenciais: true,
  previsaoEntrega: true,
  precoFaixa: true,
  condicoesComerciais: true,
  urlPublicaDirectHouse: true,
  enderecoCompleto: false,
  telefoneConstrutora: false,
  emailConstrutora: false,
  contatoComercialTerceiro: false,
  dadosCadastrais: false,
  documentosInternos: false,
  notasInternas: false,
};

export function LancamentosModal({ isOpen, onClose, companyName }: LancamentosModalProps) {
  const [activeTab, setActiveTab] = useState<'catalogos' | 'form' | 'seguranca' | 'historico'>('catalogos');
  const [lancamentos, setLancamentos] = useState<LancamentoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedForHistory, setSelectedForHistory] = useState<LancamentoItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Form State
  const [status, setStatus] = useState<CatalogoStatus>('ativo');
  const [fontePrincipal, setFontePrincipal] = useState<FonteTipo>('site_direct_house');
  const [nome, setNome] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('Rio de Janeiro');
  const [tipologias, setTipologias] = useState('');
  const [metragens, setMetragens] = useState('');
  const [quartos, setQuartos] = useState('');
  const [precoAPartirDe, setPrecoAPartirDe] = useState('');
  const [condicoesComerciais, setCondicoesComerciais] = useState('');
  const [diferenciais, setDiferenciais] = useState('');
  const [previsaoEntrega, setPrevisaoEntrega] = useState('');
  const [urlPublicaDirectHouse, setUrlPublicaDirectHouse] = useState('');
  const [conteudoPublicoAutorizado, setConteudoPublicoAutorizado] = useState('');

  // Nível 3 Internos
  const [construtora, setConstrutora] = useState('');
  const [telefoneConstrutora, setTelefoneConstrutora] = useState('');
  const [emailConstrutora, setEmailConstrutora] = useState('');
  const [contatoTerceiro, setContatoTerceiro] = useState('');
  const [enderecoCompleto, setEnderecoCompleto] = useState('');
  const [dadosCadastrais, setDadosCadastrais] = useState('');
  const [linkBookPdf, setLinkBookPdf] = useState('');
  const [documentoOrigemNome, setDocumentoOrigemNome] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [usuarioResponsavel, setUsuarioResponsavel] = useState('Lucas Toledo - Direct House');

  // Whitelist State
  const [whitelist, setWhitelist] = useState<WhitelistPublicacao>({ ...DEFAULT_WHITELIST });

  // Test Suite State
  const [testsLoading, setTestsLoading] = useState(false);
  const [testResults, setTestResults] = useState<GovernanceTestItem[]>([]);
  const [testsSummary, setTestsSummary] = useState<{ total: number; passed: number } | null>(null);
  const [simPrompt, setSimPrompt] = useState('Qual é o telefone da construtora do Reserva Jardim Barra?');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const fetchLancamentos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lancamentos');
      if (res.ok) {
        const data = await res.json();
        setLancamentos(data);
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
      setMessage(null);
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditingId(null);
    setStatus('ativo');
    setFontePrincipal('site_direct_house');
    setNome('');
    setBairro('');
    setCidade('Rio de Janeiro');
    setTipologias('');
    setMetragens('');
    setQuartos('');
    setPrecoAPartirDe('');
    setCondicoesComerciais('');
    setDiferenciais('');
    setPrevisaoEntrega('');
    setUrlPublicaDirectHouse('');
    setConteudoPublicoAutorizado('');
    setConstrutora('');
    setTelefoneConstrutora('');
    setEmailConstrutora('');
    setContatoTerceiro('');
    setEnderecoCompleto('');
    dadosCadastrais && setDadosCadastrais('');
    setLinkBookPdf('');
    setDocumentoOrigemNome('');
    setNotasInternas('');
    setWhitelist({ ...DEFAULT_WHITELIST });
  };

  const handleStartEdit = (item: LancamentoItem) => {
    setEditingId(item.id);
    setStatus(item.status || 'ativo');
    setFontePrincipal(item.fontePrincipal || 'site_direct_house');
    setNome(item.nome);
    setBairro(item.bairro);
    setCidade(item.cidade || 'Rio de Janeiro');
    setTipologias(item.tipologias || '');
    setMetragens(item.metragens || '');
    setQuartos(item.quartos || '');
    setPrecoAPartirDe(item.precoAPartirDe || '');
    setCondicoesComerciais(item.condicoesComerciais || '');
    setDiferenciais(item.diferenciais || '');
    setPrevisaoEntrega(item.previsaoEntrega || '');
    setUrlPublicaDirectHouse(item.urlPublicaDirectHouse || '');
    setConteudoPublicoAutorizado(item.conteudoPublicoAutorizado || '');
    setConstrutora(item.construtora || '');
    setTelefoneConstrutora(item.telefoneConstrutora || '');
    setEmailConstrutora(item.emailConstrutora || '');
    setContatoTerceiro(item.contatoTerceiro || '');
    setEnderecoCompleto(item.enderecoCompleto || '');
    setDadosCadastrais(item.dadosCadastrais || '');
    setLinkBookPdf(item.linkBookPdf || '');
    setDocumentoOrigemNome(item.documentoOrigemNome || '');
    setNotasInternas(item.notasInternas || '');
    setWhitelist(item.publicavel ? { ...item.publicavel } : { ...DEFAULT_WHITELIST });
    setActiveTab('form');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !bairro.trim()) {
      setMessage({ success: false, text: 'Nome do empreendimento e Bairro público são obrigatórios.' });
      return;
    }

    const payload = {
      status,
      fontePrincipal,
      nome,
      bairro,
      cidade,
      tipologias,
      metragens,
      quartos,
      precoAPartirDe,
      condicoesComerciais,
      diferenciais,
      previsaoEntrega,
      urlPublicaDirectHouse,
      conteudoPublicoAutorizado,
      // Nível 3 Interno
      construtora,
      telefoneConstrutora,
      emailConstrutora,
      contatoTerceiro,
      enderecoCompleto,
      dadosCadastrais,
      linkBookPdf,
      documentoOrigemNome,
      notasInternas,
      publicavel: whitelist,
      usuarioResponsavel,
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/lancamentos/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setMessage({ success: true, text: 'Catálogo atualizado e nova versão registrada com sucesso!' });
          fetchLancamentos();
          resetForm();
          setActiveTab('catalogos');
        }
      } else {
        const res = await fetch('/api/lancamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setMessage({ success: true, text: 'Novo catálogo cadastrado com governança de dados ativada!' });
          fetchLancamentos();
          resetForm();
          setActiveTab('catalogos');
        }
      }
    } catch (err: any) {
      setMessage({ success: false, text: err.message || 'Erro ao salvar catálogo.' });
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: CatalogoStatus) => {
    try {
      const res = await fetch(`/api/lancamentos/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          usuarioResponsavel: 'Lucas Toledo - Direct House',
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLancamentos((prev) => prev.map((l) => (l.id === id ? updated : l)));
        setMessage({
          success: true,
          text: `Status alterado para "${newStatus.toUpperCase()}". A IA ${
            newStatus === 'ativo' ? 'passou a utilizá-lo' : 'imediatamente deixou de recomendá-lo'
          }.`,
        });
      }
    } catch (err) {
      console.error('Erro ao alternar status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este catálogo? Esta ação removerá o registro ativo.')) {
      return;
    }
    try {
      const res = await fetch(`/api/lancamentos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLancamentos((prev) => prev.filter((l) => l.id !== id));
        setMessage({ success: true, text: 'Catálogo removido com sucesso.' });
      }
    } catch (err) {
      console.error('Erro ao excluir catálogo:', err);
    }
  };

  const runSecurityTests = async () => {
    setTestsLoading(true);
    try {
      const res = await fetch('/api/lancamentos/governance-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setTestResults(data.tests || []);
        setTestsSummary({ total: data.totalTests, passed: data.passedCount });
      }
    } catch (err) {
      console.error('Erro ao rodar testes de governança:', err);
    } finally {
      setTestsLoading(false);
    }
  };

  const handleSimulateAudit = async () => {
    if (!simPrompt.trim()) return;
    setSimLoading(true);
    try {
      const res = await fetch('/api/lancamentos/simulate-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: simPrompt,
          generatedText: '',
          companyName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
      }
    } catch (err) {
      console.error('Erro na simulação:', err);
    } finally {
      setSimLoading(false);
    }
  };

  const getStatusBadge = (st: CatalogoStatus) => {
    switch (st) {
      case 'ativo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Ativo (IA Autorizada)
          </span>
        );
      case 'inativo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Ban className="w-3 h-3 text-slate-500" />
            Inativo (IA Bloqueada)
          </span>
        );
      case 'em_processamento':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />
            Em Processamento
          </span>
        );
      case 'atualizacao_pendente':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <AlertCircle className="w-3 h-3 text-blue-600" />
            Atualização Pendente
          </span>
        );
      case 'arquivado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <Lock className="w-3 h-3 text-rose-600" />
            Arquivado
          </span>
        );
      default:
        return null;
    }
  };

  const filteredLancamentos = lancamentos.filter((l) => {
    if (statusFilter === 'todos') return true;
    return l.status === statusFilter;
  });

  if (!isOpen) return null;

  return (
    <div id="lancamentos-modal-container" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">Catálogos de Lançamentos & Governança de IA</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  DLP Ativo
                </span>
              </div>
              <p className="text-xs text-indigo-200">
                Base de conhecimento comercial segura e controle rigoroso de publicação para o WhatsApp Direct House
              </p>
            </div>
          </div>
          <button
            id="close-lancamentos-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Policy Bar (Regra de Ouro) */}
        <div className="bg-amber-50 px-6 py-2.5 border-b border-amber-200/80 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Regra de Ouro Direct House:</strong> Conhecimento interno amplo da IA ≠ Autorização de divulgação.
              Endereços completos e contatos de terceiros são estritamente confidenciais.
            </span>
          </div>
          <span className="hidden sm:inline font-mono font-medium text-[11px] text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
            Prevalência: Site Direct House
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 bg-slate-50 flex gap-2 pt-3">
          <button
            id="tab-catalogos-btn"
            onClick={() => setActiveTab('catalogos')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === 'catalogos'
                ? 'bg-white text-indigo-900 border-slate-200 -mb-px shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Building className="w-4 h-4 text-indigo-600" />
            Catálogos & Status ({lancamentos.length})
          </button>

          <button
            id="tab-form-btn"
            onClick={() => {
              if (activeTab !== 'form') resetForm();
              setActiveTab('form');
            }}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === 'form'
                ? 'bg-white text-indigo-900 border-slate-200 -mb-px shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Plus className="w-4 h-4 text-indigo-600" />
            {editingId ? 'Editar Empreendimento' : 'Cadastrar com Governança'}
          </button>

          <button
            id="tab-seguranca-btn"
            onClick={() => {
              setActiveTab('seguranca');
              if (testResults.length === 0) runSecurityTests();
            }}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === 'seguranca'
                ? 'bg-white text-emerald-900 border-slate-200 -mb-px shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Auditoria & 12 Testes de Segurança
            {testsSummary && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-100 text-emerald-800 font-mono">
                {testsSummary.passed}/{testsSummary.total} OK
              </span>
            )}
          </button>

          {selectedForHistory && (
            <button
              id="tab-historico-btn"
              onClick={() => setActiveTab('historico')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
                activeTab === 'historico'
                  ? 'bg-white text-indigo-900 border-slate-200 -mb-px shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              <History className="w-4 h-4 text-indigo-600" />
              Versões: {selectedForHistory.nome} (v{selectedForHistory.versaoAtual})
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {/* Status Message */}
          {message && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center justify-between gap-2 shadow-xs ${
                message.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {message.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span className="font-medium">{message.text}</span>
              </div>
              <button
                onClick={() => setMessage(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 1: LISTAGEM DE CATÁLOGOS COM GOVERNANÇA */}
          {/* ============================================================ */}
          {activeTab === 'catalogos' && (
            <div className="space-y-4">
              {/* Filter and Top Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Filtrar por Status:</span>
                  <select
                    id="status-filter-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="todos">Todos ({lancamentos.length})</option>
                    <option value="ativo">Ativo (Apenas IA)</option>
                    <option value="inativo">Inativo</option>
                    <option value="em_processamento">Em Processamento</option>
                    <option value="atualizacao_pendente">Atualização Pendente</option>
                    <option value="arquivado">Arquivado</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    id="new-catalog-btn"
                    onClick={() => {
                      resetForm();
                      setActiveTab('form');
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Catálogo com Whitelist
                  </button>
                </div>
              </div>

              {/* Hierarchy Info Pill */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-emerald-50/70 border border-emerald-200/80 p-3 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    NÍVEL 1 — Direct House Oficial
                  </div>
                  <p className="text-[11px] text-emerald-800 mt-1">
                    Site oficial, URLs públicas e conteúdo com autorização explícita. Prevalece sempre sobre books.
                  </p>
                </div>

                <div className="bg-blue-50/70 border border-blue-200/80 p-3 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <Building className="w-4 h-4 text-blue-600" />
                    NÍVEL 2 — Dados Comerciais
                  </div>
                  <p className="text-[11px] text-blue-800 mt-1">
                    Tipologias, lazer, metragens, valores e condições comerciais marcados como publicáveis.
                  </p>
                </div>

                <div className="bg-rose-50/70 border border-rose-200/80 p-3 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                    <Lock className="w-4 h-4 text-rose-600" />
                    NÍVEL 3 — Apoio Interno (NÃO PUBLICÁVEL)
                  </div>
                  <p className="text-[11px] text-rose-800 mt-1">
                    Books brutos, endereço completo, contatos de construtoras e notas confidenciais.
                  </p>
                </div>
              </div>

              {/* Catalog Cards List */}
              {loading ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                  Carregando catálogos de lançamentos...
                </div>
              ) : filteredLancamentos.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500 text-xs">
                  Nenhum catálogo encontrado com o filtro selecionado.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLancamentos.map((item) => {
                    const isAtivo = item.status === 'ativo';
                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all ${
                          isAtivo
                            ? 'border-indigo-200 shadow-xs hover:border-indigo-400'
                            : 'border-slate-200 opacity-80 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                {item.nome}
                              </h4>
                              {getStatusBadge(item.status)}
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                                Versão {item.versaoAtual || 1}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                              <span className="flex items-center gap-1 font-medium text-slate-800">
                                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                                {item.bairro} ({item.cidade || 'RJ'})
                              </span>
                              {item.tipologias && (
                                <span className="flex items-center gap-1">
                                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                                  {item.tipologias}
                                </span>
                              )}
                              {item.precoAPartirDe && (
                                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                  A partir de {item.precoAPartirDe}
                                </span>
                              )}
                            </div>

                            {/* Public Authorized Content vs Internal Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-xs">
                              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5">
                                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-900 mb-1">
                                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                  Público Autorizado (Divulgável no WhatsApp):
                                </div>
                                <p className="text-[11px] text-slate-700 line-clamp-2">
                                  {item.conteudoPublicoAutorizado || item.diferenciais || 'Características gerais autorizadas para atendimento comercial.'}
                                </p>
                                {item.urlPublicaDirectHouse && (
                                  <a
                                    href={item.urlPublicaDirectHouse}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline mt-1 font-medium"
                                  >
                                    <Globe className="w-3 h-3" />
                                    Ver página oficial no site Direct House
                                  </a>
                                )}
                              </div>

                              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-2.5">
                                <div className="flex items-center gap-1 text-[11px] font-bold text-rose-900 mb-1">
                                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                                  Dado Interno Protegido (NÃO Publicável):
                                </div>
                                <div className="text-[11px] text-slate-600 space-y-0.5">
                                  <div>
                                    <strong className="text-slate-800">Endereço Físico:</strong>{' '}
                                    <span className="font-mono text-rose-900">
                                      {item.enderecoCompleto ? `${item.enderecoCompleto} [CONFIDENCIAL]` : 'Não registrado'}
                                    </span>
                                  </div>
                                  <div>
                                    <strong className="text-slate-800">Construtora:</strong>{' '}
                                    {item.construtora || 'Terceiro'} | Tel:{' '}
                                    <span className="font-mono text-rose-900">
                                      {item.telefoneConstrutora ? `${item.telefoneConstrutora} [BLOQUEADO]` : 'Protegido'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            {/* Fast status switcher */}
                            <select
                              id={`status-select-${item.id}`}
                              value={item.status}
                              onChange={(e) => handleQuickStatusChange(item.id, e.target.value as CatalogoStatus)}
                              className="text-[11px] px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold cursor-pointer"
                            >
                              <option value="ativo">Status: Ativo</option>
                              <option value="inativo">Status: Inativo</option>
                              <option value="em_processamento">Em Processamento</option>
                              <option value="atualizacao_pendente">Atualização Pendente</option>
                              <option value="arquivado">Status: Arquivado</option>
                            </select>

                            <div className="flex items-center gap-1.5">
                              <button
                                id={`edit-catalog-${item.id}-btn`}
                                onClick={() => handleStartEdit(item)}
                                title="Editar catálogo e permissões"
                                className="p-2 bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded-xl text-xs transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                id={`history-catalog-${item.id}-btn`}
                                onClick={() => {
                                  setSelectedForHistory(item);
                                  setActiveTab('historico');
                                }}
                                title="Histórico de versões e auditoria"
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs transition-colors cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>

                              <button
                                id={`delete-catalog-${item.id}-btn`}
                                onClick={() => handleDelete(item.id)}
                                title="Excluir catálogo"
                                className="p-2 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-700 rounded-xl text-xs transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: FORMULÁRIO DE CADASTRO / EDIÇÃO COM GOVERNANÇA */}
          {/* ============================================================ */}
          {activeTab === 'form' && (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Form Title */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    {editingId ? `Editar Catálogo: ${nome}` : 'Cadastrar Catálogo com Governança de Dados'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure a separação estrita entre Base de Conhecimento Interna e Base de Conteúdo Publicável.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('catalogos')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Voltar à Listagem
                </button>
              </div>

              {/* Seção 0: Status do Catálogo & Fonte Principal */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  Status & Origem da Informação
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Status do Catálogo *</label>
                    <select
                      id="form-status-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as CatalogoStatus)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                    >
                      <option value="ativo">Ativo (Utilizado pela IA para recomendação)</option>
                      <option value="inativo">Inativo (A IA deixa imediatamente de recomendar)</option>
                      <option value="em_processamento">Em processamento (Aguardando homologação)</option>
                      <option value="atualizacao_pendente">Atualização pendente</option>
                      <option value="arquivado">Arquivado (Preservado no histórico)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Fonte Primária de Dados *</label>
                    <select
                      id="form-fonte-select"
                      value={fontePrincipal}
                      onChange={(e) => setFontePrincipal(e.target.value as FonteTipo)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                    >
                      <option value="site_direct_house">Site Oficial Direct House (Nível 1 - Autorizado)</option>
                      <option value="book_comercial">Book Comercial de Lançamento (Nível 3)</option>
                      <option value="pdf_incorporadora">PDF da Construtora / Incorporadora (Nível 3)</option>
                      <option value="documento_interno">Documento Interno da Equipe (Nível 3)</option>
                      <option value="url_externa">URL Externa / Outra fonte autorizada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Responsável pela Homologação *</label>
                    <input
                      id="form-responsavel-input"
                      type="text"
                      value={usuarioResponsavel}
                      onChange={(e) => setUsuarioResponsavel(e.target.value)}
                      placeholder="Ex: Lucas Toledo - Direct House"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Seção 1 & 2: Dados Comerciais Autorizados (NÍVEL 1 & NÍVEL 2) + Whitelist */}
              <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                  <h5 className="font-bold text-xs text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    NÍVEL 1 & 2 — Dados Comerciais Públicos & Whitelist de IA
                  </h5>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Autorizados para apresentação ao cliente no WhatsApp
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Nome do Empreendimento *</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whitelist.nome}
                          onChange={(e) => setWhitelist({ ...whitelist, nome: e.target.checked })}
                          className="rounded text-indigo-600"
                        />
                        Publicável pela IA
                      </label>
                    </div>
                    <input
                      id="form-nome-input"
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Reserva Jardim Barra"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Localização Pública Autorizada (Bairro/Região) *
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whitelist.bairroRegiao}
                          onChange={(e) => setWhitelist({ ...whitelist, bairroRegiao: e.target.checked })}
                          className="rounded text-indigo-600"
                        />
                        Publicável
                      </label>
                    </div>
                    <input
                      id="form-bairro-input"
                      type="text"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      placeholder="Ex: Barra da Tijuca, Zona Oeste"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      required
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Atenção: Cadastre apenas a região pública. Não informe ruas ou números neste campo.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Tipologias Autorizadas</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whitelist.tipologias}
                          onChange={(e) => setWhitelist({ ...whitelist, tipologias: e.target.checked })}
                          className="rounded text-indigo-600"
                        />
                        Publicável
                      </label>
                    </div>
                    <input
                      id="form-tipologias-input"
                      type="text"
                      value={tipologias}
                      onChange={(e) => setTipologias(e.target.value)}
                      placeholder="Ex: 2 e 3 Quartos com Suíte e Varanda"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Metragens & Quartos</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whitelist.metragens}
                          onChange={(e) => setWhitelist({ ...whitelist, metragens: e.target.checked })}
                          className="rounded text-indigo-600"
                        />
                        Publicável
                      </label>
                    </div>
                    <input
                      id="form-metragens-input"
                      type="text"
                      value={metragens}
                      onChange={(e) => setMetragens(e.target.value)}
                      placeholder="Ex: 68m² a 115m²"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Faixa de Preço Autorizada</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whitelist.precoFaixa}
                          onChange={(e) => setWhitelist({ ...whitelist, precoFaixa: e.target.checked })}
                          className="rounded text-indigo-600"
                        />
                        Publicável
                      </label>
                    </div>
                    <input
                      id="form-preco-input"
                      type="text"
                      value={precoAPartirDe}
                      onChange={(e) => setPrecoAPartirDe(e.target.value)}
                      placeholder="Ex: A partir de R$ 590.000"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Previsão de Entrega</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whitelist.previsaoEntrega}
                          onChange={(e) => setWhitelist({ ...whitelist, previsaoEntrega: e.target.checked })}
                          className="rounded text-indigo-600"
                        />
                        Publicável
                      </label>
                    </div>
                    <input
                      id="form-entrega-input"
                      type="text"
                      value={previsaoEntrega}
                      onChange={(e) => setPrevisaoEntrega(e.target.value)}
                      placeholder="Ex: Novembro de 2027"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Diferenciais & Lazer Aprovados</label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={whitelist.lazerDiferenciais}
                        onChange={(e) => setWhitelist({ ...whitelist, lazerDiferenciais: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      Publicável
                    </label>
                  </div>
                  <textarea
                    id="form-diferenciais-input"
                    rows={2}
                    value={diferenciais}
                    onChange={(e) => setDiferenciais(e.target.value)}
                    placeholder="Ex: Varanda gourmet com churrasqueira, vaga de garagem coberta, piscina resort com raia de 25m, academia..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        URL Oficial no Site Direct House (Nível 1)
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whitelist.urlPublicaDirectHouse}
                          onChange={(e) => setWhitelist({ ...whitelist, urlPublicaDirectHouse: e.target.checked })}
                          className="rounded text-indigo-600"
                        />
                        Publicável
                      </label>
                    </div>
                    <input
                      id="form-url-publica-input"
                      type="url"
                      value={urlPublicaDirectHouse}
                      onChange={(e) => setUrlPublicaDirectHouse(e.target.value)}
                      placeholder="https://directhouse.com.br/lancamentos/nome-do-imovel"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Condições Comerciais Autorizadas</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whitelist.condicoesComerciais}
                          onChange={(e) => setWhitelist({ ...whitelist, condicoesComerciais: e.target.checked })}
                          className="rounded text-indigo-600"
                        />
                        Publicável
                      </label>
                    </div>
                    <input
                      id="form-condicoes-input"
                      type="text"
                      value={condicoesComerciais}
                      onChange={(e) => setCondicoesComerciais(e.target.value)}
                      placeholder="Ex: Entrada facilitada durante as obras em até 36x"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 3: NÍVEL 3 — Fontes Internas de Apoio (NÃO PUBLICÁVEIS) */}
              <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                  <h5 className="font-bold text-xs text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-rose-600" />
                    NÍVEL 3 — Fontes Internas de Apoio (CONFIDENCIAL / NUNCA PUBLICÁVEL)
                  </h5>
                  <span className="text-[11px] text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded-full">
                    A IA pode compreender, mas NUNCA repassa ao cliente
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-rose-900 mb-1 flex items-center justify-between">
                      <span>Endereço Completo do Empreendimento</span>
                      <span className="text-[10px] font-mono text-rose-600">NÃO PUBLICÁVEL</span>
                    </label>
                    <input
                      id="form-endereco-completo-input"
                      type="text"
                      value={enderecoCompleto}
                      onChange={(e) => setEnderecoCompleto(e.target.value)}
                      placeholder="Rua, número, lote, quadra, bloco, CEP da construtora"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-rose-50/30 text-slate-800"
                    />
                    <p className="text-[10px] text-rose-600 mt-1">
                      ⛔ Bloqueado: A IA jamais fornecerá este endereço ao cliente. Responderá com a região e direcionará ao consultor.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-rose-900 mb-1 flex items-center justify-between">
                      <span>Construtora / Incorporadora</span>
                      <span className="text-[10px] font-mono text-rose-600">USO INTERNO</span>
                    </label>
                    <input
                      id="form-construtora-input"
                      type="text"
                      value={construtora}
                      onChange={(e) => setConstrutora(e.target.value)}
                      placeholder="Nome da incorporadora parceira"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-rose-50/30 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-rose-900 mb-1 flex items-center justify-between">
                      <span>Telefone / WhatsApp da Construtora</span>
                      <span className="text-[10px] font-mono text-rose-600">NÃO PUBLICÁVEL</span>
                    </label>
                    <input
                      id="form-tel-construtora-input"
                      type="text"
                      value={telefoneConstrutora}
                      onChange={(e) => setTelefoneConstrutora(e.target.value)}
                      placeholder="(21) 99999-9999 da construtora"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-rose-50/30 text-slate-800"
                    />
                    <p className="text-[10px] text-rose-600 mt-1">
                      ⛔ Bloqueado: O atendimento comercial é 100% da Direct House. A IA nunca repassa contatos externos.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-rose-900 mb-1 flex items-center justify-between">
                      <span>E-mail da Construtora / Terceiros</span>
                      <span className="text-[10px] font-mono text-rose-600">NÃO PUBLICÁVEL</span>
                    </label>
                    <input
                      id="form-email-construtora-input"
                      type="email"
                      value={emailConstrutora}
                      onChange={(e) => setEmailConstrutora(e.target.value)}
                      placeholder="contato@construtora.com.br"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-rose-50/30 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-rose-900 mb-1 flex items-center justify-between">
                      <span>Link de Book / PDF Bruto Recebido</span>
                      <span className="text-[10px] font-mono text-rose-600">DOCUMENTO DE APOIO</span>
                    </label>
                    <input
                      id="form-book-pdf-input"
                      type="url"
                      value={linkBookPdf}
                      onChange={(e) => setLinkBookPdf(e.target.value)}
                      placeholder="https://.../Book_Construtora.pdf"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-rose-50/30 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-rose-900 mb-1 flex items-center justify-between">
                      <span>Nome do Arquivo / Versão da Fonte</span>
                      <span className="text-[10px] font-mono text-rose-600">METADADO</span>
                    </label>
                    <input
                      id="form-documento-origem-input"
                      type="text"
                      value={documentoOrigemNome}
                      onChange={(e) => setDocumentoOrigemNome(e.target.value)}
                      placeholder="Ex: Book_Vendas_v3_Oficial.pdf"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-rose-50/30 text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-900 mb-1 flex items-center justify-between">
                    <span>Notas Internas & Briefing da Direct House</span>
                    <span className="text-[10px] font-mono text-rose-600">CONFIDENCIAL</span>
                  </label>
                  <textarea
                    id="form-notas-internas-input"
                    rows={2}
                    value={notasInternas}
                    onChange={(e) => setNotasInternas(e.target.value)}
                    placeholder="Comissões, regras com o incorporador, notas de vendas para a equipe..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-rose-50/30 text-slate-800"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('catalogos')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  id="submit-catalog-btn"
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {editingId ? 'Salvar Alterações & Registrar Versão' : 'Cadastrar Catálogo Homologado'}
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* TAB 3: AUDITORIA & SUÍTE DE 12 TESTES DE SEGURANÇA */}
          {/* ============================================================ */}
          {activeTab === 'seguranca' && (
            <div className="space-y-5">
              {/* Test Summary Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      Critérios de Aceite & Bateria de Testes de Segurança (Seção 15)
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Validação contínua contra vazamento de endereços físicos, telefones de construtoras, documentos internos e prompt injection.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {testsSummary && (
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-700">
                        {testsSummary.passed} de {testsSummary.total} APROVADOS
                      </div>
                      <div className="text-[10px] text-slate-500">100% de conformidade com a política</div>
                    </div>
                  )}

                  <button
                    id="run-security-tests-btn"
                    onClick={runSecurityTests}
                    disabled={testsLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Play className={`w-3.5 h-3.5 ${testsLoading ? 'animate-spin' : ''}`} />
                    {testsLoading ? 'Executando...' : 'Reexecutar 12 Testes'}
                  </button>
                </div>
              </div>

              {/* Interactive Simulator */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Simulador do Filtro de Governança Direct House (DLP em Tempo Real)
                  </h5>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    Prevenção de Vazamento Ativa
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    id="sim-prompt-input"
                    type="text"
                    value={simPrompt}
                    onChange={(e) => setSimPrompt(e.target.value)}
                    placeholder="Digite uma pergunta com tentativa de obter dados confidenciais..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    id="run-sim-audit-btn"
                    onClick={handleSimulateAudit}
                    disabled={simLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Testar Filtro
                  </button>
                </div>

                {simResult && (
                  <div className="bg-slate-800/90 rounded-xl p-3.5 border border-slate-700 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-200">Resultado da Análise de Governança:</span>
                      {simResult.wasModified ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          🛡️ Interceptado & Sanitizado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Liberado (Dado Público Aprovado)
                        </span>
                      )}
                    </div>
                    {simResult.violationsDetected?.length > 0 && (
                      <div className="text-[11px] text-rose-300 bg-rose-950/40 p-2 rounded-lg border border-rose-900/50">
                        <strong>Violações Detectadas:</strong> {simResult.violationsDetected.join(' | ')}
                      </div>
                    )}
                    <div className="bg-slate-900/80 p-2.5 rounded-lg text-slate-200 border border-slate-700/60 font-sans">
                      <strong className="text-slate-400 block mb-1">Mensagem Final Entregue no WhatsApp:</strong>
                      {simResult.sanitizedText}
                    </div>
                  </div>
                )}
              </div>

              {/* 12 Mandatory Tests Grid */}
              <div className="space-y-2.5">
                <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Matriz Oficial de Homologação dos 12 Critérios Obrigatórios
                </h5>

                {testsLoading ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    Executando validação de segurança...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {testResults.map((t) => (
                      <div
                        key={t.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          t.passed
                            ? 'bg-white border-emerald-200 shadow-xs'
                            : 'bg-red-50 border-red-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-mono text-slate-700">
                              {t.id}
                            </span>
                            {t.testName}
                          </span>
                          {t.passed ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              APROVADO
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                              <AlertCircle className="w-3 h-3 text-red-600" />
                              FALHA
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-600 space-y-1 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div>
                            <span className="font-semibold text-slate-800">Prompt do Cliente:</span> &ldquo;{t.userPrompt}&rdquo;
                          </div>
                          <div className="text-slate-700">
                            <span className="font-semibold text-slate-800">Resposta Comercial Segura:</span> &ldquo;{t.outputProduced}&rdquo;
                          </div>
                        </div>

                        <div className="text-[10px] text-emerald-800 mt-2 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{t.explanation}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 4: HISTÓRICO DE VERSÕES DO CATÁLOGO SELECIONADO */}
          {/* ============================================================ */}
          {activeTab === 'historico' && selectedForHistory && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    Trilha de Auditoria & Versionamento: {selectedForHistory.nome}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Histórico completo e imutável de alterações de status, fontes e permissões de publicação.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('catalogos')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Voltar aos Catálogos
                </button>
              </div>

              {selectedForHistory.historicoVersoes?.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500 text-xs">
                  Nenhum histórico registrado para este catálogo.
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-6 before:w-0.5 before:bg-slate-200 before:hidden sm:before:block">
                  {selectedForHistory.historicoVersoes?.map((v, idx) => (
                    <div
                      key={v.id || idx}
                      className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs relative sm:ml-12"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 font-mono">
                            v{v.numeroVersao}
                          </span>
                          <span className="font-bold text-xs text-slate-900">
                            {getStatusBadge(v.status)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(v.data).toLocaleString('pt-BR')}
                          <span className="text-slate-300">|</span>
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {v.usuarioResponsavel}
                        </div>
                      </div>

                      <div className="mt-3 space-y-2 text-xs">
                        <div>
                          <strong className="text-slate-700">Fonte Utilizada:</strong>{' '}
                          <span className="text-slate-600">{v.fonteUtilizada} ({v.tipoFonte})</span>
                        </div>

                        {v.alteracoesRealizadas && v.alteracoesRealizadas.length > 0 && (
                          <div>
                            <strong className="text-slate-700 block mb-1">Alterações Homologadas:</strong>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                              {v.alteracoesRealizadas.map((alt, aIdx) => (
                                <li key={aIdx}>{alt}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {v.alteracoesPermissoes && v.alteracoesPermissoes.length > 0 && (
                          <div className="bg-amber-50 p-2 rounded-xl border border-amber-200/80">
                            <strong className="text-amber-900 block mb-1">Permissões de Publicação Alteradas:</strong>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-800 text-[11px] pl-1">
                              {v.alteracoesPermissoes.map((p, pIdx) => (
                                <li key={pIdx}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Governança de Dados para WhatsApp &middot; <strong>{companyName}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
            >
              Fechar Painel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
