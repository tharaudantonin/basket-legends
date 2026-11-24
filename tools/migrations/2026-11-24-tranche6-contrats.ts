// Migration de la tranche 6 (24 novembre 2026) — paramètres de la CBA 2026-27 et contrats des joueurs.
//
// Entrée : les relevés bruts du dossier privé (`basket-legends-prive/contrats-2026-27/`), faits le 24/11/2026 dans le
// navigateur, page par page :
// - `bref-contrats-joueurs.csv` : Basketball-Reference, « 2026-27 NBA Player Contracts » (salaires par saison, options
//   du joueur « J » ou de l'équipe « E », montant garanti) ;
// - `hoopsrumors-two-way.csv` : Hoops Rumors, suivi des contrats two-way 2026/27 (mis à jour le 21/11/2026) ;
// - `nba-index-joueurs.csv` : NBA.com, index des joueurs (première saison NBA, draft).
// Ils contiennent les vrais noms : ils restent hors du dépôt. Le rattachement aux identifiants du jeu (j0001…) se fait
// par le nom réel normalisé et la franchise de `correspondance.csv`.
//
// Sortie (dans le dépôt, sans nom réel ni identifiant de fournisseur) :
// 1. data/cba/nba-2026-27.json : paramètres de la CBA pour 2026-27, chacun avec sa source ;
// 2. data/contrats/2026-27.json : contrat de chaque joueur des effectifs et situation salariale publiée de chaque équipe.
//
// Usage : npx tsx tools/migrations/2026-11-24-tranche6-contrats.ts [dépôt] [dossier privé]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();
const prive = process.argv[3] ?? join(depot, '..', 'basket-legends-prive');
const releves = join(prive, 'contrats-2026-27');
const CONSULTE = '2026-11-24';
const SAISON_DEBUT = 2026;
const SAISONS = ['2026-27', '2027-28', '2028-29', '2029-30', '2030-31', '2031-32'];

const ecrire = (chemin: string, contenu: unknown) => {
  mkdirSync(join(depot, chemin, '..'), { recursive: true });
  writeFileSync(join(depot, chemin), JSON.stringify(contenu, null, 2) + '\n', 'utf8');
  console.log(`Écrit : ${chemin}`);
};

/** Un CSV simple, avec des champs éventuellement entre guillemets (sans guillemet échappé). */
function lireCsv(chemin: string): Record<string, string>[] {
  const [entete, ...lignes] = readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
  const decouper = (l: string) => [...l.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => m[2] ?? m[1] ?? '').slice(0, -1);
  const cles = decouper(entete ?? '');
  return lignes.map((l) => {
    const v = decouper(l);
    return Object.fromEntries(cles.map((c, i) => [c, v[i] ?? '']));
  });
}

const normaliser = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
    .replace(/[^a-z]/g, '');
/** Prénoms écrits différemment selon les sources (nom réel normalisé de la source → nom réel normalisé du jeu). */
const ALIAS: Record<string, string> = { ronholland: 'ronaldholland' };
const cle = (nom: string) => ALIAS[normaliser(nom)] ?? normaliser(nom);

const EQUIPES: Record<string, string> = {
  ATL: 'atlanta', BOS: 'boston', BRK: 'brooklyn', BKN: 'brooklyn', CHO: 'charlotte', CHA: 'charlotte', CHI: 'chicago',
  CLE: 'cleveland', DAL: 'dallas', DEN: 'denver', DET: 'detroit', GSW: 'golden-state', HOU: 'houston', IND: 'indianapolis',
  LAC: 'clippers', LAL: 'lakers', MEM: 'memphis', MIA: 'miami', MIL: 'milwaukee', MIN: 'minnesota', NOP: 'new-orleans',
  NYK: 'new-york', OKC: 'oklahoma-city', ORL: 'orlando', PHI: 'philadelphia', PHO: 'phoenix', PHX: 'phoenix',
  POR: 'portland', SAC: 'sacramento', SAS: 'san-antonio', TOR: 'toronto', UTA: 'utah', WAS: 'washington',
};

// --- 1. Paramètres de la CBA 2026-27. ---

