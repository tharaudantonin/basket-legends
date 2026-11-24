// Migration de la tranche 7 (24 novembre 2026) — données de la Draft (réponses 12, 13, 16 et 17 de
// docs/DECISIONS_2026-11.md).
//
// Sorties :
// 1. data/draft/loterie-2027-2029.json : loterie « 3-2-1 » (NBA Communications, 28/05/2026 ; répartition des boules
//    confirmée par l'explication de NBA.com mise à jour le 03/11/2026). Mécanisme du tirage et table des probabilités au
//    statut « à recouper » (le PDF officiel n'a pas pu être lu : réponse 13, Antonin le fournira).
// 2. data/draft/historique-loterie.json : ordre des loteries 2025 et 2026 (NBA.com), pour les limites de la 3-2-1.
// 3. data/draft/choix-2027.json : propriété des 60 choix de la Draft 2027 au 24/11/2026 (RealGM, page « 2027 NBA Draft
//    Picks », lue le 24/11/2026). Relevé par lecture automatique et reformulé : statut « à recouper » ; les écarts avec
//    la page détaillée du même site sont notés dans `ecarts`.
// 4. data/draft/modele-draft.json : génération des classes de Draft et scouting (choix du modèle, statut « proposition »).
//
// Les codes NBA sont convertis en identifiants de franchise du jeu (data/franchises.json).
// Usage : npx tsx tools/migrations/2026-11-24-tranche7-draft.ts [dépôt]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();
const CONSULTE = '2026-11-24';
const ecrire = (chemin: string, contenu: unknown) => {
  mkdirSync(join(depot, chemin, '..'), { recursive: true });
  writeFileSync(join(depot, chemin), JSON.stringify(contenu, null, 2) + '\n', 'utf8');
  console.log(`Écrit : ${chemin}`);
};

const F: Record<string, string> = {
  ATL: 'atlanta', BOS: 'boston', BKN: 'brooklyn', CHA: 'charlotte', CHI: 'chicago', CLE: 'cleveland', DAL: 'dallas',
  DEN: 'denver', DET: 'detroit', GSW: 'golden-state', HOU: 'houston', IND: 'indianapolis', LAC: 'clippers', LAL: 'lakers',
  MEM: 'memphis', MIA: 'miami', MIL: 'milwaukee', MIN: 'minnesota', NOP: 'new-orleans', NYK: 'new-york',
  OKC: 'oklahoma-city', ORL: 'orlando', PHI: 'philadelphia', PHX: 'phoenix', POR: 'portland', SAC: 'sacramento',
  SAS: 'san-antonio', TOR: 'toronto', UTA: 'utah', WAS: 'washington',
};
const f = (code: string): string => {
  const id = F[code];
  if (!id) throw new Error(`Code inconnu : ${code}`);
  return id;
};

// --- 1. Loterie 3-2-1. ---
const sourceCommunique = {
  fournisseur: 'NBA Communications',
  titre: 'NBA Board of Governors approves new Draft Lottery system to address tanking',
  url: 'https://pr.nba.com/nba-board-of-governors-approves-new-draft-lottery-system-to-address-tanking/',
  niveau: 'primaire',
  publieLe: '2026-05-28',
  consulteLe: CONSULTE,
};
const sourceExplication = {
  fournisseur: 'NBA.com',
  titre: '2027 NBA Draft Lottery: Odds, history and how it works',
  url: 'https://www.nba.com/news/nba-draft-lottery-explainer',
  niveau: 'primaire',
  publieLe: '2026-11-03',
  consulteLe: CONSULTE,
};
ecrire('data/draft/loterie-2027-2029.json', {
  schemaVersion: 1,
  datasetId: 'basket-legends-loterie-2027-2029',
  id: '3-2-1',
  drafts: [2027, 2028, 2029],
  statut: 'a-recouper',
  note: 'Loterie « 3-2-1 » adoptée le 28/05/2026 pour les Drafts 2027 à 2029. Sourcé : 16 équipes, boules par catégorie, 16 choix tirés, plancher au 12e choix pour les trois pires bilans, limites de choix consécutifs, choix 17 à 30 au bilan inverse des 14 autres équipes, 2e tour au bilan inverse des 30. À recouper avec la table officielle des probabilités (PDF de la NBA non lu) : le mécanisme exact du tirage, l’application du plancher et des limites, le départage des bilans égaux (tirage au sort déterministe dans le jeu).',
  choixTires: 16,
  categories: [
    { id: 'releguees', boules: 2, equipes: 3, plancher: 12, definition: 'Les trois pires bilans de la ligue (« draft-relegated »).' },
    { id: 'non-qualifiees', boules: 3, equipes: 7, plancher: 16, definition: 'Les autres équipes ni en playoffs ni au Play-In.' },
    { id: 'play-in-9-10', boules: 2, equipes: 4, plancher: 16, definition: 'Les 9e et 10e de chaque conférence (Play-In).' },
    { id: 'perdants-7-8', boules: 1, equipes: 2, plancher: 16, definition: 'Les perdants des matchs 7e contre 8e du Play-In.' },
  ],
  premierChoixInterditApresUnPremier: true,
  limiteTop: { top: 5, draftsConsecutives: 3 },
  apresLaLoterie: 'Choix 17 à 30 : les 14 autres équipes au bilan inverse. 2e tour (31 à 60) : les 30 équipes au bilan inverse.',
  apartirDe2030: 'Règle à voter par le Board of Governors ; le jeu garde la 3-2-1 par défaut (réponse 12).',
  sources: [sourceCommunique, sourceExplication],
});

