/**
 * Classifier checks for cta_studio and cta_planta.
 * Run: npm run check:cta
 * Does not boot WhatsApp or read .env / .whatsapp_auth.
 */
import {
  classifyIntent,
  formatStudioOptionCard,
  isNamedStudioLaunch,
  isPlantaAdvanceMessage,
  isStudioCatalogItem,
  sortStudioLaunches,
  stateBlocksLoneMenuOne,
  SOB_CONSULTA,
  type StudioCatalogFields,
} from '../whatsapp-cta.ts';

let failed = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
    return;
  }
  console.log(`ok   ${name}`);
}

check('STUDIO', classifyIntent('STUDIO'), 'cta_studio');
check('studio lower', classifyIntent('studio'), 'cta_studio');
check('estudio accent', classifyIntent('estúdio'), 'cta_studio');
check('ESTÚDIO', classifyIntent('ESTÚDIO'), 'cta_studio');
check('trimmed quero STUDIO', classifyIntent('  quero STUDIO  '), 'cta_studio');
check('quero estudio', classifyIntent('quero estudio'), 'cta_studio');
check('short studios', classifyIntent('quero ver studios'), 'cta_studio');

check('planta', classifyIntent('planta'), 'cta_planta');
check('PLANTA', classifyIntent('PLANTA'), 'cta_planta');
check('quero PLANTA', classifyIntent('quero PLANTA'), 'cta_planta');
check('trimmed quero planta', classifyIntent('  quero planta '), 'cta_planta');

check('na planta stays lancamentos', classifyIntent('na planta'), 'lancamentos_na_planta');
check('lançamentos stays lancamentos', classifyIntent('lançamentos'), 'lancamentos_na_planta');
check('lancamentos no accent', classifyIntent('lancamentos'), 'lancamentos_na_planta');
check('quero lançamentos na planta', classifyIntent('quero lançamentos na planta'), 'lancamentos_na_planta');
check('apartamento na planta', classifyIntent('apartamento na planta'), 'lancamentos_na_planta');

check('lone 1 still aguardar_corretor', classifyIntent('1'), 'aguardar_corretor');
check('menu 2 still lancamentos', classifyIntent('2'), 'lancamentos_na_planta');

check('seguir advances planta', isPlantaAdvanceMessage('SEGUIR'), true);
check('studio is not planta advance', isPlantaAdvanceMessage('studio'), false);

check('list blocks lone 1', stateBlocksLoneMenuOne('lancamentos_apresentados'), true);
check('submenu blocks lone 1', stateBlocksLoneMenuOne('lancamento_selecionado'), true);
check('studio list blocks lone 1', stateBlocksLoneMenuOne('studios_apresentados'), true);
check('planta questions block lone 1', stateBlocksLoneMenuOne('planta_duvidas'), true);
check('main menu does not block lone 1', stateBlocksLoneMenuOne('menu_inicial'), false);

check('named MO.dO', isNamedStudioLaunch('MO.dO Copa Posto 4'), true);
check('named Sansa Living', isNamedStudioLaunch('Sansa Living'), true);
check('named Guima', isNamedStudioLaunch('Guima'), true);
check('reserva is not a named studio', isNamedStudioLaunch('Reserva Jardim Barra'), false);

const catalog: StudioCatalogFields[] = [
  {
    id: 'reserva',
    nome: 'Reserva Jardim Barra',
    tipologias: '2 e 3 Quartos com Suíte',
    quartos: '2 e 3 quartos',
    metragens: '68m² a 115m²',
    precoAPartirDe: 'R$ 590.000',
    bairro: 'Barra da Tijuca',
  },
  {
    id: 'guima',
    nome: 'Guima',
    bairro: 'Botafogo',
    cidade: 'Rio de Janeiro',
  },
  {
    id: 'sansa',
    nome: 'Sansa Living',
    tipologias: 'Studios',
    precoAPartirDe: 'R$ 410.000',
    metragens: '28m²',
    bairro: 'Copacabana',
  },
  {
    id: 'modo',
    nome: 'MO.dO Copa Posto 4',
    quartos: 'Studio',
    bairro: 'Copacabana',
  },
  {
    id: 'iconic',
    nome: 'Iconic Studios & Design',
    tipologias: 'Studios e 1 Quarto',
    metragens: '32m² a 48m²',
    precoAPartirDe: 'R$ 380.000',
  },
];

