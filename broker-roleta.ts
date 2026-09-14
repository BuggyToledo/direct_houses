import fs from 'fs';
import path from 'path';

export interface Broker {
  id: string;
  name: string;
  phone: string; // WhatsApp number with country code and DDD, e.g., "5521987654321"
  email?: string;
  active: boolean;
  leadsReceived: number;
  lastAssignedAt?: string;
  createdAt: string;
}

export interface RoletaConfig {
  autoDispatchEnabled: boolean; // Auto dispatch when lead is qualified by AI
  notifyClientWithBrokerName: boolean; // Send confirmation to client with broker name
  lastAssignedIndex: number;
}

export interface BrokerLeadDispatchResult {
  success: boolean;
  broker?: Broker;
  message: string;
  leadPayload?: any;
  dispatchTimestamp: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const BROKERS_FILE = path.join(DATA_DIR, 'brokers.json');
const CONFIG_FILE = path.join(DATA_DIR, 'roleta-config.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Default initial brokers if none exist
const DEFAULT_BROKERS: Broker[] = [
  {
    id: 'broker-1',
    name: 'Plantão Direct Houses',
    phone: '5521987654321',
    email: 'toledo@icone-rio.com.br',
    active: true,
    leadsReceived: 0,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_CONFIG: RoletaConfig = {
  autoDispatchEnabled: true,
  notifyClientWithBrokerName: true,
  lastAssignedIndex: -1,
};

export function getBrokers(): Broker[] {
  ensureDataDir();
  try {
    if (fs.existsSync(BROKERS_FILE)) {
      const data = fs.readFileSync(BROKERS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Erro ao ler arquivo de corretores:', err);
  }
  // Initialize with default
  saveBrokers(DEFAULT_BROKERS);
  return DEFAULT_BROKERS;
}

export function saveBrokers(brokers: Broker[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(BROKERS_FILE, JSON.stringify(brokers, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar corretores:', err);
  }
}

export function getRoletaConfig(): RoletaConfig {
  ensureDataDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Erro ao ler configuração da roleta:', err);
  }
  // Initialize file directly if not found
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  } catch (e) {}
  return DEFAULT_CONFIG;
}

export function saveRoletaConfig(config: Partial<RoletaConfig>): RoletaConfig {
  ensureDataDir();
  let current = DEFAULT_CONFIG;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      current = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (e) {}

  const updated = { ...current, ...config };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar configuração da roleta:', err);
  }
  return updated;
}

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // If Brazilian number without country code (10 or 11 digits), prepend 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

export function addBroker(brokerData: Omit<Broker, 'id' | 'createdAt' | 'leadsReceived'>): Broker {
  const brokers = getBrokers();
  const newBroker: Broker = {
    id: `broker-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: brokerData.name.trim(),
    phone: cleanPhoneNumber(brokerData.phone),
    email: brokerData.email?.trim() || '',
    active: typeof brokerData.active === 'boolean' ? brokerData.active : true,
    leadsReceived: 0,
    createdAt: new Date().toISOString(),
  };

  brokers.push(newBroker);
  saveBrokers(brokers);
  return newBroker;
}

export function updateBroker(id: string, updates: Partial<Broker>): Broker | null {
  const brokers = getBrokers();
  const index = brokers.findIndex((b) => b.id === id);
  if (index === -1) return null;

  const current = brokers[index];
  const updated: Broker = {
    ...current,
    ...updates,
    phone: updates.phone ? cleanPhoneNumber(updates.phone) : current.phone,
    name: updates.name ? updates.name.trim() : current.name,
  };

  brokers[index] = updated;
  saveBrokers(brokers);
  return updated;
}

export function deleteBroker(id: string): boolean {
  const brokers = getBrokers();
  const filtered = brokers.filter((b) => String(b.id).trim() !== String(id).trim());
  saveBrokers(filtered);
  return true;
}

/**
 * Round-Robin Selection of next active broker in the Roleta
 */
export function getNextBrokerInRoleta(): Broker | null {
  const brokers = getBrokers();
  const activeBrokers = brokers.filter((b) => b.active && b.phone);

  if (activeBrokers.length === 0) {
    return null;
  }

  const config = getRoletaConfig();
  let nextIndex = (config.lastAssignedIndex + 1) % activeBrokers.length;
  if (nextIndex < 0 || nextIndex >= activeBrokers.length) {
    nextIndex = 0;
  }

  const chosenBroker = activeBrokers[nextIndex];

  // Update chosen broker metrics
  chosenBroker.leadsReceived = (chosenBroker.leadsReceived || 0) + 1;
  chosenBroker.lastAssignedAt = new Date().toISOString();

  // Save updated list
  const fullIndex = brokers.findIndex((b) => b.id === chosenBroker.id);
  if (fullIndex !== -1) {
    brokers[fullIndex] = chosenBroker;
    saveBrokers(brokers);
  }

  // Update Roleta index
  saveRoletaConfig({ lastAssignedIndex: nextIndex });

  return chosenBroker;
}

/**
 * Builds the structured WhatsApp notification message sent to the broker
 */
export function formatBrokerLeadMessage(
  lead: {
    nome?: string;
    telefone?: string;
    tipoAtendimento?: string;
    produtoImovel?: string;
    observacoes?: string;
    origem?: string;
  },
  companyName: string = 'Direct Houses',
  clientPhone?: string
): string {
  const phone = clientPhone || lead.telefone || '';
  const cleanPhone = cleanPhoneNumber(phone);
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : '';

  return (
    `🏡 *NOVO LEAD QUALIFICADO - ${companyName.toUpperCase()}*\n\n` +
    `Olá, corretor! Um novo cliente acabou de ser qualificado pelo assistente virtual e direcionado para você.\n\n` +
    `👤 *Nome:* ${lead.nome || 'Não informado'}\n` +
    `📱 *Telefone:* ${lead.telefone || phone || 'Não informado'}\n` +
    `🎯 *Tipo de Atendimento:* ${(lead.tipoAtendimento || 'Interesse Imobiliário').toUpperCase()}\n` +
    `🏢 *Produto / Imóvel:* ${lead.produtoImovel || 'A combinar'}\n` +
    `📝 *Observações:* ${lead.observacoes || 'Nenhuma'}\n` +
    `🔒 *Consentimento:* Sim, autorizado pelo cliente conforme LGPD\n` +
    `📍 *Origem:* ${lead.origem || 'WhatsApp Web Direct Houses'}\n` +
    `⏱️ *Recebido em:* ${new Date().toLocaleString('pt-BR')}\n\n` +
    (waLink
      ? `💬 *CLIQUE AQUI PARA INICIAR A CONVERSA COM O CLIENTE:*\n${waLink}`
      : `_Telefone não disponível para link direto._`)
  );
}

/**
 * Builds notification message sent to the customer on WhatsApp
 */
export function formatClientAssignedMessage(
  brokerName: string,
  companyName: string = 'Direct Houses'
): string {
  return (
    `Muito obrigado pelas informações! 🙏\n\n` +
    `Seus dados foram encaminhados com prioridade para o nosso corretor especialista *${brokerName}* da equipe da *${companyName}*.\n\n` +
    `Ele(a) entrará em contato com você em instantes para apresentar as melhores opções. Tenha um excelente dia!`
  );
}
