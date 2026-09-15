import React, { useState, useEffect } from 'react';
import {
  Users,
  Timer,
  Shield,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
  SlidersHorizontal,
  UserPlus,
  Badge,
  Inbox,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Phone,
  MessageSquare,
  Search,
  Filter,
  Send,
  MoreVertical,
  Sliders,
  Sparkles,
  Flame,
  Check,
  Touchpad,
  Lock,
} from 'lucide-react';
import { Broker } from '../types';

interface RoletaViewProps {
  companyName: string;
}

export function RoletaView({ companyName }: RoletaViewProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(120);
  const [transbordoInteligente, setTransbordoInteligente] = useState(true);
  const [filtroRegiao, setFiltroRegiao] = useState(true);
  const [mascaramentoDlp, setMascaramentoDlp] = useState(true);
  const [isSimulatingLead, setIsSimulatingLead] = useState(false);
  const [simulationSuccess, setSimulationSuccess] = useState(false);
  const [acceptedSimulation, setAcceptedSimulation] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Initial list of plantonistas matching the Stitch mockup
  const [corretores, setCorretores] = useState([
    {
      id: '1',
      posicao: '#1',
      nome: 'Marcos Vinicius',
      telefone: '(21) 99344-1288',
      especialidade: 'Barra & Recreio',
      leadsHoje: 4,
      sla: '1.8 min',
      ativo: true,
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAhvMLsrEuIlzulz_VkahMZlGkAHqpWpYUYHcEh7uYtPgF1SnoKhaBrPHPpG82oj2CSP4cl3NCnPvqDS8f7qg2mjRka6L2RAHnot9-ff_9GW9pACOuGlnE0VZWFL9SJwokiAaK8Ra225TQXUb239GoebSfRlsM6ZpiNHus1C8kFVbJ3V74ErSoeztlg6nxdeurm6keAPcsgP4Xi_yUJQy_AKjvxlMMai6aeX7tPXwRZvdSriJpTlF3JNw',
    },
    {
      id: '2',
      posicao: '#2',
      nome: 'Juliana Mendes',
      telefone: '(21) 98765-4321',
      especialidade: 'Zona Sul & Botafogo',
      leadsHoje: 5,
      sla: '2.1 min',
      ativo: true,
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBxRvIka6Vc3cwbVxL3LViKXCjn7zsmrAn34OsGiHhqvkh0fnZyNqtMrKueTt-O7JybGodE0UIGs5lpOEr1iWZJU93MZ9GPVHyPRz-_BTacJDRpy3jVa1NfEKC1ThvyfHBi30TmZ5Jo0tPy4-0lViz0wMkQGb3zDVBI-dh9jNccWi_U_t0DUsFSmyAh2ckhevKBcv0Z1FWgpAeoczW903Rm__ReNmNFFS5DPMVusKYHQFtHNDz_e4_CJA',
    },
    {
      id: '3',
      posicao: '#3',
      nome: 'Gabriel Silveira',
      telefone: '(21) 99876-5432',
      especialidade: 'Studios & Investimentos',
      leadsHoje: 3,
      sla: '1.5 min',
      ativo: true,
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDv7MgQy-L7kzDL-yS1NH5yxki8nNkJkmFOs7aQr_0ku19mr3WBAmhyZlHDxglyLvU_pE_PN_19LY-y9HAQY00jCxxTIIaCzodkqswdyRMfbo8EmDVWinG_UvkLUwt9TVp0Tz7UneTW-OteqqKVkXMko4CaofTtauAorCT-YlQBRN8cPv_qekGkiOu1a1TFGpU5G5-8EroFLbgYRQzkMv5yciDqHUEN_XmTwQUoexkaqN8y942zoKTYLQ',
    },
    {
      id: '4',
      posicao: '#4',
      nome: 'Patrícia Duarte',
      telefone: '(21) 99122-3344',
      especialidade: 'Leblon & Ipanema Luxo',
      leadsHoje: 4,
      sla: '2.9 min',
      ativo: true,
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCA7Df3Bas9MVa-qc4cHEcDT12C1-COb_c6HMUhA9kPMuPpNBo1pZJ7f6y0F0bmAcRetXSFKv0HzJliPTEXHtYbgjoH-ayNasMpQgF97WtsR7cOVYp8ChrjXT4HQPDnLqa1dNVhnw4wgoy79ciucp6p-M3bIvG6aBW48Nvl2TxsGDrIUlGlmNciy99tPS7lg65yd9XCjkVtuVILkRWuUijA8xrh4OdDi9giSDjjCb_xgwcCBWgmI87FQQ',
    },
    {
      id: '5',
      posicao: '#5',
      nome: 'Fernando Rocha',
      telefone: '(21) 98455-6677',
      especialidade: 'Comercial & Salas',
      leadsHoje: 2,
      sla: '3.4 min',
      ativo: true,
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVrwVx4Moh5VFNuSp897Ot7qsNKnpMw2Pv3Efp35WDWl_YPOPPNzjIJmfd6NFiqBqqKXE3wJcVivKjPCrmOYGd8f7CxknMnQhG088m5HrcZoqSRnGPedUhaRxDxht2sFlmNqNNG5Nx1VCUWkybbtzf7OyBfFs3I6v_BPNuBmp2iOJQ7L_CV0BxWN1Ek-fW-U9EDX_jViljsVGkoDa7wWXm0_dbcwT4FUvjRjecmbG_UnlLrGqmKoWPA',
    },
    {
      id: '6',
      posicao: '#--',
      nome: 'Rodrigo Alencar',
      telefone: '(21) 97788-9900',
      especialidade: 'Lançamentos Gerais',
      leadsHoje: 0,
      sla: 'Ausente',
      ativo: false,
      avatar: null,
    },
  ]);

  const toggleCorretorAtivo = (id: string) => {
    setCorretores((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ativo: !c.ativo } : c))
    );
  };

  const handleSimulateLead = () => {
    setIsSimulatingLead(true);
    setSimulationSuccess(false);
    setTimeout(() => {
      setIsSimulatingLead(false);
      setSimulationSuccess(true);
      setTimeout(() => setSimulationSuccess(false), 4000);
    }, 1200);
  };

  const filteredCorretores = corretores.filter(
    (c) =>
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.especialidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.telefone.includes(searchTerm)
  );

  return (
    <div className="w-full flex flex-col gap-6 max-w-[1720px] mx-auto">
      {/* Header de Controle da Roleta */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {isPaused ? 'Roleta Pausada' : 'Roleta Ativa em Tempo Real'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-medium">
              <Timer className="w-3.5 h-3.5" />
              Automático com Timeout de {timeoutSeconds}s
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">
              <Shield className="w-3.5 h-3.5 text-rose-500" />
              DLP & Proteção Ativa
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
            Roleta Inteligente de Corretores
          </h1>
          <p className="text-sm text-slate-500">
            Distribuição equitativa Round-Robin com checagem de geolocalização e transbordo por inatividade no WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs border ${
              isPaused
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
            }`}
          >
            {isPaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4 text-rose-600" />}
            <span>{isPaused ? 'Retomar Roleta Geral' : 'Pausar Roleta Geral'}</span>
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Configurações de Regra</span>
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Adicionar Corretor</span>
          </button>
        </div>
      </header>

      {/* Barra de Métricas de Distribuição de Leads */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Conectados no Plantão */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Conectados no Plantão
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-display text-slate-900">12</span>
              <span className="text-sm font-medium text-slate-400">/ 16</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <span className="h-full bg-blue-600 rounded-full" style={{ width: '75%' }}></span>
              </span>
              <span className="text-xs font-bold text-slate-700">75%</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Leads Distribuídos Hoje */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Leads Distribuídos Hoje
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Inbox className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-display text-slate-900">48</span>
              <span className="text-xs font-bold text-emerald-600">+18.4% vs ontem</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
              <Timer className="w-3.5 h-3.5 text-slate-400" />
              <span>Último lead repassado há 3 min</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Primeiro Contato (SLA) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Primeiro Contato (SLA)
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Gauge className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-display text-slate-900">2m 14s</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Ótimo
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Alvo comercial máx: 05 min</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Aceite Imediato WhatsApp */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Aceite Imediato WhatsApp
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-display text-slate-900">94.2%</span>
              <span className="text-xs font-medium text-rose-600">3 transbordos</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
              <RotateCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Zero leads perdidos por SLA</span>
            </div>
          </div>
        </div>
      </section>

      {/* Fila Circular / Próximo na Fila & Configurações Rápidas */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card Próximo na Vez (4 colunas desktop) */}
        <div className="lg:col-span-4 bg-slate-900 text-white rounded-xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between border border-slate-800">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-blue-600/15 blur-2xl pointer-events-none"></div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1 text-emerald-300 bg-emerald-950/80 border border-emerald-800 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 text-emerald-400" />
                Próximo na Vez de Receber Lead
              </span>
              <span className="text-slate-400 text-xs font-semibold">Posição #1</span>
            </div>

            <div className="flex items-start gap-4 mt-2">
              <div className="relative shrink-0">
                <img
                  src={corretores[0].avatar}
                  alt={corretores[0].nome}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-xl object-cover ring-2 ring-blue-500 shadow-md"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-slate-900"></span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold text-white truncate">{corretores[0].nome}</h2>
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                </div>
                <span className="text-xs text-slate-300">Senior Broker • Barra da Tijuca & Recreio</span>
                <span className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  {corretores[0].telefone}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5 bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">Leads Hoje</span>
                <span className="text-lg font-bold text-white">4 Leads</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">Meta Diária</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold text-white">80%</span>
                  <span className="text-xs text-emerald-400 font-semibold">(4/5)</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Disponível & Online (WhatsApp Web)
              </span>
              <span>Tempo de resposta: 1.8 min</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleSimulateLead}
              disabled={isSimulatingLead}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-70"
            >
              {isSimulatingLead ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Disparando Lead via API...</span>
                </>
              ) : simulationSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Lead Enviado para Marcos V.!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Simular Envio de Lead Imediato</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mini Visualizador de Distribuição em Tempo Real (8 colunas desktop) */}
        <div className="lg:col-span-8 bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Fluxo Sequencial de Distribuição</h2>
              <p className="text-xs text-slate-500">Próximos corretores alinhados na esteira de atendimento</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
              <RotateCw className="w-3.5 h-3.5 text-blue-600" />
              <span>Regra: Menor Carga + Maior SLA</span>
            </div>
          </div>

          {/* Fila Dinâmica Cards Horizontais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 my-2">
            {/* 1st in line */}
            <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">
                  #1 da Vez
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="my-2">
                <p className="text-sm font-bold text-slate-900 truncate">Marcos V.</p>
                <p className="text-xs text-slate-500">4 leads hoje</p>
              </div>
              <span className="text-xs text-blue-700 font-semibold">Espera: 0s (Próximo)</span>
            </div>

            {/* 2nd in line */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-semibold">
                  #2 da Vez
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="my-2">
                <p className="text-sm font-bold text-slate-900 truncate">Juliana M.</p>
                <p className="text-xs text-slate-500">5 leads hoje</p>
              </div>
              <span className="text-xs text-slate-500">SLA: 2.1 min</span>
            </div>

            {/* 3rd in line */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-semibold">
                  #3 da Vez
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="my-2">
                <p className="text-sm font-bold text-slate-900 truncate">Gabriel S.</p>
                <p className="text-xs text-slate-500">3 leads hoje</p>
              </div>
              <span className="text-xs text-slate-500">SLA: 1.5 min</span>
            </div>

            {/* 4th in line */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-semibold">
                  #4 da Vez
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="my-2">
                <p className="text-sm font-bold text-slate-900 truncate">Patrícia D.</p>
                <p className="text-xs text-slate-500">4 leads hoje</p>
              </div>
              <span className="text-xs text-slate-500">SLA: 2.9 min</span>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 mt-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>A roleta compensa automaticamente corretores que sofreram transbordo sem culpa técnica.</span>
            </div>
            <a href="#" className="text-xs font-semibold text-blue-600 hover:underline shrink-0 ml-2">
              Ver Histórico de Auditoria
            </a>
          </div>
        </div>
      </section>

      {/* Seção Principal Dividida: Tabela de Corretores & Painel Lateral de Regras */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Tabela Interativa da Equipe de Plantão (8 colunas) */}
        <div className="xl:col-span-8 bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Equipe de Plantão Comercial</h2>
              <span className="text-xs text-slate-500">
                Habilite ou congele corretores na fila sem desconfigurar as métricas históricas.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrar corretor..."
                  className="h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 w-48"
                />
              </div>
              <button
                type="button"
                className="h-9 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Regiões</span>
              </button>
            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-y border-slate-200">
                  <th className="py-3 px-3">Fila</th>
                  <th className="py-3 px-3">Corretor</th>
                  <th className="py-3 px-3">Especialidade</th>
                  <th className="py-3 px-3 text-center">Leads Hoje</th>
                  <th className="py-3 px-3 text-center">Tempo SLA</th>
                  <th className="py-3 px-3 text-center">Status Plantão</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-900">
                {filteredCorretores.map((corretor) => (
                  <tr
                    key={corretor.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      !corretor.ativo ? 'opacity-60 bg-slate-50/40' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-bold text-blue-600">{corretor.posicao}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        {corretor.avatar ? (
                          <img
                            src={corretor.avatar}
                            alt={corretor.nome}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover shadow-2xs"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                            RA
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-900 leading-tight">
                            {corretor.nome}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                            <MessageSquare className="w-3 h-3 text-emerald-600" />
                            {corretor.telefone}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                        {corretor.especialidade}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-xs">
                      {corretor.leadsHoje} Leads
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          corretor.sla === 'Ausente'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {corretor.sla}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleCorretorAtivo(corretor.id)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          corretor.ativo ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            corretor.ativo ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
                          title="Enviar WhatsApp Teste"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
                          title="Configurações Individuais"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2 text-xs text-slate-500 border-t border-slate-100">
            <span>Exibindo {filteredCorretores.length} corretores na visão de plantão.</span>
            <span className="px-2 py-1 rounded bg-slate-100 font-semibold text-slate-700">
              Balanceamento Automático: ON
            </span>
          </div>
        </div>

        {/* Painel Lateral: Regras da Roleta & Automação do WhatsApp (4 colunas) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          {/* Card Configurações de Transbordo */}
          <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Regras de Timeout & Transbordo</h3>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Ativo
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Tempo máximo de tolerância para o corretor confirmar leitura no WhatsApp antes do lead ser automaticamente repassado para o próximo da fila.
            </p>

            {/* Slider Interativo */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Tempo Limite para Aceite:</span>
                <span className="text-sm font-bold text-blue-600">{timeoutSeconds} segundos</span>
              </div>
              <input
                type="range"
                min={30}
                max={300}
                step={15}
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span>30s (Ultra-rápido)</span>
                <span>120s (Padrão)</span>
                <span>300s (5 min)</span>
              </div>
            </div>

            {/* Checkboxes Estilizados */}
            <div className="flex flex-col gap-3 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={transbordoInteligente}
                  onChange={(e) => setTransbordoInteligente(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <strong className="font-semibold text-slate-900">Transbordo Inteligente:</strong>{' '}
                  Repassar imediatamente ao detectar status "Ausente" ou esgotamento do SLA de {timeoutSeconds}s.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={filtroRegiao}
                  onChange={(e) => setFiltroRegiao(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <strong className="font-semibold text-slate-900">Filtro Rígido por Região:</strong>{' '}
                  Priorizar corretores credenciados para a zona do empreendimento antes de abrir para a fila geral.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={mascaramentoDlp}
                  onChange={(e) => setMascaramentoDlp(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <strong className="font-semibold text-slate-900">Mascaração DLP WhatsApp:</strong>{' '}
                  Exibir dados completos de contato apenas após a confirmação expressa de atendimento.
                </span>
              </label>
            </div>
          </div>

          {/* Preview Real da Mensagem no WhatsApp */}
          <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Preview da Mensagem no WhatsApp</h3>
              </div>
              <span className="text-[11px] text-slate-400">Instância Oficial</span>
            </div>

            <p className="text-xs text-slate-500">
              Formato exato disparado via API oficial no WhatsApp do corretor sorteado na roleta:
            </p>

            {/* Mock WhatsApp Bubble */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs flex flex-col gap-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-200">
                <span className="font-bold text-blue-700 text-[11px]">
                  {companyName.toUpperCase()} • BOT DE DISTRIBUIÇÃO
                </span>
                <span className="text-[10px]">Agora</span>
              </div>

              <p className="text-slate-800 leading-relaxed font-medium">
                🚀 <strong>NOVO LEAD EXCLUSIVO DISPONÍVEL NA ROLETA!</strong><br />
                Você tem <strong>{timeoutSeconds} segundos</strong> para aceitar este atendimento.
              </p>

              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 text-slate-700 font-sans">
                <div>👤 <strong>Cliente:</strong> Dr. Henrique Albuquerque</div>
                <div>🏢 <strong>Interesse:</strong> Península Mandarim (4 Quartos - Barra)</div>
                <div>💰 <strong>Ticket Estimado:</strong> R$ 3.850.000,00</div>
                <div>🎯 <strong>Canal de Origem:</strong> Tráfego Pago / Instagram Ads</div>
                <div>🛡️ <strong>DLP Status:</strong> Lead qualificado & Auditado</div>
              </div>

              <p className="text-slate-500 text-[11px] italic">
                Responda <strong>"ACEITAR"</strong> neste chat para desbloquear o número de telefone e transferir a conversa diretamente para o seu aparelho.
              </p>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setAcceptedSimulation(!acceptedSimulation)}
                  className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    acceptedSimulation
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {acceptedSimulation
                      ? '✓ Atendimento Aceito por Marcos Vinicius!'
                      : '[SIMULAÇÃO] Simular Clique em ACEITAR'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