// --- 2. Historique des loteries (rang du choix propre). ---
ecrire('data/draft/historique-loterie.json', {
  schemaVersion: 1,
  datasetId: 'basket-legends-historique-loterie',
  note: 'Rang du choix propre de chaque équipe aux loteries 2025 et 2026, pour les limites de la 3-2-1 (pas deux n° 1 de suite, pas trois top 5 de suite). Un choix listé sans mention « via » est présumé propre ; les choix d’une équipe listée deux fois sans précision (San Antonio en 2025, Miami en 2026) sont laissés de côté.',
  drafts: {
    '2025': Object.fromEntries(
      [['DAL', 1], ['PHI', 3], ['CHA', 4], ['UTA', 5], ['WAS', 6], ['NOP', 7], ['BKN', 8], ['TOR', 9], ['HOU', 10], ['POR', 11], ['CHI', 12], ['ATL', 13]].map(
        ([c, r]) => [f(c as string), r],
      ),
    ),
    '2026': Object.fromEntries(
      [['WAS', 1], ['UTA', 2], ['MEM', 3], ['CHI', 4], ['IND', 5], ['BKN', 6], ['SAC', 7], ['NOP', 8], ['DAL', 9], ['MIL', 10], ['LAC', 12], ['CHA', 14]].map(
        ([c, r]) => [f(c as string), r],
      ),
    ),
  },
  sources: [
    { fournisseur: 'NBA.com', titre: '2025 NBA Draft Lottery result', url: 'https://www.nba.com/news/2025-nba-draft-lottery-result', niveau: 'primaire', publieLe: '2025-05-12', consulteLe: CONSULTE },
    { ...sourceExplication, titre: `${sourceExplication.titre} (résultats 2026 : choix d’Indiana détenu par les Clippers au 5e rang, de New Orleans détenu par Atlanta au 8e, des Clippers détenu par Oklahoma City au 12e)` },
  ],
});

// --- 3. Propriété des choix 2027. ---
type Attr = { beneficiaire: string; rangs?: [number, number]; sinon?: string };
const a = (code: string, rangs?: [number, number], sinon?: string): Attr => ({
  beneficiaire: code.startsWith('@') ? code : f(code),
  ...(rangs ? { rangs } : {}),
  ...(sinon ? { sinon: f(sinon) } : {}),
});
const o = (code: string, rangs?: [number, number]) => ({ original: f(code), ...(rangs ? { rangs } : {}) });
const simple = (de: string, vers: string) => ({ membres: [o(de)], attributions: { '1': [a(vers)] }, description: `${de} → ${vers}` });

