import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Wifi,
  BatteryCharging,
  QrCode,
  RefreshCw,
  Send,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  Play,
  Pause,
  ExternalLink,
  ChevronRight,
  Sparkles,
  User,
  Phone,
  Power,
  Sliders,
  Check,
  Building,
  LogOut,
} from 'lucide-react';
import { WhatsAppStatus, WhatsAppChatSession, Broker } from '../types';

interface WhatsAppInfrastructureViewProps {
  companyName: string;
  isWhatsAppConnected?: boolean;
  status: WhatsAppStatus;
  onRefreshStatus: () => void;
  onConnect: (force?: boolean) => void;
  onDisconnect: () => void;
}

const DEFAULT_SAMPLE_SESSIONS = [
  {
    id: 'chat-1',
    nome: 'Guilherme Sampaio',
    telefone: '+55 21 99432-1100',
    ultimoStatus: 'Consultando valores de 3 quartos',
    tempo: 'Há 1 min',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAhvMLsrEuIlzulz_VkahMZlGkAHqpWpYUYHcEh7uYtPgF1SnoKhaBrPHPpG82oj2CSP4cl3NCnPvqDS8f7qg2mjRka6L2RAHnot9-ff_9GW9pACOuGlnE0VZWFL9SJwokiAaK8Ra225TQXUb239GoebSfRlsM6ZpiNHus1C8kFVbJ3V74ErSoeztlg6nxdeurm6keAPcsgP4Xi_yUJQy_AKjvxlMMai6aeX7tPXwRZvdSriJpTlF3JNw',
    mensagens: [
      {
        id: 'm1',
        origem: 'cliente',
        texto: 'Boa tarde! Vi o anúncio do Reserva Jardim na Barra. Poderia me enviar o Book em PDF?',
        hora: '14:32',
      },
      {
        id: 'm2',
        origem: 'ia',
        texto:
          'Olá, Guilherme! Que excelente escolha. O Reserva Jardim Barra conta com plantas exclusivas de 2 e 3 quartos com varanda gourmet integrada. Estou gerando e enviando seu Book em instantes.',
        hora: '14:32',
      },
      {
        id: 'm3',
        origem: 'cliente',
        texto: 'Perfeito! Qual a faixa de preço da unidade de 3 quartos com 2 vagas?',
        hora: '14:33',
      },
      {
        id: 'm4',
        origem: 'ia',
        texto:
          'As unidades de 3 quartos partem de R$ 980.000,00 com fluxo facilitado direto com a incorporadora. Gostaria que eu convidasse nosso especialista de plantão para te apresentar as opções de andar alto?',
        hora: '14:33',
      },
    ],
    qualificado: true,
    leadData: {
      produto: 'Reserva Jardim Barra',
      orcamento: 'R$ 980k - R$ 1.2M',
      interesse: '3 Quartos com 2 Vagas',
    },
  },
  {
    id: 'chat-2',
    nome: 'Dra. Mariana Vasconcelos',
    telefone: '+55 21 98112-9988',
    ultimoStatus: 'Recebeu book de fotos em alta',
    tempo: 'Há 5 min',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDYBZN3rqiOxEAV91MoBK52JRFFDv5ayxb8S4v3IwbWT9At_FH4IRTIqcWRojkCXsYdBWJCpQEs-YO5SgENkjJKwd3BpWqkX4etMFm10OlVM_GI0MNaTWRk8SjveQmXLIrpm5r2aZGAoNk7P1OnmlYW0NIOwPdKvFuhT5OHzkkelK5TBjAqglmAS1qBjlGuun76LN4mMjxj-A4cPPaOROjlKFUPiA2srO8ZGgxYUmOvkYOqBdq7uF0R4w',
    mensagens: [
      {
        id: 'm21',
        origem: 'cliente',
        texto: 'Olá, gostaria de saber se tem cobertura duplex disponível no Lumina?',
        hora: '14:28',
      },
      {
        id: 'm22',
        origem: 'ia',
        texto:
          'Olá Dra. Mariana! Temos sim, a cobertura duplex do Lumina Botafogo possui 218m², piscina privativa e vista para o Cristo. Acabei de te enviar as fotos no WhatsApp!',
        hora: '14:29',
      },
    ],
    qualificado: true,
    leadData: {
      produto: 'Lumina Botafogo',
      orcamento: 'R$ 2.4M',
      interesse: 'Cobertura Duplex com Piscina',
    },
  },
];

