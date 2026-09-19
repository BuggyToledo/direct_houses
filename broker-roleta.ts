import fs from 'fs';
import path from 'path';
import { isDbConfigured, query, execute, withDbOrFallback } from './db';

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

function rowToBroker(r: any): Broker {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email || undefined,
    active: Boolean(r.active),
    leadsReceived: Number(r.leads_received || 0),
    lastAssignedAt: r.last_assigned_at
      ? (r.last_assigned_at instanceof Date ? r.last_assigned_at.toISOString() : String(r.last_assigned_at))
      : undefined,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

// ---------- JSON helpers ----------
function getBrokersFromJson(): Broker[] {
  ensureDataDir();
  try {
    if (fs.existsSync(BROKERS_FILE)) {
      const data = fs.readFileSync(BROKERS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Erro ao ler arquivo de corretores:', err);
  }
  saveBrokersToJson(DEFAULT_BROKERS);
  return DEFAULT_BROKERS;
}

function saveBrokersToJson(brokers: Broker[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(BROKERS_FILE, JSON.stringify(brokers, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar corretores:', err);
  }
}

function getConfigFromJson(): RoletaConfig {
  ensureDataDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Erro ao ler configuração da roleta:', err);
  }
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  } catch (e) {}
  return DEFAULT_CONFIG;
}

function saveConfigToJson(config: RoletaConfig): void {
  ensureDataDir();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar configuração da roleta:', err);
  }
}

// ---------- API pública (async) ----------
export async function getBrokers(): Promise<Broker[]> {
  return withDbOrFallback(
    async () => {
      const rows = await query(`SELECT * FROM brokers WHERE company_id = 1 ORDER BY created_at ASC`);
      if (rows.length === 0) {
        // seed default
        const def = DEFAULT_BROKERS[0];
        await execute(
          `INSERT INTO brokers (id, company_id, name, phone, email, active, leads_received, created_at)
           VALUES (?, 1, ?, ?, ?, 1, 0, ?)`,
          [def.id, def.name, def.phone, def.email || null, new Date(def.createdAt)]
        );
        return DEFAULT_BROKERS;
      }
      return rows.map(rowToBroker);
    },
    () => getBrokersFromJson()
  );
}

export async function saveBrokers(brokers: Broker[]): Promise<void> {
  await withDbOrFallback(
    async () => {
      for (const b of brokers) {
        await execute(
          `INSERT INTO brokers (id, company_id, name, phone, email, active, leads_received, last_assigned_at, created_at)
           VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name=VALUES(name), phone=VALUES(phone), email=VALUES(email),
             active=VALUES(active), leads_received=VALUES(leads_received),
             last_assigned_at=VALUES(last_assigned_at)`,
          [
            b.id,
            b.name,
            b.phone,
            b.email || null,
            b.active ? 1 : 0,
            b.leadsReceived || 0,
            b.lastAssignedAt ? new Date(b.lastAssignedAt) : null,
            new Date(b.createdAt),
          ]
        );
      }
    },
    () => saveBrokersToJson(brokers)
  );
}

export async function getRoletaConfig(): Promise<RoletaConfig> {
  return withDbOrFallback(
    async () => {
      const rows = await query(`SELECT * FROM roleta_config WHERE company_id = 1 LIMIT 1`);
      if (!rows[0]) return DEFAULT_CONFIG;
      const r = rows[0];
      return {
        autoDispatchEnabled: Boolean(r.auto_dispatch_enabled),
        notifyClientWithBrokerName: Boolean(r.notify_client_with_broker_name),
        lastAssignedIndex: Number(r.last_assigned_index ?? -1),
      };
    },
    () => getConfigFromJson()
  );
}

export async function saveRoletaConfig(config: Partial<RoletaConfig>): Promise<RoletaConfig> {
  const current = await getRoletaConfig();
  const updated = { ...current, ...config };

  await withDbOrFallback(
    async () => {
      await execute(
        `INSERT INTO roleta_config (id, company_id, auto_dispatch_enabled, notify_client_with_broker_name, last_assigned_index)
         VALUES (1, 1, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           auto_dispatch_enabled=VALUES(auto_dispatch_enabled),
           notify_client_with_broker_name=VALUES(notify_client_with_broker_name),
           last_assigned_index=VALUES(last_assigned_index)`,
        [
          updated.autoDispatchEnabled ? 1 : 0,
          updated.notifyClientWithBrokerName ? 1 : 0,
          updated.lastAssignedIndex,
        ]
      );
    },
    () => saveConfigToJson(updated)
  );

  return updated;
}

export async function getNextBrokerInRoleta(): Promise<Broker | null> {
  const brokers = await getBrokers();
  const activeBrokers = brokers.filter((b) => b.active && b.phone);
  if (activeBrokers.length === 0) return null;

  const config = await getRoletaConfig();
  let nextIndex = (config.lastAssignedIndex + 1) % activeBrokers.length;
  if (nextIndex < 0 || nextIndex >= activeBrokers.length) nextIndex = 0;

  const chosen = { ...activeBrokers[nextIndex] };
  chosen.leadsReceived = (chosen.leadsReceived || 0) + 1;
  chosen.lastAssignedAt = new Date().toISOString();

  const full = brokers.map((b) => (b.id === chosen.id ? chosen : b));
  await saveBrokers(full);
  await saveRoletaConfig({ lastAssignedIndex: nextIndex });

  return chosen;
}

export async function addBroker(brokerData: Omit<Broker, 'id' | 'createdAt' | 'leadsReceived'>): Promise<Broker> {
  const brokers = await getBrokers();
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
  await saveBrokers(brokers);
  return newBroker;
}

export async function updateBroker(id: string, updates: Partial<Broker>): Promise<Broker | null> {
  const brokers = await getBrokers();
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
  await saveBrokers(brokers);
  return updated;
}

export async function deleteBroker(id: string): Promise<boolean> {
  await withDbOrFallback(
    async () => {
      await execute(`DELETE FROM brokers WHERE id = ? AND company_id = 1`, [id]);
    },
    () => {
      const brokers = getBrokersFromJson();
      const filtered = brokers.filter((b) => String(b.id).trim() !== String(id).trim());
      saveBrokersToJson(filtered);
    }
  );
  // Also keep local JSON in sync
  const localBrokers = getBrokersFromJson();
  const filtered = localBrokers.filter((b) => String(b.id).trim() !== String(id).trim());
  saveBrokersToJson(filtered);

  return true;
}

// ---------- Phone & Format helpers ----------
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  // Discard WhatsApp Privacy LIDs (15+ digits or starting with 192878...)
  if (digits.length >= 15) return false;
  if (digits.startsWith('192878') && digits.length >= 14) return false;
  return digits.length >= 8 && digits.length <= 14;
}

export function extractPhoneFromText(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  
  // Direct digit check for 10-13 digits
  const cleanDigits = trimmed.replace(/\D/g, '');
  if ((cleanDigits.length === 10 || cleanDigits.length === 11) && !cleanDigits.startsWith('192878')) {
    return cleanPhoneNumber(cleanDigits);
  }
  if ((cleanDigits.length === 12 || cleanDigits.length === 13) && cleanDigits.startsWith('55')) {
    return cleanPhoneNumber(cleanDigits);
  }

  // Regex check for Brazilian phone patterns inside text
  const brazilianPhoneRegex = /(?:\+?55\s*)?(?:\(?([1-9][0-9])\)?\s*)?(9[0-9]{4}[-\s]?[0-9]{4}|[2-8][0-9]{3}[-\s]?[0-9]{4}|9[0-9]{3,4}[-\s]?[0-9]{3,4})/g;
  const match = trimmed.match(brazilianPhoneRegex);
  if (match && match.length > 0) {
    for (const m of match) {
      const cleanM = m.replace(/\D/g, '');
      if (cleanM.length >= 8 && cleanM.length <= 13 && !cleanM.startsWith('192878')) {
        return cleanPhoneNumber(cleanM);
      }
    }
  }

  return null;
}

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // If it is an LID (15+ digits), do not treat as phone
  if (digits.length >= 15 || (digits.startsWith('192878') && digits.length >= 14)) {
    return '';
  }

  // If Brazilian number without country code (10 or 11 digits), prepend 55
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  // If Brazilian number with 12 digits (55 + DDD + 8 digits, missing the 9th digit), insert the 9
  if (digits.length === 12 && digits.startsWith('55')) {
    const ddiAndDdd = digits.slice(0, 4); // '5521'
    const rest = digits.slice(4); // '87654321'
    digits = `${ddiAndDdd}9${rest}`;
  }

  return digits;
}

