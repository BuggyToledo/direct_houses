import React from 'react';
import { X, CheckCircle2, ShieldCheck, FileText } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
}

export const RULES_LIST = [
  {
    number: 1,
    title: 'Cumprimente o cliente na primeira mensagem',
    description: 'Inicia a conversa de forma calorosa e profissional apresentando-se como assistente comercial da empresa.',
  },
  {
    number: 2,
    title: 'Explique que fará algumas perguntas rápidas',
    description: 'Deixa claro desde o início que o objetivo é coletar dados rápidos para direcioná-lo ao corretor ideal.',
  },
  {
    number: 3,
    title: 'Faça apenas uma pergunta por vez',
    description: 'Nunca sobrecarrega o cliente com questionários longos em uma única mensagem; mantém ritmo dialógico fluido.',
  },
  {
    number: 4,
    title: 'Colete os 5 dados essenciais',
    description: 'Nome completo, telefone, tipo de atendimento (comprar/vender/alugar/dúvidas), produto ou imóvel de interesse e observações adicionais.',
  },
  {
    number: 5,
    title: 'Número de WhatsApp do sistema',
    description: 'Considera o WhatsApp do cliente como telefone apenas se ele já estiver cadastrado no sistema; caso contrário, solicita ativamente.',
  },
  {
    number: 6,
    title: 'Nunca invente preços, imóveis ou disponibilidade',
    description: 'Não especula valores nem inventa inventário; atua como qualificador comercial e encaminha para o especialista.',
  },
  {
    number: 7,
    title: 'Respeite a vontade do cliente em não responder',
    description: 'Se o cliente preferir pular alguma informação (ex: orçamento ou observação), prossegue com os dados disponíveis.',
  },
  {
    number: 8,
    title: 'Finalização imediata ao pedir atendente humano',
    description: 'Se o lead solicitar falar com um humano, a coleta é finalizada imediatamente com os dados obtidos até o momento.',
  },
  {
    number: 9,
    title: 'Resumo prévio e pedido de confirmação',
    description: 'Antes de enviar, exibe um resumo claro de todos os pontos coletados para que o cliente valide.',
  },
  {
    number: 10,
    title: 'Geração do formato padronizado NOVO LEAD',
    description: 'Gera o bloco exato com todos os campos estruturados pronto para ser copiado ou recebido pelo corretor.',
  },
  {
    number: 11,
    title: 'Informar encaminhamento ao corretor',
    description: 'Avisa com clareza que os dados foram encaminhados e que um corretor especialista entrará em contato.',
  },
  {
    number: 12,
    title: 'Não dizer que a conversa foi transferida automaticamente',
    description: 'Evita a promessa falsa de transferência instantânea de chat; enfatiza que o corretor fará o contato.',
  },
  {
    number: 13,
    title: 'Consentimento comercial conforme a LGPD',
    description: 'Registra expressamente o consentimento do lead para contato comercial de acordo com a Lei Geral de Proteção de Dados.',
  },
];

export function RulesModal({ isOpen, onClose, companyName }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      id="rules-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        id="rules-modal-content"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Diretrizes de Atendimento (13 Regras)</h3>
              <p className="text-xs text-slate-500">Operação ativa para {companyName}</p>
            </div>
          </div>
          <button
            id="close-rules-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <FileText className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>O assistente segue com rigor absoluto cada uma das 13 regras do prompt comercial em tempo real.</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 pt-2">
            {RULES_LIST.map((rule) => (
              <div
                key={rule.number}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all flex items-start gap-3"
              >
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {rule.number}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-800">{rule.title}</h4>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{rule.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex justify-end">
          <button
            id="confirm-rules-modal-btn"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-xl transition-all shadow-xs"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
