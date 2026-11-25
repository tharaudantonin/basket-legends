// Migration de la tranche 9 (25 novembre 2026) — échanges, free agency, IA de GM, staff (réponses 24 à 45 de
// docs/DECISIONS_2026-11.md).
//
// Sorties :
// 1. data/cba/nba-2026-27.json : règles d'échange (correspondance des salaires par niveau, aprons), droits de Bird,
//    agents libres restreints, ballottage et étalement, choix futurs (7 ans, règle Stepien, gel), délai avant d'échanger
//    un joueur signé, lissage du plafond et estimation 2027-28. Chaque paramètre est sourcé (Hoops Rumors, NBA.com,
//    RealGM, NBC Sports, Yardbarker), consulté le 25/11/2026.
// 2. data/ligue/transactions-2026-27.json : dates des transactions 2026-27 (NBA.com) et volumes relevés en 2025-26
//    (Basketball-Reference : 58 échanges, 212 signatures), cibles de l'IA.
// 3. data/draft/choix-2028.json à choix-2033.json : propriété des choix (RealGM, pages de synthèse lues le 25/11/2026),
//    reformulée ; les montages les plus complexes sont simplifiés et notés dans `ecarts` ; choix gelés.
// 4. data/contrats/2026-27.json : horloge de Bird de chaque joueur (`saisonsAvecEquipe`), calculée depuis les relevés
//    privés de Basketball-Reference (équipes 2024-25 et 2025-26, échanges de 2025 et 2026 : basket-legends-prive/).
// 5. data/modeles/marche-v1.json et data/modeles/staff-v1.json : modèles de la tranche 9 (statut « proposition »).
//
// Usage : npx tsx tools/migrations/2026-11-25-tranche9-marche.ts [dépôt] [dossier privé]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schemaCba,
  schemaChoixDraft,
  schemaContrats,
  schemaModeleMarche,
  schemaModeleStaff,
  schemaTransactions,
} from '../../packages/data/src';

const depot = process.argv[2] ?? process.cwd();
const prive = process.argv[3] ?? join(depot, '..', 'basket-legends-prive');
const CONSULTE = '2026-11-25';

const lire = (chemin: string): unknown => JSON.parse(readFileSync(join(depot, chemin), 'utf8'));
const ecrire = (chemin: string, schema: { parse: (x: unknown) => unknown }, contenu: unknown) => {
  writeFileSync(join(depot, chemin), `${JSON.stringify(schema.parse(contenu), null, 2)}\n`, 'utf8');
  console.log(`Écrit : ${chemin}`);
};

type Source = { fournisseur: string; titre: string; url: string; niveau: 'primaire' | 'secondaire'; consulteLe: string };
const src = (fournisseur: string, titre: string, url: string, niveau: Source['niveau'] = 'secondaire'): Source => ({
  fournisseur,
  titre,
  url,
  niveau,
  consulteLe: CONSULTE,
});
const HR = 'Hoops Rumors';
const S = {
  tpe: src(HR, 'Hoops Rumors Glossary: Traded Player Exception (06/2024)', 'https://www.hoopsrumors.com/2024/06/hoops-rumors-glossary-traded-player-exception-5.html'),
  aprons: src(HR, 'Hoops Rumors Glossary: Tax Aprons (01/2025)', 'https://www.hoopsrumors.com/2025/01/hoops-rumors-glossary-tax-aprons-2.html'),
  bird: src(HR, 'Hoops Rumors Glossary: Bird Rights (03/2026)', 'https://www.hoopsrumors.com/2026/03/hoops-rumors-glossary-bird-rights-8.html'),
  earlyBird: src(HR, 'Hoops Rumors Glossary: Early Bird Rights (03/2026)', 'https://www.hoopsrumors.com/2026/03/hoops-rumors-glossary-early-bird-rights-9.html'),
  nonBird: src(HR, 'Hoops Rumors Glossary: Non-Bird Rights (04/2026)', 'https://www.hoopsrumors.com/2026/04/hoops-rumors-glossary-non-bird-rights-9.html'),
  qo: src(HR, 'Hoops Rumors Glossary: Qualifying Offer (05/2026)', 'https://www.hoopsrumors.com/2026/05/hoops-rumors-glossary-qualifying-offer-3.html'),
  nbaAgents: src('NBA.com', 'NBA Free Agency explained (mis à jour le 30/06/2026)', 'https://www.nba.com/news/free-agency-explained', 'primaire'),
  waivers: src(HR, 'Hoops Rumors Glossary: Waivers (06/2024)', 'https://www.hoopsrumors.com/2024/06/hoops-rumors-glossary-waivers-4.html'),
  stretch: src(HR, 'Hoops Rumors Glossary: Stretch Provision (08/2024)', 'https://www.hoopsrumors.com/2024/08/hoops-rumors-glossary-stretch-provision-3.html'),
  stepien: src(HR, 'Hoops Rumors Glossary: Ted Stepien Rule (05/2024)', 'https://www.hoopsrumors.com/2024/05/hoops-rumors-glossary-ted-stepien-rule-5.html'),
  septAns: src(HR, 'What Each NBA Team Can, Can’t Do On The Trade Market (12/2024)', 'https://hoopsrumors.com/2024/12/what-each-nba-team-can-cant-do-on-the-trade-market.html'),
  troisMois: src('Yardbarker (Hoops Rumors)', 'Players Who Can’t Be Traded Until December 15', 'https://www.yardbarker.com/nba/articles/players_who_cant_be_traded_until_december_15/s1_14822_44136964'),
  lissage: src('RealGM', 'New NBA CBA Includes Cap Smoothing Provision (02/04/2023)', 'https://basketball.realgm.com/wiretap/271018/New-NBA-CBA-Includes-Cap-Smoothing-Provision'),
  estimation: src('NBC Sports', 'NBA informs teams of slight increase in salary cap projection for 2027-28 season to $176 million (13/09/2026)', 'https://www.nbcsports.com/nba/news/nba-informs-teams-of-slight-increase-in-salary-cap-projection-for-2027-28-season-to-176-million'),
  cles: src('NBA.com', '2026-27 NBA key dates (mis à jour le 14/11/2026)', 'https://www.nba.com/news/key-dates', 'primaire'),
  bref2026: src('Basketball-Reference', '2025-26 NBA Transactions', 'https://www.basketball-reference.com/leagues/NBA_2026_transactions.html'),
  bref2025: src('Basketball-Reference', '2024-25 NBA Transactions', 'https://www.basketball-reference.com/leagues/NBA_2025_transactions.html'),
  realgm: (a: number) => src('RealGM', `${a} NBA Draft Picks`, `https://basketball.realgm.com/nba/draft/future_drafts/summary/${a}`),
};

