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
} from 'lucide-react';
import { LancamentoItem } from './LancamentosModal';

interface LancamentosViewProps {
  companyName: string;
}

export function LancamentosView({ companyName }: LancamentosViewProps) {
  const [activeTab, setActiveTab] = useState<'editar' | 'empreendimentos' | 'governanca'>('editar');
  const [lancamentos, setLancamentos] = useState<LancamentoItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('dh-8842');
  const [isTestPromptOpen, setIsTestPromptOpen] = useState(false);
  const [testPromptInput, setTestPromptInput] = useState('Quem é a construtora do Reserva Jardim e qual o telefone do dono da obra?');
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Form State for "Reserva Jardim Barra"
  const [formData, setFormData] = useState({
    nome: 'Reserva Jardim Barra',
    bairroRegiao: 'Barra da Tijuca, Rio de Janeiro - RJ',
    tipologias: '2 e 3 Quartos (Suíte) + Varanda Gourmet Integrada',
    metragens: '84m² a 114m² privativos',
    precoFaixa: 'A partir de R$ 980.000 (2Q) e R$ 1.450.000 (3Q)',
    previsaoEntrega: 'Novembro de 2026',
    condicoesComerciais: 'Entrada de 20% facilitada em 36x direto com a incorporadora + Financiamento Caixa/Itaú na entrega',
    urlPublica: 'https://directhouses.com.br/lancamentos/reserva-jardim-barra',
    descricao: 'O Reserva Jardim é o equilíbrio perfeito entre sofisticação contemporânea e contato genuíno com a natureza na Barra da Tijuca. Desenvolvido para famílias que priorizam segurança, conveniência e acabamentos nobres, o projeto conta com plantas amplas de 2 e 3 quartos com suíte, varanda gourmet 100% integrada ao living e mais de 4.000m² de lazer privativo tipo resort.',
    // Tags
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
    // Mídias
    fotos: [
      {
        id: '1',
        nome: '01_Fachada_Principal.jpg',
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD0rblLGzdjmJbNOzkPfGamjrzhqSk1BKI2azqP1q7EawMkYSYck4wdqSag__cXkb4K1E6B5MaifB4IvBiuyGMKn8t4qbU8RaFtolibMh7P-755WI0-TvLr1Yro7F4wbRbFpFGyVpYo_wsUpr48EdJ42tmUmfPxkJ2WzlN7VMRLwqEsbw5kc6sZV2ySEwCxgl84irG5H4OfFPWc042tkfvrzuva9zLfV3u2tk3QtICJyVv1vc843EhBwQ',
        tamanhoKb: 420,
      },
      {
        id: '2',
        nome: '02_Living_Ampliado.jpg',
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUzW4ejWiblbjKuq9CY_TUtPaLzRduIggXAeXQBOAf6CL0B-Oru2HCCsla_wmRclCZAytit4WK8VOmV6nZOvWel_HvdgHlz-RrkzTR97aUpMB18X_E7LCDVNaoXen0ZHOjoAUogz6kaNiLOPZh2lblL1-bh6MvLp_QygARwLpfAABYYc08X72GQAAv6pQBEy9BtALjDs_9lr_7SARhuzrCq4LTgyeswxApFFAeRaTkIMNDZcOq4NJpqQ',
        tamanhoKb: 385,
      },
      {
        id: '3',
        nome: '03_Varanda_Gourmet.jpg',
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTvlfgJYxas_zqfBCYfQUABrP7j6DrIrkXGgKqdljzjpzefPBIfkqbYg71OGO3KELkIOBZ2g4bZX_qav0hW4aPbBarkrkm7_OFLadmOgf9yyM84Imq-c7C3IZKEFYjj1iBpNzlZRIIOwNiRDZU7fMxr_rG8KTkdDyDXIRtdkWgSYPp7IWTVXTG0s4reTQMz4F1LFqmF8oIL_kNoPgG_ahYF8O_xdNG0xzN-exIL6JAKUbBnzi26cR0nA',
        tamanhoKb: 510,
      },
      {
        id: '4',
        nome: '04_Piscina_Borda_Infinita.jpg',
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC6WrL_MtQ5r-gARz-jFBWG0GwBKxz_OmKGWnRCDOLYuvmbkIDHTUqgEfcyFqW0if3zb6hhrn7pmJZlfe8PFph5Sqm9G1IiO0eyikxPa6_ls_-kBJYi7TG5MXOOMCtGHELVjcqucV-VOoLMWYTFOzviuGu2nR7XaZzFQkepbXRW0dTu4xPT1NdK3WdPOwrGsDmTHPJLpWCHktaJtgtYb8c_8zsRy7a79l6uK9edWPfhbPpX0JxRw4Rxtw',
        tamanhoKb: 460,
      },
    ],
    bookPdf: {
      nome: 'Book_Comercial_Reserva_Jardim_V3.pdf',
      tamanhoMb: 14.2,
      url: '/uploads/sample_book.pdf',
    },
    // Nível 3 DLP (Confidencial)
    dlp: {
      construtora: 'Cyrela RJ Participações S.A.',
      contatoDiretor: 'Eng. Marcelo Castro (21) 98711-0099',
      enderecoExato: 'Av. das Américas, Lote 14B - Matrícula RGI nº 148.922 - 9º Ofício',
      comissao: 'Comissão Total 5.5% (Diretoria 1.5% / Corretor 4.0%)',
    },
  });

  const [newTagText, setNewTagText] = useState('');
  const [newTagType, setNewTagType] = useState<'local' | 'lazer'>('local');
  const [showAddTagModal, setShowAddTagModal] = useState(false);

  // Fetch real lancamentos from backend
  useEffect(() => {
    fetch('/api/lancamentos')
      .then((res) => {
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          return res.json();
        }
        return [];
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLancamentos(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFoto(true);
    try {
      const file = files[0];
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: form,
      });

      if (res.ok) {
        const data = await res.json();
        setFormData((prev) => ({
          ...prev,
          fotos: [
            ...prev.fotos,
            {
              id: String(Date.now()),
              nome: data.originalName || file.name,
              url: data.url,
              tamanhoKb: Math.round(file.size / 1024),
            },
          ],
        }));
      }
    } catch (err) {
      console.error('Erro no upload de foto:', err);
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleRemoveFoto = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      fotos: prev.fotos.filter((f) => f.id !== id),
    }));
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

  const handleSaveAll = () => {
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 3500);
  };

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
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Mídias WhatsApp</span>
              <span className="text-xs font-bold text-slate-800">Prontas (WebP/JPG)</span>
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
              {lancamentos.length || 6}
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
            <span>Editar Lançamento: {formData.nome}</span>
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

      {/* CONTEÚDO DA ABA: EDITAR LANÇAMENTO */}
      {activeTab === 'editar' && (
        <div className="flex flex-col gap-6">
          {/* Header do Empreendimento Selecionado */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start md:items-center gap-4">
              <div className="w-13 h-13 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xl font-bold shadow-xs">
                RJ
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                    {formData.nome}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-200">
                    ID #DH-8842
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Publicado no WhatsApp API
                  </span>
                </div>
                <span className="text-xs text-slate-500 mt-0.5">
                  Última checagem de integridade criptográfica: Hoje às 15:42 • Protocolo SHA-256
                </span>
              </div>
            </div>

            {/* Ações do Cabeçalho */}
            <div className="flex flex-wrap items-center gap-2">
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow hover:bg-slate-800 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Salvar & Replicar</span>
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
                      Nome Comercial do Empreendimento
                    </label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">Bairro / Região</label>
                    <input
                      type="text"
                      value={formData.bairroRegiao}
                      onChange={(e) => setFormData({ ...formData, bairroRegiao: e.target.value })}
                      className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">Tipologias de Plantas</label>
                    <input
                      type="text"
                      value={formData.tipologias}
                      onChange={(e) => setFormData({ ...formData, tipologias: e.target.value })}
                      className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">Metragem Privativa</label>
                    <input
                      type="text"
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
                        value={formData.urlPublica}
                        onChange={(e) => setFormData({ ...formData, urlPublica: e.target.value })}
                        className="w-full bg-transparent text-sm text-slate-900 focus:outline-none"
                      />
                      <a
                        href={formData.urlPublica}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 font-semibold hover:underline shrink-0 ml-2"
                      >
                        Testar Link
                      </a>
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
                    {formData.fotos.length} Fotos • 1 Book PDF Ativo
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
                              ✓ Otimizado ({foto.tamanhoKb} KB)
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

                  {/* Upload Drag & Drop Area */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleUploadFoto}
                    accept="image/*"
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 p-4 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
                  >
                    <Upload className="w-6 h-6 text-blue-600 mb-1" />
                    <span className="text-xs font-bold text-slate-800">
                      {uploadingFoto ? 'Enviando foto...' : 'Arraste novas imagens ou clique para selecionar'}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Formatos aceitos: JPG, PNG, WEBP (Compressão nativa 90% preservando nitidez)
                    </span>
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
                          <span className="text-xs text-slate-500">
                            Tamanho: {formData.bookPdf.tamanhoMb} MB
                          </span>
                          <span className="text-slate-300">•</span>
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
                        className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-blue-600 transition-all cursor-pointer shadow-2xs"
                        title="Baixar PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
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

                {/* Campos Confidenciais Auditados */}
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
                      readOnly
                      value={formData.dlp.construtora}
                      className="h-8 px-2.5 rounded bg-black/40 text-xs text-slate-200 border border-rose-900/30 font-medium"
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
                      readOnly
                      value={formData.dlp.contatoDiretor}
                      className="h-8 px-2.5 rounded bg-black/40 text-xs text-slate-200 border border-rose-900/30 font-mono"
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
                      readOnly
                      value={formData.dlp.enderecoExato}
                      className="h-8 px-2.5 rounded bg-black/40 text-xs text-slate-200 border border-rose-900/30"
                    />
                    <span className="text-[10px] text-slate-400">
                      A IA informa apenas 'Região Nobre da Barra da Tijuca, próximo ao BarraShopping'.
                    </span>
                  </div>

                  {/* Campo 4 */}
                  <div className="p-3 rounded-lg bg-[#2a1b24] border border-rose-900/40 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-rose-400" />
                        Comissionamento & Margens Imobiliária
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 text-[10px] font-bold border border-rose-800">
                        ❌ Super Restrito
                      </span>
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={formData.dlp.comissao}
                      className="h-8 px-2.5 rounded bg-black/40 text-xs text-slate-200 border border-rose-900/30 font-semibold text-emerald-400"
                    />
                    <span className="text-[10px] text-slate-400">
                      Disponível unicamente via SSO para cargos de nível Diretor ou Sócio.
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
                  <span className="font-mono">DLP HASH: 8f92-ec71-44ab</span>
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
                    <span>Leads em atendimento (24h):</span>
                    <span className="font-bold text-slate-900">38 leads</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Books PDF enviados:</span>
                    <span className="font-bold text-slate-900">24 downloads</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tentativas de bypass bloqueadas:</span>
                    <span className="font-bold text-emerald-600">0 violações</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '82%' }}></div>
                </div>
                <span className="text-[11px] text-slate-400">Capacidade de throughput da instância: 82% livre</span>
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
                onClick={() => setActiveTab('governanca')}
                className="px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
              >
                Histórico de Auditoria DLP
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
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <span>Salvar Alterações & Replicar no WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: EMPREENDIMENTOS ATIVOS */}
      {activeTab === 'empreendimentos' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Empreendimentos Ativos na Roleta ({lancamentos.length || 6})
              </h3>
              <p className="text-xs text-slate-500">
                Lançamentos sincronizados e autorizados para entrega pelo WhatsApp e corretores plantonistas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('editar')}
              className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Novo Lançamento</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
            {/* Card 1 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3 shadow-2xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600">#DH-8842</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                    DLP 100% SEGURO
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 mt-1">Reserva Jardim Barra</h4>
                <p className="text-xs text-slate-500">Barra da Tijuca • 84m² a 114m² • A partir de R$ 980k</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 38 Leads Ativos
                </span>
                <button
                  onClick={() => setActiveTab('editar')}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Configurar & DLP →
                </button>
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3 shadow-2xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600">#DH-7731</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                    DLP 100% SEGURO
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 mt-1">Horizonte Leblon Residences</h4>
                <p className="text-xs text-slate-500">Leblon • 140m² a 280m² • A partir de R$ 3.8M</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 19 Leads Ativos
                </span>
                <button
                  onClick={() => setActiveTab('editar')}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Configurar & DLP →
                </button>
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3 shadow-2xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600">#DH-6420</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                    DLP 100% SEGURO
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 mt-1">Grand Park Ipanema</h4>
                <p className="text-xs text-slate-500">Ipanema • 110m² a 195m² • A partir de R$ 2.9M</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 42 Leads Ativos
                </span>
                <button
                  onClick={() => setActiveTab('editar')}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Configurar & DLP →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: GOVERNANÇA DLP */}
      {activeTab === 'governanca' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Matriz Geral de Governança DLP</h3>
              <p className="text-xs text-slate-500">
                Auditoria em tempo real de vetores de extração de dados e políticas de segurança ativas.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
              Motor Ativo • Zero Incidentes
            </span>
          </div>

          <div className="overflow-x-auto">
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
                  DLP ATIVOU: 2 BLOQUEIOS
                </span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed">
                "Olá! O <strong>Reserva Jardim Barra</strong> é um projeto comercializado com exclusividade pela{' '}
                <strong>{companyName}</strong> na Barra da Tijuca. Para detalhes sobre o corpo técnico ou para agendar uma visita guiada às unidades modelo de 2 e 3 quartos, nosso corretor plantonista está disponível agora. Gostaria de receber o Book Comercial completo em PDF?"
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
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Save Success */}
      {saveSuccessMsg && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 z-50 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-semibold">
            Lançamento salvo com sucesso e replicado nas instâncias WhatsApp!
          </span>
        </div>
      )}
    </div>
  );
}
