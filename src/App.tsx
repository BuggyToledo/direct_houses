import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Building,
  ShieldCheck,
  Shield,
  Settings,
  History,
  Sparkles,
  Users,
  Smartphone,
  LogOut,
  KeyRound,
  Crown,
  LayoutDashboard,
  MessageSquare,
  QrCode,
  Share2,
  Lock,
  ExternalLink,
  ChevronRight,
  Wifi,
  Menu,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { AppSettings, WhatsAppStatus, AuthUser, Broker } from './types';
import { LeadsDashboard, PersistentLeadData } from './components/LeadsDashboard';
import { LancamentosView } from './components/LancamentosView';
import { RoletaView } from './components/RoletaView';
import { WhatsAppInfrastructureView } from './components/WhatsAppInfrastructureView';
import { IntegracoesView } from './components/IntegracoesView';
import { RulesModal } from './components/RulesModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { WhatsAppConnectModal } from './components/WhatsAppConnectModal';
import { BrokersManagementModal } from './components/BrokersManagementModal';
import { LoginScreen } from './components/LoginScreen';
import { AuthorizedUsersModal } from './components/AuthorizedUsersModal';
import { LancamentosModal, LancamentoItem } from './components/LancamentosModal';

const INITIAL_SETTINGS: AppSettings = {
  companyName: 'Direct Houses',
  whatsappAvailableInSystem: true,
  systemWhatsappNumber: '+55 (21) 98822-4411',
  soundEnabled: true,
  makeEnabled: true,
  makeWebhookUrl: 'https://hook.eu1.make.com/directhouses-prod-webhook',
  makeApiKey: '',
  n8nEnabled: false,
  n8nWebhookUrl: '',
  n8nSecretToken: '',
  emailEnabled: true,
  emailRecipients: 'diretoria@directhouses.com.br, plantao@directhouses.com.br',
  smtpHost: 'smtp.dreamhost.com',
  smtpPort: 465,
  smtpUser: 'notificacoes@directhouses.com.br',
  smtpPass: '',
  smtpSecure: true,
  smtpSenderName: 'Direct Houses - Inteligência Comercial',
};

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('assistente_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.companyName === 'Ícone Imóveis' || !parsed.companyName) {
          parsed.companyName = 'Direct Houses';
        }
        if (parsed.smtpSenderName === 'Ícone Imóveis - Plantão de Vendas' || !parsed.smtpSenderName) {
          parsed.smtpSenderName = 'Direct Houses - Inteligência Comercial';
        }
        return { ...INITIAL_SETTINGS, ...parsed };
      }
      return INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  });

  // Active View State (Google Stitch Multi-Screen Architecture)
  const [activeTab, setActiveTab] = useState<
    'overview' | 'lancamentos' | 'roleta' | 'whatsapp' | 'integracoes'
  >('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Persistent Leads State from Server
  const [persistentLeads, setPersistentLeads] = useState<PersistentLeadData[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoItem[]>([]);

  // WhatsApp Web State
  const [whatsAppStatus, setWhatsAppStatus] = useState<WhatsAppStatus>({
    state: 'disconnected',
    qrCodeDataUrl: null,
    connectedPhone: null,
    connectedName: null,
  });

  // Authentication state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('direct_houses_auth_user');
      return saved
        ? JSON.parse(saved)
        : {
            email: 'diretoria@directhouses.com.br',
            name: 'Carlos Eduardo',
            role: 'admin',
            token: 'mock-session-direct-houses-admin',
            picture:
              'https://lh3.googleusercontent.com/aida-public/AB6AXuDYBZN3rqiOxEAV91MoBK52JRFFDv5ayxb8S4v3IwbWT9At_FH4IRTIqcWRojkCXsYdBWJCpQEs-YO5SgENkjJKwd3BpWqkX4etMFm10OlVM_GI0MNaTWRk8SjveQmXLIrpm5r2aZGAoNk7P1OnmlYW0NIOwPdKvFuhT5OHzkkelK5TBjAqglmAS1qBjlGuun76LN4mMjxj-A4cPPaOROjlKFUPiA2srO8ZGgxYUmOvkYOqBdq7uF0R4w',
          };
    } catch {
      return null;
    }
  });
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);

  // Modals state
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isBrokersModalOpen, setIsBrokersModalOpen] = useState(false);
  const [isLancamentosModalOpen, setIsLancamentosModalOpen] = useState(false);

  // Handle Login & Logout
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    localStorage.setItem('direct_houses_auth_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('direct_houses_auth_user');
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  // Fetch persistent leads from backend
  const fetchPersistentLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setPersistentLeads(data);
      }
    } catch {
      // Background poll failure
    }
  }, []);

  // Fetch brokers
  const fetchBrokers = useCallback(async () => {
    try {
      const res = await fetch('/api/brokers');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setBrokers(data);
      }
    } catch {}
  }, []);

  // Fetch lancamentos
  const fetchLancamentos = useCallback(async () => {
    try {
      const res = await fetch('/api/lancamentos');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setLancamentos(data);
      }
    } catch {}
  }, []);

  // Delete lead handler
  const handleDeleteLead = async (id: string) => {
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPersistentLeads((prev) => prev.filter((l) => l.id !== id));
      }
    } catch (err) {
      console.error('Erro ao deletar lead:', err);
    }
  };

  // WhatsApp polling & status check
  const fetchWhatsAppStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        setWhatsAppStatus(data);
      }
    } catch {}
  }, []);

  const handleConnectWhatsApp = async (force: boolean = false) => {
    try {
      setWhatsAppStatus((prev) => ({ ...prev, state: 'connecting' }));
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      if (res.ok) {
        const data = await res.json();
        setWhatsAppStatus(data);
      }
    } catch (err) {
      console.error('Erro ao conectar WhatsApp:', err);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      if (res.ok) {
        setWhatsAppStatus({
          state: 'disconnected',
          qrCodeDataUrl: null,
          connectedPhone: null,
          connectedName: null,
        });
      }
    } catch (err) {
      console.error('Erro ao desconectar WhatsApp:', err);
    }
  };

  useEffect(() => {
    fetchWhatsAppStatus();
    fetchPersistentLeads();
    fetchBrokers();
    fetchLancamentos();

    const interval = setInterval(() => {
      fetchWhatsAppStatus();
      fetchPersistentLeads();
      fetchBrokers();
      fetchLancamentos();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchWhatsAppStatus, fetchPersistentLeads, fetchBrokers, fetchLancamentos]);

  // Persist settings
  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('assistente_settings', JSON.stringify(newSettings));
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
    } catch {}
  };

  if (!currentUser) {
    return (
      <LoginScreen
        companyName={settings.companyName}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const activeBrokers = brokers.filter((b) => b.active);

  return (
    <div id="app-root" className="min-h-screen flex flex-col bg-[#f8f9ff] text-[#0b1c30] font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Header Executivo Fixo (Google Stitch Design System) */}
      <header
        id="app-header"
        className="fixed top-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-xl z-50 border-b border-slate-200/80 shadow-xs"
      >
        <div className="w-full h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Brand Info */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div
              onClick={() => setActiveTab('overview')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex flex-col">
                <span className="font-display font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight leading-none">
                  {settings.companyName}
                </span>
                <span className="text-[10px] font-bold text-slate-600 tracking-wider uppercase mt-1">
                  Inteligência Comercial Imobiliária
                </span>
              </div>
            </div>
          </div>

          {/* Status Badge Centralizado */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsWhatsAppModalOpen(true)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
                whatsAppStatus.state === 'connected'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : whatsAppStatus.state === 'qr_ready'
                  ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                  : whatsAppStatus.state === 'connecting'
                  ? 'bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100'
                  : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  whatsAppStatus.state === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : whatsAppStatus.state === 'qr_ready'
                    ? 'bg-amber-500 animate-ping'
                    : whatsAppStatus.state === 'connecting'
                    ? 'bg-blue-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              ></span>
              <span>
                {whatsAppStatus.state === 'connected'
                  ? `WhatsApp Conectado: +${whatsAppStatus.connectedPhone || 'Ativo'}`
                  : whatsAppStatus.state === 'qr_ready'
                  ? 'Aguardando Leitura do QR Code'
                  : whatsAppStatus.state === 'connecting'
                  ? 'Conectando WhatsApp...'
                  : 'Conectar WhatsApp Web'}
              </span>
            </button>
          </div>

          {/* Top Navigation Links (Desktop Shortcuts) */}
          <nav className="hidden xl:flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('lancamentos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'lancamentos'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Lançamentos & Governança (DLP)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('roleta')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'roleta'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Roleta & Corretores</span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                {activeBrokers.length || 12}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'whatsapp'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Atendimentos ao Vivo</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('integracoes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'integracoes'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Integrações
            </button>
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer shadow-2xs"
              title="Configurações & SMTP"
            >
              <Settings className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              {currentUser.picture ? (
                <img
                  src={currentUser.picture}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500/30 shadow-2xs"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                  {currentUser.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-blue-600 font-semibold uppercase">
                  {currentUser.role === 'admin' ? 'Diretor Comercial' : 'Corretor'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                title="Sair do Sistema"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Sidebar Lateral Fixa (Navegação Executiva) */}
      <aside
        id="app-sidebar"
        className={`fixed left-0 top-20 bottom-0 w-64 bg-white z-40 flex flex-col justify-between py-4 border-r border-slate-200/80 shadow-xs transition-transform duration-200 lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-6 px-3">
          <div className="px-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Navegação Executiva
            </span>
          </div>

          <nav className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('overview');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                activeTab === 'overview'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview Gerencial</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('lancamentos');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                activeTab === 'lancamentos'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-3">
                <Building className="w-4 h-4" />
                <span>Lançamentos & DLP</span>
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                Blindado
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('roleta');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                activeTab === 'roleta'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-3">
                <Users className="w-4 h-4" />
                <span>Gestão da Roleta</span>
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                {activeBrokers.length || 12}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('whatsapp');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                activeTab === 'whatsapp'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4" />
                <span>Central WhatsApp</span>
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('whatsapp');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                activeTab === 'whatsapp'
                  ? 'text-slate-900 bg-slate-100 font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>Instâncias & QR</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('integracoes');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                activeTab === 'integracoes'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>APIs & Webhooks</span>
            </button>
          </nav>
        </div>

        {/* Bottom Box: DLP Ativo & 13 Regras */}
        <div className="px-3 flex flex-col gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900 text-white flex flex-col gap-1.5 shadow-md">
            <div className="flex items-center gap-2 text-rose-400">
              <Shield className="w-4 h-4 shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider">DLP ATIVO</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Proteção contra vazamento de carteira e contratos.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsRulesModalOpen(true)}
            className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center justify-between transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>13 Regras de IA</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </aside>

      {/* 3. Main Workspace Area */}
      <main className="pl-0 lg:pl-64 pt-20 min-h-screen flex-1 p-4 sm:p-6 lg:p-8">
        {activeTab === 'overview' && (
          <LeadsDashboard
            leads={persistentLeads}
            brokers={brokers}
            whatsAppStatus={whatsAppStatus}
            companyName={settings.companyName}
            lancamentosCount={lancamentos.length || 6}
            onOpenWhatsAppModal={() => setActiveTab('whatsapp')}
            onOpenBrokersModal={() => setActiveTab('roleta')}
            onOpenLancamentosModal={() => setActiveTab('lancamentos')}
            onRefreshLeads={fetchPersistentLeads}
            onDeleteLead={handleDeleteLead}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {activeTab === 'lancamentos' && (
          <LancamentosView companyName={settings.companyName} />
        )}

        {activeTab === 'roleta' && (
          <RoletaView companyName={settings.companyName} />
        )}

        {activeTab === 'whatsapp' && (
          <WhatsAppInfrastructureView
            companyName={settings.companyName}
            isWhatsAppConnected={whatsAppStatus.state === 'connected'}
            status={whatsAppStatus}
            onRefreshStatus={fetchWhatsAppStatus}
            onConnect={handleConnectWhatsApp}
            onDisconnect={handleDisconnectWhatsApp}
          />
        )}

        {activeTab === 'integracoes' && (
          <IntegracoesView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            companyName={settings.companyName}
          />
        )}
      </main>

      {/* Modals Auxiliares de Governança e Configurações */}
      <RulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        companyName={settings.companyName}
      />

      <CompanySettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      <WhatsAppConnectModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        status={whatsAppStatus}
        onRefreshStatus={fetchWhatsAppStatus}
        onConnect={handleConnectWhatsApp}
        onDisconnect={handleDisconnectWhatsApp}
      />

      <BrokersManagementModal
        isOpen={isBrokersModalOpen}
        onClose={() => setIsBrokersModalOpen(false)}
        companyName={settings.companyName}
        isWhatsAppConnected={whatsAppStatus.state === 'connected'}
      />

      <LancamentosModal
        isOpen={isLancamentosModalOpen}
        onClose={() => setIsLancamentosModalOpen(false)}
        companyName={settings.companyName}
      />

      {currentUser.role === 'admin' && (
        <AuthorizedUsersModal
          isOpen={isUsersModalOpen}
          onClose={() => setIsUsersModalOpen(false)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
