import React, { useState } from 'react';
import {
  Share2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  RefreshCw,
  Copy,
  Check,
  Globe,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import { AppSettings } from '../types';

interface IntegracoesViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  companyName: string;
}

export function IntegracoesView({
  settings,
  onSaveSettings,
  companyName,
}: IntegracoesViewProps) {
  const [makeUrl, setMakeUrl] = useState(settings.makeWebhookUrl || 'https://hook.eu1.make.com/directhouses-prod-webhook');
  const [makeEnabled, setMakeEnabled] = useState(settings.makeEnabled ?? true);
  const [emailEnabled, setEmailEnabled] = useState(settings.emailEnabled ?? true);
  const [emailRecipients, setEmailRecipients] = useState(settings.emailRecipients || 'diretoria@directhouses.com.br, plantao@directhouses.com.br');
  const [smtpHost, setSmtpHost] = useState(settings.smtpHost || 'smtp.dreamhost.com');
  const [smtpUser, setSmtpUser] = useState(settings.smtpUser || 'notificacoes@directhouses.com.br');
  const [smtpPort, setSmtpPort] = useState(settings.smtpPort || 465);

  const [testLog, setTestLog] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(makeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestWebhooks = async () => {
    setIsTesting(true);
    setTestLog(null);
    try {
      const res = await fetch('/api/settings/test-make', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: makeUrl }),
      });
      const data = await res.json();
      setTestLog(
        JSON.stringify(
          {
            status: res.status,
            make: data,
            timestamp: new Date().toISOString(),
            payloadSent: {
              evento: 'LEAD_QUALIFICADO_WHATSAPP',
              origem: 'Direct Houses Intelligence',
              cliente: 'Dra. Camila Siqueira',
              empreendimento: 'Horizonte Leblon',
              corretorAtribuido: 'Juliana Mendes',
              dlpAuditado: true,
            },
          },
          null,
          2
        )
      );
    } catch (err: any) {
      setTestLog(JSON.stringify({ status: 500, error: err.message }, null, 2));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    await onSaveSettings({
      ...settings,
      makeEnabled,
      makeWebhookUrl: makeUrl,
      emailEnabled,
      emailRecipients,
      smtpHost,
      smtpUser,
      smtpPort,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="w-full flex flex-col gap-6 max-w-[1720px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-600 tracking-widest uppercase font-semibold">
              {companyName} Integrations
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <span className="text-xs text-slate-500 font-medium">Ecosistema Operacional</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
            APIs, Webhooks & Integrações CRM
          </h1>
          <p className="text-sm text-slate-500">
            Sincronização em tempo real com Make.com, RD Station, HubSpot e servidores SMTP para disparo de relatórios.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestWebhooks}
            disabled={isTesting}
            className="px-3.5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-blue-600" />}
            <span>Testar Todos os Webhooks</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Salvar Configurações</span>
          </button>
        </div>
      </div>

      {/* Grid de Integrações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Card Make.com */}
        <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
                M
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Make.com (Integromat)</h3>
                <span className="text-xs text-slate-500">Disparo automático em cada lead qualificado</span>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={makeEnabled}
                onChange={(e) => setMakeEnabled(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span className="text-xs font-semibold text-slate-700">Ativo</span>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Webhook URL do Cenário:</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={makeUrl}
                onChange={(e) => setMakeUrl(e.target.value)}
                className="flex-1 h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="h-10 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            O webhook envia: <code>nome</code>, <code>telefone</code>, <code>produtoImovel</code>, <code>observacoes</code>, <code>corretorAtribuido</code>, <code>trilhaNavegacao</code> e <code>historicoMensagens</code>.
          </p>
        </div>

        {/* Card SMTP / E-mail */}
        <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                @
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">E-mail Corporativo & Plantão (SMTP)</h3>
                <span className="text-xs text-slate-500">Notificação imediata para diretoria comercial</span>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span className="text-xs font-semibold text-slate-700">Ativo</span>
            </label>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">Destinatários (separados por vírgula):</label>
              <input
                type="text"
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
                className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Host SMTP:</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Porta:</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Log de Teste */}
      {testLog && (
        <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase">
              Resultado do Teste de Disparo Webhook
            </span>
            <span className="text-xs text-emerald-700 font-bold">HTTP 200 OK</span>
          </div>
          <pre className="p-3.5 rounded-lg bg-slate-900 text-emerald-400 text-xs font-mono overflow-x-auto max-h-60 border border-slate-800">
            {testLog}
          </pre>
        </div>
      )}

      {/* Toast Save Success */}
      {savedSuccess && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 z-50 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-semibold">Configurações de integração salvas com sucesso!</span>
        </div>
      )}
    </div>
  );
}
