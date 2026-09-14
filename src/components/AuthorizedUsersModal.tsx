import React, { useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  UserPlus,
  Shield,
  ShieldCheck,
  Trash2,
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Crown,
  KeyRound,
} from 'lucide-react';
import { AuthorizedUser, AuthUser } from '../types';

interface AuthorizedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
}

export function AuthorizedUsersModal({
  isOpen,
  onClose,
  currentUser,
}: AuthorizedUsersModalProps) {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error('Erro ao buscar usuários autorizados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setActionMessage(null);
      setDeletingEmail(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setLoading(true);
    setActionMessage(null);

    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          email: newEmail.trim(),
          name: newName.trim(),
          role: newRole,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setNewEmail('');
        setNewName('');
        setActionMessage({ success: true, text: `E-mail ${newEmail} autorizado com sucesso!` });
        await fetchUsers();
      } else {
        setActionMessage({ success: false, text: data.error || 'Falha ao autorizar e-mail.' });
      }
    } catch (err: any) {
      setActionMessage({ success: false, text: err.message || 'Erro de conexão.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (email: string) => {
    setDeletingEmail(null);
    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUsers((prev) => prev.filter((u) => u.email !== email));
        setActionMessage({ success: true, text: `Acesso revogado para ${email}.` });
      } else {
        setActionMessage({ success: false, text: data.error || 'Não foi possível remover usuário.' });
      }
    } catch (err: any) {
      setActionMessage({ success: false, text: err.message || 'Erro ao remover usuário.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 border border-purple-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Usuários Autorizados (Whitelist)</h3>
              <p className="text-xs text-slate-500">
                Apenas contas Google cadastradas nesta lista conseguem logar no sistema
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Action Message */}
          {actionMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                actionMessage.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {actionMessage.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="font-medium">{actionMessage.text}</span>
            </div>
          )}

          {/* Add New Authorized User Form */}
          <form
            onSubmit={handleAddUser}
            className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
          >
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-purple-600" />
              Autorizar Novo E-mail Google
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  E-mail da Conta Google *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="usuario@icone-rio.com.br"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nome do Usuário (opcional)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Carlos Gerente"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">Nível de Acesso:</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                  className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                >
                  <option value="user">Operador / Corretor (Acesso Padrão)</option>
                  <option value="admin">Administrador (Pode gerenciar acessos)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || !newEmail}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                Autorizar Acesso
              </button>
            </div>
          </form>

          {/* Authorized Users List */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
              <span>Contas com Acesso Liberado ({users.length})</span>
              <button
                onClick={fetchUsers}
                className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 font-normal"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </h4>

            <div className="space-y-2">
              {users.map((u) => {
                const isPermanent = u.isPermanentAdmin || u.email.toLowerCase() === 'toledo@icone-rio.com.br';
                return (
                  <div
                    key={u.email}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      isPermanent
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-white border-slate-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isPermanent
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {isPermanent ? <Crown className="w-4 h-4 text-amber-600" /> : <UserCheck className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                          {u.name || u.email.split('@')[0]}
                          {isPermanent && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-600" />
                              ADM GLOBAL
                            </span>
                          )}
                          {!isPermanent && u.role === 'admin' && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                              Administrador
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="font-mono">{u.email}</span>
                        </div>
                      </div>
                    </div>

                    {!isPermanent && (
                      <div>
                        {deletingEmail === u.email ? (
                          <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-1">
                            <span className="text-[10px] text-rose-700 font-bold px-1">Revogar?</span>
                            <button
                              onClick={() => handleRemoveUser(u.email)}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold"
                            >
                              Sim
                            </button>
                            <button
                              onClick={() => setDeletingEmail(null)}
                              className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px]"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            title="Revogar acesso"
                            onClick={() => setDeletingEmail(u.email)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Controle de acesso rigoroso por Whitelist
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