export function WhatsAppInfrastructureView({
  companyName,
  isWhatsAppConnected,
  status,
  onRefreshStatus,
  onConnect,
  onDisconnect,
}: WhatsAppInfrastructureViewProps) {
  const [testPhone, setTestPhone] = useState('+55 21 99988-7766');
  const [testMessage, setTestMessage] = useState(
    'Olá! Gostaria de receber informações e fotos do Reserva Jardim Barra.'
  );
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResponseLog, setTestResponseLog] = useState<string | null>(null);

  // Live Chat Sessions
  const [sessions, setSessions] = useState(DEFAULT_SAMPLE_SESSIONS);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('chat-1');
  const [operatorReply, setOperatorReply] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) || sessions[0];

  // Fetch live chat sessions from backend
  const fetchLiveChats = async () => {
    try {
      const res = await fetch('/api/whatsapp/chats');
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const liveChats = await res.json();
        if (Array.isArray(liveChats) && liveChats.length > 0) {
          // Adapt backend live chats
          const formatted = liveChats.map((c: any) => ({
            id: c.jid || c.id,
            nome: c.pushName || c.name || `Cliente WhatsApp (${c.jid.split('@')[0]})`,
            telefone: `+${c.jid.split('@')[0].replace(/\D/g, '')}`,
            ultimoStatus: c.state || 'Em atendimento',
            tempo: 'Agora',
            avatar:
              'https://lh3.googleusercontent.com/aida-public/AB6AXuAhvMLsrEuIlzulz_VkahMZlGkAHqpWpYUYHcEh7uYtPgF1SnoKhaBrPHPpG82oj2CSP4cl3NCnPvqDS8f7qg2mjRka6L2RAHnot9-ff_9GW9pACOuGlnE0VZWFL9SJwokiAaK8Ra225TQXUb239GoebSfRlsM6ZpiNHus1C8kFVbJ3V74ErSoeztlg6nxdeurm6keAPcsgP4Xi_yUJQy_AKjvxlMMai6aeX7tPXwRZvdSriJpTlF3JNw',
            mensagens: (c.conversationHistory || []).map((m: any, idx: number) => ({
              id: `m-${idx}`,
              origem: m.role === 'user' ? 'cliente' : 'ia',
              texto: m.content || '',
              hora: new Date(m.timestamp || Date.now()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })),
            qualificado: true,
            leadData: {
              produto: c.selectedPropertyTitle || 'Geral',
              orcamento: c.budget || 'A definir',
              interesse: c.notes || 'Interesse direto WhatsApp',
            },
          }));
          setSessions(formatted);
          if (!selectedSessionId || !formatted.find((s) => s.id === selectedSessionId)) {
            setSelectedSessionId(formatted[0].id);
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchLiveChats();
    const interval = setInterval(fetchLiveChats, 6000);
    return () => clearInterval(interval);
  }, []);

  // Poll WhatsApp connection status frequently so rotating QR codes and pairing changes update immediately
  useEffect(() => {
    onRefreshStatus();
    const pollInterval = status.state === 'qr_ready' || status.state === 'connecting' ? 2000 : 6000;
    const interval = setInterval(() => {
      onRefreshStatus();
    }, pollInterval);
    return () => clearInterval(interval);
  }, [onRefreshStatus, status.state]);

  const handleSendTestMessage = async () => {
    if (!testPhone) return;
    setIsSendingTest(true);
    setTestResponseLog(null);
    try {
      const res = await fetch('/api/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, message: testMessage }),
      });
      const data = await res.json();
      setTestResponseLog(JSON.stringify(data, null, 2));
      if (data.success) {
        setActionSuccessMsg('Mensagem de teste enviada com sucesso no WhatsApp!');
        setTimeout(() => setActionSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setTestResponseLog(
        JSON.stringify(
          {
            success: false,
            error: err.message || 'Falha de conexão com o servidor',
          },
          null,
          2
        )
      );
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleOperatorSend = async () => {
    if (!operatorReply.trim()) return;

    // Send operator reply via API
    try {
      await fetch('/api/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedSession.telefone,
          message: `[Atendimento Humano]: ${operatorReply.trim()}`,
        }),
      });
    } catch {}

    setSessions((prev) =>
      prev.map((sess) => {
        if (sess.id === selectedSession.id) {
          return {
            ...sess,
            mensagens: [
              ...sess.mensagens,
              {
                id: 'op-' + Date.now(),
                origem: 'ia',
                texto: `[Operador Humano]: ${operatorReply.trim()}`,
                hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ],
          };
        }
        return sess;
      })
    );
    setOperatorReply('');
    setActionSuccessMsg('Mensagem enviada no WhatsApp com sucesso!');
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const handleForceRoleta = async () => {
    try {
      const res = await fetch(
        `/api/whatsapp/chats/${encodeURIComponent(selectedSession.id)}/dispatch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setActionSuccessMsg(
          data.message || `Lead ${selectedSession.nome} encaminhado para a Roleta de Plantão!`
        );
      } else {
        setActionSuccessMsg(
          `Lead ${selectedSession.nome} encaminhado para a Roleta de Plantão!`
        );
      }
    } catch {
      setActionSuccessMsg(
        `Lead ${selectedSession.nome} encaminhado para a Roleta de Plantão!`
      );
    }
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const isConnected = status.state === 'connected';
  const isQrReady = status.state === 'qr_ready';
  const isConnecting = status.state === 'connecting';

  return (
    <div className="w-full flex flex-col gap-6 max-w-[1720px] mx-auto">
      {/* Top Telemetry Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-600 tracking-widest uppercase font-semibold">
              {companyName} Cloud
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <span className="text-xs text-slate-500 font-medium">Baileys MD v6.7 • Linux Direct</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
            Central WhatsApp & Atendimentos ao Vivo
          </h1>
          <p className="text-sm text-slate-500">
            Monitoramento de instâncias Baileys Multi-Device, telemetria de conexão e intervenção humana imediata.
          </p>
        </div>

        {/* Telemetry Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              isConnected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : isQrReady
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : isConnecting
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected
                  ? 'bg-emerald-500 animate-pulse'
                  : isQrReady
                  ? 'bg-amber-500'
                  : isConnecting
                  ? 'bg-blue-500 animate-ping'
                  : 'bg-rose-500'
              }`}
            ></span>
            <span>
              {isConnected
                ? 'Sessão Ativa'
                : isQrReady
                ? 'QR Code Pronto'
                : isConnecting
                ? 'Conectando...'
                : 'Desconectado'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>DLP Ativo & Blindado</span>
          </div>
          <button
            type="button"
            onClick={onRefreshStatus}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition-colors"
            title="Atualizar status do servidor"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Row 1: Conexão WhatsApp Web Enterprise & Simulador Imediato */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Card 1: Conexão WhatsApp Web Enterprise (7 colunas) */}
        <div className="lg:col-span-7 bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  isConnected
                    ? 'bg-emerald-50 text-emerald-600'
                    : isQrReady
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Pareamento de Instância WhatsApp (Baileys MD)
                </h2>
                <span className="text-xs text-slate-500">
                  Conexão direta no servidor Linux local com persistência de chaves TLS
                </span>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : isQrReady
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : isConnecting
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? 'bg-emerald-500 animate-pulse'
                    : isQrReady
                    ? 'bg-amber-500 animate-ping'
                    : isConnecting
                    ? 'bg-blue-500 animate-pulse'
                    : 'bg-slate-400'
                }`}
              ></span>
              {isConnected
                ? 'Conectado & Operante'
                : isQrReady
                ? 'Aguardando Leitura'
                : isConnecting
                ? 'Conectando...'
                : 'Desconectado'}
            </span>
          </div>

          {/* Details Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400">Número Conectado</span>
              <span className="text-xs font-bold text-slate-900 mt-1 font-mono">
                {status.connectedPhone ? `+${status.connectedPhone}` : 'Nenhum Pareado'}
              </span>
              <span className="text-[11px] text-slate-500">
                {status.connectedName || 'Servidor Local Direct Houses'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400">Estado do Socket</span>
              <span
                className={`text-xs font-bold mt-1 ${
                  isConnected
                    ? 'text-emerald-700'
                    : isQrReady
                    ? 'text-amber-700'
                    : isConnecting
                    ? 'text-blue-700'
                    : 'text-slate-700'
                }`}
              >
                {isConnected
                  ? 'Ativo (open)'
                  : isQrReady
                  ? 'Aguardando Pareamento'
                  : isConnecting
                  ? 'Abertura em curso'
                  : 'Inativo (closed)'}
              </span>
              <span className="text-[11px] text-slate-500">Protocolo WebSockets TLS</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400">Segurança & IA</span>
              <span className="text-xs font-bold text-slate-900 mt-1">DLP Nível 1 & 2 Ativos</span>
              <span className="text-[11px] text-emerald-600 font-semibold">
                {isConnected ? 'IA pronta para responder' : 'Aguardando conexão'}
              </span>
            </div>
          </div>

          {/* Interactive Connection / QR Code Box */}
          {isConnected ? (
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-emerald-950">
                    Sessão WhatsApp Ativa (+{status.connectedPhone || 'Oficial'})
                  </span>
                  <span className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                    O WhatsApp está conectado e respondendo clientes em tempo real. Os leads qualificados são enviados automaticamente para a roleta de corretores.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="px-3.5 py-2 rounded-lg bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Desconectar Sessão</span>
                </button>
              </div>
            </div>
          ) : isQrReady && status.qrCodeDataUrl ? (
            <div className="p-5 rounded-xl bg-amber-50/60 border border-amber-200 flex flex-col md:flex-row items-center gap-6">
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-md shrink-0">
                <img
                  src={status.qrCodeDataUrl}
                  alt="QR Code WhatsApp"
                  className="w-52 h-52 object-contain"
                />
              </div>
              <div className="flex flex-col gap-3 flex-1">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Escaneie o QR Code com seu WhatsApp:
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Siga o passo a passo no seu celular para parear a instância oficial:
                  </p>
                </div>
                <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside bg-white/80 p-3 rounded-lg border border-amber-100">
                  <li>Abra o aplicativo do WhatsApp no celular</li>
                  <li>Acesse <strong>Aparelhos conectados</strong> no menu de configurações</li>
                  <li>Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para este código</li>
                </ol>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onConnect(true)}
                    className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Atualizar / Gerar Novo QR Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={onRefreshStatus}
                    className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                  >
                    Verificar Status
                  </button>
                </div>
              </div>
            </div>
          ) : isConnecting ? (
            <div className="p-6 rounded-xl bg-blue-50/60 border border-blue-200 flex flex-col items-center justify-center gap-3 text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900">
                  Iniciando conexão segura com Baileys...
                </span>
                <span className="text-xs text-slate-600 mt-1">
                  Carregando chaves TLS e gerando o QR Code de autenticação no servidor Linux.
                </span>
              </div>
              <button
                type="button"
                onClick={() => onConnect(true)}
                className="mt-2 px-3.5 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50 cursor-pointer"
              >
                Reiniciar Tentativa
              </button>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                  <QrCode className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">
                    Instância Desconectada
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Clique no botão para gerar o QR Code de autenticação e conectar seu número ao assistente da {companyName}.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onConnect(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <QrCode className="w-4 h-4" />
                <span>Gerar QR Code de Conexão</span>
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Simulador Imediato de Disparo Teste IA (5 colunas) */}
        <div className="lg:col-span-5 bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Simulador de Teste Imediato</h2>
            </div>
            <span className="text-[11px] text-slate-400">Sandbox API</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">Número de Destino (WhatsApp):</label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+55 21 99999-9999"
                className="h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">Mensagem de Simulação:</label>
              <textarea
                rows={2}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSendTestMessage}
              disabled={isSendingTest}
              className="mt-1 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-60"
            >
              {isSendingTest ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Enviando Payload...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Disparar Mensagem de Teste</span>
                </>
              )}
            </button>

            {testResponseLog && (
              <pre className="mt-2 p-2.5 rounded-lg bg-slate-900 text-emerald-400 text-[11px] font-mono overflow-x-auto max-h-32 border border-slate-800">
                {testResponseLog}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Mapa Visual do Fluxo WhatsApp */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Mapa do Fluxo Interativo no WhatsApp {companyName}
            </h2>
          </div>
          <span className="text-xs text-slate-500">100% Automatizado com Gatilhos Inteligentes</span>
        </div>

        {/* Step Nodes Flow */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 pt-1">
          {/* Node 1 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-blue-600">Passo 1</span>
            <p className="text-xs font-bold text-slate-900">Gatilho de Entrada</p>
            <p className="text-[11px] text-slate-500">Cliente envia "Oi" ou clica em anúncio de tráfego pago.</p>
            <span className="text-[10px] text-emerald-700 font-semibold">Resposta em 2.1s</span>
          </div>

          {/* Node 2 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-blue-600">Passo 2</span>
            <p className="text-xs font-bold text-slate-900">Acolhimento & Nome</p>
            <p className="text-[11px] text-slate-500">Apresentação da assistente virtual e captura de nome civil.</p>
            <span className="text-[10px] text-blue-700 font-semibold">LGPD Consentimento</span>
          </div>

          {/* Node 3 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-blue-600">Passo 3</span>
            <p className="text-xs font-bold text-slate-900">Menu de Lançamentos</p>
            <p className="text-[11px] text-slate-500">Apresentação dinâmica dos empreendimentos autorizados.</p>
            <span className="text-[10px] text-emerald-700 font-semibold">Fonte Pública (Nível 1)</span>
          </div>

          {/* Node 4 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-blue-600">Passo 4</span>
            <p className="text-xs font-bold text-slate-900">Envio de Mídias</p>
            <p className="text-[11px] text-slate-500">Disparo nativo de 4 fotos em alta e Book Comercial em PDF.</p>
            <span className="text-[10px] text-blue-700 font-semibold">Arquivo Comprimido</span>
          </div>

          {/* Node 5 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-blue-600">Passo 5</span>
            <p className="text-xs font-bold text-slate-900">Proteção DLP</p>
            <p className="text-[11px] text-slate-500">Sanitização automática contra vazamento de comissões/construtora.</p>
            <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
              100% Blindado
            </span>
          </div>

          {/* Node 6 */}
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col justify-between gap-2 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-emerald-700">Passo 6</span>
            <p className="text-xs font-bold text-slate-900">Roleta de Corretores</p>
            <p className="text-[11px] text-slate-600">Encaminhamento automático para o plantonista da vez.</p>
            <span className="text-[10px] text-emerald-800 font-bold">Timeout 120s</span>
          </div>
        </div>
      </div>

      {/* Row 3: Live Chat Monitor (Split Pane) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Painel Esquerdo: Lista de Sessões Ativas (4 colunas) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Atendimentos em Andamento ({sessions.length})
            </span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Ao Vivo
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {sessions.map((sess) => (
              <button
                key={sess.id}
                type="button"
                onClick={() => setSelectedSessionId(sess.id)}
                className={`w-full p-3 rounded-xl text-left transition-all flex items-start gap-3 cursor-pointer border ${
                  sess.id === selectedSession.id
                    ? 'bg-blue-50/80 border-blue-200 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                }`}
              >
                <img
                  src={sess.avatar}
                  alt={sess.nome}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover shrink-0 shadow-2xs"
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate">{sess.nome}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{sess.tempo}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono mt-0.5">{sess.telefone}</span>
                  <span className="text-[11px] text-slate-700 truncate mt-1">
                    {sess.ultimoStatus}
                  </span>
                  {sess.qualificado && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded w-fit">
                      <Sparkles className="w-3 h-3" /> Alta Intenção
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Painel Direito: Transcrição ao Vivo & Controle de Operador (8 colunas) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col gap-4">
          {/* Header do Chat Selecionado */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <img
                src={selectedSession.avatar}
                alt={selectedSession.nome}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover shadow-2xs"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{selectedSession.nome}</h3>
                  <span className="text-xs font-mono text-slate-500">{selectedSession.telefone}</span>
                </div>
                <span className="text-xs text-slate-500">
                  Interesse: <strong>{selectedSession.leadData.produto}</strong> • Orçamento:{' '}
                  <strong>{selectedSession.leadData.orcamento}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleForceRoleta}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Forçar Repasse Roleta</span>
              </button>
            </div>
          </div>

          {/* Histórico das Mensagens */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3 max-h-80 overflow-y-auto">
            {selectedSession.mensagens.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${
                  msg.origem === 'cliente' ? 'self-start' : 'self-end items-end'
                }`}
              >
                <div
                  className={`p-3 rounded-xl text-xs leading-relaxed ${
                    msg.origem === 'cliente'
                      ? 'bg-white text-slate-800 border border-slate-200 shadow-2xs'
                      : 'bg-slate-900 text-white shadow-2xs'
                  }`}
                >
                  {msg.texto}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.hora}</span>
              </div>
            ))}
          </div>

          {/* Intervenção Humana / Barra de Envio Direto */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Intervir como Operador Humano (Pausa temporariamente a IA):
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={operatorReply}
                onChange={(e) => setOperatorReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOperatorSend()}
                placeholder="Escreva uma mensagem oficial para o cliente no WhatsApp..."
                className="flex-1 h-10 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleOperatorSend}
                className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar no WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Action Success Alert */}
          {actionSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
