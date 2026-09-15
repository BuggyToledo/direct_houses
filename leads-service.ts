import fs from 'fs';
import path from 'path';

export interface PersistentLead {
  id: string;
  nome: string;
  telefone: string;
  tipoAtendimento: string;
  produtoImovel: string;
  observacoes: string;
  initialMessage?: string;
  origem: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  assignedBroker?: {
    id: string;
    name: string;
    phone: string;
    assignedAt?: string;
  };
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

export function getPersistentLeads(): PersistentLead[] {
  ensureDataDir();
  try {
    if (fs.existsSync(LEADS_FILE)) {
      const data = fs.readFileSync(LEADS_FILE, 'utf-8');
      const leads: PersistentLead[] = JSON.parse(data);
      return Array.isArray(leads) ? leads : [];
    }
  } catch (err) {
    console.error('Erro ao ler leads gravados:', err);
  }
  return [];
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

  if (existingIndex !== -1) {
    // Update existing lead
    const current = leads[existingIndex];
    savedLead = {
      ...current,
      ...leadData,
      nome: leadData.nome && leadData.nome !== 'Cliente' && leadData.nome !== 'Cliente WhatsApp' ? leadData.nome : current.nome,
      telefone: leadData.telefone || current.telefone,
      tipoAtendimento: leadData.tipoAtendimento || current.tipoAtendimento,
      produtoImovel: leadData.produtoImovel || current.produtoImovel,
      observacoes: leadData.observacoes || current.observacoes,
      initialMessage: leadData.initialMessage || current.initialMessage,
      status: leadData.status || current.status,
      assignedBroker: leadData.assignedBroker || current.assignedBroker,
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
      tipoAtendimento: leadData.tipoAtendimento || 'Interesse Imobiliário',
      produtoImovel: leadData.produtoImovel || 'A combinar',
      observacoes: leadData.observacoes || 'Nenhuma',
      initialMessage: leadData.initialMessage || '',
      origem: leadData.origem || 'WhatsApp Web Direct Houses',
      status: leadData.status || 'Novo Lead',
      createdAt: leadData.createdAt || now,
      assignedBroker: leadData.assignedBroker,
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