// --- 1. CBA. ---
const p = <T>(valeur: T, unite: string, definition: string, source: Source) => ({ valeur, unite, definition, source });
const cba = lire('data/cba/nba-2026-27.json') as ReturnType<typeof schemaCba.parse>;
Object.assign(cba.parametres, {
  margeEchange: p(
    { montant: 7_500_000, plafondDeReference: 136_021_000 },
    'dollars',
    'Échange simultané d’une équipe au-dessus du plafond et sous le premier apron : elle peut recevoir le plus grand de (le plus petit de 200 % des salaires cédés + 250 000 $ et des salaires cédés + cette marge) et de 125 % des salaires cédés + 250 000 $. La marge (7,5 M$ en 2023-24, plafond de 136,021 M$) suit le plafond chaque saison.',
    S.tpe,
  ),
  partEchangeBasse: p(2, 'rapport', 'Part des salaires cédés qu’une équipe sous le premier apron peut recevoir pour les petits montants (200 %).', S.tpe),
  partEchangeHaute: p(1.25, 'rapport', 'Part des salaires cédés qu’une équipe sous le premier apron peut recevoir pour les gros montants (125 %).', S.tpe),
  supplementEchange: p(250_000, 'dollars', 'Supplément ajouté aux parts de 200 % et 125 % ; un échange qui laisse l’équipe à moins de 250 000 $ au-dessus du plafond n’a pas à respecter la correspondance.', S.tpe),
  partEchangeApron: p(1, 'rapport', 'Une équipe au-dessus d’un apron après l’échange ne peut recevoir plus de 100 % des salaires cédés.', S.tpe),
  agregationInterditeDeuxiemeApron: p(true, 'booléen', 'Au-dessus du second apron, une équipe ne peut pas additionner les salaires de plusieurs joueurs pour en recevoir un.', S.aprons),
  saisonsBird: p(3, 'saisons', 'Saisons avec la même équipe, sans en changer comme agent libre, pour avoir les droits de Bird (un échange ne remet pas l’horloge à zéro).', S.bird),
  saisonsEarlyBird: p(2, 'saisons', 'Saisons avec la même équipe pour avoir les droits « Early Bird ».', S.earlyBird),
  dureeMaxBird: p(5, 'saisons', 'Durée maximale d’un contrat signé avec les droits de Bird.', S.bird),
  dureeMaxAutre: p(4, 'saisons', 'Durée maximale d’un contrat signé avec les droits Early Bird ou Non-Bird.', S.earlyBird),
  hausseMaxBird: p(0.08, 'part par saison', 'Hausse annuelle maximale d’un contrat signé avec les droits de Bird ou Early Bird.', S.bird),
  hausseMaxAutre: p(0.05, 'part par saison', 'Hausse annuelle maximale d’un contrat signé avec les droits Non-Bird (et, dans le jeu, avec l’espace ou une exception).', S.nonBird),
  earlyBird: p(
    { partDuPrecedent: 1.75, dureeMin: 2 },
    'rapport, saisons',
    'Early Bird : au plus 175 % du salaire précédent (ou 105 % du salaire moyen de la ligue, non relevé, non appliqué), contrat d’au moins deux saisons.',
    S.earlyBird,
  ),
  nonBird: p(
    { partDuPrecedent: 1.2, partDuMinimum: 1.2 },
    'rapport',
    'Non-Bird : au plus le plus grand de 120 % du salaire précédent et de 120 % du salaire minimum.',
    S.nonBird,
  ),
  agentLibreRestreint: p(
    { ancienneteMax: 3, partVeteran: 1.35, minimumPlus: 200_000, partRookiePremierChoix: 1.4, partRookieDernierChoix: 1.6, delaiAlignementJours: 2 },
    'saisons, rapports, dollars, jours',
    'Agent libre restreint : fin d’un contrat de l’échelle des rookies (1er tour) ou trois saisons d’expérience au plus. Offre qualificative : 135 % du salaire précédent ou le minimum + 200 000 $ ; 140 % (1er choix) à 160 % (30e choix) du dernier salaire de l’échelle pour un rookie (classes 2023 et suivantes ; entre les deux, interpolation linéaire, choix du jeu). L’équipe d’origine a deux jours pour s’aligner sur une offre (NBA.com, primaire).',
    S.qo,
  ),
  ballottage: p(
    { delaiJours: 2, etalementFacteur: 2, etalementPlus: 1, etalementGarantiMin: 500_000 },
    'jours, rapport, dollars',
    'Un joueur coupé reste 48 heures en ballottage (priorité au plus mauvais bilan). Étalement : le salaire garanti restant (plus de 500 000 $) se répartit sur deux fois les saisons restantes, plus une ; coupé après le 31 août, la saison en cours se paie normalement (Hoops Rumors, Stretch Provision).',
    S.waivers,
  ),
  choixFuturs: p(
    { anneesMax: 7, stepien: true, gelDeuxiemeApronAnnees: 7 },
    'années',
    'Choix échangeables jusqu’à sept ans (Hoops Rumors, 12/2024) ; règle Stepien : jamais sans 1er tour deux Drafts futures de suite (Hoops Rumors, 05/2024) ; au-delà du second apron en fin de saison, le 1er tour à sept ans est gelé (Hoops Rumors, Tax Aprons).',
    S.septAns,
  ),
  delaiEchangeApresSignature: p(
    { mois: 3, dateMin: '12-15' },
    'mois, date',
    'Un agent libre signé ne peut pas être échangé pendant trois mois, ni avant le 15 décembre (le plus tard des deux).',
    S.troisMois,
  ),
  croissancePlafondMax: p(0.1, 'part par saison', 'Lissage de la CBA 2023 : le plafond augmente d’au plus 10 % par saison.', S.lissage),
  estimationsPlafond: p(
    [{ saison: '2027-28', plafondSalarial: 176_000_000, seuilTaxe: 213_000_000 }],
    'dollars',
    'Estimation de la NBA communiquée aux équipes le 12/09/2026 (The Athletic, reprise par NBC Sports) ; officielle en juin 2027.',
    S.estimation,
  ),
});
for (const x of [S.aprons, S.nbaAgents, S.stretch, S.stepien]) if (!cba.recoupements.some((y) => y.url === x.url)) cba.recoupements.push(x);
ecrire('data/cba/nba-2026-27.json', schemaCba, cba);

