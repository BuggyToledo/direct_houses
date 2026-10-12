/**
 * Pure CTA matching for the WhatsApp assistant.
 * Kept out of whatsapp-ai-handler.ts so the classifier can run without
 * booting Baileys, sessions, or the auth directory.
 */

export type AttendanceIntent =
  | 'cta_studio'
  | 'cta_planta'
  | 'aguardar_corretor'
  | 'lancamentos_na_planta'
  | 'imoveis_prontos'
  | 'duvida'
  | 'atendimento_humano';

export const SOB_CONSULTA = 'sob consulta';

export const TIPO_STUDIO = 'Studio';
export const TIPO_PLANTA = 'Compra na planta';

export const TRAIL_STUDIO = 'Interesse: Studio';
export const TRAIL_STUDIO_LIST = 'Recebeu opções de studio';
export const TRAIL_PLANTA = 'Interesse: Compra na planta';
export const TRAIL_PLANTA_QA = 'Dúvidas sobre compra na planta';
export const TRAIL_PLANTA_PROFILE = 'Perfil de compra na planta qualificado';

/** Trim, lowercase, and strip accents. Punctuation becomes space. */
export function normalizeCtaText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bare post-confirm menu digit (1–4), including keycap emoji. */
export function normalizeMenuChoice(text: string): '1' | '2' | '3' | '4' | null {
  const t = (text || '')
    .trim()
    .toLowerCase()
    .replace(/\uFE0F|\u20E3/g, '');
  if (t === '1') return '1';
  if (t === '2') return '2';
  if (t === '3') return '3';
  if (t === '4') return '4';
  return null;
}

/**
 * Word "studio" / "estúdio" (accent already stripped), including a short
 * message such as "quero STUDIO". Plural "studios" counts as the same word.
 */
export function matchesStudioCta(text: string): boolean {
  const normalized = normalizeCtaText(text);
  if (!normalized) return false;
  return /\b(studio|estudio)s?\b/.test(normalized);
}

/**
 * "planta" on its own or inside a short message such as "quero PLANTA".
 * "na planta" and "lançamentos" stay on the generic lançamentos intent.
 */
export function matchesPlantaCta(text: string): boolean {
  const normalized = normalizeCtaText(text);
  if (!normalized || !/\bplanta\b/.test(normalized)) return false;
  if (/\bna planta\b/.test(normalized)) return false;
  if (/\blancamentos?\b/.test(normalized)) return false;
  return true;
}

/**
 * Studio and planta are checked before the generic menu intents.
 * "na planta" and "lançamentos" still return lancamentos_na_planta.
 * A lone "1" still classifies as aguardar_corretor; catalog browse states
 * block the broker dispatch separately.
 */
export function classifyIntent(text: string): AttendanceIntent | null {
  const menu = normalizeMenuChoice(text);
  const t = (text || '').toLowerCase().trim();

  if (matchesStudioCta(text)) return 'cta_studio';
  if (matchesPlantaCta(text)) return 'cta_planta';

  // Atendimento humano
  if (
    /(falar\s+com\s+(uma?\s+)?(pessoa|humano|atendente|corretor|consultor)|atendente\s+humano|quero\s+(um\s+)?humano|passa\s+pro?\s+(atendente|humano|corretor)|pessoa\s+de\s+verdade)/i.test(t) ||
    t === '5'
  ) {
    return 'atendimento_humano';
  }

  // Aguardar corretor
  if (
    menu === '1' ||
    t === '1' ||
    /^(1|aguard(o|ar)(\s+o?\s*contato)?|pode\s+pedir\s+para\s+o\s+corretor\s+me\s+chamar|s[oó] isso|pode\s+chamar|valeu|obrigad[oa])\.?$/i.test(t) ||
    /aguard(ar|o)\s+(o\s+)?(contato|consultor|corretor)/i.test(t)
  ) {
    return 'aguardar_corretor';
  }

  // Lançamentos na planta
  if (
    menu === '2' ||
    t === '2' ||
    /\b(lan[çc]amento(s)?|na\s+planta|em\s+constru[çc][ãa]o|apartamento(s)?\s+novo(s)?|novos)\b/i.test(t) ||
    /conhecer\s+lan[çc]amentos/i.test(t)
  ) {
    return 'lancamentos_na_planta';
  }

  // Imóveis prontos
  if (
    menu === '3' ||
    t === '3' ||
    /\b(im[oó]ve(l|is)\s+pronto(s)?|comprar|alugar|procurando\s+(uma?\s+)?casa|apartamento\s+pronto|buscar\s+im[oó]veis)\b/i.test(t)
  ) {
    return 'imoveis_prontos';
  }

  // Dúvida
  if (
    menu === '4' ||
    t === '4' ||
    /^(4|d[uú]vida|tirar\s+uma?\s+d[uú]vida|pergunt(a|ar)|aceita\s+financiamento|informa[çc][õo]es)\b/i.test(t) ||
    (t.endsWith('?') && t.length > 5)
  ) {
    return 'duvida';
  }

  return null;
}

/** Client is done with off-plan questions and wants the profile / handoff. */
export function isPlantaAdvanceMessage(text: string): boolean {
  const normalized = normalizeCtaText(text);
  if (!normalized) return false;
  if (
    /^(seguir|proxima|proximo|continuar|pode seguir|sem duvida|nao tenho duvida|nao tenho mais duvidas|so isso|encaminhar|pode encaminhar|quero seguir)$/.test(
      normalized
    )
  ) {
    return true;
  }
  return /\b(sem mais duvidas|pode seguir|quero seguir|nao tenho mais duvidas)\b/.test(normalized);
}

