import fs from 'fs';
import path from 'path';

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
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Initial sample history if file doesn't exist yet
const INITIAL_HISTORY: RoletaDistributionLog[] = [
  {
    id: 'dist-init-1',
    leadId: 'lead-sample-1',
    leadNome: 'Guilherme Sampaio',
    leadTelefone: '5521994321100',
    brokerId: 'broker-1',
    brokerNome: 'Plantão Direct Houses',
    brokerTelefone: '5521987654321',
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    tipoDistribuicao: 'automatica_roleta',
    statusEnvioWhatsApp: 'enviado',
    motivo: 'Lead qualificado pela IA com interesse no Reserva Jardim Barra',
    produtoImovel: 'Reserva Jardim Barra - 3 Quartos',
    tempoSLA: '1.2 min',
  },
  {
    id: 'dist-init-2',
    leadId: 'lead-sample-2',
    leadNome: 'Mariana Drummond',
    leadTelefone: '5521981112233',
    brokerId: 'broker-1',
    brokerNome: 'Plantão Direct Houses',
    brokerTelefone: '5521987654321',
    timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    tipoDistribuicao: 'timeout_recuperacao',
    statusEnvioWhatsApp: 'enviado',
    motivo: 'Inatividade do cliente por mais de 5 minutos durante o atendimento',
    produtoImovel: 'Origem Ipanema Studios',
    tempoSLA: 'Recuperado',
  },
];

export function getRoletaDistributionHistory(): RoletaDistributionLog[] {
  ensureDataDir();
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (err) {
    console.error('Erro ao ler histórico da roleta:', err);
  }

  // Save and return initial sample history
  saveRoletaDistributionHistory(INITIAL_HISTORY);
  return INITIAL_HISTORY;
}

export function saveRoletaDistributionHistory(history: RoletaDistributionLog[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao gravar histórico da roleta:', err);
  }
}

export function recordDistributionLog(
  entry: Omit<RoletaDistributionLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): RoletaDistributionLog {
  const history = getRoletaDistributionHistory();
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

  history.unshift(newLog);

  // Keep max 500 records
  if (history.length > 500) {
    history.splice(500);
  }

  saveRoletaDistributionHistory(history);
  return newLog;
}

export function clearRoletaDistributionHistory(): boolean {
  saveRoletaDistributionHistory([]);
  return true;
}

export function getRoletaDistributionStats() {
  const history = getRoletaDistributionHistory();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const hoje = history.filter((h) => h.timestamp.startsWith(todayStr));
  const porCorretor: Record<string, number> = {};
  let enviadosWhatsApp = 0;

  for (const h of history) {
    porCorretor[h.brokerNome] = (porCorretor[h.brokerNome] || 0) + 1;
    if (h.statusEnvioWhatsApp === 'enviado') {
      enviadosWhatsApp++;
    }
  }

  const taxaWhatsApp = history.length > 0 ? Math.round((enviadosWhatsApp / history.length) * 100) : 100;

  return {
    total: history.length,
    hoje: hoje.length,
    porCorretor,
    taxaWhatsApp,
    ultimosEnvios: history.slice(0, 10),
  };
}