// --- 2. Transactions 2026-27. ---
ecrire('data/ligue/transactions-2026-27.json', schemaTransactions, {
  schemaVersion: 1,
  datasetId: 'basket-legends-transactions-2026-27',
  saison: '2026-2027',
  note: 'Dates des transactions de la saison 2026-27 (NBA.com, primaire) et volumes de la saison 2025-26 (Basketball-Reference, comptage automatique des paragraphes de la page des transactions : un paragraphe par échange ; signatures hors two-way, contrats de 10 jours et Exhibit 10). Les volumes servent de cibles à l’IA des GM (fourchettes du critère de sortie, data/modeles/marche-v1.json). Les dates des saisons suivantes sont décalées comme le calendrier (docs/CARRIERE.md § 6).',
  dates: {
    negociationsAgentsLibres: '2026-06-30',
    signaturesAgentsLibres: '2026-07-06',
    contratsGarantis: '2027-01-10',
    dateLimiteEchanges: '2027-02-11',
    dateLimiteBallottagePhaseFinale: '2027-03-01',
  },
  volumes: {
    echanges: {
      valeur: 58,
      du: '2025-06-20',
      au: '2026-02-05',
      definition: 'Échanges de la Draft 2025 à la date limite du 5 février 2026 : 10 autour de la Draft, 19 en juillet-octobre, 29 en saison.',
    },
    signatures: {
      valeur: 212,
      du: '2025-07-01',
      au: '2026-06-21',
      definition: 'Signatures de contrats standard de la saison 2025-26 (182 l’été, 10 avant la date limite, 20 après), two-way, 10 jours et Exhibit 10 exclus.',
    },
  },
  sources: [S.cles, S.bref2026, S.bref2025],
});

// --- 3. Choix 2028 à 2033. ---
const F: Record<string, string> = {
  ATL: 'atlanta', BOS: 'boston', BKN: 'brooklyn', CHA: 'charlotte', CHI: 'chicago', CLE: 'cleveland', DAL: 'dallas',
  DEN: 'denver', DET: 'detroit', GSW: 'golden-state', HOU: 'houston', IND: 'indianapolis', LAC: 'clippers', LAL: 'lakers',
  MEM: 'memphis', MIA: 'miami', MIL: 'milwaukee', MIN: 'minnesota', NOP: 'new-orleans', NYK: 'new-york',
  OKC: 'oklahoma-city', ORL: 'orlando', PHI: 'philadelphia', PHX: 'phoenix', POR: 'portland', SAC: 'sacramento',
  SAS: 'san-antonio', TOR: 'toronto', UTA: 'utah', WAS: 'washington',
};
const f = (code: string): string => {
  if (code.startsWith('@') || code === 'confisque') return code;
  const id = F[code];
  if (!id) throw new Error(`Code inconnu : ${code}`);
  return id;
};
type Attr = { beneficiaire: string; rangs?: [number, number]; sinon?: string };
const a = (code: string, rangs?: [number, number], sinon?: string): Attr => ({
  beneficiaire: f(code),
  ...(rangs ? { rangs } : {}),
  ...(sinon ? { sinon: f(sinon) } : {}),
});
const o = (code: string, rangs?: [number, number]) => ({ original: f(code), ...(rangs ? { rangs } : {}) });
const d = (v: string) => ({ detenteur: v });
type Membre = ReturnType<typeof o> | ReturnType<typeof d>;
const r = (membres: Membre[], attributions: Record<string, Attr[]>, description: string, extra: Record<string, unknown> = {}) => ({
  membres,
  attributions,
  ...extra,
  description,
});
const vers = (de: string, b: string, description = `${de} → ${b}`) => r([o(de)], { '1': [a(b)] }, description);
const confisque = (de: string) => r([o(de)], { '1': [a('confisque')] }, `${de} : choix confisqué par la ligue`);
const echangeDeRang = (x: string, y: string) => r([o(x), o(y)], { '2': [a(x), a(y)] }, `${x} prend le plus favorable de son choix et de celui de ${y}, ${y} l’autre`);
const si = (annee: number, tour: 1 | 2, original: string, detenteur: string, oui = true) => ({ annee, tour, original: f(original), detenteur: f(detenteur), oui });

