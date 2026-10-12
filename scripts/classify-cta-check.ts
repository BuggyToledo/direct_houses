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

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll CTA checks passed.');