export function formatPhoneForDisplay(phone: string): string {
  const clean = cleanPhoneNumber(phone);
  if (!clean) return phone || '';

  // Brazilian format: 5521987654321
  if (clean.length === 13 && clean.startsWith('55')) {
    const ddd = clean.slice(2, 4);
    const part1 = clean.slice(4, 9);
    const part2 = clean.slice(9);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  if (clean.length === 11) {
    const ddd = clean.slice(0, 2);
    const part1 = clean.slice(2, 7);
    const part2 = clean.slice(7);
    return `(${ddd}) ${part1}-${part2}`;
  }

  return `+${clean}`;
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
    isTimeoutRecovery?: boolean;
    initialMessage?: string;
    trilhaNavegacao?: string[];
    resumoNavegacao?: string;
    historicoMensagens?: Array<{ role: string; content: string; timestamp: string }>;
  },
  companyName: string = 'Direct Houses',
  clientPhone?: string
): string {
  const phone = clientPhone || lead.telefone || '';
  const cleanPhone = cleanPhoneNumber(phone);
  const displayPhone = formatPhoneForDisplay(phone);
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : '';

  // Formatar trilha de navegação se existir
  let trilhaText = '';
  if (lead.trilhaNavegacao && lead.trilhaNavegacao.length > 0) {
    trilhaText = `🧭 *TRILHA DE NAVEGAÇÃO DO CLIENTE:*\n${lead.trilhaNavegacao.map((t) => `• ${t}`).join('\n')}\n\n`;
  } else if (lead.resumoNavegacao) {
    trilhaText = `🧭 *RESUMO DA NAVEGAÇÃO:*\n${lead.resumoNavegacao}\n\n`;
  }

  // Formatar histórico de mensagens trocadas se existir
  let chatHistoryText = '';
  if (lead.historicoMensagens && lead.historicoMensagens.length > 0) {
    chatHistoryText = `💬 *TRANSCRIÇÃO COMPLETA DA CONVERSA:*\n` +
      lead.historicoMensagens
        .map((m) => `${m.role === 'user' ? '👤 Cliente' : '🤖 IA'}: ${m.content}`)
        .join('\n\n') +
      `\n\n`;
  }

  if (lead.isTimeoutRecovery) {
    return (
      `⚠️ *LEAD CAPTURADO POR INATIVIDADE (5 MIN SEM RESPOSTA)*\n\n` +
      `Olá, corretor! Um cliente iniciou contato no WhatsApp da *${companyName}*, mas parou de responder às perguntas do assistente virtual. Para não perdermos o lead, ele foi direcionado imediatamente para você.\n\n` +
      `👤 *Nome:* ${lead.nome || 'Cliente WhatsApp'}\n` +
      `📱 *Telefone:* ${displayPhone || 'Capturado na sessão'}\n` +
      (lead.initialMessage ? `💬 *Primeira mensagem / Imóvel:* "${lead.initialMessage}"\n` : '') +
      trilhaText +
      chatHistoryText +
      `⏱️ *Horário:* ${new Date().toLocaleString('pt-BR')}\n` +
      `📌 *Ação sugerida:* Entre em contato diretamente pelo WhatsApp abaixo para dar atendimento humanizado.\n\n` +
      (waLink
        ? `💬 *CLIQUE AQUI PARA INICIAR A CONVERSA COM O CLIENTE:*\n${waLink}`
        : `_Telefone não disponível para link direto._`)
    );
  }

  return (
    `🏡 *NOVO LEAD QUALIFICADO - ${companyName.toUpperCase()}*\n\n` +
    `Olá, corretor! Um novo cliente acabou de ser qualificado pelo assistente virtual e direcionado para você.\n\n` +
    `👤 *Nome:* ${lead.nome || 'Não informado'}\n` +
    `📱 *Telefone:* ${displayPhone || lead.telefone || phone || 'Não informado'}\n` +
    `🎯 *Tipo de Atendimento:* ${(lead.tipoAtendimento || 'Interesse Imobiliário').toUpperCase()}\n` +
    `🏢 *Produto / Imóvel:* ${lead.produtoImovel || 'A combinar'}\n` +
    trilhaText +
    chatHistoryText +
    `📝 *Observações Finais:* ${lead.observacoes || 'Nenhuma'}\n` +
    (lead.initialMessage ? `💬 *Origem / Link:* "${lead.initialMessage}"\n` : '') +
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
