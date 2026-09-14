import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  Phone,
  Mail,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Check,
  Award,
} from 'lucide-react';
import { Broker, RoletaConfig } from '../types';

interface BrokersManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  isWhatsAppConnected: boolean;
}

export function BrokersManagementModal({
  isOpen,
  onClose,
  companyName,
  isWhatsAppConnected,
}: BrokersManagementModalProps) {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [config, setConfig] = useState<RoletaConfig>({
    autoDispatchEnabled: true,
    notifyClientWithBrokerName: true,
    lastAssignedIndex: -1,
  });
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ success: boolean; text: string } | null>(null);

  // New broker form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingBrokerId, setDeletingBrokerId] = useState<string | null>(null);

  // Load brokers & config
  const fetchBrokersData = async () => {
    setLoading(true);
    try {
      const [bRes, cRes] = await Promise.all([
        fetch('/api/brokers'),
        fetch('/api/roleta/config'),
      ]);
      if (bRes.ok) setBrokers(await bRes.json());
      if (cRes.ok) setConfig(await cRes.json());
    } catch (err) {
      console.error('Erro ao carregar corretores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBrokersData();
      setActionMessage(null);
      setDeletingBrokerId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    try {
      const res = await fetch('/api/brokers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          phone: newPhone,
          email: newEmail,
          active: true,
        }),
      });
      if (res.ok) {
        setNewName('');
        setNewPhone('');
        setNewEmail('');
        setIsAdding(false);
        await fetchBrokersData();
        setActionMessage({ success: true, text: 'Corretor cadastrado com sucesso na fila!' });
      }
    } catch (err: any) {
      setActionMessage({ success: false, text: err.message || 'Erro ao cadastrar corretor.' });
    }
  };

  const handleToggleActive = async (broker: Broker) => {
    try {
      const res = await fetch(`/api/brokers/${broker.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !broker.active }),
      });
      if (res.ok) {
        await fetchBrokersData();
      }
    } catch (err) {
      console.error('Erro ao alternar status do corretor:', err);
    }
  };

  const handleDeleteBroker = async (id: string) => {
    setDeletingBrokerId(null);
    // Optimistic UI update
    setBrokers((prev) => prev.filter((b) => b.id !== id));

    try {
      const res = await fetch(`/api/brokers/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.brokers)) {
          setBrokers(data.brokers);
        }
        setActionMessage({ success: true, text: 'Corretor removido com sucesso da fila!' });
      } else {
        await fetchBrokersData();
      }
    } catch (err) {
      console.error('Erro ao deletar corretor:', err);
      await fetchBrokersData();
      setActionMessage({ success: false, text: 'Erro ao remover corretor.' });
    }
  };

  const handleSaveConfig = async (newConfig: Partial<RoletaConfig>) => {
    try {
      const res = await fetch('/api/roleta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        setConfig(await res.json());
      }
    } catch (err) {
      console.error('Erro ao salvar configuração da roleta:', err);
    }
  };

  const handleTestRoletaDispatch = async (brokerId?: string) => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/roleta/test-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brokerId, companyName }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({
          success: true,
          text: data.message || `Disparo de teste concluído com sucesso para ${data.broker?.name}!`,
        });
        await fetchBrokersData();
      } else {
        setActionMessage({
          success: false,
          text: data.message || 'Falha ao testar disparo.',
        });
      }
    } catch (err: any) {
      setActionMessage({
        success: false,
        text: err.message || 'Erro ao conectar ao servidor.',
      });
    } finally {
      setLoading(false);
    }
  };

  const activeBrokersCount = brokers.filter((b) => b.active).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 border border-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Roleta & Cadastro de Corretores</h3>
              <p className="text-xs text-slate-500">
                Distribuição justa (Round-Robin) de leads com notificação direta no WhatsApp
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

          {/* Feedback banner */}
          {actionMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
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

          {/* Roleta Options Settings Card */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Regras da Roleta de Distribuição
            </h4>

            <div className="flex items-center justify-between py-1">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  Distribuição Automática ao Concluir Lead
                </div>
                <div className="text-xs text-slate-500">
                  Assim que a IA finaliza a qualificação ou o cliente pede corretor, dispara direto no WhatsApp do próximo da fila.
                </div>
              </div>
              <button
                onClick={() =>
                  handleSaveConfig({ autoDispatchEnabled: !config.autoDispatchEnabled })
                }
                className="text-slate-700 focus:outline-hidden"
              >
                {config.autoDispatchEnabled ? (
                  <ToggleRight className="w-8 h-8 text-emerald-600" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-400" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-slate-200/60 pt-2">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  Avisar Cliente com o Nome do Corretor
                </div>
                <div className="text-xs text-slate-500">
                  Envia uma mensagem no WhatsApp do cliente dizendo que o corretor (ex: "Carlos") entrará em contato em breve.
                </div>
              </div>
              <button
                onClick={() =>
                  handleSaveConfig({
                    notifyClientWithBrokerName: !config.notifyClientWithBrokerName,
                  })
                }
                className="text-slate-700 focus:outline-hidden"
              >
                {config.notifyClientWithBrokerName ? (
                  <ToggleRight className="w-8 h-8 text-emerald-600" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* Active Queue Summary & Test Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-950">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>
                <strong>{activeBrokersCount}</strong> corretor(es) ativo(s) na fila da Roleta
              </span>
            </div>

            <button
              onClick={() => handleTestRoletaDispatch()}
              disabled={loading || activeBrokersCount === 0}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Girar Roleta (Disparo Teste)
            </button>
          </div>

          {/* Brokers List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Corretores Cadastrados ({brokers.length})
              </h4>
              <button
                onClick={() => setIsAdding(!isAdding)}
                className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {isAdding ? 'Cancelar' : 'Novo Corretor'}
              </button>
            </div>

            {/* Add Broker Form */}
            {isAdding && (
              <form
                onSubmit={handleAddBroker}
                className="p-4 mb-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3"
              >
                <div className="font-semibold text-xs text-emerald-900">
                  Adicionar Corretor à Fila
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nome do Corretor *
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ex: Carlos Silva"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      WhatsApp com DDD *
                    </label>
                    <input
                      type="text"
                      required
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="Ex: (21) 98765-4321 ou 21987654321"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    E-mail (opcional)
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="carlos@imobiliaria.com.br"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs"
                  >
                    Salvar Corretor
                  </button>
                </div>
              </form>
            )}

            {/* List Table/Cards */}
            <div className="space-y-2.5">
              {brokers.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                  Nenhum corretor cadastrado ainda. Clique em "Novo Corretor" acima para cadastrar a equipe.
                </div>
              ) : (
                brokers.map((b, idx) => (
                  <div
                    key={b.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      b.active
                        ? 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        : 'bg-slate-50/60 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          b.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          {b.name}
                          {!b.active && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                              Pausado
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            +{b.phone}
                          </span>
                          {b.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {b.email}
                            </span>
                          )}
                          <span className="text-emerald-700 font-semibold">
                            {b.leadsReceived || 0} leads recebidos
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        title={b.active ? 'Pausar da roleta' : 'Ativar na roleta'}
                        onClick={() => handleToggleActive(b)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                          b.active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {b.active ? 'Ativo na Fila' : 'Pausado'}
                      </button>

                      <button
                        title="Testar envio direto no WhatsApp deste corretor"
                        onClick={() => handleTestRoletaDispatch(b.id)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>

                      {deletingBrokerId === b.id ? (
                        <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg p-1 animate-in fade-in duration-150">
                          <span className="text-[10px] text-rose-700 font-bold px-1">Excluir?</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteBroker(b.id)}
                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[10px] font-bold transition-colors shadow-2xs"
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingBrokerId(null)}
                            className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-[10px] transition-colors"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          title="Remover corretor"
                          onClick={() => setDeletingBrokerId(b.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Roleta justa: cada lead qualificado é distribuído ordenadamente
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
