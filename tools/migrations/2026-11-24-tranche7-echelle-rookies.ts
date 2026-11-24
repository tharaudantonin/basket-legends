// Migration de la tranche 7 (24 novembre 2026) — échelle des rookies (rookie scale) des choix de premier tour.
//
// Relevé le 24/11/2026 : Hoops Rumors, « Rookie Scale Salaries For 2026 NBA First-Round Picks » (Luke Adams,
// 02/07/2026), qui publie pour chaque rang les montants à 120 % de l'échelle (le maximum, que signent presque tous les
// choix de premier tour) pour les quatre saisons du contrat. Recoupement : la page de 2025 du même auteur donne des
// montants inférieurs de 6,67 % à chaque rang, exactement la hausse du plafond salarial (154 647 000 $ en 2025-26,
// 164 961 000 $ en 2026-27). Le jeu en déduit l'échelle d'une Draft future en proportion du plafond de sa saison :
// relation observée sur deux années, au statut « derive », à recouper avec l'article VIII de la CBA 2023.
//
// Sortie : data/draft/echelle-rookies.json. Usage : npx tsx tools/migrations/2026-11-24-tranche7-echelle-rookies.ts [dépôt]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();
const CONSULTE = '2026-11-24';

// Rang → [2026-27, 2027-28, 2028-29 (option de l'équipe), 2029-30 (option de l'équipe)], à 120 % de l'échelle.
const RELEVE: readonly (readonly [number, number, number, number])[] = [
  [14748000, 15485760, 16223040, 20457253],
  [13195320, 13855320, 14515320, 18318334],
  [11849760, 12441840, 13034880, 16476088],
  [10683720, 11217960, 11752320, 14866685],
  [9674760, 10158240, 10641960, 13483363],
  [8787000, 9226440, 9666000, 12256488],
  [8021640, 8422920, 8823600, 11205972],
  [7348680, 7716120, 8083680, 10282441],
  [6754800, 7093080, 7430640, 9466635],
  [6417360, 6738000, 7058520, 8999613],
  [6096240, 6401280, 6706200, 8899127],
  [5791680, 6081480, 6371160, 8779458],
  [5502000, 5777280, 6052200, 8648594],
  [5227200, 5488560, 5750160, 8515987],
  [4965480, 5213760, 5461920, 8373123],
  [4717320, 4953240, 5189400, 7960540],
  [4481280, 4705440, 4929360, 7571497],
  [4257480, 4470000, 4683120, 7202639],
  [4065720, 4268880, 4472640, 6887866],
  [3902760, 4097880, 4292880, 6619621],
  [3746760, 3934320, 4121760, 6565964],
  [3597120, 3776760, 3956760, 6508870],
  [3453360, 3626160, 3798360, 6445817],
  [3315360, 3481080, 3646800, 6378253],
  [3182280, 3341280, 3500880, 6305085],
  [3076920, 3230520, 3384480, 6102217],
  [2988120, 3137640, 3287400, 5930470],
  [2969520, 3118560, 3266880, 5896718],
  [2948280, 3095640, 3243120, 5853832],
  [2926800, 3073080, 3219840, 5811811],
];
// Totaux publiés par la source, pour contrôler le relevé.
const TOTAUX = [
  66914053, 59884294, 53802568, 48520685, 43958323, 39935928, 36474132, 33430921, 30745155, 29213493, 28102847, 27023778,
  25980074, 24981907, 24014283, 22820500, 21687577, 20613239, 19695106, 18913141, 18368804, 17839510, 17323697, 16821493,
  16329525, 15794137, 15343630, 15251678, 15140872, 15031531,
];
RELEVE.forEach((l, i) => {
  const total = l.reduce((s, x) => s + x, 0);
  if (total !== TOTAUX[i]) throw new Error(`Rang ${i + 1} : total ${total} ≠ total publié ${TOTAUX[i]}`);
});

const source = (titre: string, url: string, niveau: 'primaire' | 'secondaire', publieLe: string) => ({
  fournisseur: niveau === 'primaire' ? 'NBPA' : 'Hoops Rumors',
  titre,
  url,
  niveau,
  publieLe,
  consulteLe: CONSULTE,
});

const sortie = {
  schemaVersion: 1,
  datasetId: 'basket-legends-echelle-rookies',
  note: 'Échelle des rookies des choix de premier tour, à 120 % (maximum autorisé, signé par presque tous les choix de premier tour ; la cap hold d’un choix non signé vaut aussi 120 %). Montants en dollars par saison du contrat.',
  draftDeReference: 2026,
  plafondDeReference: 164961000,
  bornes: {
    minimum: 0.8,
    maximum: 1.2,
    definition: 'Un choix de premier tour peut signer entre 80 % et 120 % de l’échelle de son rang ; les montants ci-dessous sont à 120 %.',
  },
  saisonsGaranties: 2,
  optionsEquipe: [3, 4],
  evolution: {
    regle: 'proportionnelle-au-plafond',
    statut: 'derive',
    definition:
      'Échelle d’une Draft future = montants de la Draft de référence × plafond salarial de la saison de la Draft ÷ plafond de référence. Observé : +6,67 % de 2025 à 2026 à chaque rang, comme le plafond (154 647 000 → 164 961 000 $). À recouper avec l’article VIII de la CBA 2023.',
  },
  rangs: RELEVE.map((montants, i) => ({ rang: i + 1, montants: [...montants] })),
  sources: [
    source(
      'Rookie Scale Salaries For 2026 NBA First-Round Picks',
      'https://www.hoopsrumors.com/2026/07/rookie-scale-salaries-for-2026-nba-first-round-picks.html',
      'secondaire',
      '2026-07-02',
    ),
    source(
      'Rookie Scale Salaries For 2025 NBA First-Round Picks (recoupement de la croissance)',
      'https://www.hoopsrumors.com/2025/07/rookie-scale-salaries-for-2025-nba-first-round-picks.html',
      'secondaire',
      '2025-07-02',
    ),
  ],
};

mkdirSync(join(depot, 'data', 'draft'), { recursive: true });
writeFileSync(join(depot, 'data', 'draft', 'echelle-rookies.json'), JSON.stringify(sortie, null, 2) + '\n', 'utf8');
console.log('Écrit : data/draft/echelle-rookies.json');
