import fs from 'fs';
import path from 'path';
import { isDbConfigured, query, execute, withDbOrFallback } from './db';

export interface RoletaDistributionLog {
  id: string;
  leadId: string;
  leadNome: string;
  leadTelefone: string;
  brokerId: string;
  brokerNome: string;
  brokerTelefone: string;
  timestamp: string;
  tipoDistribuicao: 'automatica_roleta' | 'manual_operador' | 'timeout_recuperacao' | 'redistribuicao';
  statusEnvioWhatsApp: 'enviado' | 'link_gerado' | 'falha';
  motivo?: string;
  produtoImovel?: string;
  valorInteresse?: string;
  detalhesEnvio?: string;
  tempoSLA?: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const HISTORY_FILE = path.join(DATA_DIR, 'roleta-history.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function rowToLog(r: any): RoletaDistributionLog {
  return {
    id: r.id,
    leadId: r.lead_id,
    leadNome: r.lead_nome,
    leadTelefone: r.lead_telefone,
    brokerId: r.broker_id,
    brokerNome: r.broker_nome,
    brokerTelefone: r.broker_telefone,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
    tipoDistribuicao: r.tipo_distribuicao,
    statusEnvioWhatsApp: r.status_envio_whatsapp,
    motivo: r.motivo || undefined,
    produtoImovel: r.produto_imovel || undefined,
    valorInteresse: r.valor_interesse || undefined,
    detalhesEnvio: r.detalhes_envio || undefined,
    tempoSLA: r.tempo_sla || undefined,
  };
}

// ---------- JSON fallback ----------
function getHistoryFromJson(): RoletaDistributionLog[] {
  ensureDataDir();
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const list = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.error('Erro ao ler histórico da roleta (JSON):', err);
  }
  return [];
}

function saveHistoryToJson(history: RoletaDistributionLog[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao gravar histórico da roleta (JSON):', err);
  }
}

// ---------- API pública (async) ----------
export async function getRoletaDistributionHistory(): Promise<RoletaDistributionLog[]> {
  return withDbOrFallback(
    async () => {
      const rows = await query(
        `SELECT * FROM roleta_distributions ORDER BY timestamp DESC LIMIT 500`
      );
      return rows.map(rowToLog);
    },
    () => getHistoryFromJson()
  );
}

export async function recordDistributionLog(
  entry: Omit<RoletaDistributionLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<RoletaDistributionLog> {
  const newLog: RoletaDistributionLog = {
    id: entry.id || `dist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    leadId: entry.leadId || `lead-${Date.now()}`,
    leadNome: entry.leadNome || 'Cliente',
    leadTelefone: entry.leadTelefone || '',
    brokerId: entry.brokerId,
    brokerNome: entry.brokerNome,
    brokerTelefone: entry.brokerTelefone,
    timestamp: entry.timestamp || new Date().toISOString(),
    tipoDistribuicao: entry.tipoDistribuicao || 'automatica_roleta',
    statusEnvioWhatsApp: entry.statusEnvioWhatsApp || 'enviado',
    motivo: entry.motivo || 'Distribuição padrão na Roleta',
    produtoImovel: entry.produtoImovel || '',
    valorInteresse: entry.valorInteresse || '',
    detalhesEnvio: entry.detalhesEnvio,
    tempoSLA: entry.tempoSLA || '< 1 min',
  };

  await withDbOrFallback(
    async () => {
      await execute(
        `INSERT INTO roleta_distributions (
          id, company_id, lead_id, lead_nome, lead_telefone,
          broker_id, broker_nome, broker_telefone, timestamp,
          tipo_distribuicao, status_envio_whatsapp, motivo, produto_imovel,
          valor_interesse, detalhes_envio, tempo_sla
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status_envio_whatsapp = VALUES(status_envio_whatsapp)`,
        [
          newLog.id, newLog.leadId, newLog.leadNome, newLog.leadTelefone,
          newLog.brokerId, newLog.brokerNome, newLog.brokerTelefone,
          new Date(newLog.timestamp),
          newLog.tipoDistribuicao, newLog.statusEnvioWhatsApp,
          newLog.motivo || null, newLog.produtoImovel || null,
          newLog.valorInteresse || null, newLog.detalhesEnvio || null,
          newLog.tempoSLA || null,
        ]
      );
    },
    () => {
      const history = getHistoryFromJson();
      history.unshift(newLog);
      if (history.length > 500) history.splice(500);
      saveHistoryToJson(history);
    }
  );

  return newLog;
}

export async function clearRoletaDistributionHistory(): Promise<boolean> {
  await withDbOrFallback(
    async () => {
      await execute(`DELETE FROM roleta_distributions WHERE company_id = 1`);
    },
    () => saveHistoryToJson([])
  );
  return true;
}

export async function getRoletaDistributionStats() {
  const history = await getRoletaDistributionHistory();
  const todayStr = new Date().toISOString().slice(0, 10);
  const hoje = history.filter((h) => h.timestamp.startsWith(todayStr));
  const porCorretor: Record<string, number> = {};
  let enviadosWhatsApp = 0;

  for (const h of history) {
    porCorretor[h.brokerNome] = (porCorretor[h.brokerNome] || 0) + 1;
    if (h.statusEnvioWhatsApp === 'enviado') enviadosWhatsApp++;
  }

  return {
    total: history.length,
    hoje: hoje.length,
    porCorretor,
    taxaWhatsApp: history.length > 0 ? Math.round((enviadosWhatsApp / history.length) * 100) : 100,
    ultimosEnvios: history.slice(0, 10),
  };
}
