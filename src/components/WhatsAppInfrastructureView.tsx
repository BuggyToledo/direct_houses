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
import { WhatsAppStatus, Broker } from '../types';

interface WhatsAppInfrastructureViewProps {
  companyName: string;
  isWhatsAppConnected?: boolean;
  status: WhatsAppStatus;
  onRefreshStatus: () => void;
  onConnect: (force?: boolean) => void;
  onDisconnect: () => void;
}

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
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

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
            Central WhatsApp & Conexão Multi-Device
          </h1>
          <p className="text-sm text-slate-500">
            Monitoramento de instâncias Baileys Multi-Device, pareamento via QR Code, telemetria de latência e testes de envio.
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
    </div>
  );
}
