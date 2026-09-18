import React, { useState, useEffect, useRef } from 'react';
import {
  Building,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Upload,
  Image as ImageIcon,
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Bot,
  Layers,
  History,
  AlertTriangle,
  Plus,
  X,
  RefreshCw,
  Search,
  Sliders,
  Check,
  Cloud,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { LancamentoItem, CatalogoStatus } from './LancamentosModal';

interface LancamentosViewProps {
  companyName: string;
  onLancamentosUpdated?: () => void;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const DEFAULT_FORM_DATA = {
  nome: 'Reserva Jardim Barra',
  bairro: 'Barra da Tijuca',
  cidade: 'Rio de Janeiro',
  tipologias: '2 e 3 Quartos (Suíte) + Varanda Gourmet Integrada',
  metragens: '84m² a 114m² privativos',
  quartos: '2 e 3 quartos',
  precoFaixa: 'A partir de R$ 980.000 (2Q) e R$ 1.450.000 (3Q)',
  previsaoEntrega: 'Novembro de 2026',
  condicoesComerciais: 'Entrada de 20% facilitada em 36x direto com a incorporadora + Financiamento Caixa/Itaú na entrega',
  urlPublica: 'https://directhouses.com.br/lancamentos/reserva-jardim-barra',
  descricao: 'O Reserva Jardim é o equilíbrio perfeito entre sofisticação contemporânea e contato genuíno com a natureza na Barra da Tijuca. Desenvolvido para famílias que priorizam segurança, conveniência e acabamentos nobres, o projeto conta com plantas amplas de 2 e 3 quartos com suíte, varanda gourmet 100% integrada ao living e mais de 4.000m² de lazer privativo tipo resort.',
  localizacaoTags: [
    'A 5 min do Shopping BarraShopping',
    'Próximo à estação de BRT e Metrô Jardim Oceânico',
    'Fácil acesso à Praia da Barra',
  ],
  lazerTags: [
    'Piscina aquecida',
    'Academia de 300m²',
    'Espaço Coworking',
    'Quadra de Beach Tennis',
    'Pet Place',
  ],
  fotos: [] as Array<{ id: string; nome: string; url: string; tamanhoKb?: number }>,
  bookPdf: null as { nome: string; tamanhoMb?: number; url: string } | null,
  dlp: {
    construtora: 'Cyrela RJ Participações S.A.',
    contatoDiretor: 'Eng. Marcelo Castro (21) 98711-0099',
    enderecoExato: 'Av. das Américas, Lote 14B - Matrícula RGI nº 148.922 - 9º Ofício',
    comissao: 'Comissão Total 5.5% (Diretoria 1.5% / Corretor 4.0%)',
    notasInternas: '',
    dadosCadastrais: '',
  },
  status: 'ativo' as CatalogoStatus,
};

export interface AIViolationRecord {
  id: string;
  leadId?: string | null;
  whatsappJid: string;
  companyName: string;
  originalUserMessage: string;
  rawAiResponse: string;
  sanitizedResponse: string;
  violationTypes: string[];
  blockedType: string;
  wasModified: boolean;
  modelUsed: string;
  createdAt: string;
}

export function LancamentosView({ companyName, onLancamentosUpdated }: LancamentosViewProps) {
  const [activeTab, setActiveTab] = useState<'editar' | 'empreendimentos' | 'governanca'>('empreendimentos');
  const [lancamentos, setLancamentos] = useState<LancamentoItem[]>([]);
  const [violations, setViolations] = useState<AIViolationRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isTestPromptOpen, setIsTestPromptOpen] = useState(false);
  const [testPromptInput, setTestPromptInput] = useState('Quem é a construtora do Reserva Jardim e qual o telefone do dono da obra?');
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  const [newTagText, setNewTagText] = useState('');
  const [newTagType, setNewTagType] = useState<'local' | 'lazer'>('local');
  const [showAddTagModal, setShowAddTagModal] = useState(false);

  // Fetch real lancamentos from backend
  const fetchLancamentos = async () => {
    try {
      const res = await fetch('/api/lancamentos');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLancamentos(data);
          return data;
        }
      }
    } catch (err) {
      console.error('Erro ao carregar lançamentos:', err);
    }
    return [];
  };

  const fetchViolations = async () => {
    try {
      const res = await fetch('/api/lancamentos/violations');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setViolations(data);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar violações DLP:', err);
    }
  };

  const handleClearViolations = async () => {
    if (!window.confirm('Deseja limpar todo o histórico de incidentes DLP?')) return;
    try {
      const res = await fetch('/api/lancamentos/violations', { method: 'DELETE' });
      if (res.ok) {
        setViolations([]);
        showToast('Histórico de incidentes DLP limpo com sucesso.');
      }
    } catch (err) {
      console.error('Erro ao limpar violações:', err);
    }
  };

  useEffect(() => {
    fetchLancamentos().then((items) => {
      if (items.length > 0 && !selectedId) {
        loadLancamentoIntoForm(items[0]);
      }
    });
    fetchViolations();
  }, []);

  useEffect(() => {
    if (activeTab === 'governanca') {
      fetchViolations();
    }
  }, [activeTab]);

  const loadLancamentoIntoForm = (item: LancamentoItem) => {
    setSelectedId(item.id);

    // Parse fotos
    const fotosList: Array<{ id: string; nome: string; url: string; tamanhoKb?: number }> = [];
    if (Array.isArray(item.fotosUpload) && item.fotosUpload.length > 0) {
      item.fotosUpload.forEach((f) => {
        fotosList.push({
          id: f.id || f.filename,
          nome: f.originalName || f.filename,
          url: f.url,
          tamanhoKb: 350,
        });
      });
    } else if (item.fotos) {
      const split = item.fotos.split(',').map((s) => s.trim()).filter(Boolean);
      split.forEach((url, i) => {
        fotosList.push({
          id: `foto-${i}`,
          nome: `Foto_${i + 1}.jpg`,
          url,
          tamanhoKb: 400,
        });
      });
    }

    // Parse book PDF
    let bookPdfObj: { nome: string; tamanhoMb?: number; url: string } | null = null;
    if (item.bookPdfUpload && item.bookPdfUpload.url) {
      bookPdfObj = {
        nome: item.bookPdfUpload.originalName || item.bookPdfUpload.filename,
        url: item.bookPdfUpload.url,
        tamanhoMb: 12.5,
      };
    } else if (item.linkBookPdf) {
      bookPdfObj = {
        nome: item.documentoOrigemNome || 'Book_Comercial.pdf',
        url: item.linkBookPdf,
        tamanhoMb: 14.2,
      };
    }

    // Parse tags
    let locTags: string[] = [];
    if (item.localidade) {
      locTags = item.localidade.split('•').map((s) => s.trim()).filter(Boolean);
      if (locTags.length <= 1) {
        locTags = item.localidade.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    if (locTags.length === 0) {
      locTags = [
        `Localizado em ${item.bairro}`,
        `Próximo a vias principais de ${item.cidade || 'Rio de Janeiro'}`,
        'Fácil acesso a conveniências',
      ];
    }

    let lazTags: string[] = [];
    if (item.diferenciais) {
      lazTags = item.diferenciais.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (lazTags.length === 0) {
      lazTags = ['Lazer Completo', 'Piscina', 'Academia', 'Segurança 24h'];
    }

    setFormData({
      nome: item.nome || '',
      bairro: item.bairro || '',
      cidade: item.cidade || 'Rio de Janeiro',
      tipologias: item.tipologias || '',
      metragens: item.metragens || '',
      quartos: item.quartos || '',
      precoFaixa: item.precoAPartirDe || '',
      previsaoEntrega: item.previsaoEntrega || '',
      condicoesComerciais: item.condicoesComerciais || '',
      urlPublica: item.urlPublicaDirectHouse || '',
      descricao: item.descricao || item.conteudoPublicoAutorizado || '',
      localizacaoTags: locTags,
      lazerTags: lazTags,
      fotos: fotosList,
      bookPdf: bookPdfObj,
      dlp: {
        construtora: item.construtora || 'Incorporadora Homologada',
        contatoDiretor: item.telefoneConstrutora || item.contatoTerceiro || '(21) 98711-0099',
        enderecoExato: item.enderecoCompleto || 'Endereço registrado sob sigilo no RGI',
        comissao: item.notasInternas || 'Comissão Padrão Direct House (DLP Ativo)',
        notasInternas: item.notasInternas || '',
        dadosCadastrais: item.dadosCadastrais || '',
      },
      status: item.status || 'ativo',
    });
  };

  const handleNewLancamento = () => {
    setSelectedId('');
    setFormData({
      nome: '',
      bairro: '',
      cidade: 'Rio de Janeiro',
      tipologias: '',
      metragens: '',
      quartos: '',
      precoFaixa: '',
      previsaoEntrega: '',
      condicoesComerciais: '',
      urlPublica: '',
      descricao: '',
      localizacaoTags: ['Localização Nobre', 'Fácil Acesso'],
      lazerTags: ['Piscina', 'Academia', 'Segurança 24h'],
      fotos: [],
      bookPdf: null,
      dlp: {
        construtora: '',
        contatoDiretor: '',
        enderecoExato: '',
        comissao: '',
        notasInternas: '',
        dadosCadastrais: '',
      },
      status: 'ativo',
    });
    setActiveTab('editar');
  };

  const handleDeleteLancamento = async (id: string, nomeEmpreendimento?: string) => {
    const nome = nomeEmpreendimento || formData.nome || 'este lançamento';
    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir o lançamento "${nome}"?\n\nEsta ação removerá o catálogo do sistema e a IA deixará de mencioná-lo no WhatsApp.`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/lancamentos/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const remaining = lancamentos.filter((l) => l.id !== id);
        setLancamentos(remaining);
        if (selectedId === id) {
          if (remaining.length > 0) {
            loadLancamentoIntoForm(remaining[0]);
          } else {
            handleNewLancamento();
          }
        }
        showToast('Lançamento excluído com sucesso!');
        onLancamentosUpdated?.();
      } else {
        alert('Erro ao excluir lançamento. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro na exclusão do lançamento:', err);
      alert('Erro de conexão ao excluir lançamento.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: CatalogoStatus) => {
    const newStatus: CatalogoStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    try {
      const res = await fetch(`/api/lancamentos/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const updated = await res.json();
        setLancamentos((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: newStatus, active: newStatus === 'ativo' } : l))
        );
        if (selectedId === id) {
          setFormData((prev) => ({ ...prev, status: newStatus }));
        }
        showToast(`Status atualizado para: ${newStatus === 'ativo' ? 'Ativo (Liberado no WhatsApp)' : 'Inativo (Pausado)'}`);
        onLancamentosUpdated?.();
      }
    } catch (err) {
      console.error('Erro ao alternar status:', err);
    }
  };

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFoto(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await fileToBase64(file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            dataUrl: base64,
            type: 'image',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setFormData((prev) => ({
            ...prev,
            fotos: [
              ...prev.fotos,
              {
                id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                nome: data.originalName || file.name,
                url: data.url,
                tamanhoKb: Math.round(file.size / 1024),
              },
            ],
          }));
        }
      }
      showToast(`${files.length} foto(s) enviada(s) com sucesso!`);
    } catch (err) {
      console.error('Erro no upload de foto:', err);
      alert('Erro ao enviar imagem. Verifique o tamanho do arquivo.');
    } finally {
      setUploadingFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFoto = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      fotos: prev.fotos.filter((f) => f.id !== id),
    }));
  };

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPdf(true);
    try {
      const base64 = await fileToBase64(file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          dataUrl: base64,
          type: 'document',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFormData((prev) => ({
          ...prev,
          bookPdf: {
            nome: data.originalName || file.name,
            tamanhoMb: parseFloat((file.size / (1024 * 1024)).toFixed(1)),
            url: data.url,
          },
        }));
        showToast('Book Comercial PDF enviado com sucesso!');
      }
    } catch (err) {
      console.error('Erro no upload de PDF:', err);
      alert('Erro ao enviar PDF.');
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleRemoveTag = (type: 'local' | 'lazer', index: number) => {
    if (type === 'local') {
      setFormData((prev) => ({
        ...prev,
        localizacaoTags: prev.localizacaoTags.filter((_, i) => i !== index),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        lazerTags: prev.lazerTags.filter((_, i) => i !== index),
      }));
    }
  };

  const handleAddTag = () => {
    if (!newTagText.trim()) return;
    if (newTagType === 'local') {
      setFormData((prev) => ({
        ...prev,
        localizacaoTags: [...prev.localizacaoTags, newTagText.trim()],
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        lazerTags: [...prev.lazerTags, newTagText.trim()],
      }));
    }
    setNewTagText('');
    setShowAddTagModal(false);
  };

  const showToast = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 3800);
  };

  const handleSaveAll = async () => {
    if (!formData.nome.trim()) {
      alert('Por favor, informe o nome do empreendimento.');
      return;
    }
    if (!formData.bairro.trim()) {
      alert('Por favor, informe o bairro/região.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<LancamentoItem> = {
        nome: formData.nome.trim(),
        bairro: formData.bairro.trim(),
        cidade: formData.cidade.trim() || 'Rio de Janeiro',
        tipologias: formData.tipologias.trim(),
        metragens: formData.metragens.trim(),
        quartos: formData.quartos.trim(),
        precoAPartirDe: formData.precoFaixa.trim(),
        previsaoEntrega: formData.previsaoEntrega.trim(),
        condicoesComerciais: formData.condicoesComerciais.trim(),
        urlPublicaDirectHouse: formData.urlPublica.trim(),
        descricao: formData.descricao.trim(),
        localidade: formData.localizacaoTags.join(' • '),
        diferenciais: formData.lazerTags.join(', '),
        status: formData.status || 'ativo',
        active: formData.status === 'ativo',
        // Uploads nativos
        fotosUpload: formData.fotos.map((f) => ({
          id: f.id,
          filename: f.nome,
          url: f.url,
          originalName: f.nome,
        })),
        bookPdfUpload: formData.bookPdf
          ? {
              filename: formData.bookPdf.nome,
              url: formData.bookPdf.url,
              originalName: formData.bookPdf.nome,
            }
          : undefined,
        // Nível 3 DLP
        construtora: formData.dlp.construtora.trim(),
        telefoneConstrutora: formData.dlp.contatoDiretor.trim(),
        enderecoCompleto: formData.dlp.enderecoExato.trim(),
        notasInternas: formData.dlp.comissao.trim(),
        dadosCadastrais: formData.dlp.dadosCadastrais?.trim() || '',
        usuarioResponsavel: `Admin (${companyName})`,
      };

      let res: Response;
      if (selectedId) {
        res = await fetch(`/api/lancamentos/${selectedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/lancamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const savedItem = await res.json();
        setSelectedId(savedItem.id);
        const updatedList = await fetchLancamentos();
        showToast('Lançamento salvo e sincronizado com o WhatsApp com sucesso!');
        onLancamentosUpdated?.();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Erro ao salvar: ${errorData.error || 'Verifique os campos obrigatórios'}`);
      }
    } catch (err) {
      console.error('Erro ao salvar lançamento:', err);
      alert('Erro de conexão ao salvar lançamento.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLancamentos = lancamentos.filter((l) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      l.nome?.toLowerCase().includes(term) ||
      l.bairro?.toLowerCase().includes(term) ||
      l.tipologias?.toLowerCase().includes(term) ||
      l.id?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="w-full flex flex-col gap-6 max-w-[1720px] mx-auto">
      {/* Top Bar: Contexto Executivo & Status DLP Global */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-600 tracking-widest uppercase font-semibold">
              {companyName} Intelligence
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <span className="text-xs text-slate-500 font-medium">Motor de Blindagem v4.2</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
            Catálogo de Lançamentos & Governança DLP
          </h1>
          <p className="text-sm text-slate-500">
            Controle granular de distribuição via WhatsApp Business API e barreira criptográfica contra vazamento de carteira.
          </p>
        </div>

        {/* Quick Metrics Bar */}
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-50">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Matriz DLP</span>
              <span className="text-xs font-bold text-slate-800">100% Blindada</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-50">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Catálogos no Sistema</span>
              <span className="text-xs font-bold text-slate-800">{lancamentos.length} Empreendimentos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Abas de Navegação Superior Estruturadas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-1.5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('empreendimentos')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'empreendimentos'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Empreendimentos Ativos</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold">
              {lancamentos.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('editar')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'editar'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>
              {selectedId ? `Editar: ${formData.nome || 'Lançamento'}` : 'Cadastrar Novo Lançamento'}
            </span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('governanca')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'governanca'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-4 h-4 text-rose-500" />
            <span>Governança & Matriz DLP (Auditoria)</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
              14 Regras
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-2">
          <span className="text-xs text-slate-500">Sincronização IA:</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Tempo Real (Meta WhatsApp v19)
          </span>
        </div>
      </div>

      {/* CONTEÚDO DA ABA: EMPREENDIMENTOS ATIVOS */}
      {activeTab === 'empreendimentos' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Empreendimentos Cadastrados ({lancamentos.length})
              </h3>
              <p className="text-xs text-slate-500">
                Lançamentos sincronizados e autorizados para entrega pelo WhatsApp e corretores plantonistas.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar lançamento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 w-48 sm:w-64"
                />
              </div>
              <button
                type="button"
                onClick={handleNewLancamento}
                className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Lançamento</span>
              </button>
            </div>
          </div>

          {/* Grid de Cards Dinâmicos */}
          {filteredLancamentos.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Building className="w-10 h-10 text-slate-300" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-slate-700">Nenhum empreendimento encontrado</span>
                <span className="text-xs text-slate-400">
                  {searchTerm ? 'Tente ajustar sua busca por nome ou bairro.' : 'Comece cadastrando seu primeiro lançamento no catálogo.'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleNewLancamento}
                className="mt-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Primeiro Lançamento</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-1">
              {filteredLancamentos.map((item) => {
                const isAtivo = item.status === 'ativo' || item.active === true;
                const fotosCount = item.fotosUpload?.length || (item.fotos ? item.fotos.split(',').length : 0);
                const hasPdf = !!item.bookPdfUpload?.url || !!item.linkBookPdf;

                return (
                  <div
                    key={item.id}
                    className={`p-5 rounded-xl border flex flex-col justify-between gap-4 transition-all shadow-2xs hover:shadow-md ${
                      selectedId === item.id
                        ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-400/30'
                        : 'bg-white border-slate-200/90'
                    }`}
                  >
                    <div className="flex flex-col gap-2.5">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-blue-600 font-mono">
                          #{item.id.toUpperCase()}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item.id, item.status)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer transition-colors ${
                              isAtivo
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Clique para alternar o status do lançamento"
                          >
                            {isAtivo ? '● ATIVO NO WHATSAPP' : '○ PAUSADO'}
                          </button>
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200">
                            DLP 100%
                          </span>
                        </div>
                      </div>

                      {/* Title & Info */}
                      <div>
                        <h4 className="text-base font-bold text-slate-900 tracking-tight">
                          {item.nome}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {item.bairro} {item.cidade ? `• ${item.cidade}` : ''}
                        </p>
                      </div>

                      {/* Specs */}
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs flex flex-col gap-1 text-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Tipologias:</span>
                          <span className="font-semibold text-slate-900 truncate max-w-[170px]">
                            {item.tipologias || 'Sob consulta'}
                          </span>
                        </div>
                        {item.precoAPartirDe && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Valor a partir:</span>
                            <span className="font-bold text-emerald-700">
                              {item.precoAPartirDe}
                            </span>
                          </div>
                        )}
                        {item.metragens && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Metragem:</span>
                            <span className="font-medium text-slate-800">
                              {item.metragens}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Mídias Badges */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                          <ImageIcon className="w-3 h-3 text-blue-600" />
                          {fotosCount} foto{fotosCount !== 1 ? 's' : ''}
                        </span>
                        {hasPdf && (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-100">
                            <FileText className="w-3 h-3" />
                            Book PDF
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteLancamento(item.id, item.nome)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title={`Excluir "${item.nome}"`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          loadLancamentoIntoForm(item);
                          setActiveTab('editar');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                      >
                        <span>Configurar & DLP</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA: EDITAR / CADASTRAR LANÇAMENTO */}
      {activeTab === 'editar' && (
        <div className="flex flex-col gap-6">
          {/* Header do Empreendimento Selecionado */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start md:items-center gap-4">
              <div className="w-13 h-13 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xl font-bold shadow-xs shrink-0">
                {formData.nome ? formData.nome.substring(0, 2).toUpperCase() : 'DH'}
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                    {formData.nome || 'Novo Lançamento'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-200 font-mono">
                    {selectedId ? `#${selectedId.toUpperCase()}` : 'NOVO'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      formData.status === 'ativo'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        formData.status === 'ativo' ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    ></span>
                    {formData.status === 'ativo' ? 'Publicado no WhatsApp API' : 'Pausado / Não divulgado'}
                  </span>
                </div>
                <span className="text-xs text-slate-500 mt-0.5">
                  Última checagem de integridade criptográfica: Protocolo SHA-256 • Barreira DLP Ativa
                </span>
              </div>
            </div>

            {/* Ações do Cabeçalho */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedId && (
                <button
                  type="button"
                  onClick={() => handleDeleteLancamento(selectedId, formData.nome)}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-all cursor-pointer"
                  title="Excluir este lançamento"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir Lançamento</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsTestPromptOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
              >
                <Bot className="w-4 h-4 text-blue-600" />
                <span>Simular Chat IA</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow hover:bg-slate-800 transition-all cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Salvar & Replicar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* GRID PRINCIPAL: 8 Colunas (Fonte Pública + Mídias) & 4 Colunas (DLP Confidencial) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUNA ESQUERDA: NÍVEL 1 - FONTE PÚBLICA AUTORIZADA + MÍDIAS NATIVAS (8 Colunas) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* BLOCO NÍVEL 1: Informações Públicas Autorizadas */}
              <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        NÍVEL 1 — Fonte Pública Autorizada
                      </h3>
                      <p className="text-xs text-slate-500">
                        Conteúdos que a Inteligência Artificial pode consultar, transcrever e responder aos clientes no WhatsApp.
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Liberado para IA & Corretores
                  </div>
                </div>

                {/* Form Grid dos Campos Públicos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Nome Comercial do Empreendimento *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Reserva Jardim Barra"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">Bairro / Região *</label>
                    <input
                      type="text"
                      placeholder="Ex: Barra da Tijuca, Rio de Janeiro - RJ"
                      value={formData.bairro}
                      onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                      className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">Tipologias de Plantas</label>
                    <input
                      type="text"
                      placeholder="Ex: 2 e 3 Quartos (Suíte) + Varanda Gourmet Integrada"
                      value={formData.tipologias}
                      onChange={(e) => setFormData({ ...formData, tipologias: e.target.value })}
                      className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">Metragem Privativa</label>
                    <input
                      type="text"
                      placeholder="Ex: 84m² a 114m² privativos"
                      value={formData.metragens}
                      onChange={(e) => setFormData({ ...formData, metragens: e.target.value })}
                      className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Faixa de Preço Comercial (Público)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: A partir de R$ 980.000 (2Q)"
                      value={formData.precoFaixa}
                      onChange={(e) => setFormData({ ...formData, precoFaixa: e.target.value })}
                      className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all font-medium text-emerald-800"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Previsão de Conclusão e Chaves
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Novembro de 2026"
                      value={formData.previsaoEntrega}
                      onChange={(e) => setFormData({ ...formData, previsaoEntrega: e.target.value })}
                      className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Condições Comerciais Gerais
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Entrada facilitada durante obras + Financiamento bancário na entrega"
                      value={formData.condicoesComerciais}
                      onChange={(e) => setFormData({ ...formData, condicoesComerciais: e.target.value })}
                      className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">
                      URL Oficial da Landing Page / Hotsite
                    </label>
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 h-10">
                      <ExternalLink className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                      <input
                        type="url"
                        placeholder="https://directhouses.com.br/lancamentos/..."
                        value={formData.urlPublica}
                        onChange={(e) => setFormData({ ...formData, urlPublica: e.target.value })}
                        className="w-full bg-transparent text-sm text-slate-900 focus:outline-none"
                      />
                      {formData.urlPublica && (
                        <a
                          href={formData.urlPublica}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 font-semibold hover:underline shrink-0 ml-2"
                        >
                          Testar Link
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCO SUB-MENU WHATSAPP & UPLOAD DE MÍDIAS NATIVAS */}
              <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Mídias Nativas & Biblioteca WhatsApp
                      </h3>
                      <p className="text-xs text-slate-500">
                        Arquivos processados e comprimidos para disparo instantâneo no fluxo do cliente.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                    {formData.fotos.length} Fotos • {formData.bookPdf ? '1 Book PDF Ativo' : 'Nenhum PDF'}
                  </span>
                </div>

                {/* 1. Galeria de Fotos */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      1. Galeria Oficial (Compressão Automática JPG WhatsApp)
                    </span>
                    <span className="text-xs text-slate-400">Dimensão recomendada: 1200x900px</span>
                  </div>

                  {formData.fotos.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                      {formData.fotos.map((foto) => (
                        <div
                          key={foto.id}
                          className="group relative rounded-xl overflow-hidden bg-slate-100 shadow-xs aspect-4/3 flex flex-col justify-end border border-slate-200"
                        >
                          <img
                            src={foto.url}
                            alt={foto.nome}
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                          <div className="relative p-2.5 flex flex-col gap-0.5 text-white">
                            <span className="text-[11px] font-bold truncate">{foto.nome}</span>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-emerald-300 font-semibold">
                                ✓ Otimizado ({foto.tamanhoKb || 350} KB)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFoto(foto.id)}
                                className="w-6 h-6 rounded-full bg-black/60 hover:bg-rose-600 flex items-center justify-center text-white transition-colors cursor-pointer"
                                title="Remover foto"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Drag & Drop Area */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleUploadFoto}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 p-4 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
                  >
                    {uploadingFoto ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                        <span className="text-xs font-bold text-slate-800">Processando e enviando imagem...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-blue-600 mb-1" />
                        <span className="text-xs font-bold text-slate-800">
                          Arraste novas imagens ou clique para selecionar
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          Formatos aceitos: JPG, PNG, WEBP (Compressão nativa para disparo no WhatsApp)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 2. Descrição & Conceito */}
                <div className="flex flex-col gap-1.5 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      2. Descrição & Conceito Arquitetônico (Prompt de Síntese para IA WhatsApp)
                    </label>
                    <span className="text-[11px] text-blue-600 font-semibold">Auto-Ajustável pela IA</span>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Descreva o conceito do empreendimento, diferenciais arquitetônicos e pontos de destaque que a IA deve utilizar para encantar o cliente."
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 leading-relaxed resize-none transition-all"
                  />
                  <span className="text-[11px] text-slate-400">
                    A IA consultará este texto para compor resumos personalizados conforme as perguntas do cliente no WhatsApp.
                  </span>
                </div>

                {/* 3 & 4. Tags de Localização e Lazer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Localização */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      3. Localização & Referências Públicas
                    </label>
                    <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 min-h-[88px] content-start">
                      {formData.localizacaoTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-800 text-xs font-medium shadow-2xs"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag('local', idx)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setNewTagType('local');
                          setShowAddTagModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Adicionar Tag
                      </button>
                    </div>
                  </div>

                  {/* Lazer */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      4. Infraestrutura de Lazer Autorizada
                    </label>
                    <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 min-h-[88px] content-start">
                      {formData.lazerTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium shadow-2xs"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag('lazer', idx)}
                            className="text-emerald-500 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setNewTagType('lazer');
                          setShowAddTagModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Adicionar Tag
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. Book Comercial em PDF */}
                <div className="flex flex-col gap-1.5 pt-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    5. Documento Oficial do Lançamento (PDF Nativo)
                  </label>
                  {formData.bookPdf ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">
                            {formData.bookPdf.nome}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {formData.bookPdf.tamanhoMb && (
                              <>
                                <span className="text-xs text-slate-500">
                                  Tamanho: {formData.bookPdf.tamanhoMb} MB
                                </span>
                                <span className="text-slate-300">•</span>
                              </>
                            )}
                            <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Disparo Automático Habilitado no WhatsApp
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={pdfInputRef}
                          onChange={handleUploadPdf}
                          accept="application/pdf"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => pdfInputRef.current?.click()}
                          className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                        >
                          Substituir PDF
                        </button>
                        <a
                          href={formData.bookPdf.url}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-blue-600 transition-all cursor-pointer shadow-2xs"
                          title="Baixar ou visualizar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, bookPdf: null })}
                          className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer shadow-2xs"
                          title="Remover PDF"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        ref={pdfInputRef}
                        onChange={handleUploadPdf}
                        accept="application/pdf"
                        className="hidden"
                      />
                      <div
                        onClick={() => pdfInputRef.current?.click()}
                        className="p-4 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
                      >
                        {uploadingPdf ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
                            <span className="text-xs font-bold text-slate-800">Enviando Book PDF...</span>
                          </div>
                        ) : (
                          <>
                            <FileText className="w-6 h-6 text-rose-600 mb-1" />
                            <span className="text-xs font-bold text-slate-800">
                              Clique para fazer upload do Book Comercial em PDF
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5">
                              Arquivo oficial para disparo quando o cliente solicitar no WhatsApp
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: NÍVEL 3 - DADOS INTERNOS & CONFIDENCIAIS (DLP - Data Loss Prevention) (4 Colunas) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* BOX VINHO / VERMELHO RIGOROSO DLP */}
              <div className="bg-[#1e141a] text-slate-200 p-5 sm:p-6 rounded-xl border border-rose-900/60 shadow-lg flex flex-col gap-4 relative overflow-hidden">
                {/* Header Alerta Grave */}
                <div className="flex items-center gap-2 text-white bg-rose-700 px-3 py-1.5 rounded-lg shadow-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] uppercase font-bold tracking-wider">
                    ÁREA CONFIDENCIAL - BLOQUEIO RIGOROSO DE DADOS (DLP)
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <Lock className="w-4 h-4 text-rose-400" />
                    Barreira DLP Ativada
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-rose-400">ATENÇÃO ABSOLUTA:</strong> As informações contidas neste bloco são criptografadas e de consumo restrito à Diretoria e Mesa de Fechamento.
                    <span className="text-rose-300/80 font-medium block mt-1">
                      A Inteligência Artificial NÃO possui leitura vetorial destes dados e a API de WhatsApp recusa automaticamente qualquer menção a eles.
                    </span>
                  </p>
                </div>

                {/* Campos Confidenciais Editáveis para ADM com Indicação de Bloqueio IA */}
                <div className="flex flex-col gap-3">
                  {/* Campo 1 */}
                  <div className="p-3 rounded-lg bg-[#2a1b24] border border-rose-900/40 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-rose-400" />
                        Incorporadora / Construtora Real
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 text-[10px] font-bold border border-rose-800">
                        ❌ Oculto da IA
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Ex: Construtora X Participações S.A."
                      value={formData.dlp.construtora}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dlp: { ...formData.dlp, construtora: e.target.value },
                        })
                      }
                      className="h-8 px-2.5 rounded bg-black/40 text-xs text-slate-200 border border-rose-900/30 font-medium focus:outline-none focus:border-rose-500"
                    />
                    <span className="text-[10px] text-slate-400">
                      O cliente final no WhatsApp recebe apenas a chancela {companyName}.
                    </span>
                  </div>

                  {/* Campo 2 */}
                  <div className="p-3 rounded-lg bg-[#2a1b24] border border-rose-900/40 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-rose-400" />
                        Contato do Diretor de Incorporação
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 text-[10px] font-bold border border-rose-800">
                        ❌ Totalmente Bloqueado
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Ex: Eng. Responsável (21) 98765-4321"
                      value={formData.dlp.contatoDiretor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dlp: { ...formData.dlp, contatoDiretor: e.target.value },
                        })
                      }
                      className="h-8 px-2.5 rounded bg-black/40 text-xs text-slate-200 border border-rose-900/30 font-mono focus:outline-none focus:border-rose-500"
                    />
                    <span className="text-[10px] text-slate-400">
                      Bloqueio total de vazamento telefônico ou bypass de intermediação.
                    </span>
                  </div>

                  {/* Campo 3 */}
                  <div className="p-3 rounded-lg bg-[#2a1b24] border border-rose-900/40 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-rose-400" />
                        Endereço Exato do Terreno / Matrícula
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 text-[10px] font-bold border border-rose-800">
                        ❌ Bloqueado
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Ex: Rua Tal, Lote 14 - Matrícula RGI nº 12345"
                      value={formData.dlp.enderecoExato}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dlp: { ...formData.dlp, enderecoExato: e.target.value },
                        })
                      }
                      className="h-8 px-2.5 rounded bg-black/40 text-xs text-slate-200 border border-rose-900/30 focus:outline-none focus:border-rose-500"
                    />
                    <span className="text-[10px] text-slate-400">
                      A IA informa apenas 'Região Nobre da {formData.bairro || 'cidade'}, próximo a pontos de referência'.
                    </span>
                  </div>

                  {/* Campo 4 */}
                  <div className="p-3 rounded-lg bg-[#2a1b24] border border-rose-900/40 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-rose-400" />
                        Comissionamento & Notas Internas
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 text-[10px] font-bold border border-rose-800">
                        ❌ Super Restrito
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Ex: Comissão 5% • Espelho de vendas interno"
                      value={formData.dlp.comissao}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dlp: { ...formData.dlp, comissao: e.target.value },
                        })
                      }
                      className="h-8 px-2.5 rounded bg-black/40 text-xs text-slate-200 border border-rose-900/30 font-semibold text-emerald-400 focus:outline-none focus:border-rose-500"
                    />
                    <span className="text-[10px] text-slate-400">
                      Disponível unicamente no painel administrativo para cargos de diretoria.
                    </span>
                  </div>
                </div>

                {/* Matriz de Whitelist e Toggle de Auditoria */}
                <div className="pt-2 flex flex-col gap-1.5 border-t border-rose-900/40">
                  <span className="text-[11px] uppercase font-bold text-slate-300 tracking-wider">
                    Matriz de Prevenção de Incidentes
                  </span>
                  <div className="flex items-center justify-between p-2 rounded bg-black/30 text-xs">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Filtro Regex de CPFs e CNPJs</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">Ativo</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-black/30 text-xs">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Blacklist de Nomes de Incorporadores</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">Ativo</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-black/30 text-xs">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mascaramento de Lote/Quadra em Chat</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">Ativo</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-rose-900/30">
                  <span className="font-mono">DLP HASH: SHA256-SAFE</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('governanca')}
                    className="text-emerald-400 font-semibold underline hover:text-white cursor-pointer"
                  >
                    Ver Relatório Forense
                  </button>
                </div>
              </div>

              {/* Card Resumo de Auditoria Rápida */}
              <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Painel de Disparos WhatsApp</span>
                  <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Empreendimentos cadastrados:</span>
                    <span className="font-bold text-slate-900">{lancamentos.length} ativos</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Status do item atual:</span>
                    <span className={`font-bold ${formData.status === 'ativo' ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {formData.status === 'ativo' ? 'Ativo na IA' : 'Pausado'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tentativas de bypass bloqueadas:</span>
                    <span className="font-bold text-emerald-600">0 violações</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BARRA DE AÇÃO FIXADA NO RODAPÉ */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900">Modo de Segurança Rigoroso Ativo</span>
                <span className="text-xs text-slate-500">
                  Todas as alterações geram assinatura imutável no ledger de auditoria.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('empreendimentos')}
                className="px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
              >
                Voltar à Lista
              </button>
              <button
                type="button"
                onClick={() => setIsTestPromptOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold border border-blue-200 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                <span>Testar Resposta da IA</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                    <span>Salvar Alterações & Replicar no WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: GOVERNANÇA DLP */}
      {activeTab === 'governanca' && (
        <div className="flex flex-col gap-6">
          {/* Header e Métricas da Governança */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Matriz Geral de Governança DLP</h3>
                <p className="text-xs text-slate-500">
                  Auditoria em tempo real de vetores de extração de dados e políticas de segurança ativas.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Motor Ativo • 100% Blindado
                </span>
                <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200">
                  {violations.length} Bloqueio{violations.length !== 1 ? 's' : ''} Registrado{violations.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-y border-slate-200">
                  <tr>
                    <th className="p-3">Regra / Camada</th>
                    <th className="p-3">Alvo de Bloqueio</th>
                    <th className="p-3">Ação Automática</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr className="hover:bg-slate-50/70">
                    <td className="p-3 font-semibold text-blue-900">DLP-POL-01: Mascaramento de Construtora</td>
                    <td className="p-3 text-slate-600">CNPJ, Razão Social, Sócios Incorporadores</td>
                    <td className="p-3">Substituição por "Incorporadora Parceira {companyName}"</td>
                    <td className="p-3 text-center text-emerald-700 font-bold">Ativo</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="p-3 font-semibold text-blue-900">DLP-POL-02: Endereço de Terreno Bruto</td>
                    <td className="p-3 text-slate-600">Lote, Quadra, Matrícula de RGI e Cartório</td>
                    <td className="p-3">Generalização para Bairro/Ponto de Referência</td>
                    <td className="p-3 text-center text-emerald-700 font-bold">Ativo</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="p-3 font-semibold text-blue-900">DLP-POL-03: Bloqueio de Comissões</td>
                    <td className="p-3 text-slate-600">Percentuais de Honorários, Repasses e Diretoria</td>
                    <td className="p-3">Truncamento de resposta e alerta à auditoria</td>
                    <td className="p-3 text-center text-emerald-700 font-bold">Ativo</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="p-3 font-semibold text-blue-900">DLP-POL-04: Telefones Diretos da Engenharia</td>
                    <td className="p-3 text-slate-600">Contatos de gerentes de obra e diretores de expansão</td>
                    <td className="p-3">Redirecionamento para Roleta de Corretores</td>
                    <td className="p-3 text-center text-emerald-700 font-bold">Ativo</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Registro de Incidentes e Auditoria DLP em Tempo Real */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Registro de Incidentes & Bloqueios em Tempo Real (DLP Audit Log)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tentativas de extração, prompt injection ou vazamento de dados capturadas e neutralizadas pelo motor de segurança.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchViolations}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Atualizar Log</span>
                </button>
                {violations.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearViolations}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar Registros</span>
                  </button>
                )}
              </div>
            </div>

            {violations.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <ShieldCheck className="w-8 h-8 text-emerald-500" />
                <span className="text-xs font-bold text-slate-700">Nenhum incidente registrado até o momento</span>
                <span className="text-[11px] text-slate-400">
                  Todas as respostas enviadas pelo WhatsApp estão em total conformidade com as regras de governança.
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-y border-slate-200">
                    <tr>
                      <th className="p-3 w-36">Data / Hora</th>
                      <th className="p-3 w-40">Canal / Lead</th>
                      <th className="p-3 w-44">Tipo de Bloqueio</th>
                      <th className="p-3">Mensagem do Lead</th>
                      <th className="p-3">Resposta Higienizada (Enviada)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {violations.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 align-top">
                        <td className="p-3 text-[11px] text-slate-500 font-mono">
                          {new Date(item.createdAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-blue-700">
                          {item.whatsappJid.replace('@s.whatsapp.net', '')}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            {item.blockedType || 'Segurança Geral'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium">
                          {item.originalUserMessage || '—'}
                        </td>
                        <td className="p-3 text-slate-900 bg-emerald-50/30 rounded">
                          <p className="line-clamp-3 text-xs leading-relaxed">{item.sanitizedResponse}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Interativo: Simulação de Teste de Prompt IA e Barreira DLP */}
      {isTestPromptOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-2xl shadow-xl p-6 flex flex-col gap-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Simulador de Resposta IA WhatsApp & Teste DLP
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTestPromptOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">Pergunta Teste do Lead:</label>
              <input
                type="text"
                value={testPromptInput}
                onChange={(e) => setTestPromptInput(e.target.value)}
                className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700">
                  Resposta Gerada pelo Motor IA:
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200">
                  DLP ATIVOU: BLOQUEIO PREVENTIVO
                </span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed">
                "Olá! O <strong>{formData.nome || 'Lançamento'}</strong> é um projeto comercializado pela{' '}
                <strong>{companyName}</strong> na região de {formData.bairro || 'destaque'}. Para informações técnicas detalhadas ou para agendar uma visita guiada às unidades modelo ({formData.tipologias || '2 e 3 quartos'}), nosso corretor especialista está à disposição. Deseja receber o Book Comercial completo em PDF?"
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTestPromptOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Fechar Simulação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Tag */}
      {showAddTagModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-xl shadow-lg p-5 flex flex-col gap-3 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">
              Adicionar Nova Tag de {newTagType === 'local' ? 'Localização' : 'Lazer'}
            </h3>
            <input
              type="text"
              autoFocus
              value={newTagText}
              placeholder="Ex: A 10 min do Metrô..."
              onChange={(e) => setNewTagText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => setShowAddTagModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Save/Delete Success */}
      {saveSuccessMsg && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 z-50 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">
            {saveSuccessMsg}
          </span>
        </div>
      )}
    </div>
  );
}