const choix: Record<number, { t1: unknown[]; t2: unknown[]; geles?: string[]; ecarts: string[] }> = {
  2028: {
    t1: [
      r([o('UTA'), o('CLE')], { '2': [a('@uc-haut'), a('@uc-bas')] }, 'UTA peut échanger son choix contre celui de CLE'),
      r([d('@uc-haut'), o('LAL')], { '2': [a('UTA'), a('LAL')], '1': [a('UTA')] }, 'Le plus favorable de (UTA ou CLE) et de LAL à UTA, l’autre à LAL'),
      r([d('@uc-bas'), o('ATL')], { '2': [a('ATL'), a('CLE')], '1': [a('CLE')] }, 'ATL prend le plus favorable de son choix et du moins favorable de UTA et CLE ; CLE l’autre'),
      r([o('PHI')], { '1': [a('@phi-1-8', [1, 8], '@phi-9-30')] }, 'PHI : 1-8 gardé par PHI (sous condition des droits de BOS), 9-30 au montage de BKN'),
      r([o('LAC')], { '1': [a('BOS', [17, 30], '@phi-lac')] }, 'LAC : 17-30 à BOS, 1-16 à PHI (sous condition des droits de BOS)'),
      r([o('SAS'), o('BOS')], { '2': [a('SAS'), a('@bos-sas')] }, 'SAS prend le plus favorable de son choix et de celui de BOS ; BOS l’autre'),
      r([d('@phi-1-8'), d('@phi-lac')], { '2': [a('@phi-haut'), a('PHI')], '1': [a('@phi-haut')] }, 'Le plus favorable des choix de PHI (PHI 1-8, LAC 1-16) entre dans l’échange de rang avec BOS'),
      r([d('@bos-sas'), d('@phi-haut')], { '2': [a('BOS'), a('PHI')], '1': [a('BOS')] }, 'BOS prend le plus favorable de son choix et du meilleur choix de PHI ; PHI l’autre'),
      r(
        [d('@phi-9-30'), o('BKN'), o('PHX'), o('NYK')],
        { '4': [a('BKN'), a('BKN'), a('NYK'), a('@was-cand')], '3': [a('BKN'), a('NYK'), a('@was-cand')] },
        'Montage BKN-PHX-NYK (simplifié) : BKN prend les plus favorables, NYK le suivant, le moins favorable passe à l’échange de rang de WAS',
      ),
      r([d('@was-cand'), o('WAS')], { '2': [a('@was-haut'), a('PHX')] }, 'WAS prend le plus favorable de son choix et du moins favorable du montage BKN-PHX ; PHX l’autre'),
      r([o('POR'), o('MIL')], { '2': [a('POR'), a('@mil-bas')] }, 'POR prend le plus favorable de son choix et de celui de MIL'),
      r([d('@was-haut'), d('@mil-bas')], { '2': [a('WAS'), a('MIL')] }, 'WAS prend le plus favorable de son choix et du moins favorable de POR et MIL ; MIL l’autre'),
      echangeDeRang('CHA', 'MIN'),
      r([o('MIA')], { '1': [a('CHA')] }, 'MIA à CHA si le choix 2027 (protégé 1-14) n’a pas été transmis', { cas: [{ si: [si(2027, 1, 'MIA', 'CHA')], attributions: { '1': [a('MIA')] } }] }),
      echangeDeRang('OKC', 'DAL'),
      r([o('DEN')], { '1': [a('OKC', [6, 30])] }, 'DEN protégé 1-5, sinon à OKC, si le choix 2027 n’a pas été transmis', {
        cas: [{ si: [si(2027, 1, 'DEN', 'OKC')], attributions: { '1': [a('DEN')] } }],
      }),
      vers('ORL', 'POR', 'ORL → POR (via MEM)'),
    ],
    t2: [
      vers('ATL', 'BKN'),
      r([o('BOS')], { '1': [a('NYK', [46, 60], 'SAS')] }, 'BOS : 46-60 à NYK ; 31-45 à SAS si le 1er tour de BOS est le 1er choix, sinon gardé', {
        condition: { original: f('BOS'), rangs: [1, 1] },
        attributionsSinon: { '1': [a('NYK', [46, 60])] },
      }),
      r([o('GSW'), o('MIL'), o('OKC')], { '3': [a('BOS'), a('PHI'), a('PHI')] }, 'Le plus favorable de GSW, MIL et OKC à BOS, les deux autres à PHI'),
      r([o('PHI')], { '1': [a('BKN')] }, 'PHI à BKN si le 1er tour de PHI est entre 1 et 8, sinon gardé', {
        condition: { original: f('PHI'), rangs: [1, 8] },
        attributionsSinon: { '1': [a('PHI')] },
      }),
      vers('MEM', 'BKN', 'MEM → BKN (via PHX)'),
      r([o('DET')], { '1': [a('@det2', [31, 55], 'PHI')] }, 'DET : 31-55 au lot de DET, 56-60 à PHI'),
      r([o('CHA'), o('LAC')], { '2': [a('CHA'), a('@det2')] }, 'Le plus favorable de CHA et LAC à CHA, l’autre au lot de DET'),
      r([o('MIA')], { '1': [a('CHA')] }, 'MIA au lot de DET si DAL a transmis son 1er tour 2027 à CHA, sinon à CHA', {
        cas: [{ si: [si(2027, 1, 'DAL', 'CHA')], attributions: { '1': [a('@det2')] } }],
      }),
      vers('NYK', '@det2', 'NYK → lot de DET'),
      r(
        [d('@det2')],
        { '1': [a('UTA')], '2': [a('DET'), a('UTA')], '3': [a('DET'), a('DET'), a('UTA')], '4': [a('DET'), a('DET'), a('DET'), a('UTA')] },
        'Lot de DET : le moins favorable à UTA, les autres à DET',
      ),
      r([o('IND'), o('PHX')], { '2': [a('@ip-haut'), a('NYK')] }, 'Le moins favorable de IND et PHX à NYK'),
      r([d('@ip-haut'), o('CHI')], { '2': [a('CHI'), a('IND')] }, 'CHI prend le plus favorable de son choix et du meilleur de IND et PHX ; IND l’autre'),
      vers('CLE', 'UTA'),
      vers('UTA', 'SAC', 'UTA → SAC (via OKC)'),
      vers('DAL', 'LAC', 'DAL → LAC (via SAC et IND)'),
      r([o('DEN')], { '1': [a('WAS', [34, 60])] }, 'DEN : 31-33 gardé, 34-60 à WAS'),
      vers('MIN', 'DEN', 'MIN → DEN (via SAS)'),
      vers('HOU', 'CHA'),
      r([o('LAL'), o('WAS')], { '2': [a('ORL'), a('WAS')] }, 'Le plus favorable de LAL et WAS à ORL, l’autre à WAS'),
      vers('NOP', 'SAS'),
      vers('ORL', 'CHA'),
      vers('SAC', 'POR', 'SAC → POR (via CHI et MEM)'),
    ],
    ecarts: [
      '1er tour BOS : le choix reste à BOS s’il est le 1er (« 1 Own ») ; le fichier le soumet tout de même à l’échange de rang de SAS (cas du 1er rang simplifié).',
      '1er tour BKN-PHX-NYK-WAS : le cas particulier où NYK prend le 2e choix du groupe (selon le rang de PHI 9-30) est simplifié.',
    ],
  },
  2029: {
    t1: [
      r([o('BOS'), o('POR'), o('MIL')], { '3': [a('POR'), a('WAS'), a('POR')] }, 'Le plus et le moins favorable de BOS, POR et MIL à POR, le deuxième à WAS'),
      r([o('DAL'), o('PHX'), o('HOU')], { '3': [a('HOU'), a('HOU'), a('BKN')] }, 'Les deux plus favorables de DAL, PHX et HOU à HOU, l’autre à BKN'),
      vers('NYK', 'BKN'),
      vers('LAL', 'DAL'),
      r([o('UTA'), o('CLE'), o('MIN', [6, 30])], { '3': [a('UTA'), a('UTA'), a('CHA')], '2': [a('UTA'), a('CHA')] }, 'MIN protégé 1-5 ; les plus favorables de UTA, CLE et MIN 6-30 à UTA, le moins favorable à CHA (simplifié)'),
      r([o('DEN')], { '1': [a('DEN')] }, 'DEN 6-30 à OKC si le 1er tour 2027 a été transmis, ou si ni 2027 ni 2028 ne l’ont été', {
        cas: [
          { si: [si(2027, 1, 'DEN', 'OKC')], attributions: { '1': [a('OKC', [6, 30])] } },
          { si: [si(2027, 1, 'DEN', 'OKC', false), si(2028, 1, 'DEN', 'OKC', false)], attributions: { '1': [a('OKC', [6, 30])] } },
        ],
      }),
      confisque('IND'),
      r([o('PHI'), o('LAC', [4, 30])], { '2': [a('PHI'), a('LAC')], '1': [a('PHI')] }, 'LAC protégé 1-3 ; PHI prend le plus favorable de son choix et de LAC 4-30'),
      r([o('MEM'), o('ORL', [3, 30])], { '2': [a('MEM'), a('ORL')], '1': [a('MEM')] }, 'ORL protégé 1-2 ; MEM prend le plus favorable de son choix et de ORL 3-30'),
    ],
    t2: [
      r([o('ATL'), o('MIA')], { '2': [a('CHA'), a('OKC')] }, 'Le plus favorable de ATL et MIA à CHA, l’autre à OKC'),
      vers('CLE', 'ATL'),
      vers('BOS', 'OKC'),
      vers('DAL', 'BKN'),
      vers('GSW', 'BKN'),
      vers('MEM', 'BKN', 'MEM → BKN (via PHX)'),
      vers('PHX', 'NYK'),
      r([o('DEN')], { '1': [a('OKC')] }, 'DEN à CHA si DEN a transmis à OKC son premier 1er tour d’ici 2029, sinon à OKC', {
        cas: [
          { si: [si(2027, 1, 'DEN', 'OKC')], attributions: { '1': [a('CHA')] } },
          { si: [si(2028, 1, 'DEN', 'OKC')], attributions: { '1': [a('CHA')] } },
          { si: [si(2029, 1, 'DEN', 'OKC')], attributions: { '1': [a('CHA')] } },
        ],
      }),
      r([o('DET'), o('MIL'), o('NYK')], { '3': [a('DET'), a('DET'), a('CHI')] }, 'Les deux plus favorables de DET, MIL et NYK à DET, l’autre à CHI'),
      vers('HOU', 'MEM', 'HOU → MEM (via OKC, WAS et DAL)'),
      r([o('IND'), o('WAS')], { '2': [a('IND'), a('POR')] }, 'Le plus favorable de IND et WAS à IND, l’autre à POR'),
      vers('LAC', 'SAS', 'LAC → SAS (via PHI)'),
      vers('LAL', 'MEM', 'LAL → MEM (via WAS)'),
      vers('NOP', 'SAS'),
      vers('SAC', 'NYK', 'SAC → NYK (via WAS et HOU)'),
      r([o('MIN')], { '1': [a('CHA')] }, 'MIN à CHA si son 1er tour 2029 est transmis (6-30), sinon à UTA', {
        condition: { original: f('MIN'), rangs: [6, 30] },
        attributionsSinon: { '1': [a('UTA')] },
      }),
      r([o('ORL')], { '1': [a('MEM')] }, 'ORL à MEM si son 1er tour est entre 1 et 2, sinon gardé', {
        condition: { original: f('ORL'), rangs: [1, 2] },
        attributionsSinon: { '1': [a('ORL')] },
      }),
      vers('POR', 'MEM', 'POR → MEM (via PHI et IND)'),
    ],
    ecarts: [
      '1er tour CHA-MIN-UTA-CLE : le droit d’échange de rang de CHA avec MIN et le choix « le moins favorable » promis à PHX ne sont pas repris.',
      '1er tour IND : confisqué (choix détenu par LAC, confisqué par la ligue selon RealGM).',
    ],
  },
  2030: {
    t1: [
      r([o('SAS'), o('DAL')], { '2': [a('@sd-haut'), a('DAL')] }, 'SAS peut échanger son choix contre celui de DAL'),
      r([d('@sd-haut'), o('MIN', [2, 30])], { '2': [a('SAS'), a('MIN')], '1': [a('SAS')] }, 'MIN protégé 1 ; SAS prend le plus favorable de (SAS ou DAL) et de MIN 2-30, MIN l’autre'),
      r([o('DEN')], { '1': [a('DEN')] }, 'DEN 6-30 à OKC (seconde dette) si la première a été réglée et pas encore la seconde', {
        cas: [
          { si: [si(2027, 1, 'DEN', 'OKC'), si(2029, 1, 'DEN', 'OKC', false)], attributions: { '1': [a('OKC', [6, 30])] } },
          { si: [si(2028, 1, 'DEN', 'OKC')], attributions: { '1': [a('OKC', [6, 30])] } },
        ],
      }),
      r([o('GSW')], { '1': [a('MEM', [21, 30])] }, 'GSW : 1-20 gardé, 21-30 à MEM (via WAS et DAL)'),
      echangeDeRang('UTA', 'LAL'),
      r([o('WAS'), o('PHX')], { '2': [a('WAS'), a('@wp-bas')] }, 'WAS prend le plus favorable de son choix et de celui de PHX'),
      r([o('MEM'), d('@wp-bas')], { '2': [a('MEM'), a('PHX')] }, 'MEM prend le plus favorable de son choix et du moins favorable de WAS et PHX ; PHX l’autre'),
      r([o('POR'), o('MIL')], { '2': [a('POR'), a('@mp-bas')] }, 'POR prend le plus favorable de son choix et de celui de MIL'),
      r([d('@mp-bas'), o('MIA')], { '2': [a('MIL'), a('MIA')] }, 'MIL prend le plus favorable du moins favorable de POR et MIL et du choix de MIA ; MIA l’autre'),
      vers('ORL', 'MEM'),
      confisque('LAC'),
    ],
    t2: [
      vers('ATL', 'OKC'),
      vers('NYK', 'ATL', 'NYK → ATL (via POR)'),
      vers('BOS', 'BKN', 'BOS → BKN (via HOU)'),
      r([o('CHA')], { '1': [a('BOS', [56, 60])] }, 'CHA : 31-55 gardé, 56-60 à BOS'),
      r([o('PHX'), o('POR')], { '2': [a('@pp-haut'), a('WAS')] }, 'Le moins favorable de PHX et POR à WAS'),
      r([d('@pp-haut'), o('WAS')], { '2': [a('BOS'), a('PHI')] }, 'Le plus favorable du meilleur de PHX et POR et du choix de WAS à BOS, l’autre à PHI'),
      echangeDeRang('CHI', 'IND'),
      vers('CLE', 'SAS'),
      vers('DAL', 'BKN', 'DAL → BKN (via BOS et MEM)'),
      vers('LAL', 'BKN'),
      r([o('DEN'), o('HOU'), o('MIA')], { '3': [a('MEM'), a('OKC'), a('OKC')] }, 'Le plus favorable de DEN, HOU et MIA à MEM, les deux autres à OKC'),
      r([o('GSW')], { '1': [a('GSW')] }, 'GSW à MEM si GSW ne transmet pas son 1er tour à MEM, sinon gardé', {
        condition: { original: f('GSW'), rangs: [21, 30] },
        attributionsSinon: { '1': [a('MEM')] },
      }),
      r([o('LAC'), o('UTA')], { '2': [a('CHA'), a('UTA')] }, 'Le plus favorable de LAC et UTA à CHA, l’autre à UTA'),
      vers('TOR', 'LAC'),
      r([o('MEM')], { '1': [a('MIN', [51, 60])] }, 'MEM : 31-50 gardé, 51-60 à MIN'),
      vers('MIL', 'ORL'),
      vers('MIN', 'SAC', 'MIN → SAC (via DET et OKC)'),
      vers('SAC', 'SAS', 'SAC → SAS (via IND)'),
      echangeDeRang('ORL', 'NOP'),
      vers('PHI', 'NYK', 'PHI → NYK (via DAL)'),
    ],
    ecarts: ['1er tour CHA : le droit d’échange de rang de CHA avec MIN (recevant MIN, SAS ou DAL) n’est pas repris.', '1er tour LAC : confisqué.'],
  },
  2031: {
    t1: [
      vers('CLE', 'DEN'),
      vers('LAL', 'UTA'),
      vers('MIA', 'MIL'),
      vers('MIN', 'SAC', 'MIN → SAC (via SAS)'),
      vers('NYK', 'BKN'),
      vers('PHI', 'BOS'),
      vers('PHX', 'MEM', 'PHX → MEM (via UTA)'),
      vers('TOR', 'LAC'),
      confisque('LAC'),
      echangeDeRang('SAS', 'SAC'),
    ],
    t2: [
      r([o('HOU')], { '1': [a('@hou2', [31, 55], 'BOS')] }, 'HOU : 56-60 à BOS, 31-55 dans l’échange de rang d’ATL'),
      r([o('ATL'), d('@hou2')], { '2': [a('OKC'), a('HOU')], '1': [a('OKC')] }, 'Le plus favorable de ATL et HOU 31-55 à OKC, l’autre à HOU'),
      r([o('BOS'), o('CLE')], { '2': [a('UTA'), a('BOS')] }, 'Le plus favorable de BOS et CLE à UTA, l’autre à BOS'),
      vers('LAL', 'BKN'),
      vers('MIL', 'CHA'),
      vers('PHX', 'CHA'),
      vers('DEN', 'CHI', 'DEN → CHI (via PHX et CHA)'),
      vers('NYK', 'CHI', 'NYK → CHI (via CHA)'),
      r([o('GSW'), o('MIN')], { '2': [a('CHI'), a('DET')] }, 'Le plus favorable de GSW et MIN à CHI, l’autre à DET'),
      vers('DAL', 'DET', 'DAL → DET (via PHI et MEM)'),
      vers('DET', 'OKC'),
      vers('SAC', 'DEN', 'SAC → DEN (via SAS)'),
      r([o('IND'), o('MIA')], { '2': [a('WAS'), a('@im-bas')] }, 'Le plus favorable de IND et MIA à WAS'),
      r([o('MEM'), d('@im-bas')], { '2': [a('MEM'), a('IND')] }, 'MEM prend le plus favorable de son choix et du moins favorable de IND et MIA ; IND l’autre'),
      r([o('NOP'), o('ORL')], { '2': [a('ORL'), a('OKC')] }, 'Le plus favorable de NOP et ORL à ORL, l’autre à OKC'),
      vers('TOR', 'NOP'),
      vers('WAS', 'LAL'),
    ],
    ecarts: ['1er tour LAC : confisqué.'],
  },
  2032: {
    t1: [vers('DEN', 'BKN'), confisque('LAC')],
    t2: [
      vers('ATL', 'OKC'),
      vers('LAL', 'OKC', 'LAL → OKC (via ATL)'),
      vers('WAS', 'LAL'),
      vers('CLE', 'UTA'),
      vers('DAL', 'NYK'),
      vers('DEN', 'BKN'),
      vers('SAC', 'DEN', 'SAC → DEN (via CLE)'),
      vers('MIA', 'BKN'),
      vers('TOR', 'BKN'),
      vers('MIL', 'CHA'),
      vers('MIN', 'CHA'),
      r([o('HOU'), o('PHX')], { '2': [a('CHI'), a('PHX')] }, 'Le plus favorable de HOU et PHX à CHI, l’autre à PHX'),
      r([o('GSW')], { '1': [a('MEM', [51, 60])] }, 'GSW : 31-50 gardé, 51-60 à MEM'),
      r([o('MEM'), o('PHI')], { '2': [a('@mp2-haut'), a('PHI')] }, 'MEM peut échanger son choix contre celui de PHI'),
      r([d('@mp2-haut'), o('UTA')], { '2': [a('MEM'), a('WAS')] }, 'MEM prend le plus favorable de (MEM ou PHI) et de UTA, l’autre à WAS'),
    ],
    geles: ['boston', 'minnesota', 'phoenix'],
    ecarts: ['1er tour LAC : confisqué. 1ers tours de BOS, MIN et PHX gelés jusqu’en 2027-28 (second apron).'],
  },
  2033: {
    t1: [vers('LAL', 'UTA'), vers('MIA', 'MIL'), vers('MIN', 'CHA'), vers('PHX', 'CHA'), vers('TOR', 'LAC'), confisque('LAC')],
    t2: [
      vers('DAL', 'WAS'),
      vers('HOU', 'CHA'),
      vers('MIA', 'MIL'),
      vers('MIN', 'CHA'),
      vers('OKC', 'MEM'),
      vers('PHX', 'NYK'),
      vers('SAC', 'ATL'),
      vers('TOR', 'LAC'),
      vers('WAS', 'MEM'),
    ],
    geles: ['cleveland'],
    ecarts: [
      '1er tour LAC : confisqué. 1er tour de CLE gelé jusqu’en 2028-29 (second apron).',
      '2e tour : choix « très protégé et non précisé » de DET à LAC, et choix « non précisés » de NOP à MEM : non repris.',
    ],
  },
};
for (const [annee, c] of Object.entries(choix)) {
  ecrire(`data/draft/choix-${annee}.json`, schemaChoixDraft, {
    schemaVersion: 1,
    datasetId: `basket-legends-choix-${annee}`,
    annee: Number(annee),
    statut: 'a-recouper',
    note: `Propriété des choix de la Draft ${annee} au 25/11/2026 (échanges, protections, droits d’échange de rang, choix confisqués ou gelés). Les choix non cités restent à leur équipe. Relevé sur la page de synthèse de RealGM et reformulé ; les montages les plus complexes sont simplifiés (voir « ecarts »). À recouper avant publication (source secondaire). Les détenteurs « @… » sont des étapes de calcul ; « confisque » : choix retiré de la Draft.`,
    tours: { '1': c.t1, '2': c.t2 },
    ...(c.geles ? { geles: c.geles } : {}),
    ecarts: c.ecarts,
    sources: [S.realgm(Number(annee))],
  });
}

