import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Send,
  Sparkles,
  ShieldCheck,
  Phone,
} from 'lucide-react';
import { WhatsAppStatus } from '../types';

interface WhatsAppConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: WhatsAppStatus;
  onRefreshStatus: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WhatsAppConnectModal({
  isOpen,
  onClose,
  status,
  onRefreshStatus,
  onConnect,
  onDisconnect,
}: WhatsAppConnectModalProps) {
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste do Assistente Comercial Direct Houses.');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Auto poll status while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      onRefreshStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen, onRefreshStatus]);

  if (!isOpen) return null;

  const isConnected = status.state === 'connected';
  const isQrReady = status.state === 'qr_ready';
  const isConnecting = status.state === 'connecting';

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, message: testMessage }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: 'Mensagem de teste enviada com sucesso no WhatsApp!',
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || data.message || 'Falha ao enviar mensagem.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Erro de conexão com o servidor.',
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Conectar WhatsApp Web</h3>
              <p className="text-xs text-slate-500">
                Atendimento automático 24/7 e disparo de leads para corretores
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 ${
              isConnected
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : isQrReady
                ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                : isConnecting
                ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="mt-0.5">
              {isConnected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : isQrReady ? (
                <QrCode className="w-5 h-5 text-amber-600 animate-pulse" />
              ) : isConnecting ? (
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              ) : (
                <Smartphone className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">
                {isConnected
                  ? `WhatsApp Conectado: +${status.connectedPhone || 'Ativo'}`
                  : isQrReady
                  ? 'Aguardando leitura do QR Code pelo celular'
                  : isConnecting
                  ? 'Iniciando conexão segura com WhatsApp...'
                  : 'WhatsApp Desconectado'}
              </div>
              <div className="text-xs opacity-90 mt-0.5">
                {isConnected
                  ? `Sessão ativa e sincronizada. A IA responderá clientes e encaminhará leads aos corretores automaticamente.`
                  : isQrReady
                  ? 'Abra o WhatsApp no seu smartphone, vá em Aparelhos Conectados e aponte a câmera para o QR Code abaixo.'
                  : 'Clique no botão abaixo para gerar o QR Code de autenticação.'}
              </div>
            </div>
          </div>

          {/* QR Code Container */}
          {isQrReady && status.qrCodeDataUrl && (
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="bg-white p-4 rounded-xl shadow-md border border-slate-200 inline-block mb-3">
                <img
                  src={status.qrCodeDataUrl}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64 object-contain rounded-lg"
                />
              </div>
              <div className="text-center text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Atualização em tempo real. O código expira automaticamente para sua segurança.
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 items-center justify-between pt-2">
            {!isConnected && !isQrReady && !isConnecting && (
              <button
                onClick={onConnect}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                Gerar QR Code de Conexão
              </button>
            )}

            {isQrReady && (
              <button
                onClick={onConnect}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar QR Code
              </button>
            )}

            {isConnected && (
              <button
                onClick={onDisconnect}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs rounded-xl transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Desconectar Sessão
              </button>
            )}

            <button
              onClick={onRefreshStatus}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ml-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Verificar Status
            </button>
          </div>

          {/* Test WhatsApp Message Card (if connected) */}
          {isConnected && (
            <div className="pt-4 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600" />
                Testar Envio de Mensagem Direta
              </h4>

              <form onSubmit={handleSendTest} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Número do WhatsApp de Teste (com DDD)
                  </label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Ex: 21987654321 ou (21) 98765-4321"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Mensagem de Teste
                  </label>
                  <input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={testLoading || !testPhone}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-medium text-xs rounded-xl transition-colors flex items-center gap-2"
                >
                  {testLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Disparar Teste no WhatsApp
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Conexão WebSocket Multi-Device criptografada ponta a ponta
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