const source = (fournisseur: string, titre: string, url: string, niveau: 'primaire' | 'secondaire') => ({
  fournisseur,
  titre,
  url,
  niveau,
  consulteLe: CONSULTE,
});
const S = {
  nba: source('NBA Communications', 'NBA sets Salary Cap for 2026-27 season at $164.961 million (30/06/2026)', 'https://pr.nba.com/2026-27-salary-cap/', 'primaire'),
  maximums: source('Hoops Rumors', 'NBA Maximum Salaries For 2026/27', 'https://www.hoopsrumors.com/2026/06/nba-maximum-salaries-for-2026-27.html', 'secondaire'),
  minimums: source('Hoops Rumors', 'NBA Minimum Salaries For 2026/27', 'https://www.hoopsrumors.com/2026/07/nba-minimum-salaries-for-2026-27.html', 'secondaire'),
  exceptions: source('Hoops Rumors', 'Values Of 2026/27 Mid-Level, Bi-Annual Exceptions', 'https://www.hoopsrumors.com/2026/07/values-of-2026-27-mid-level-bi-annual-exceptions.html', 'secondaire'),
  twoWay: source('Hoops Rumors', '2026/27 NBA Two-Way Contract Tracker (mis à jour le 21/11/2026)', 'https://www.hoopsrumors.com/2026/07/2026-27-nba-two-way-contract-tracker.html', 'secondaire'),
  taxe: source('SalarySwish', '2026-27 Luxury Tax Tracker (barème de la CBA 2023, Article VII)', 'https://www.salaryswish.com/luxury-tax/2027', 'secondaire'),
  plafonds: source('SalarySwish', 'NBA Salary Cap History (recoupement des montants officiels)', 'https://www.salaryswish.com/salary-cap/2027', 'secondaire'),
  equipes: source('SalarySwish', 'NBA Salary Cap Tracker — 2026-27 Salary Cap (masse de chaque équipe, plafond strict)', 'https://www.salaryswish.com/', 'secondaire'),
  effectif: source('Hoops Rumors', '2026/27 NBA Two-Way Contract Tracker (15 contrats standard et 3 two-way)', 'https://www.hoopsrumors.com/2026/07/2026-27-nba-two-way-contract-tracker.html', 'secondaire'),
  cba: source('NBPA', 'Collective Bargaining Agreement 2023 (texte de référence, non relu pour cette tranche)', 'https://www.nbpa.com/cba', 'primaire'),
};
const p = <T>(valeur: T, unite: string, definition: string, src: ReturnType<typeof source>) => ({ valeur, unite, definition, source: src });

