import fs from 'fs';
import path from 'path';
import { query, execute, withDbOrFallback } from './db';

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

const INITIAL_SAMPLE_LEADS: PersistentLead[] = [];

function parseJsonField<T>(val: any, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function rowToLead(r: any): PersistentLead {
  return {
    id: r.id,
    nome: r.nome,
    telefone: r.telefone,
    email: r.email || undefined,
    tipoAtendimento: r.tipo_atendimento || '',
    produtoImovel: r.produto_imovel || '',
    valorInteresse: r.valor_interesse || undefined,
    bairrosInteresse: parseJsonField(r.bairros_interesse, []),
    temperatura: r.temperatura || 'morno',
    observacoes: r.observacoes || '',
    initialMessage: r.initial_message || undefined,
    origem: r.origem || 'whatsapp',
    status: r.status || 'novo',
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at || undefined,
    tags: parseJsonField(r.tags, []),
    notasInternas: parseJsonField(r.notas_internas, []),
    assignedBroker: parseJsonField(r.assigned_broker_data, undefined),
    historicoDistribuicoes: parseJsonField(r.historico_distribuicoes, []),
    rawStructuredText: r.raw_structured_text || undefined,
    trilhaNavegacao: parseJsonField(r.trilha_navegacao, []),
    resumoNavegacao: r.resumo_navegacao || undefined,
    historicoMensagens: parseJsonField(r.historico_mensagens, []),
  };
}

// ---------- JSON Fallback Helpers ----------
function getLeadsFromJson(): PersistentLead[] {
  ensureDataDir();
  try {
    if (fs.existsSync(LEADS_FILE)) {
      const data = fs.readFileSync(LEADS_FILE, 'utf-8');
      const leads: PersistentLead[] = JSON.parse(data);
      if (Array.isArray(leads)) {
        return leads;
      }
    }
  } catch (err) {
    console.error('Erro ao ler leads gravados (JSON):', err);
  }

  saveAllPersistentLeads([]);
  return [];
}

export function saveAllPersistentLeads(leads: PersistentLead[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar leads gravados (JSON):', err);
  }
}

function recordLeadToJson(savedLead: PersistentLead): void {
  const leads = getLeadsFromJson();
  const index = leads.findIndex((l) => l.id === savedLead.id);
  if (index !== -1) {
    leads[index] = savedLead;
  } else {
    leads.unshift(savedLead);
  }
  saveAllPersistentLeads(leads);
}

function updateLeadInJson(id: string, updated: PersistentLead): void {
  const leads = getLeadsFromJson();
  const index = leads.findIndex((l) => l.id === id);
  if (index !== -1) {
    leads[index] = updated;
    saveAllPersistentLeads(leads);
  }
}

function deleteLeadFromJson(id: string): boolean {
  const leads = getLeadsFromJson();
  const filtered = leads.filter((l) => l.id !== id);
  saveAllPersistentLeads(filtered);
  return filtered.length !== leads.length;
}

// Pure builder that merges partial input with existing records or defaults
function buildSavedLead(leadData: Partial<PersistentLead>, existingLeads: PersistentLead[]): PersistentLead {
  const cleanPhone = (leadData.telefone || '').replace(/\D/g, '');
  let existingIndex = -1;

  if (leadData.id) {
    existingIndex = existingLeads.findIndex((l) => l.id === leadData.id);
  } else if (cleanPhone && cleanPhone.length >= 8) {
    existingIndex = existingLeads.findIndex((l) => (l.telefone || '').replace(/\D/g, '') === cleanPhone);
  }

  const now = new Date().toISOString();

  const initialStage: LeadStage =
    leadData.status && ['novo', 'qualificado', 'em_atendimento', 'visita_agendada', 'proposta', 'fechado', 'perdido'].includes(leadData.status)
      ? (leadData.status as LeadStage)
      : leadData.assignedBroker
      ? 'em_atendimento'
      : 'qualificado';

  const initialTemperatura: LeadTemperatura =
    leadData.temperatura || (leadData.assignedBroker ? 'quente' : 'morno');

  if (existingIndex !== -1) {
    const current = existingLeads[existingIndex];
    return {
      ...current,
      ...leadData,
      nome:
        leadData.nome && leadData.nome !== 'Cliente' && leadData.nome !== 'Cliente WhatsApp'
          ? leadData.nome
          : current.nome,
      telefone: leadData.telefone || current.telefone,
      email: leadData.email || current.email,
      tipoAtendimento: leadData.tipoAtendimento || current.tipoAtendimento,
      produtoImovel: leadData.produtoImovel || current.produtoImovel,
      valorInteresse: leadData.valorInteresse || current.valorInteresse,
      bairrosInteresse: leadData.bairrosInteresse || current.bairrosInteresse || [],
      temperatura: leadData.temperatura || current.temperatura || initialTemperatura,
      observacoes: leadData.observacoes || current.observacoes || '',
      initialMessage: leadData.initialMessage || current.initialMessage,
      status: leadData.status || current.status || initialStage,
      tags: leadData.tags || current.tags || [],
      notasInternas: leadData.notasInternas || current.notasInternas || [],
      assignedBroker: leadData.assignedBroker || current.assignedBroker,
      historicoDistribuicoes: leadData.historicoDistribuicoes || current.historicoDistribuicoes || [],
      rawStructuredText: leadData.rawStructuredText || current.rawStructuredText,
      trilhaNavegacao: leadData.trilhaNavegacao || current.trilhaNavegacao || [],
      resumoNavegacao: leadData.resumoNavegacao || current.resumoNavegacao,
      historicoMensagens: leadData.historicoMensagens || current.historicoMensagens || [],
      updatedAt: now,
    };
  }

  return {
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
}

// ---------- Public Async API ----------

export async function getPersistentLeads(): Promise<PersistentLead[]> {
  return withDbOrFallback(
    async () => {
      const rows = await query(`SELECT * FROM leads WHERE company_id = 1 ORDER BY created_at DESC`);
      if (rows.length === 0) {
        return getLeadsFromJson();
      }
      return rows.map(rowToLead);
    },
    () => getLeadsFromJson()
  );
}

export async function recordLead(leadData: Partial<PersistentLead>): Promise<PersistentLead> {
  const existingLeads = await getPersistentLeads();
  const savedLead = buildSavedLead(leadData, existingLeads);

  await withDbOrFallback(
    async () => {
      await execute(
        `INSERT INTO leads (
          id, company_id, nome, telefone, email, tipo_atendimento, produto_imovel,
          valor_interesse, bairros_interesse, temperatura, observacoes, initial_message,
          origem, status, assigned_broker_id, assigned_broker_data, tags, notas_internas,
          historico_distribuicoes, raw_structured_text, trilha_navegacao, resumo_navegacao,
          historico_mensagens, created_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          nome=VALUES(nome), telefone=VALUES(telefone), email=VALUES(email),
          tipo_atendimento=VALUES(tipo_atendimento), produto_imovel=VALUES(produto_imovel),
          valor_interesse=VALUES(valor_interesse), bairros_interesse=VALUES(bairros_interesse),
          temperatura=VALUES(temperatura), observacoes=VALUES(observacoes),
          status=VALUES(status), assigned_broker_id=VALUES(assigned_broker_id),
          assigned_broker_data=VALUES(assigned_broker_data), tags=VALUES(tags),
          notas_internas=VALUES(notas_internas), historico_distribuicoes=VALUES(historico_distribuicoes),
          raw_structured_text=VALUES(raw_structured_text),
          trilha_navegacao=VALUES(trilha_navegacao), resumo_navegacao=VALUES(resumo_navegacao),
          historico_mensagens=VALUES(historico_mensagens)`,
        [
          savedLead.id,
          savedLead.nome,
          savedLead.telefone,
          savedLead.email || null,
          savedLead.tipoAtendimento,
          savedLead.produtoImovel,
          savedLead.valorInteresse || null,
          JSON.stringify(savedLead.bairrosInteresse || []),
          savedLead.temperatura || 'morno',
          savedLead.observacoes,
          savedLead.initialMessage || null,
          savedLead.origem,
          savedLead.status,
          savedLead.assignedBroker?.id || null,
          savedLead.assignedBroker ? JSON.stringify(savedLead.assignedBroker) : null,
          JSON.stringify(savedLead.tags || []),
          JSON.stringify(savedLead.notasInternas || []),
          JSON.stringify(savedLead.historicoDistribuicoes || []),
          savedLead.rawStructuredText || null,
          JSON.stringify(savedLead.trilhaNavegacao || []),
          savedLead.resumoNavegacao || null,
          JSON.stringify(savedLead.historicoMensagens || []),
          new Date(savedLead.createdAt),
        ]
      );
    },
    () => {
      recordLeadToJson(savedLead);
    }
  );

  // Keep local JSON in sync
  recordLeadToJson(savedLead);
  return savedLead;
}

export async function updateLead(id: string, updates: Partial<PersistentLead>): Promise<PersistentLead | null> {
  const leads = await getPersistentLeads();
  const current = leads.find((l) => l.id === id);
  if (!current) return null;

  const updated: PersistentLead = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await withDbOrFallback(
    async () => {
      await execute(
        `UPDATE leads SET
          nome=?, telefone=?, email=?, tipo_atendimento=?, produto_imovel=?,
          valor_interesse=?, bairros_interesse=?, temperatura=?, observacoes=?,
          status=?, assigned_broker_id=?, assigned_broker_data=?, tags=?,
          notas_internas=?, historico_distribuicoes=?, raw_structured_text=?,
          trilha_navegacao=?, resumo_navegacao=?, historico_mensagens=?,
          updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND company_id=1`,
        [
          updated.nome,
          updated.telefone,
          updated.email || null,
          updated.tipoAtendimento,
          updated.produtoImovel,
          updated.valorInteresse || null,
          JSON.stringify(updated.bairrosInteresse || []),
          updated.temperatura || 'morno',
          updated.observacoes,
          updated.status,
          updated.assignedBroker?.id || null,
          updated.assignedBroker ? JSON.stringify(updated.assignedBroker) : null,
          JSON.stringify(updated.tags || []),
          JSON.stringify(updated.notasInternas || []),
          JSON.stringify(updated.historicoDistribuicoes || []),
          updated.rawStructuredText || null,
          JSON.stringify(updated.trilhaNavegacao || []),
          updated.resumoNavegacao || null,
          JSON.stringify(updated.historicoMensagens || []),
          id,
        ]
      );
    },
    () => updateLeadInJson(id, updated)
  );

  updateLeadInJson(id, updated);
  return updated;
}

export async function updateLeadStage(id: string, stage: string): Promise<PersistentLead | null> {
  return updateLead(id, { status: stage });
}

export async function addLeadNote(id: string, note: { texto: string; autor: string }): Promise<PersistentLead | null> {
  const leads = await getPersistentLeads();
  const current = leads.find((l) => l.id === id);
  if (!current) return null;

  const notes = current.notasInternas || [];
  const newNote = {
    id: `note-${Date.now()}`,
    texto: note.texto,
    autor: note.autor || 'Equipe Comercial',
    data: new Date().toISOString(),
  };

  return updateLead(id, {
    notasInternas: [newNote, ...notes],
  });
}

export async function addLeadDistribution(
  id: string,
  dist: {
    brokerId: string;
    brokerName: string;
    brokerPhone: string;
    tipo: string;
    statusEnvioWhatsApp: string;
  }
): Promise<PersistentLead | null> {
  const leads = await getPersistentLeads();
  const current = leads.find((l) => l.id === id);
  if (!current) return null;

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

  return updateLead(id, {
    assignedBroker: {
      id: dist.brokerId,
      name: dist.brokerName,
      phone: dist.brokerPhone,
      assignedAt: new Date().toISOString(),
    },
    status: current.status === 'novo' ? 'em_atendimento' : current.status,
    historicoDistribuicoes: [newDist, ...dists],
  });
}

export async function deletePersistentLead(id: string): Promise<boolean> {
  await withDbOrFallback(
    async () => {
      await execute(`DELETE FROM leads WHERE id = ? AND company_id = 1`, [id]);
    },
    () => {
      deleteLeadFromJson(id);
    }
  );
  deleteLeadFromJson(id);
  return true;
}

export async function clearAllPersistentLeads(): Promise<boolean> {
  await withDbOrFallback(
    async () => {
      await execute(`DELETE FROM leads WHERE company_id = 1`);
    },
    () => {
      saveAllPersistentLeads([]);
    }
  );
  saveAllPersistentLeads([]);
  return true;
}

export async function clearAllLeadHistories(): Promise<boolean> {
  await withDbOrFallback(
    async () => {
      await execute(`UPDATE leads SET historico_mensagens = '[]', raw_structured_text = '' WHERE company_id = 1`);
    },
    () => {
      const leads = getLeadsFromJson();
      for (const l of leads) {
        l.historicoMensagens = [];
        l.rawStructuredText = '';
      }
      saveAllPersistentLeads(leads);
    }
  );
  const leads = getLeadsFromJson();
  for (const l of leads) {
    l.historicoMensagens = [];
    l.rawStructuredText = '';
  }
  saveAllPersistentLeads(leads);
  return true;
}

export async function getLeadsMetrics() {
  const leads = await getPersistentLeads();
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