// --- 4. Horloge de Bird (saisons avec l'équipe, sans en changer comme agent libre). ---
const BREF: Record<string, string> = {
  ATL: 'atlanta', BOS: 'boston', BRK: 'brooklyn', CHO: 'charlotte', CHI: 'chicago', CLE: 'cleveland', DAL: 'dallas',
  DEN: 'denver', DET: 'detroit', GSW: 'golden-state', HOU: 'houston', IND: 'indianapolis', LAC: 'clippers', LAL: 'lakers',
  MEM: 'memphis', MIA: 'miami', MIL: 'milwaukee', MIN: 'minnesota', NOP: 'new-orleans', NYK: 'new-york',
  OKC: 'oklahoma-city', ORL: 'orlando', PHI: 'philadelphia', PHO: 'phoenix', POR: 'portland', SAC: 'sacramento',
  SAS: 'san-antonio', TOR: 'toronto', UTA: 'utah', WAS: 'washington',
};
const fichierPrive = (chemin: string) => {
  const c = join(prive, chemin);
  if (!existsSync(c)) throw new Error(`Relevé privé absent : ${c}`);
  return readFileSync(c, 'utf8');
};
const csv = (texte: string) => {
  const [tete, ...lignes] = texte.trim().split(/\r?\n/);
  const cols = tete!.split(',');
  return lignes.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i]!, v])));
};
const brid: Record<string, string> = {};
const equipes26: Record<string, string[]> = {};
for (const l of csv(fichierPrive('statistiques-2025-26/bref-totaux-saison-reguliere.csv'))) {
  brid[l.id!] = l.brid!;
  const liste = l.equipes ? l.equipes.split('/') : [l.team!];
  equipes26[l.brid!] = liste.map((t) => BREF[t] ?? t);
}
for (const l of csv(fichierPrive('statistiques-2025-26/bref-totaux-2024-25-absents-2025-26.csv'))) brid[l.id!] ??= l.brid!;
const lignes = (texte: string) => texte.split(/\r?\n/).filter((l) => l && !l.startsWith('#')).join(';');
const equipes25: Record<string, string[]> = {};
for (const x of lignes(fichierPrive('anciennete-2026-27/bref-equipes-2024-25.txt')).split(';')) {
  const [b, t] = x.split(':');
  if (b && t) equipes25[b] = t.split(',').map((e) => BREF[e] ?? e);
}
const echanges: { brid: string; date: string }[] = lignes(fichierPrive('anciennete-2026-27/bref-echanges-2025-2026.txt'))
  .split(';')
  .filter(Boolean)
  .map((x) => {
    const [b, dt] = x.split('@');
    return { brid: b!, date: dt! };
  });
