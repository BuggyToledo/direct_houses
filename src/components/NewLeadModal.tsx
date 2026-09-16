import React, { useState } from 'react';
import { X, UserPlus, Phone, Mail, Building, Flame, DollarSign, Tag, FileText, CheckCircle2 } from 'lucide-react';
import { LeadStage, LeadTemperatura, Broker } from '../types';

interface NewLeadModalProps {
  isOpen: boolean;
  brokers: Broker[];
  onClose: () => void;
  onCreateLead: (leadData: any, distributeImmediately?: boolean, targetBrokerId?: string) => Promise<void>;
}

export function NewLeadModal({
  isOpen,
  brokers,
  onClose,
  onCreateLead,
}: NewLeadModalProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [tipoAtendimento, setTipoAtendimento] = useState('comprar');
  const [produtoImovel, setProdutoImovel] = useState('');
  const [valorInteresse, setValorInteresse] = useState('');
  const [temperatura, setTemperatura] = useState<LeadTemperatura>('quente');
  const [status, setStatus] = useState<LeadStage>('novo');
  const [origem, setOrigem] = useState('Cadastro Manual');
  const [observacoes, setObservacoes] = useState('');
  const [distributeImmediately, setDistributeImmediately] = useState(true);
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) {
      setErrorMsg('Nome e telefone são obrigatórios.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const newLeadPayload = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim() || undefined,
        tipoAtendimento,
        produtoImovel: produtoImovel.trim() || 'Lançamento Geral',
        valorInteresse: valorInteresse.trim() || undefined,
        temperatura,
        status,
        origem: origem.trim() || 'Cadastro Manual',
        observacoes: observacoes.trim(),
      };

      await onCreateLead(newLeadPayload, distributeImmediately, selectedBrokerId || undefined);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cadastrar lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Novo Lead Comercial</h2>
              <p className="text-xs text-slate-500">Cadastre e organize leads recebidos por qualquer canal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nome do Cliente *</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Dra. Mariana Costa"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Telefone com DDD *</label>
              <input
                type="text"
                required
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Ex: (21) 99887-6655"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">E-mail (opcional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: cliente@email.com"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tipo de Atendimento</label>
              <select
                value={tipoAtendimento}
                onChange={(e) => setTipoAtendimento(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="comprar">Comprar Imóvel</option>
                <option value="investimento">Investimento</option>
                <option value="alugar">Alugar</option>
                <option value="vender">Vender</option>
                <option value="duvidas">Tirar Dúvidas</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Imóvel de Interesse</label>
              <input
                type="text"
                value={produtoImovel}
                onChange={(e) => setProdutoImovel(e.target.value)}
                placeholder="Ex: Reserva Jardim Barra (3 quartos)"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Faixa de Preço / Ticket</label>
              <input
                type="text"
                value={valorInteresse}
                onChange={(e) => setValorInteresse(e.target.value)}
                placeholder="Ex: R$ 1.500.000,00"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Temperatura</label>
              <select
                value={temperatura}
                onChange={(e) => setTemperatura(e.target.value as LeadTemperatura)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="quente">🔥 Quente (Alta urgência)</option>
                <option value="morno">⚡ Morno (Médio prazo)</option>
                <option value="frio">❄️ Frio (Longo prazo)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Etapa Inicial</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStage)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="novo">Novo Lead</option>
                <option value="qualificado">Qualificado</option>
                <option value="roleta">Fila da Roleta</option>
                <option value="em_atendimento">Em Atendimento</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Origem do Contato</label>
              <input
                type="text"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                placeholder="Ex: Plantão Presencial, Instagram, Indicação"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Observações & Preferências</label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Busca andar alto com vista livre, 2 vagas de garagem, sol da manhã..."
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Opção de Roleta Imediata */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={distributeImmediately}
                onChange={(e) => setDistributeImmediately(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Distribuir imediatamente na Roleta de Corretores</span>
            </label>

            {distributeImmediately && (
              <div className="pt-1">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Direcionar para:
                </label>
                <select
                  value={selectedBrokerId}
                  onChange={(e) => setSelectedBrokerId(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-700"
                >
                  <option value="">Próximo Corretor da Fila (Automático)</option>
                  {brokers
                    .filter((b) => b.active)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.phone})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar e Organizar Lead'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