const tour1 = [
  simple('ATL', 'SAS'),
  {
    membres: [o('NOP'), o('MIL')],
    attributions: { '2': [a('NOP'), a('ATL', [5, 30], 'NOP')] },
    description: 'NOP prend le plus favorable de NOP et MIL ; ATL le moins favorable s’il est entre 5 et 30, sinon NOP garde les deux',
  },
  { membres: [o('HOU'), o('BKN')], attributions: { '2': [a('HOU'), a('BKN')] }, description: 'HOU peut échanger son choix contre celui de BKN' },
  simple('NYK', 'BKN'),
  simple('PHX', 'HOU'),
  { membres: [o('DAL')], attributions: { '1': [a('CHA', [3, 30])] }, description: 'DAL protégé 1-2, sinon à CHA' },
  { membres: [o('MIA')], attributions: { '1': [a('CHA', [15, 30])] }, description: 'MIA protégé 1-14, sinon à CHA' },
  { membres: [o('LAL')], attributions: { '1': [a('MEM', [5, 30])] }, description: 'LAL protégé 1-4, sinon à MEM (via UTA)' },
  {
    membres: [o('CLE'), o('MIN'), o('UTA')],
    attributions: { '3': [a('MEM'), a('UTA'), a('PHX')] },
    description: 'Le plus favorable de CLE, MIN et UTA à MEM, le deuxième à UTA, le moins favorable à PHX',
  },
  {
    membres: [o('DEN', [6, 30]), o('OKC'), o('LAC')],
    attributions: { '3': [a('OKC'), a('OKC'), a('LAC')], '2': [a('OKC'), a('LAC')] },
    description: 'DEN protégé 1-5 ; OKC prend les deux plus favorables de OKC, DEN (6-30) et LAC, LAC le dernier',
  },
  { membres: [o('SAS')], attributions: { '1': [a('SAC', [1, 16], 'OKC')] }, description: 'SAS : 1-16 à SAC, 17-30 à OKC (via SAC)' },
];
const condSas = { original: f('SAS'), rangs: [1, 16] as [number, number] };
const tour2 = [
  { membres: [o('BOS'), o('ORL')], attributions: { '2': [a('UTA'), a('CHA')] }, description: 'Le plus favorable de BOS et ORL à UTA, l’autre à CHA' },
  { membres: [o('BKN'), o('DAL')], attributions: { '2': [a('WAS'), a('DET')] }, description: 'Le plus favorable de BKN et DAL à WAS, l’autre à DET' },
  {
    membres: [o('CHA')],
    condition: condSas,
    attributions: { '1': [a('OKC')] },
    attributionsSinon: { '1': [a('SAC')] },
    description: 'CHA à OKC si le 1er tour de SAS est entre 1 et 16, sinon à SAC',
  },
  {
    membres: [o('SAC')],
    condition: condSas,
    attributions: { '1': [a('OKC')] },
    attributionsSinon: { '1': [a('SAC')] },
    description: 'SAC à OKC si le 1er tour de SAS est entre 1 et 16, sinon SAC le garde',
  },
  simple('CHI', 'DAL'),
  simple('CLE', 'CHI'),
  simple('DEN', 'UTA'),
  { membres: [o('GSW'), o('PHX')], attributions: { '2': [a('PHI'), a('WAS')] }, description: 'Le plus favorable de GSW et PHX à PHI, l’autre à WAS' },
  {
    membres: [o('OKC'), o('HOU'), o('IND'), o('MIA')],
    attributions: { '4': [a('PHI'), a('NOP'), a('NYK'), a('@groupe-sas')] },
    description: 'Groupe OKC, HOU, IND, MIA : le plus favorable à PHI, le deuxième à NOP, le troisième à NYK, le dernier passe au groupe SAS',
  },
  {
    membres: [{ detenteur: '@groupe-sas' }, o('SAS')],
    attributions: { '2': [a('SAS'), a('MIA')] },
    description: 'SAS prend le plus favorable de son choix et du dernier du groupe, MIA l’autre',
  },
  {
    membres: [o('LAL')],
    condition: { original: f('LAL'), rangs: [5, 30] },
    attributions: { '1': [a('BKN')] },
    attributionsSinon: { '1': [a('MEM')] },
    description: 'LAL à BKN si LAL cède son 1er tour à MEM, sinon à MEM (via UTA)',
  },
  simple('LAC', 'UTA'),
  simple('MEM', 'HOU'),
  simple('MIL', 'DET'),
  simple('MIN', 'POR'),
  {
    membres: [o('NOP'), o('POR')],
    attributions: { '2': [a('CHA'), a('HOU', [56, 60], 'POR')] },
    description: 'Le plus favorable de NOP et POR à CHA ; l’autre à HOU s’il est entre 56 et 60, sinon à POR',
  },
  simple('UTA', 'IND'),
  simple('WAS', 'NYK'),
];
ecrire('data/draft/choix-2027.json', {
  schemaVersion: 1,
  datasetId: 'basket-legends-choix-2027',
  annee: 2027,
  statut: 'a-recouper',
  note: 'Propriété des choix de la Draft 2027 au 24/11/2026 (échanges, protections, droits d’échange de rang). Les choix non cités restent à leur équipe. Relevé par lecture automatique de la page RealGM et reformulé : à recouper ligne à ligne avant validation (porte de publication : source secondaire).',
  tours: { '1': tour1, '2': tour2 },
  ecarts: [
    'SAS 1er tour : la page de synthèse donne 1-16 à SAC et 17-30 à OKC ; la lecture de la page détaillée donnait l’inverse. Le fichier suit la synthèse.',
    'BOS/ORL 2e tour : la synthèse donne le moins favorable à CHA ; la page détaillée le donnait à PHX (échange en attente).',
    'MEM 2e tour : la synthèse donne HOU (via LAC) ; la section de Charlotte de la page détaillée le donnait à CHA.',
    'ATL 2e tour : la synthèse indique « Own (via BOS to MEM to POR) », formulation ambiguë ; le fichier laisse ce choix à ATL.',
    'LAC 1er tour : la page détaillée mentionnait un droit d’échange de TOR (en attente) absent de la synthèse ; non repris.',
    'Choix 2028 à 2033 : page détaillée tronquée au relevé (sections PHX à WAS absentes) ; à relever avant les échanges (tranche 9).',
  ],
  sources: [
    { fournisseur: 'RealGM', titre: '2027 NBA Draft Picks', url: 'https://basketball.realgm.com/nba/draft/future_drafts/summary/2027', niveau: 'secondaire', consulteLe: CONSULTE },
    { fournisseur: 'RealGM', titre: 'NBA Future Draft Pick Details', url: 'https://basketball.realgm.com/nba/draft/future_drafts/detailed', niveau: 'secondaire', consulteLe: CONSULTE },
  ],
});