const studios = sortStudioLaunches(catalog.filter((item) => isStudioCatalogItem(item)));
check(
  'studio match order',
  studios.map((item) => item.nome),
  ['MO.dO Copa Posto 4', 'Sansa Living', 'Guima', 'Iconic Studios & Design']
);
check('reserva excluded', studios.some((item) => item.nome === 'Reserva Jardim Barra'), false);

const modoCard = formatStudioOptionCard(studios[0], 0);
check('missing price is sob consulta', modoCard.includes(`💰 ${SOB_CONSULTA}`), true);
check('missing size is sob consulta', modoCard.includes(`📐 ${SOB_CONSULTA}`), true);
check('modo card does not invent a price', /R\$\s*\d/.test(modoCard), false);
check('modo keeps catalog typology', modoCard.includes('Studio'), true);

const sansaCard = formatStudioOptionCard(studios[1], 1);
check('existing price is shown', sansaCard.includes('R$ 410.000'), true);
check('existing size is shown', sansaCard.includes('28m²'), true);

const hiddenPrice = formatStudioOptionCard(
  {
    nome: 'Guima',
    precoAPartirDe: 'R$ 999.000',
    metragens: '40m²',
    publicavel: { precoFaixa: false, metragens: false },
  },
  0
);
check('unpublished price stays sob consulta', hiddenPrice.includes(SOB_CONSULTA) && !hiddenPrice.includes('999'), true);
check('unpublished size stays sob consulta', !hiddenPrice.includes('40m²'), true);

// ==========================================
// TESTES DO FLUXO DE SUBMENU E CONFIRMAÇÃO
// ==========================================
import {
  isPrematureDispatchTurn,
  buildContactConfirmationPrompt,
  processContactConfirmationGate,
  performTechnicalLeadValidation,
  handleLaunchFollowUp,
  type WhatsAppChatSession,
} from '../whatsapp-ai-handler.ts';

// 1) Teste: a opção 4 do submenu envia para a roleta
const sessionSubmenu: WhatsAppChatSession = {
  jid: '5521999991111@s.whatsapp.net',
  phone: '5521999991111',
  name: 'Carla Dias',
  initialMessage: 'Quero saber sobre lançamentos',
  messages: [
    { id: '1', role: 'user', content: 'Quero saber sobre lançamentos', timestamp: '10:00' },
    { id: '2', role: 'assistant', content: 'Aqui estão os lançamentos...', timestamp: '10:01' },
  ],
  extractedLead: {
    nome: 'Carla Dias',
    telefone: '(21) 99999-1111',
    tipoAtendimento: 'Lançamento na Planta',
    produtoImovel: 'Reserva Jardim Barra',
    observacoes: '',
    consentimento: 'Sim, autorizado conforme LGPD',
    origem: 'WhatsApp Web Direct Houses',
    status: 'Em atendimento inicial',
    isComplete: false,
    humanRequested: false,
    finalStructuredText: '',
    nameConfirmed: true,
    phoneConfirmed: true,
    trilhaNavegacao: ['Recebeu lista de lançamentos na planta', 'Empreendimento: Reserva Jardim Barra'],
    selectedLancamentoId: 'reserva',
    selectedLancamentoNome: 'Reserva Jardim Barra',
    estadoAtendimento: 'lancamento_selecionado',
  },
  status: 'active',
  lastActivity: new Date().toISOString(),
};

// Cliente escolhe a opção 4 (Falar com consultor) no submenu de lançamento
handleLaunchFollowUp(sessionSubmenu, '4', 'Direct Houses');
check('opcao 4 define aguardando_corretor', sessionSubmenu.extractedLead.estadoAtendimento, 'aguardando_corretor');
check('opcao 4 define humanRequested true', sessionSubmenu.extractedLead.humanRequested, true);

// Validação técnica roda
await performTechnicalLeadValidation(sessionSubmenu);
check('validacao nao sobrescreve estado aguardando_corretor', sessionSubmenu.extractedLead.estadoAtendimento, 'aguardando_corretor');
check('validacao promove status para qualified', sessionSubmenu.status, 'qualified');