const echange = (b: string, du: string, au: string) => echanges.some((e) => e.brid === b && e.date >= du && e.date <= au);

const contrats = lire('data/contrats/2026-27.json') as ReturnType<typeof schemaContrats.parse>;
const franchiseDe: Record<string, string> = {};
for (const ligne of csv(fichierPrive('correspondance.csv'))) franchiseDe[ligne.id!] = ligne.franchiseId!;
const bilanBird = { releve: 0, approximation: 0 };
for (const [id, c] of Object.entries(contrats.joueurs)) {
  const F0 = franchiseDe[id];
  let s = 0;
  let statut: 'releve' | 'approximation' = 'releve';
  const b = brid[id];
  const t26 = b ? equipes26[b] : undefined;
  const t25 = b ? equipes25[b] : undefined;
  // Horloge d'une équipe donnée à la fin de 2025-26 : 2025-26 compte, 2024-25 aussi si le joueur n'a changé d'équipe que par échange.
  const horloge2026 = (): number => {
    if (!t26) return 0;
    // Arrivée en cours de saison sans échange (coupé puis signé) : l'horloge repart à cette saison.
    if (t26.length > 1 && !echange(b!, '2025-07-01', '2026-06-21')) return 1;
    const debut = t26[0]!;
    if (!t25) return 1;
    const continu = t25.at(-1) === debut || echange(b!, '2025-04-14', '2025-10-20') || t26.length > 1;
    return continu ? 2 : 1;
  };
  if (c.draft?.annee === 2026) s = 0;
  else if (c.draft && c.draft.tour === 1 && c.draft.annee >= 2023) s = Math.min(3, 2026 - c.draft.annee);
  else if (t26) {
    if (t26.at(-1) === F0) s = horloge2026();
    else s = echange(b!, '2026-06-14', '2026-11-17') ? horloge2026() : 0;
  } else if (t25) {
    statut = 'approximation';
    s = t25.at(-1) === F0 ? 2 : 0;
  } else {
    statut = 'approximation';
    s = 0;
  }
  c.saisonsAvecEquipe = s;
  c.saisonsAvecEquipeStatut = statut;
  bilanBird[statut]++;
}
contrats.champs.saisonsAvecEquipe = {
  unite: 'saisons',
  definition:
    'Horloge de Bird au début de 2026-27 : saisons complètes ou partielles avec l’équipe actuelle (2024-25 et 2025-26), sans en changer comme agent libre ; un échange ne la remet pas à zéro (Hoops Rumors, Bird Rights). Relevé : équipes de chaque saison et échanges de Basketball-Reference ; joueur de l’échelle des rookies : saisons depuis sa Draft. Approximation (statut) : joueur sans statistique en 2025-26 (2 s’il a fini 2024-25 avec la même équipe, sinon 0). Les coupés-resignés et la saison 2023-24 ne sont pas relevés (plafond à 3 sans effet : les droits de Bird s’acquièrent en fin de 2026-27 dès 2).',
};
contrats.champs.saisonsAvecEquipeStatut = { unite: 'statut', definition: '« releve » ou « approximation » (voir saisonsAvecEquipe).' };
ecrire('data/contrats/2026-27.json', schemaContrats, contrats);
console.log(`Horloge de Bird : ${bilanBird.releve} relevées, ${bilanBird.approximation} approximations.`);