const cba = {
  schemaVersion: 1,
  datasetId: 'basket-legends-cba-nba-2026-27',
  saison: '2026-2027',
  note: 'Paramètres de la convention collective (CBA 2023 NBA-NBPA) pour la saison 2026-27. Montants officiels de la NBA ; barèmes relevés chez Hoops Rumors et SalarySwish (sources secondaires à recouper avec le texte de la CBA avant publication). Les montants maximum valent exactement 25, 30 et 35 % du plafond, comme le prévoit la CBA.',
  parametres: {
    plafondSalarial: p(164961000, 'dollars', 'Salary Cap : au-dessus, une équipe ne peut plus signer avec son espace salarial.', S.nba),
    seuilTaxe: p(200428000, 'dollars', 'Tax Level : au-dessus en fin de saison régulière, l’équipe paie la taxe de luxe.', S.nba),
    premierApron: p(209015000, 'dollars', 'First Apron : au-dessus, l’équipe perd des outils (mid-level non contribuable, exception bi-annuelle…).', S.nba),
    deuxiemeApron: p(221686000, 'dollars', 'Second Apron : au-dessus, l’équipe perd aussi la mid-level contribuable.', S.nba),
    masseMinimale: p(148465000, 'dollars', 'Minimum Team Salary : une équipe en dessous en fin de saison verse la différence à ses joueurs.', S.nba),
    midLevelNonContribuable: p(15044000, 'dollars par saison', 'Non-Taxpayer Mid-Level Exception (jusqu’à 4 ans) ; l’utiliser plafonne strictement la masse au premier apron.', S.nba),
    midLevelContribuable: p(6064000, 'dollars par saison', 'Taxpayer Mid-Level Exception (jusqu’à 2 ans) ; l’utiliser plafonne strictement la masse au second apron.', S.nba),
    midLevelEspace: p(9366000, 'dollars par saison', 'Room Mid-Level Exception (jusqu’à 3 ans), pour une équipe passée sous le plafond.', S.nba),
    exceptionBiannuelle: p(5477000, 'dollars par saison', 'Bi-Annual Exception (jusqu’à 2 ans, une année sur deux) ; l’utiliser plafonne strictement la masse au premier apron.', S.exceptions),
    salaireMaximum: p(
      [
        { ancienneteMin: 0, ancienneteMax: 6, partDuPlafond: 0.25, montant: 41240250 },
        { ancienneteMin: 7, ancienneteMax: 9, partDuPlafond: 0.3, montant: 49488300 },
        { ancienneteMin: 10, ancienneteMax: null, partDuPlafond: 0.35, montant: 57736350 },
      ],
      'dollars pour la première saison',
      'Salaire maximum selon les années d’expérience NBA.',
      S.maximums,
    ),
    salaireMinimum: p(
      [1357763, 2185116, 2449421, 2537526, 2625627, 2845883, 3066143, 3286399, 3506659, 3524115, 3876529],
      'dollars, par année d’expérience (0 à 10 et plus)',
      'Salaire minimum d’un nouveau contrat signé en 2026-27 selon les années d’expérience NBA (rang 10 : 10 ans et plus).',
      S.minimums,
    ),
    minimumImputeVeteran: p(
      2449421,
      'dollars',
      'Un vétéran de 3 ans d’expérience ou plus signé au minimum pour un an ne compte que pour le minimum d’un joueur de 2 ans (la ligue rembourse la différence).',
      S.minimums,
    ),
    salaireTwoWay: p(678882, 'dollars', 'Salaire d’un contrat two-way (moitié du minimum d’un débutant) ; il ne compte pas dans la masse salariale.', S.twoWay),
    matchsMaxTwoWay: p(50, 'matchs', 'Un joueur two-way peut figurer dans l’effectif actif de 50 matchs de saison régulière au plus.', S.twoWay),
    twoWayEnPhaseFinale: p(false, 'booléen', 'Les joueurs two-way ne peuvent pas jouer le Play-In ni les playoffs (sauf promotion avant la fin de la saison régulière).', S.twoWay),
    contratsStandardMax: p(15, 'joueurs', 'Contrats standard au plus en saison régulière.', S.effectif),
    contratsTwoWayMax: p(3, 'joueurs', 'Contrats two-way au plus.', S.effectif),
    taxe: p(
      {
        largeurTranche: 6064000,
        taux: [1.0, 1.25, 3.5, 4.75],
        tauxRecidiviste: [3.0, 3.25, 5.5, 6.75],
        hausseParTrancheSuivante: 0.5,
      },
      'dollars ; dollars de taxe par dollar au-dessus du seuil',
      'Barème de la taxe de luxe depuis 2025-26 : tranches de 6,064 M$ (5 M$ indexés sur le plafond depuis 2024-25), taux croissants, + 0,50 par tranche au-delà de la quatrième. Taux « récidiviste » pour une équipe taxée 3 saisons sur les 4 dernières.',
      S.taxe,
    ),
  },
  recoupements: [S.plafonds, S.cba],
};
ecrire('data/cba/nba-2026-27.json', cba);

// --- 2. Contrats des joueurs. ---

const correspondance = lireCsv(join(prive, 'correspondance.csv'));
const parCle = new Map<string, Record<string, string>[]>();
for (const c of correspondance) parCle.set(cle(c.nomReel!), [...(parCle.get(cle(c.nomReel!)) ?? []), c]);
/** L'identifiant du jeu pour un nom réel et une équipe (la même franchise, sinon le seul homonyme). */
const trouver = (nom: string, equipe: string | undefined): { id: string; franchise: string; memeEquipe: boolean } | undefined => {
  const candidats = parCle.get(cle(nom)) ?? [];
  const meme = candidats.find((c) => c.franchiseId === equipe);
  if (meme) return { id: meme.id!, franchise: meme.franchiseId!, memeEquipe: true };
  if (candidats.length === 1) return { id: candidats[0]!.id!, franchise: candidats[0]!.franchiseId!, memeEquipe: false };
  return undefined;
};

const contratsBref = lireCsv(join(releves, 'bref-contrats-joueurs.csv'));
const twoWay = lireCsv(join(releves, 'hoopsrumors-two-way.csv'));
const index = lireCsv(join(releves, 'nba-index-joueurs.csv'));