// Despacho: isPrematureDispatchTurn deve ser false (permite roleta)
const prematureSubmenu4 = isPrematureDispatchTurn(sessionSubmenu, '4');
check('a opção 4 do submenu envia para a roleta', prematureSubmenu4, false);

// 2) Teste: um "1" sozinho não envia
const sessionList: WhatsAppChatSession = {
  jid: '5521999992222@s.whatsapp.net',
  phone: '5521999992222',
  name: 'João Silva',
  initialMessage: '2',
  messages: [{ id: '1', role: 'user', content: '2', timestamp: '10:00' }],
  extractedLead: {
    nome: 'João Silva',
    telefone: '(21) 99999-2222',
    tipoAtendimento: 'Lançamento na Planta',
    produtoImovel: '',
    observacoes: '',
    consentimento: 'Sim',
    origem: 'WhatsApp',
    status: 'Em atendimento inicial',
    isComplete: false,
    humanRequested: false,
    finalStructuredText: '',
    nameConfirmed: true,
    phoneConfirmed: true,
    trilhaNavegacao: [],
    estadoAtendimento: 'lancamentos_apresentados',
  },
  status: 'active',
  humanRequested: false,
  lastActivity: new Date().toISOString(),
};
check('um "1" sozinho não envia (na lista de lançamentos)', isPrematureDispatchTurn(sessionList, '1'), true);

const sessionSubmenuFotos: WhatsAppChatSession = {
  ...sessionSubmenu,
  humanRequested: false,
  extractedLead: {
    ...sessionSubmenu.extractedLead,
    humanRequested: false,
    estadoAtendimento: 'lancamento_selecionado',
  },
};
check('um "1" sozinho não envia (no submenu fotos)', isPrematureDispatchTurn(sessionSubmenuFotos, '1'), true);

const sessionStudioList: WhatsAppChatSession = {
  ...sessionList,
  humanRequested: false,
  extractedLead: {
    ...sessionList.extractedLead,
    humanRequested: false,
    estadoAtendimento: 'studios_apresentados',
  },
};
check('um "1" sozinho não envia (na lista de studios)', isPrematureDispatchTurn(sessionStudioList, '1'), true);

// 3) Teste: "Sim" confirma sem repetir a pergunta
const sessionConfirmGate: WhatsAppChatSession = {
  jid: '5521999993333@s.whatsapp.net',
  phone: '5521999993333',
  name: 'Marcos Souza',
  initialMessage: 'Olá, gostaria de informações',
  messages: [
    { id: '1', role: 'user', content: 'Olá, gostaria de informações', timestamp: '10:00' },
  ],
  extractedLead: {
    nome: 'Marcos Souza',
    telefone: '(21) 99999-3333',
    tipoAtendimento: '',
    produtoImovel: '',
    observacoes: '',
    consentimento: 'Sim',
    origem: 'WhatsApp',
    status: 'Em atendimento inicial',
    isComplete: false,
    humanRequested: false,
    finalStructuredText: '',
    nameConfirmed: false,
    phoneConfirmed: false,
    trilhaNavegacao: [],
    estadoAtendimento: 'confirmacao_contato',
  },
  status: 'active',
  awaitingContactConfirmation: true,
  contactConfirmationAsked: true,
  lastActivity: new Date().toISOString(),
};

// Cliente responde "Sim"
const replySim = processContactConfirmationGate(sessionConfirmGate, 'Sim', 'Direct Houses');
check('Sim confirma nameConfirmed', sessionConfirmGate.extractedLead.nameConfirmed, true);
check('Sim confirma phoneConfirmed', sessionConfirmGate.extractedLead.phoneConfirmed, true);
check('Sim sai de awaitingContactConfirmation', sessionConfirmGate.awaitingContactConfirmation, false);
check('"Sim" confirma sem repetir a pergunta', !replySim?.includes('Confirma seus dados?'), true);
check('"Sim" exibe o menu apos confirmacao', replySim?.includes('Como prefere continuar?'), true);

// Mensagem seguinte não repete a pergunta de confirmação
const followUpAfterSim = processContactConfirmationGate(sessionConfirmGate, 'Quero saber de casas', 'Direct Houses');
check('mensagem seguinte nao repete confirmacao', followUpAfterSim === null, true);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll CTA checks passed.');
process.exit(0);