/**
 * Lone "1" must not dispatch the broker while a catalog list or submenu is open,
 * nor while the off-plan profile is still being collected.
 * On the main menu, "1" remains "aguardar corretor".
 */
export function stateBlocksLoneMenuOne(estado?: string): boolean {
  return (
    estado === 'lancamentos_apresentados' ||
    estado === 'lancamento_selecionado' ||
    estado === 'studios_apresentados' ||
    estado === 'coletando_lancamento' ||
    estado === 'coletando_prontos' ||
    estado === 'coletando_planta' ||
    estado === 'planta_duvidas'
  );
}

export interface StudioCatalogFields {
  id?: string;
  nome: string;
  status?: string;
  bairro?: string;
  cidade?: string;
  tipologias?: string;
  quartos?: string;
  metragens?: string;
  precoAPartirDe?: string;
  urlPublicaDirectHouse?: string;
  publicavel?: {
    bairroRegiao?: boolean;
    tipologias?: boolean;
    quartos?: boolean;
    metragens?: boolean;
    precoFaixa?: boolean;
    urlPublicaDirectHouse?: boolean;
  };
}

/**
 * Known studio launches, matched on the catalog name at runtime.
 * MO.dO / MODO Copa Posto 4, Sansa Living, Guima.
 */
export function isNamedStudioLaunch(nome: string): boolean {
  const n = normalizeCtaText(nome);
  if (!n) return false;
  const modoCopa = /\bmo\s*do\b/.test(n) && /\bcopa\b/.test(n) && /\bposto\s*4\b/.test(n);
  const sansa = /\bsansa\b/.test(n) && /\bliving\b/.test(n);
  const guima = /\bguima\b/.test(n);
  return modoCopa || sansa || guima;
}

/** Studio typology lives in tipologias and/or quartos. Description is ignored. */
export function hasStudioTypology(item: { tipologias?: string; quartos?: string }): boolean {
  const blob = normalizeCtaText(`${item.tipologias || ''} ${item.quartos || ''}`);
  if (!blob) return false;
  return /\b(studio|estudio)s?\b/.test(blob);
}

export function isStudioCatalogItem(item: { nome: string; tipologias?: string; quartos?: string }): boolean {
  return isNamedStudioLaunch(item.nome) || hasStudioTypology(item);
}

function studioNameRank(nome: string): number {
  const n = normalizeCtaText(nome);
  if (/\bmo\s*do\b/.test(n) && /\bcopa\b/.test(n) && /\bposto\s*4\b/.test(n)) return 0;
  if (/\bsansa\b/.test(n) && /\bliving\b/.test(n)) return 1;
  if (/\bguima\b/.test(n)) return 2;
  return 3;
}

export function sortStudioLaunches<T extends { nome: string; tipologias?: string; quartos?: string }>(items: T[]): T[] {
  return items
    .filter((item) => isStudioCatalogItem(item))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const rank = studioNameRank(a.item.nome) - studioNameRank(b.item.nome);
      return rank !== 0 ? rank : a.index - b.index;
    })
    .map((entry) => entry.item);
}

function allowed(flag: boolean | undefined): boolean {
  return flag !== false;
}

/**
 * TODO: preço e metragem de studio (MO.dO Copa Posto 4, Sansa Living, Guima)
 * não são campos garantidos no catálogo. Usar somente o valor já cadastrado.
 * Se o campo estiver vazio ou não publicável, mostrar "sob consulta".
 * Nunca inventar preço, metragem, tipologia ou número de quartos.
 */
export function studioCommercialField(value: string | undefined, published: boolean): string {
  if (!published) return SOB_CONSULTA;
  const trimmed = (value || '').trim();
  return trimmed || SOB_CONSULTA;
}

export function formatStudioOptionCard(item: StudioCatalogFields, index: number): string {
  const pub = item.publicavel || {};
  const bairro = allowed(pub.bairroRegiao) ? (item.bairro || '').trim() : '';
  const cidade = allowed(pub.bairroRegiao) ? (item.cidade || '').trim() : '';
  const location =
    bairro || cidade
      ? `📍 ${bairro}${bairro && cidade ? ` (${cidade})` : cidade}`
      : `📍 ${SOB_CONSULTA}`;

  const tipologiaSource = allowed(pub.tipologias) ? (item.tipologias || '').trim() : '';
  const quartosSource = allowed(pub.quartos) ? (item.quartos || '').trim() : '';
  const tipologia = tipologiaSource || quartosSource || SOB_CONSULTA;

  const metragem = studioCommercialField(item.metragens, allowed(pub.metragens));
  const preco = studioCommercialField(item.precoAPartirDe, allowed(pub.precoFaixa));
  const link =
    allowed(pub.urlPublicaDirectHouse) && (item.urlPublicaDirectHouse || '').trim()
      ? `🔗 ${(item.urlPublicaDirectHouse || '').trim()}`
      : '';

  return [
    `${index + 1}️⃣ *${item.nome}*`,
    location,
    `🏠 ${tipologia}`,
    `📐 ${metragem}`,
    `💰 ${preco}`,
    link,
  ]
    .filter(Boolean)
    .join('\n');
}