type Option = 'joueur' | 'equipe';
interface Contrat {
  type: 'standard' | 'two-way' | 'non-releve';
  salaires: { saison: string; montant: number; option?: Option }[];
  garanti: number | null;
  /** Années depuis la première saison NBA (NBA.com) : approximation des années d'expérience de la CBA. */
  anciennete: number | null;
  draft: { annee: number; tour: number; rang: number } | null;
  sources: string[];
  note?: string;
}
const contrats: Record<string, Contrat> = {};
// Joueurs listés à la fois avec un contrat standard (Basketball-Reference) et en two-way (Hoops Rumors) : le two-way
// est confirmé par la situation de l'équipe chez SalarySwish (15 contrats standard et 3 two-way au 24/11/2026).
const TWO_WAY_CONFIRME = new Set(['j0293']);
const conflits: string[] = [];

// Contrats standard : la ligne de la franchise du joueur ; une ligne chez une autre équipe est une somme restant due
// après une libération (argent mort de cette équipe), sauf si le joueur n'a aucune ligne chez sa franchise.
const lignesParJoueur = new Map<string, { l: Record<string, string>; memeEquipe: boolean }[]>();
let ignorees = 0;
for (const l of contratsBref) {
  const t = trouver(l.nom!, EQUIPES[l.equipe!]);
  if (!t) {
    ignorees++;
    continue;
  }
  lignesParJoueur.set(t.id, [...(lignesParJoueur.get(t.id) ?? []), { l, memeEquipe: t.memeEquipe }]);
}
const estTwoWay = new Set(
  twoWay.map((x) => trouver(x.nom!, x.equipe)).filter((t): t is NonNullable<typeof t> => Boolean(t?.memeEquipe)).map((t) => t.id),
);
for (const c of correspondance) {
  const lignes = lignesParJoueur.get(c.id!) ?? [];
  const chezLui = lignes.find((x) => x.memeEquipe);
  const nba = index.find((x) => cle(x.nom!) === cle(c.nomReel!));
  const anciennete = nba ? SAISON_DEBUT - Number(nba.debut) : null;
  const draft = nba?.draftAnnee ? { annee: Number(nba.draftAnnee), tour: Number(nba.draftTour), rang: Number(nba.draftRang) } : null;
  const commun = { anciennete, draft };
  if (chezLui && lignes.some((x) => !x.memeEquipe)) {
    // Libéré par une autre équipe, puis signé par sa franchise : Basketball-Reference répète les salaires de l'ancien
    // contrat sur les deux lignes ; seul le montant garanti de la ligne de sa franchise décrit le nouveau contrat.
    const montant = Number(chezLui.l.garanti);
    if (!montant) throw new Error(`${c.id} : nouveau contrat sans montant garanti`);
    contrats[c.id!] = {
      type: 'standard',
      salaires: [{ saison: '2026-27', montant }],
      garanti: montant,
      ...commun,
      sources: ['basketball-reference', ...(nba ? ['nba.com'] : [])],
      note: 'signé après avoir été libéré par une autre équipe : salaire 2026-27 = montant garanti publié ; durée au-delà non relevée',
    };
  } else if (chezLui && !(estTwoWay.has(c.id!) && TWO_WAY_CONFIRME.has(c.id!))) {
    const l = chezLui.l;
    const salaires = SAISONS.flatMap((saison, i) => {
      const montant = l[`s${i + 1}`];
      if (!montant) return [];
      const o = l[`o${i + 1}`];
      return [{ saison, montant: Number(montant), ...(o === 'J' ? { option: 'joueur' as const } : o === 'E' ? { option: 'equipe' as const } : {}) }];
    });
    contrats[c.id!] = {
      type: 'standard',
      salaires,
      garanti: l.garanti ? Number(l.garanti) : null,
      ...commun,
      sources: ['basketball-reference', ...(nba ? ['nba.com'] : [])],
      ...(salaires[0]?.saison !== '2026-27' ? { note: 'aucun salaire 2026-27 relevé' } : {}),
    };
  } else if (estTwoWay.has(c.id!)) {
    if (chezLui)
      conflits.push(
        `${c.id} : contrat standard chez Basketball-Reference, two-way chez Hoops Rumors et SalarySwish (3 two-way, 15 contrats standard) : two-way retenu`,
      );
    contrats[c.id!] = { type: 'two-way', salaires: [], garanti: null, ...commun, sources: ['hoops-rumors', ...(nba ? ['nba.com'] : [])] };
  } else {
    contrats[c.id!] = {
      type: 'non-releve',
      salaires: [],
      garanti: null,
      ...commun,
      sources: nba ? ['nba.com'] : [],
      note: 'aucun contrat relevé au 24/11/2026 (ni chez Basketball-Reference, ni dans le suivi two-way) : à vérifier',
    };
  }
}

