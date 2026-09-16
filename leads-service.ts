import fs from 'fs';
import path from 'path';

export type LeadStage =
  | 'novo'
  | 'qualificado'
  | 'em_atendimento'
  | 'visita_agendada'
  | 'proposta'
  | 'fechado'
  | 'perdido';

export type LeadTemperatura = 'quente' | 'morno' | 'frio';

export interface PersistentLead {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  tipoAtendimento: string;
  produtoImovel: string;
  valorInteresse?: string;
  bairrosInteresse?: string[];
  temperatura?: LeadTemperatura;
  observacoes: string;
  initialMessage?: string;
  origem: string;
  status: string; // LeadStage or string
  createdAt: string;
  updatedAt?: string;
  tags?: string[];
  notasInternas?: Array<{
    id: string;
    texto: string;
    autor: string;
    data: string;
  }>;
  assignedBroker?: {
    id: string;
    name: string;
    phone: string;
    assignedAt?: string;
  };
  historicoDistribuicoes?: Array<{
    id: string;
    brokerId: string;
    brokerName: string;
    brokerPhone: string;
    data: string;
    tipo: string;
    statusEnvioWhatsApp: string;
  }>;
  rawStructuredText?: string;
  trilhaNavegacao?: string[];
  resumoNavegacao?: string;
  historicoMensagens?: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const INITIAL_SAMPLE_LEADS: PersistentLead[] = [
  {
    id: 'lead-sample-1',
    nome: 'Guilherme Sampaio',
    telefone: '5521994321100',
    email: 'guilherme.sampaio@email.com',
    tipoAtendimento: 'Lançamento na Planta',
    produtoImovel: 'Reserva Jardim Barra - 3 Quartos',
    valorInteresse: 'R$ 850.000 a R$ 1.200.000',
    bairrosInteresse: ['Barra da Tijuca', 'Recreio dos Bandeirantes'],
    temperatura: 'quente',
    observacoes: 'Deseja agendar visita no decorado este sábado pela manhã. Pagamento com entrada facilitada.',
    initialMessage: 'Olá! Vi o anúncio do Reserva Jardim na Barra e queria detalhes das unidades de 3 quartos.',
    origem: 'WhatsApp Web Direct Houses',
    status: 'visita_agendada',
    tags: ['Lançamento', 'Entrada Facilitada', 'Decora Sábado'],
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    assignedBroker: {
      id: 'broker-1',
      name: 'Plantão Direct Houses',
      phone: '5521987654321',
      assignedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    },
    historicoDistribuicoes: [
      {
        id: 'dist-init-1',
        brokerId: 'broker-1',
        brokerName: 'Plantão Direct Houses',
        brokerPhone: '5521987654321',
        data: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        tipo: 'automatica_roleta',
        statusEnvioWhatsApp: 'enviado',
      },
    ],
    trilhaNavegacao: ['Interesse: Lançamentos na Planta', 'Empreendimento: Reserva Jardim Barra', 'Consultou Fotos', 'Consultou Valores'],
    notasInternas: [
      {
        id: 'note-1',
        texto: 'Cliente com alto potencial de fechamento na planta. Corretor já enviou apresentação em PDF.',
        autor: 'IA Assistente Direct Houses',
        data: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'lead-sample-2',
    nome: 'Mariana Drummond',
    telefone: '5521981112233',
    email: 'mariana.drummond@gestao.com',
    tipoAtendimento: 'Comprar Imóvel Pronto',
    produtoImovel: 'Origem Ipanema Studios',
    valorInteresse: 'R$ 1.400.000',
    bairrosInteresse: ['Ipanema', 'Leblon'],
    temperatura: 'quente',
    observacoes: 'Investidora procurando studio para aluguel por temporada (Airbnb). Tem recursos para pagamento à vista.',
    initialMessage: 'Boa tarde, procuro estúdio em Ipanema ou Leblon com alta rentabilidade de locação.',
    origem: 'WhatsApp Web Direct Houses',
    status: 'em_atendimento',
    tags: ['Investidor', 'Airbnb', 'À Vista'],
    createdAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
    assignedBroker: {
      id: 'broker-1',
      name: 'Plantão Direct Houses',
      phone: '5521987654321',
      assignedAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    },
    historicoDistribuicoes: [
      {
        id: 'dist-init-2',
        brokerId: 'broker-1',
        brokerName: 'Plantão Direct Houses',
        brokerPhone: '5521987654321',
        data: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
        tipo: 'timeout_recuperacao',
        statusEnvioWhatsApp: 'enviado',
      },
    ],
    trilhaNavegacao: ['Interesse: Studios & Investimento', 'Empreendimento: Origem Ipanema'],
  },
  {
    id: 'lead-sample-3',
    nome: 'Dr. Roberto Magalhães',
    telefone: '5521972345678',
    tipoAtendimento: 'Lançamento na Planta',
    produtoImovel: 'Vogue Square Cobertura',
    valorInteresse: 'R$ 2.800.000',
    bairrosInteresse: ['Barra da Tijuca'],
    temperatura: 'morno',
    observacoes: 'Quer permuta com imóvel em Niterói ou parcelamento direto em 48x.',
    initialMessage: 'Gostaria de saber se aceitam permuta na compra da cobertura do Vogue Square.',
    origem: 'WhatsApp Web Direct Houses',
    status: 'proposta',
    tags: ['Cobertura', 'Permuta', 'Médio Prazo'],
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'lead-sample-4',
    nome: 'Beatriz Vasconcelos',
    telefone: '5521969887766',
    tipoAtendimento: 'Comprar Imóvel Pronto',
    produtoImovel: 'Apartamento 2 Quartos Botafogo',
    valorInteresse: 'R$ 680.000',
    bairrosInteresse: ['Botafogo', 'Flamengo'],
    temperatura: 'frio',
    observacoes: 'Aguardando aprovação de crédito na Caixa Econômica Federal.',
    origem: 'Site Institucional',
    status: 'novo',
    tags: ['Financiamento CEF', '1º Imóvel'],
    createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
  },
];

export function getPersistentLeads(): PersistentLead[] {
  ensureDataDir();
  try {
    if (fs.existsSync(LEADS_FILE)) {
      const data = fs.readFileSync(LEADS_FILE, 'utf-8');
      const leads: PersistentLead[] = JSON.parse(data);
      if (Array.isArray(leads) && leads.length > 0) {
        return leads;
      }
    }
  } catch (err) {
    console.error('Erro ao ler leads gravados:', err);
  }

  // Populate sample leads so that CRM starts fully functional
  saveAllPersistentLeads(INITIAL_SAMPLE_LEADS);
  return INITIAL_SAMPLE_LEADS;
}

export function saveAllPersistentLeads(leads: PersistentLead[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar leads gravados:', err);
  }
}

export function recordLead(leadData: Partial<PersistentLead>): PersistentLead {
  const leads = getPersistentLeads();
  
  // Check if lead with same phone or id already exists
  const cleanPhone = (leadData.telefone || '').replace(/\D/g, '');
  let existingIndex = -1;
  
  if (leadData.id) {
    existingIndex = leads.findIndex((l) => l.id === leadData.id);
  } else if (cleanPhone && cleanPhone.length >= 8) {
    existingIndex = leads.findIndex((l) => (l.telefone || '').replace(/\D/g, '') === cleanPhone);
  }

  const now = new Date().toISOString();
  let savedLead: PersistentLead;

  // Derive initial status and temperature
  const initialStage: LeadStage =
    leadData.status && ['novo', 'qualificado', 'em_atendimento', 'visita_agendada', 'proposta', 'fechado', 'perdido'].includes(leadData.status)
      ? (leadData.status as LeadStage)
      : leadData.assignedBroker
      ? 'em_atendimento'
      : 'qualificado';

  const initialTemperatura: LeadTemperatura =
    leadData.temperatura || (leadData.assignedBroker ? 'quente' : 'morno');

  if (existingIndex !== -1) {
    // Update existing lead
    const current = leads[existingIndex];
    savedLead = {
      ...current,
      ...leadData,
      nome: leadData.nome && leadData.nome !== 'Cliente' && leadData.nome !== 'Cliente WhatsApp' ? leadData.nome : current.nome,
      telefone: leadData.telefone || current.telefone,
      email: leadData.email || current.email,
      tipoAtendimento: leadData.tipoAtendimento || current.tipoAtendimento,
      produtoImovel: leadData.produtoImovel || current.produtoImovel,
      valorInteresse: leadData.valorInteresse || current.valorInteresse,
      bairrosInteresse: leadData.bairrosInteresse || current.bairrosInteresse,
      temperatura: leadData.temperatura || current.temperatura || initialTemperatura,
      observacoes: leadData.observacoes || current.observacoes,
      initialMessage: leadData.initialMessage || current.initialMessage,
      status: leadData.status || current.status || initialStage,
      tags: leadData.tags || current.tags || [],
      notasInternas: leadData.notasInternas || current.notasInternas || [],
      assignedBroker: leadData.assignedBroker || current.assignedBroker,
      historicoDistribuicoes: leadData.historicoDistribuicoes || current.historicoDistribuicoes || [],
      rawStructuredText: leadData.rawStructuredText || current.rawStructuredText,
      trilhaNavegacao: leadData.trilhaNavegacao || current.trilhaNavegacao,
      resumoNavegacao: leadData.resumoNavegacao || current.resumoNavegacao,
      historicoMensagens: leadData.historicoMensagens || current.historicoMensagens,
      updatedAt: now,
    };
    leads[existingIndex] = savedLead;
  } else {
    // Insert new lead
    savedLead = {
      id: leadData.id || `lead-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      nome: leadData.nome || 'Cliente WhatsApp',
      telefone: leadData.telefone || 'Não informado',
      email: leadData.email || '',
      tipoAtendimento: leadData.tipoAtendimento || 'Lançamento na Planta',
      produtoImovel: leadData.produtoImovel || 'A combinar',
      valorInteresse: leadData.valorInteresse || 'A definir',
      bairrosInteresse: leadData.bairrosInteresse || [],
      temperatura: initialTemperatura,
      observacoes: leadData.observacoes || 'Lead capturado no atendimento automatizado',
      initialMessage: leadData.initialMessage || '',
      origem: leadData.origem || 'WhatsApp Web Direct Houses',
      status: leadData.status || initialStage,
      createdAt: leadData.createdAt || now,
      tags: leadData.tags || ['WhatsApp'],
      notasInternas: leadData.notasInternas || [],
      assignedBroker: leadData.assignedBroker,
      historicoDistribuicoes: leadData.historicoDistribuicoes || [],
      rawStructuredText: leadData.rawStructuredText || '',
      trilhaNavegacao: leadData.trilhaNavegacao || [],
      resumoNavegacao: leadData.resumoNavegacao || '',
      historicoMensagens: leadData.historicoMensagens || [],
    };
    leads.unshift(savedLead);
  }

  saveAllPersistentLeads(leads);
  return savedLead;
}

export function updateLead(id: string, updates: Partial<PersistentLead>): PersistentLead | null {
  const leads = getPersistentLeads();
  const index = leads.findIndex((l) => l.id === id);
  if (index === -1) return null;

  const current = leads[index];
  const updated: PersistentLead = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  leads[index] = updated;
  saveAllPersistentLeads(leads);
  return updated;
}

export function updateLeadStage(id: string, stage: string): PersistentLead | null {
  return updateLead(id, { status: stage });
}

export function addLeadNote(id: string, note: { texto: string; autor: string }): PersistentLead | null {
  const leads = getPersistentLeads();
  const index = leads.findIndex((l) => l.id === id);
  if (index === -1) return null;

  const current = leads[index];
  const notes = current.notasInternas || [];
  const newNote = {
    id: `note-${Date.now()}`,
    texto: note.texto,
    autor: note.autor || 'Equipe Comercial',
    data: new Date().toISOString(),
  };

  const updated: PersistentLead = {
    ...current,
    notasInternas: [newNote, ...notes],
    updatedAt: new Date().toISOString(),
  };

  leads[index] = updated;
  saveAllPersistentLeads(leads);
  return updated;
}

export function addLeadDistribution(
  id: string,
  dist: {
    brokerId: string;
    brokerName: string;
    brokerPhone: string;
    tipo: string;
    statusEnvioWhatsApp: string;
  }
): PersistentLead | null {
  const leads = getPersistentLeads();
  const index = leads.findIndex((l) => l.id === id);
  if (index === -1) return null;

  const current = leads[index];
  const dists = current.historicoDistribuicoes || [];
  const newDist = {
    id: `dist-${Date.now()}`,
    brokerId: dist.brokerId,
    brokerName: dist.brokerName,
    brokerPhone: dist.brokerPhone,
    data: new Date().toISOString(),
    tipo: dist.tipo,
    statusEnvioWhatsApp: dist.statusEnvioWhatsApp,
  };

  const updated: PersistentLead = {
    ...current,
    assignedBroker: {
      id: dist.brokerId,
      name: dist.brokerName,
      phone: dist.brokerPhone,
      assignedAt: new Date().toISOString(),
    },
    status: current.status === 'novo' ? 'em_atendimento' : current.status,
    historicoDistribuicoes: [newDist, ...dists],
    updatedAt: new Date().toISOString(),
  };

  leads[index] = updated;
  saveAllPersistentLeads(leads);
  return updated;
}

export function deletePersistentLead(id: string): boolean {
  const leads = getPersistentLeads();
  const filtered = leads.filter((l) => l.id !== id);
  if (filtered.length === leads.length) return false;
  saveAllPersistentLeads(filtered);
  return true;
}

export function clearAllPersistentLeads(): boolean {
  saveAllPersistentLeads([]);
  return true;
}

export function getLeadsMetrics() {
  const leads = getPersistentLeads();
  const porEtapa: Record<string, number> = {
    novo: 0,
    qualificado: 0,
    em_atendimento: 0,
    visita_agendada: 0,
    proposta: 0,
    fechado: 0,
    perdido: 0,
  };

  const porTemperatura: Record<string, number> = {
    quente: 0,
    morno: 0,
    frio: 0,
  };

  const porCorretor: Record<string, number> = {};
  const todayStr = new Date().toISOString().slice(0, 10);
  let novosHoje = 0;

  for (const l of leads) {
    const st = (l.status || 'novo').toLowerCase();
    if (st.includes('fechado') || st.includes('venda')) porEtapa.fechado++;
    else if (st.includes('proposta')) porEtapa.proposta++;
    else if (st.includes('visita')) porEtapa.visita_agendada++;
    else if (st.includes('atendimento') || st.includes('direcionado')) porEtapa.em_atendimento++;
    else if (st.includes('qualificado')) porEtapa.qualificado++;
    else if (st.includes('perdido') || st.includes('descartado')) porEtapa.perdido++;
    else porEtapa.novo++;

    const temp = l.temperatura || 'morno';
    porTemperatura[temp] = (porTemperatura[temp] || 0) + 1;

    if (l.assignedBroker?.name) {
      porCorretor[l.assignedBroker.name] = (porCorretor[l.assignedBroker.name] || 0) + 1;
    }

    if (l.createdAt && l.createdAt.startsWith(todayStr)) {
      novosHoje++;
    }
  }

  return {
    total: leads.length,
    novosHoje,
    porEtapa,
    porTemperatura,
    porCorretor,
  };
}