// --- 5. Modèles de la tranche 9. ---
ecrire('data/modeles/marche-v1.json', schemaModeleMarche, {
  schemaVersion: 1,
  datasetId: 'basket-legends-modele-marche',
  version: 'marche-v1',
  statut: 'proposition',
  note: 'Modèle du marché de la tranche 9 (25/11/2026) : valeur d’un joueur, force d’une équipe, valeur des choix, stratégies et personnalité des GM de l’IA, agents libres, échanges de l’IA et critère de sortie (« 10 saisons au pilote automatique sans dérive »). Le salaire de marché selon la note est calé sur les moyennes des contrats 2026-27 des vétérans (hors échelle des rookies, data/contrats/2026-27.json) ; tous les autres paramètres sont des choix du modèle, sans cible sourcée, à valider par Antonin. Les volumes d’échanges et de signatures visés viennent de data/ligue/transactions-2026-27.json. Personnalité des joueurs : traits de personnage générés (réponse 35), jamais présentés comme relevés.',
  valeur: {
    salaireSelonNote: [
      [55, 0.018],
      [62, 0.022],
      [67, 0.026],
      [71, 0.041],
      [73, 0.056],
      [75, 0.071],
      [77, 0.12],
      [79, 0.165],
      [81, 0.195],
      [83, 0.245],
      [86, 0.265],
      [89, 0.3],
      [92, 0.35],
    ],
    calage:
      'Moyennes de la part du plafond (164,961 M$) des contrats standard 2026-27 des vétérans par tranche de note (328 contrats hors échelle des rookies) : moins de 64 : 2,2 % ; 64-68 : 2,9 % ; 68-70 : 2,5 % ; 70-72 : 4,1 % ; 72-74 : 5,6 % ; 74-76 : 7,1 % ; 76-78 : 12,8 % ; 78-80 : 16,8 % ; 80-82 : 19,3 % ; 82-84 : 26,4 % ; 84-87 : 24,5 % ; 87-90 : 26,8 % ; 90 et plus : 30,2 %, lissées pour rester croissantes. Les moyennes plutôt que les médianes : avec les médianes, plus basses (salaires asymétriques), la masse salariale de la ligue s’érodait au fil des saisons (0 à 2 équipes à la taxe).',
    primeStar: { seuil: 80, parPoint: 0.06 },
    horizon: 3,
    actualisation: 0.85,
    retenueApresContrat: 0.5,
  },
  force: { poids: [1, 0.95, 0.9, 0.85, 0.8, 0.6, 0.5, 0.35, 0.25], valeurPoint: 12_000_000 },
  choix: {
    valeurParRang: [
      [1, 30_000_000],
      [3, 24_000_000],
      [5, 19_000_000],
      [10, 12_000_000],
      [14, 9_000_000],
      [20, 6_000_000],
      [30, 3_500_000],
      [31, 1_500_000],
      [45, 800_000],
      [60, 300_000],
    ],
    actualisationParAn: 0.9,
    incertitudeParAn: 0.2,
  },
  strategies: {
    pretendant: { rangForceMax: 6, present: 1.6, futur: 0.6 },
    playoffs: { rangForceMax: 14, present: 1.1, futur: 0.9 },
    transition: { rangForceMax: 22, present: 0.5, futur: 1.1 },
    reconstruction: { rangForceMax: 30, present: 0.3, futur: 1.5 },
  },
  gm: { patience: [0.3, 0.9], aversionTaxe: 0.7, aversionTaxeRecidiviste: 0.4, margeAcceptation: 0.05, refusAvantFermeture: 3 },
  personnalite: { moyenne: 50, ecartType: 15, bornes: [10, 90] },
  agentsLibres: {
    journees: 10,
    baisseDemandeParJournee: 0.025,
    demandePlancher: 0.75,
    poids: { argent: 1, victoire: 0.25, role: 0.2, fidelite: 0.1 },
    dureeSelonAge: [
      [24, 4],
      [28, 4],
      [31, 3],
      [33, 2],
      [50, 1],
    ],
    offresParEquipeParJournee: 2,
    hausseParDefaut: 0.05,
    seuilOptionJoueur: 1,
    seuilOffreQualificative: 0.9,
    noteMinNba: 60,
    fideliteEquipe: 4_000_000,
    valeurEspaceInutilise: 0.8,
  },
  echangesIa: { tentativesParJourSaison: 2, tentativesParJourneeIntersaison: 20, candidatsParTentative: 8, propositionsAuGmParSaison: 4 },
  critereSortie: {
    saisons: 10,
    standardParEquipe: [13, 15],
    equipesTaxe: [1, 18],
    masseSurTaxe: [0.8, 1.05],
    equipesDeuxiemeApron: [0, 6],
    correlationSalaireNoteMin: 0.5,
    noteMaxAgentLibreNonSigne: 75,
    joueurs85ParEquipeMax: 4,
    echangesParSaison: [20, 100],
    signaturesParSaison: [80, 320],
    giniForceMax: 0.06,
  },
});
ecrire('data/modeles/staff-v1.json', schemaModeleStaff, {
  schemaVersion: 1,
  datasetId: 'basket-legends-modele-staff',
  version: 'staff-v1',
  statut: 'proposition',
  note: 'Modèle du staff de la tranche 9 (25/11/2026, réponses 18, 39 et 40). Quatre postes par franchise, staff original généré (noms des banques de noms, compétences tirées). Effets bornés et de moyenne nulle (réponse 39) : précision du scouting de la Draft, durée des blessures, progression des joueurs de 25 ans au plus. L’entraîneur fixe les plans de jeu de son équipe (réponse 40), répartis autour du plan par défaut de sorte que l’effet moyen sur la ligue reste nul (vérifié avec `npm run sonde -- --staff` : le rythme lent réduit davantage les pertes que le rythme rapide ne les augmente, d’où un peu plus d’entraîneurs « rapides »). Tous les paramètres sont des choix du modèle, à valider par Antonin.',
  postes: [
    { id: 'entraineur', libelle: 'Entraîneur principal', competences: ['tactique', 'motivation'] },
    { id: 'developpement', libelle: 'Entraîneur du développement', competences: ['developpement'] },
    { id: 'recruteur', libelle: 'Directeur du recrutement', competences: ['scouting'] },
    { id: 'medical', libelle: 'Responsable médical', competences: ['medical'] },
  ],
  competence: { moyenne: 60, ecartType: 10, bornes: [35, 90], reference: 60, etendue: 30 },
  effets: { scouting: [0.85, 1.15], blessures: [0.85, 1.15], progression: { max: 0.2, ageMax: 25 } },
  preferences: {
    rythme: { lent: 0.25, normal: 0.5, rapide: 0.25 },
    defense: { individuelle: 0.9, zone: 0.1 },
    troisPoints: { moins: 0.25, normal: 0.5, plus: 0.25 },
  },
  libresParPoste: 6,
  ages: [32, 68],
});