// Corrections du 24/11/2026 : les 5 joueurs sans contrat relevé, d'après les informations d'Antonin, recoupées pour les
// salaires saison par saison sur les pages d'équipe de SalarySwish (montants imputés sur la masse).
const pageEquipe = (e: string) => `salaryswish:${e}`;
const CORRECTIONS: Record<string, Partial<Contrat>> = {
  // Two-way signé le 07/11/2026 ; libéré le 18/11/2026, après le snapshot du 17/11.
  j0095: { type: 'two-way', salaires: [], garanti: null, sources: ['nba.com'], note: 'two-way au snapshot du 17/11/2026 (libéré le 18/11/2026, après le snapshot)' },
  j0216: { type: 'standard', salaires: [{ saison: '2026-27', montant: 2584539 }, { saison: '2027-28', montant: 2934742 }], garanti: null, sources: [pageEquipe('pacers')], note: 'two-way converti en contrat standard de 3 ans en février 2026' },
  j0441: { type: 'standard', salaires: [{ saison: '2026-27', montant: 2150917 }, { saison: '2027-28', montant: 2525901 }, { saison: '2028-29', montant: 2735698, option: 'equipe' }], garanti: null, sources: [pageEquipe('kings')], note: 'two-way converti en contrat standard de 4 ans en février 2026' },
  j0491: { type: 'standard', salaires: [{ saison: '2026-27', montant: 2449421 }], garanti: null, sources: [pageEquipe('jazz')], note: 'minimum vétéran d’un an (salaire 3 506 659 $, imputé 2 449 421 $) ; réclamé sur waivers le 17/10/2026' },
  j0521: { type: 'standard', salaires: [{ saison: '2026-27', montant: 3000000 }, { saison: '2027-28', montant: 3000000, option: 'equipe' }], garanti: null, sources: [pageEquipe('wizards')], note: 'two-way converti en contrat standard de 3 ans le 21/02/2026' },
};
for (const [id, c] of Object.entries(CORRECTIONS)) contrats[id] = { ...contrats[id]!, ...c };

// Situation publiée de chaque équipe (SalarySwish, 24/11/2026) : masse (cap hit), taxe de luxe due, récidiviste,
// plafond strict. Elle sert à rapprocher la somme des contrats individuels et à tester le calcul de la taxe.
const publie: Record<string, [number, number, boolean, 'premier' | 'deuxieme' | null]> = {
  denver: [220887619, 86558428, true, null],
  'new-york': [220861653, 45515852, false, null],
  'golden-state': [220838431, 86226409, true, null],
  orlando: [217865321, 32226624, false, null],
  'oklahoma-city': [217648521, 31467824, false, null],
  phoenix: [217225506, 63582283, true, 'deuxieme'],
  minnesota: [214930955, 21956343, false, 'premier'],
  philadelphia: [207186471, 6932089, false, 'premier'],
  cleveland: [207150518, 6887148, false, 'premier'],
  indianapolis: [206299932, 5871932, false, 'premier'],
  miami: [206189256, 5761256, false, 'premier'],
  sacramento: [204793947, 4365947, false, 'premier'],
  lakers: [202442622, 6043866, true, 'premier'],
  houston: [202233360, 1805360, false, 'deuxieme'],
  toronto: [201188888, 760888, false, 'premier'],
  atlanta: [201080502, 652502, false, 'premier'],
  boston: [198722406, 0, true, 'premier'],
  'san-antonio': [198279967, 0, false, 'premier'],
  'new-orleans': [196221049, 0, false, 'premier'],
  detroit: [194498178, 0, false, 'premier'],
  washington: [194462515, 0, false, 'premier'],
  portland: [192093473, 0, false, null],
  dallas: [189066094, 0, false, 'premier'],
  milwaukee: [187760790, 0, true, 'premier'],
  clippers: [183207323, 0, true, 'premier'],
  utah: [182965101, 0, false, 'premier'],
  charlotte: [168581193, 0, false, 'premier'],
  chicago: [168033555, 0, false, 'premier'],
  memphis: [161742655, 0, false, 'premier'],
  brooklyn: [160056358, 0, false, null],
};
const equipes = Object.fromEntries(
  Object.entries(publie).map(([id, [masse, taxe, recidiviste, plafondStrict]]) => {
    const joueurs = correspondance.filter((c) => c.franchiseId === id).map((c) => contrats[c.id!]!);
    const somme = joueurs
      .filter((x) => x.type === 'standard')
      .reduce((s, x) => s + (x.salaires.find((v) => v.saison === '2026-27')?.montant ?? 0), 0);
    return [
      id,
      {
        massePubliee: masse,
        taxePubliee: taxe,
        recidiviste,
        plafondStrict,
        // Ce que la somme des contrats individuels n'explique pas : argent mort des joueurs libérés, écarts entre salaire
        // et montant imputé (minimums de vétérans…), primes. Gardé tel quel pour que la masse du jeu soit la masse publiée.
        autresCharges: masse - somme,
      },
    ];
  }),
);
const effectifs = new Set(correspondance.map((c) => c.franchiseId));
if (Object.keys(equipes).length !== 30 || [...effectifs].some((e) => !equipes[e!])) throw new Error('Situation publiée incomplète.');