// --- 4. Modèle de génération et de scouting. ---
ecrire('data/draft/modele-draft.json', {
  schemaVersion: 1,
  datasetId: 'basket-legends-modele-draft',
  statut: 'proposition',
  note: 'Choix du modèle (aucune cible sourcée) pour générer les classes de Draft et le vivier de joueurs originaux, et pour le scouting à notes incertaines. Échelle hors NBA 40-67 (décision du 24/11/2026). À valider par Antonin.',
  classe: {
    taille: 100,
    ages: { '19': 0.4, '20': 0.25, '21': 0.2, '22': 0.15 },
    origines: { universite: 0.65, international: 0.25, 'g-league': 0.1 },
    postes: { G: 0.34, 'G-F': 0.08, F: 0.26, 'F-G': 0.06, 'F-C': 0.1, C: 0.16 },
    tailleParPoste: { G: [191, 5], 'G-F': [198, 4], F: [203, 4], 'F-G': [200, 4], 'F-C': [208, 4], C: [212, 5] },
    imcMoyen: 24.2,
    paysParOrigine: {
      universite: { USA: 0.85, Canada: 0.06, Australia: 0.03, Nigeria: 0.02, France: 0.02, Senegal: 0.02 },
      international: { France: 0.2, Spain: 0.1, Serbia: 0.1, Germany: 0.08, Lithuania: 0.07, Australia: 0.08, Turkey: 0.05, Brazil: 0.05, Greece: 0.04, Italy: 0.05, Japan: 0.03, China: 0.03, Croatia: 0.04, Senegal: 0.04, Cameroon: 0.04 },
      'g-league': { USA: 0.9, Canada: 0.05, Bahamas: 0.05 },
    },
    note: { moyenne: 50, ecartTalent: 5, parAnnee: 1.5, bruit: 2, min: 40, max: 67 },
    potentiel: { marge: 14, ecartTalent: 7, ecartPropre: 4, parAnneeDAge: 3, max: 97 },
    details: {
      ecart: 6,
      min: 25,
      max: 85,
      profilParGroupe: {
        meneur: { tirCercle: -2, tirATroisPoints: 3, passe: 6, maniement: 7, defenseExterieure: 3, defenseInterieure: -7, contre: -8, rebondOffensif: -8, rebondDefensif: -6, vitesse: 6, force: -6, interception: 3 },
        ailier: { tirATroisPoints: 1, defenseExterieure: 2, rebondDefensif: 1 },
        interieur: { tirCercle: 6, tirATroisPoints: -8, passe: -4, maniement: -7, defenseExterieure: -5, defenseInterieure: 7, contre: 8, rebondOffensif: 8, rebondDefensif: 7, vitesse: -6, force: 7, interception: -3 },
      },
    },
  },
  scouting: {
    ecartInitial: { note: 6, potentiel: 9, details: 8 },
    observationsParDefaut: 1,
    budgetObservations: 60,
    observationsMax: 12,
    observationsDuConsensus: 3,
  },
  choixIa: { poidsNote: 0.45, poidsPotentiel: 0.55, malusParAnnee: 0.8, besoinDePoste: 1.5 },
});
