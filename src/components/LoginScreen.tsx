import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  ShieldCheck,
  Lock,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  LogIn,
  KeyRound,
} from 'lucide-react';
import { AuthUser } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
  companyName: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

export function LoginScreen({ onLoginSuccess, companyName }: LoginScreenProps) {
  const [clientId, setClientId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState<string>(''); // For direct login testing / fallback
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Fetch Google Client ID and config from server
  useEffect(() => {
    fetch('/api/auth/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.googleClientId) {
          setClientId(data.googleClientId);
        }
      })
      .catch(() => {});
  }, []);

  // Initialize Google Identity Services
  useEffect(() => {
    const initGoogleGSI = () => {
      if (!window.google?.accounts?.id) return;
      setIsGsiLoaded(true);

      const targetClientId =
        clientId ||
        '938927429188-directhouses.apps.googleusercontent.com'; // fallback / placeholder

      try {
        window.google.accounts.id.initialize({
          client_id: targetClientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: 'signin_with',
            shape: 'pill',
            logo_alignment: 'left',
            width: 280,
          });
        }
      } catch (e) {
        console.warn('Erro ao inicializar Google GSI:', e);
      }
    };

    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGoogleGSI();
        clearInterval(timer);
      }
    }, 300);

    return () => clearInterval(timer);
  }, [clientId]);

  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response?.credential) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.user) {
        onLoginSuccess(data.user);
      } else {
        setErrorMessage(
          data.message || data.error || 'Acesso não autorizado para esta conta Google.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao autenticar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Direct login handler (e.g. for development or direct authorized email verification)
  const handleDirectEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/direct-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.user) {
        onLoginSuccess(data.user);
      } else {
        setErrorMessage(
          data.message || data.error || 'E-mail não autorizado no sistema.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao verificar autorização.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 flex flex-col justify-center items-center p-4 text-slate-100 font-sans relative overflow-hidden">
      
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header Card */}
        <div className="p-8 pb-6 text-center bg-slate-900 text-white relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20 font-bold">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">
            {companyName || 'Direct Houses'}
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            Painel Comercial & Automação de Leads WhatsApp
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-emerald-400 font-semibold">
            <Lock className="w-3.5 h-3.5" />
            Acesso Restrito a Usuários Autorizados
          </div>
        </div>

        {/* Body Form */}
        <div className="p-8 pt-6 space-y-6">

          {/* Error alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">
                {errorMessage}
              </div>
            </div>
          )}

          {/* Google Sign In Container */}
          <div className="flex flex-col items-center justify-center space-y-3 py-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Entrar com Conta Google
            </div>

            {/* Google Identity Services Render Element */}
            <div ref={googleBtnRef} className="flex justify-center min-h-[44px]" />

            {/* If Google script is loading */}
            {!isGsiLoaded && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Carregando botão do Google...
              </div>
            )}
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Ou acesse com e-mail cadastrado
            </span>
          </div>

          {/* Direct Whitelist Email Access Form */}
          <form onSubmit={handleDirectEmailLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                E-mail Google Autorizado
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="toledo@icone-rio.com.br"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !emailInput}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              ) : (
                <LogIn className="w-4 h-4 text-emerald-400" />
              )}
              <span>Verificar Acesso & Entrar</span>
            </button>
          </form>

          {/* Whitelist Info Box */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Administrador Global:
            </div>
            <div className="text-slate-500 pl-5">
              <code className="text-emerald-700 font-mono bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                toledo@icone-rio.com.br
              </code>
            </div>
            <p className="text-[10px] text-slate-400 pl-5 pt-0.5">
              Outros e-mails podem ser cadastrados pelo administrador dentro das configurações do painel.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-400">
          Direct Houses • Ícone Rio Imóveis • Sistema Seguro
        </div>

      </div>
    </div>
  );
}
