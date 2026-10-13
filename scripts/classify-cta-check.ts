/**
 * Classifier checks for cta_studio and cta_planta.
 * Run: npm run check:cta
 * Does not boot WhatsApp or read .env / .whatsapp_auth.
 */
import { formatPhoneForDisplay, isValidPhoneNumber } from '../broker-roleta.ts';
import {
  buildContactConfirmationPrompt,
  classifyIntent,
  formatStudioOptionCard,
  isContactConfirmationReply,
  isNamedStudioLaunch,
  isPlantaAdvanceMessage,
  isPrematureDispatchTurn,
  isStudioCatalogItem,
  isUndispatchedRecoveryCandidate,
  nextContactConfirmationStep,
  resolveContactDisplayName,
  sortStudioLaunches,
  stateBlocksLoneMenuOne,
  SOB_CONSULTA,
  type ContactConfirmationStep,
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

const consultorHandoff = {
  extractedLead: { humanRequested: true, estadoAtendimento: 'aguardando_corretor' as const },
};
check('submenu 4 dispatches', isPrematureDispatchTurn(consultorHandoff, '4'), false);
check(
  'submenu 4 still dispatches if validation rewrote the state',
  isPrematureDispatchTurn({ extractedLead: { humanRequested: true, estadoAtendimento: 'qualificado' } }, '4'),
  false
);
check(
  'studio handoff dispatches',
  isPrematureDispatchTurn({ humanRequested: true, extractedLead: { estadoAtendimento: 'aguardando_corretor' } }, '4'),
  false
);
check(
  'planta handoff dispatches',
  isPrematureDispatchTurn({ extractedLead: { humanRequested: true, estadoAtendimento: 'planta_concluido' } }, 'Copacabana'),
  false
);
check(
  'lone 1 does not dispatch',
  isPrematureDispatchTurn({ extractedLead: { humanRequested: false, estadoAtendimento: 'lancamentos_apresentados' } }, '1'),
  true
);
check(
  'lone 1 on the launch submenu does not dispatch',
  isPrematureDispatchTurn({ extractedLead: { humanRequested: false, estadoAtendimento: 'lancamento_selecionado' } }, '1'),
  true
);
check(
  'menu 4 outside a handoff does not dispatch',
  isPrematureDispatchTurn({ extractedLead: { humanRequested: false, estadoAtendimento: 'menu_inicial' } }, '4'),
  true
);
check(
  'menu 2 outside a handoff does not dispatch',
  isPrematureDispatchTurn({ extractedLead: { humanRequested: false, estadoAtendimento: 'menu_inicial' } }, '2'),
  true
);

check(
  'qualified lead with no dispatch is recovered',
  isUndispatchedRecoveryCandidate({ status: 'qualified', extractedLead: { humanRequested: false } }),
  true
);
check(
  'humanRequested lead with no dispatch is recovered',
  isUndispatchedRecoveryCandidate({ status: 'active', humanRequested: true }),
  true
);
check(
  'already dispatched lead is not sent again',
  isUndispatchedRecoveryCandidate({
    status: 'qualified',
    lastDispatchedAt: '2026-01-01T00:00:00.000Z',
    extractedLead: { humanRequested: true },
  }),
  false
);
check(
  'dispatched status is not sent again',
  isUndispatchedRecoveryCandidate({ status: 'dispatched', extractedLead: { humanRequested: true } }),
  false
);

const typedName = resolveContactDisplayName('Carla Mendes', 'Carla Zap');
check('typed name wins over pushName', typedName, 'Carla Mendes');
check('pushName fills in when no typed name', resolveContactDisplayName('Cliente', 'Carla Zap'), 'Carla Zap');

const phone = '5521987654321';
const formatted = formatPhoneForDisplay(phone);
const prompt = buildContactConfirmationPrompt(typedName, phone);
check('confirmation shows the typed name', prompt.includes(typedName), true);
check('confirmation shows the formatted phone', prompt.includes(formatted), true);
check('formatted phone is the display form', formatted, '+55 (21) 98765-4321');

const lidPrompt = buildContactConfirmationPrompt(typedName, '');
check('lid prompt asks for the number', /WhatsApp com DDD/i.test(lidPrompt), true);
check('lid prompt does not invent a phone', lidPrompt.includes('+55'), false);
check('lid number is not a real phone', isValidPhoneNumber(''), false);

let asked = false;
let confirmed = false;
const simReplies: string[] = [];
for (const message of ['Oi', 'Sim', 'Sim']) {
  const step: ContactConfirmationStep = nextContactConfirmationStep({
    confirmed,
    asked,
    hasName: true,
    hasPhone: true,
    messageIsConfirmation: isContactConfirmationReply(message),
    messageIsTypedName: false,
    messageHasPhone: false,
  });
  if (step === 'show_prompt' || step === 'reprompt') {
    asked = true;
    simReplies.push(buildContactConfirmationPrompt(typedName, phone));
  } else if (step === 'confirmed_menu') {
    asked = true;
    confirmed = true;
    simReplies.push('MENU');
  } else if (step === 'already_confirmed') {
    simReplies.push('DONE');
  } else {
    simReplies.push(step);
  }
}
check('first message is the confirmation', simReplies[0].includes('Confirma seus dados'), true);
check('Sim confirms', simReplies[1], 'MENU');
check('Sim confirms without looping', simReplies[2], 'DONE');
check('plain Sim is a confirmation', isContactConfirmationReply('Sim'), true);
check('second Sim is not the prompt again', simReplies[2].includes('Confirma seus dados'), false);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll CTA checks passed.');