const compte = (t: Contrat['type']) => Object.values(contrats).filter((c) => c.type === t).length;
ecrire('data/contrats/2026-27.json', {
  schemaVersion: 1,
  datasetId: 'basket-legends-contrats-2026-27',
  saison: '2026-2027',
  consulteLe: CONSULTE,
  note: 'Contrats des joueurs des effectifs au 24/11/2026, rattachés aux identifiants du jeu hors du dépôt (aucun nom réel). Salaires en dollars par saison ; option du joueur ou de l’équipe sur la saison concernée ; montant garanti total. L’ancienneté est le nombre de saisons depuis la première saison NBA (NBA.com) : approximation des années d’expérience de la CBA, qui ne comptent que les saisons passées dans un effectif.',
  sources: {
    'basketball-reference': source('Basketball-Reference', '2026-27 NBA Player Contracts', 'https://www.basketball-reference.com/contracts/players.html', 'secondaire'),
    'hoops-rumors': S.twoWay,
    'nba.com': source('NBA.com', 'Players (index des joueurs : première saison, draft)', 'https://www.nba.com/players', 'primaire'),
    salaryswish: S.equipes,
    'salaryswish:pacers': source('SalarySwish', 'Indiana Pacers — contrats', 'https://www.salaryswish.com/teams/pacers', 'secondaire'),
    'salaryswish:kings': source('SalarySwish', 'Sacramento Kings — contrats', 'https://www.salaryswish.com/teams/kings', 'secondaire'),
    'salaryswish:jazz': source('SalarySwish', 'Utah Jazz — contrats', 'https://www.salaryswish.com/teams/jazz', 'secondaire'),
    'salaryswish:wizards': source('SalarySwish', 'Washington Wizards — contrats', 'https://www.salaryswish.com/teams/wizards', 'secondaire'),
    conditions: 'Relevés faits page par page pour un usage privé ; conditions de réutilisation à examiner avant publication (porte de publication).',
  },
  champs: {
    salaires: { unite: 'dollars', definition: 'Salaire de chaque saison du contrat (montant imputé sur la masse salariale).' },
    garanti: { unite: 'dollars', definition: 'Total garanti restant selon Basketball-Reference (vide : non publié).' },
    anciennete: { unite: 'saisons', definition: 'Saisons depuis la première saison NBA au 1er juillet 2026.' },
    autresCharges: { unite: 'dollars', definition: 'Masse publiée moins la somme des salaires 2026-27 des contrats standard de l’effectif.' },
  },
  bilan: {
    standard: compte('standard'),
    twoWay: compte('two-way'),
    nonReleve: compte('non-releve'),
    lignesSansJoueurDuJeu: ignorees,
    conflits,
  },
  joueurs: contrats,
  equipes,
});
console.log({ standard: compte('standard'), twoWay: compte('two-way'), nonReleve: compte('non-releve'), ignorees, conflits });
for (const [id, e] of Object.entries(equipes).sort((a, b) => a[1].autresCharges - b[1].autresCharges))
  console.log(id.padEnd(16), String(Math.round(e.autresCharges / 1000)).padStart(8), 'k$');
