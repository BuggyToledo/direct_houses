import fs from 'fs';
import path from 'path';

export interface Lancamento {
  id: string;
  nome: string;
  bairro: string;
  cidade?: string;
  construtora?: string;
  tipologias: string; // Ex: "Studios, 2 e 3 Quartos, Coberturas"
  precoAPartirDe?: string; // Ex: "R$ 450.000"
  diferenciais?: string; // Ex: "Varanda gourmet, lazer completo, piscina, vaga"
  linkBookPdf?: string; // Link para PDF / Book de apresentação
  active: boolean;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const LANCAMENTOS_FILE = path.join(DATA_DIR, 'lancamentos.json');

const DEFAULT_LANCAMENTOS: Lancamento[] = [
  {
    id: 'lanc-1',
    nome: 'Reserva Jardim Barra',
    bairro: 'Barra da Tijuca',
    cidade: 'Rio de Janeiro',
    construtora: 'Direct Houses',
    tipologias: '2 e 3 Quartos com Suíte',
    precoAPartirDe: 'R$ 590.000',
    diferenciais: 'Varanda gourmet, 1 vaga, lazer completo tipo resort, piscina e academia',
    linkBookPdf: '',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'lanc-2',
    nome: 'Iconic Studios & Design',
    bairro: 'Botafogo / Zona Sul',
    cidade: 'Rio de Janeiro',
    construtora: 'Direct Houses',
    tipologias: 'Studios e 1 Quarto',
    precoAPartirDe: 'R$ 380.000',
    diferenciais: 'Ideal para moradia ou Airbnb, rooftop com vista para o Cristo, coworking',
    linkBookPdf: '',
    active: true,
    createdAt: new Date().toISOString(),
  },
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getLancamentos(): Lancamento[] {
  ensureDataDir();
  try {
    if (fs.existsSync(LANCAMENTOS_FILE)) {
      const data = fs.readFileSync(LANCAMENTOS_FILE, 'utf-8');
      const items: Lancamento[] = JSON.parse(data);
      return Array.isArray(items) ? items : DEFAULT_LANCAMENTOS;
    }
  } catch (err) {
    console.error('Erro ao ler lançamentos:', err);
  }
  saveLancamentos(DEFAULT_LANCAMENTOS);
  return DEFAULT_LANCAMENTOS;
}

export function saveLancamentos(items: Lancamento[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(LANCAMENTOS_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar lançamentos:', err);
  }
}

export function getActiveLancamentos(): Lancamento[] {
  return getLancamentos().filter((item) => item.active);
}

export function addLancamento(data: Omit<Lancamento, 'id' | 'createdAt'>): Lancamento {
  const items = getLancamentos();
  const newItem: Lancamento = {
    ...data,
    id: `lanc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    nome: data.nome.trim(),
    bairro: data.bairro.trim(),
    tipologias: data.tipologias?.trim() || '2 e 3 quartos',
    active: typeof data.active === 'boolean' ? data.active : true,
    createdAt: new Date().toISOString(),
  };
  items.unshift(newItem);
  saveLancamentos(items);
  return newItem;
}

export function updateLancamento(id: string, updates: Partial<Lancamento>): Lancamento | null {
  const items = getLancamentos();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const updated: Lancamento = {
    ...items[index],
    ...updates,
    nome: updates.nome ? updates.nome.trim() : items[index].nome,
    bairro: updates.bairro ? updates.bairro.trim() : items[index].bairro,
  };

  items[index] = updated;
  saveLancamentos(items);
  return updated;
}

export function deleteLancamento(id: string): boolean {
  const items = getLancamentos();
  const filtered = items.filter((item) => item.id !== id);
  if (filtered.length === items.length) return false;
  saveLancamentos(filtered);
  return true;
}

export function formatLancamentosForPrompt(): string {
  const active = getActiveLancamentos();
  if (active.length === 0) return 'Nenhum lançamento cadastrado no momento.';

  return active
    .map((l, idx) => {
      let line = `${idx + 1}. *${l.nome}* (${l.bairro}${l.cidade ? ` - ${l.cidade}` : ''})`;
      if (l.tipologias) line += ` | Tipologias: ${l.tipologias}`;
      if (l.precoAPartirDe) line += ` | A partir de ${l.precoAPartirDe}`;
      if (l.diferenciais) line += ` | Destaques: ${l.diferenciais}`;
      if (l.linkBookPdf) line += ` | Link do Book: ${l.linkBookPdf}`;
      return line;
    })
    .join('\n');
}
