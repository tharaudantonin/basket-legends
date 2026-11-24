// Migration de la tranche 2 (24 novembre 2026) — écrit les statistiques sourcées de la saison 2025-2026.
//
// Entrée : les relevés bruts du dossier privé (`basket-legends-prive/statistiques-2025-26/`), faits le 24/11/2026 dans le
// navigateur sur Basketball-Reference (saison régulière, playoffs, saison 2024-25, draft 2026) et NBA.com (Play-In). Ils
// contiennent les identifiants du fournisseur ou les vrais noms : ils restent hors du dépôt. Les lignes sont déjà
// rattachées aux identifiants du jeu (j0001…) par le nom réel normalisé de `correspondance.csv`.
//
// Sortie (dans le dépôt, sans aucun nom réel ni identifiant de fournisseur) :
// 1. data/statistiques/2025-26/joueurs.json : totaux par joueur, saison régulière, Play-In et playoffs séparés ; saison
//    2024-25 pour les joueurs absents toute la saison 2025-26 ; rang de draft 2026 des recrues.
// 2. data/statistiques/2025-26/ligue.json : moyennes de la ligue par équipe et par match (cibles de la calibration).
//
// Usage : npx tsx tools/migrations/2026-11-24-tranche2-statistiques.ts [dépôt] [dossier privé]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();
const prive = process.argv[3] ?? join(depot, '..', 'basket-legends-prive');
const releves = join(prive, 'statistiques-2025-26');
const CONSULTE_LE = '2026-11-24';

const lireCsvSimple = (chemin: string): Record<string, string>[] => {
  const [entete, ...lignes] = readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
  const cles = (entete ?? '').split(',');
  return lignes.map((l) => {
    const v = l.split(',');
    return Object.fromEntries(cles.map((c, i) => [c, v[i] ?? '']));
  });
};
const n = (x: string | undefined): number => {
  const v = Number(x);
  if (x === undefined || x === '' || !Number.isFinite(v)) throw new Error(`valeur numérique illisible : « ${x} »`);
  return v;
};

/** Les totaux d'une compétition pour un joueur (mêmes champs que le fournisseur, noms français). */
function totauxBref(l: Record<string, string>) {
  return {
    age: n(l.age),
    equipe: l.team,
    equipes: l.equipes ? l.equipes.split('/') : [l.team],
    poste: l.pos,
    matchs: n(l.g),
    titularisations: n(l.gs),
    minutes: n(l.mp),
    tirsReussis: n(l.fg),
    tirsTentes: n(l.fga),
    troisReussis: n(l.fg3),
    troisTentes: n(l.fg3a),
    lancersReussis: n(l.ft),
    lancersTentes: n(l.fta),
    rebondsOffensifs: n(l.orb),
    rebondsDefensifs: n(l.drb),
    passes: n(l.ast),
    interceptions: n(l.stl),
    contres: n(l.blk),
    pertes: n(l.tov),
    fautes: n(l.pf),
    points: n(l.pts),
  };
}
type Totaux = ReturnType<typeof totauxBref>;

// Contrôle de cohérence de chaque ligne : on refuse une ligne impossible plutôt que de l'importer.
function controler(id: string, t: Totaux | Omit<Totaux, 'titularisations'>, ou: string): void {
  const p = 2 * (t.tirsReussis - t.troisReussis) + 3 * t.troisReussis + t.lancersReussis;
  const ok =
    t.tirsReussis <= t.tirsTentes &&
    t.troisReussis <= t.troisTentes &&
    t.troisTentes <= t.tirsTentes &&
    t.lancersReussis <= t.lancersTentes &&
    p === t.points;
  if (!ok) throw new Error(`${ou} ${id} : totaux incohérents (points recalculés ${p} pour ${t.points})`);
}

const normaliser = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/[^a-z]/g, '');

// 1. Correspondance nom réel → identifiant (pour le Play-In, relevé sur NBA.com avec les noms).
const idParNom = new Map<string, string>();
for (const l of lireCsvSimple(join(prive, 'correspondance.csv'))) idParNom.set(normaliser(l.nomReel ?? ''), l.id ?? '');
idParNom.set('ronholland', 'j0164'); // nom d'usage chez les fournisseurs

const joueurs: Record<string, Record<string, unknown>> = {};
const fiche = (id: string) => (joueurs[id] ??= {});

for (const l of lireCsvSimple(join(releves, 'bref-totaux-saison-reguliere.csv'))) {
  const t = totauxBref(l);
  controler(l.id!, t, 'saison régulière');
  fiche(l.id!).saisonReguliere = t;
}
for (const l of lireCsvSimple(join(releves, 'bref-totaux-playoffs.csv'))) {
  const t = totauxBref(l);
  controler(l.id!, t, 'playoffs');
  fiche(l.id!).playoffs = t;
}
for (const l of lireCsvSimple(join(releves, 'bref-totaux-2024-25-absents-2025-26.csv'))) {
  const t = totauxBref(l);
  controler(l.id!, t, 'saison 2024-25');
  if (fiche(l.id!).saisonReguliere) throw new Error(`${l.id} a déjà une saison 2025-26`);
  fiche(l.id!).saison2024_25 = t;
}
for (const l of lireCsvSimple(join(releves, 'bref-draft-2026.csv'))) fiche(l.id!).draft2026 = { choix: n(l.pick) };

let playInNonRattaches = 0;
for (const l of lireCsvSimple(join(releves, 'nba-totaux-play-in.csv'))) {
  const id = idParNom.get(normaliser(l.nom ?? ''));
  if (!id) {
    playInNonRattaches++;
    continue;
  }
  const t = {
    age: n(l.age),
    equipe: l.team,
    matchs: n(l.g),
    minutes: n(l.min),
    tirsReussis: n(l.fg),
    tirsTentes: n(l.fga),
    troisReussis: n(l.fg3),
    troisTentes: n(l.fg3a),
    lancersReussis: n(l.ft),
    lancersTentes: n(l.fta),
    rebondsOffensifs: n(l.orb),
    rebondsDefensifs: n(l.drb),
    passes: n(l.ast),
    interceptions: n(l.stl),
    contres: n(l.blk),
    pertes: n(l.tov),
    fautes: n(l.pf),
    points: n(l.pts),
  };
  controler(id, { ...t, equipes: [], poste: '' }, 'Play-In');
  fiche(id).playIn = t;
}

const tries = Object.fromEntries(Object.keys(joueurs).sort().map((id) => [id, joueurs[id]]));

const BREF = 'Basketball-Reference (Sports Reference LLC)';
const champs = {
  age: { unite: 'ans', definition: 'Âge du joueur selon le fournisseur (au 1er février de la saison chez Basketball-Reference).' },
  equipe: { unite: 'code', definition: 'Code de l’équipe NBA de la ligne ; « 2TM », « 3TM »… pour le total d’un joueur passé par plusieurs équipes.' },
  equipes: { unite: 'codes', definition: 'Équipes successives de la saison, dans l’ordre du fournisseur.' },
  poste: { unite: 'code', definition: 'Poste indiqué par le fournisseur (PG, SG, SF, PF, C).' },
  matchs: { unite: 'matchs', definition: 'Matchs joués.' },
  titularisations: { unite: 'matchs', definition: 'Matchs commencés comme titulaire.' },
  minutes: { unite: 'minutes', definition: 'Minutes jouées (entières chez Basketball-Reference, décimales chez NBA.com).' },
  tirsReussis: { unite: 'tirs', definition: 'Tirs réussis (FGM), lancers francs exclus.' },
  tirsTentes: { unite: 'tirs', definition: 'Tirs tentés (FGA), lancers francs exclus.' },
  troisReussis: { unite: 'tirs', definition: 'Tirs à trois points réussis (3PM).' },
  troisTentes: { unite: 'tirs', definition: 'Tirs à trois points tentés (3PA).' },
  lancersReussis: { unite: 'lancers', definition: 'Lancers francs réussis (FTM).' },
  lancersTentes: { unite: 'lancers', definition: 'Lancers francs tentés (FTA).' },
  rebondsOffensifs: { unite: 'rebonds', definition: 'Rebonds offensifs (ORB).' },
  rebondsDefensifs: { unite: 'rebonds', definition: 'Rebonds défensifs (DRB).' },
  passes: { unite: 'passes', definition: 'Passes décisives (AST).' },
  interceptions: { unite: 'interceptions', definition: 'Interceptions (STL).' },
  contres: { unite: 'contres', definition: 'Contres (BLK).' },
  pertes: { unite: 'ballons', definition: 'Balles perdues (TOV).' },
  fautes: { unite: 'fautes', definition: 'Fautes personnelles (PF).' },
  points: { unite: 'points', definition: 'Points marqués (PTS).' },
  choix: { unite: 'rang', definition: 'Rang du choix de draft 2026 (1 à 60).' },
};

const fichierJoueurs = {
  schemaVersion: 1,
  datasetId: 'basket-legends-statistiques-joueurs-2025-26',
  saison: '2025-2026',
  consulteLe: CONSULTE_LE,
  note: 'Totaux relevés le 24/11/2026 pour la calibration du modèle de notes v1 (tranche 2). Aucun nom réel ni identifiant de fournisseur : les lignes sont rattachées aux identifiants du jeu hors du dépôt. Un joueur absent d’une section n’a pas de statistique dans cette compétition ; une valeur absente est inconnue, jamais inventée.',
  sources: {
    saisonReguliere: {
      fournisseur: BREF,
      titre: '2025-26 NBA Player Stats: Totals',
      url: 'https://www.basketball-reference.com/leagues/NBA_2026_totals.html',
      perimetre: 'Saison régulière 2025-2026 (Play-In et playoffs exclus). Pour un joueur de plusieurs équipes, la ligne totale de la saison.',
    },
    playIn: {
      fournisseur: 'NBA.com / NBA Stats',
      titre: 'Players Traditional — Season Type: PlayIn, Totals',
      url: 'https://www.nba.com/stats/players/traditional?Season=2025-26&SeasonType=PlayIn&PerMode=Totals',
      perimetre: 'Tournoi de Play-In 2026. Basketball-Reference ne publie pas de totaux du Play-In séparés.',
    },
    playoffs: {
      fournisseur: BREF,
      titre: '2026 NBA Playoffs Stats: Totals',
      url: 'https://www.basketball-reference.com/playoffs/NBA_2026_totals.html',
      perimetre: 'Playoffs 2026 (Play-In exclu).',
    },
    saison2024_25: {
      fournisseur: BREF,
      titre: '2024-25 NBA Player Stats: Totals',
      url: 'https://www.basketball-reference.com/leagues/NBA_2025_totals.html',
      perimetre: 'Saison régulière 2024-2025, relevée seulement pour les joueurs de l’effectif qui n’ont joué aucun match de saison régulière 2025-2026.',
    },
    draft2026: {
      fournisseur: BREF,
      titre: '2026 NBA Draft',
      url: 'https://www.basketball-reference.com/draft/NBA_2026.html',
      perimetre: 'Rang du choix des joueurs de l’effectif draftés en 2026.',
    },
    conditions: 'Relevé manuel de pages publiques, pour un usage privé et local de calibration (docs/SOURCES.md § 4). Conditions de réutilisation à examiner avant toute publication (porte de publication, docs/AUDIT_2026-11.md § 3.4).',
  },
  champs,
  joueurs: tries,
};

// 2. Moyennes de la ligue (relevées sur la page de la saison et celle des classements).
const ligue = {
  schemaVersion: 1,
  datasetId: 'basket-legends-statistiques-ligue-2025-26',
  saison: '2025-2026',
  competition: 'saison régulière',
  consulteLe: CONSULTE_LE,
  sources: {
    saison: {
      fournisseur: BREF,
      titre: '2025-26 NBA Season Summary (Team Per Game Stats, Advanced Stats, Shooting Stats — ligne « League Average »)',
      url: 'https://www.basketball-reference.com/leagues/NBA_2026.html',
    },
    classements: {
      fournisseur: BREF,
      titre: '2025-26 NBA Standings (Expanded Standings, colonne Home)',
      url: 'https://www.basketball-reference.com/leagues/NBA_2026_standings.html',
    },
  },
  parEquipeParMatch: {
    unite: 'par équipe et par match',
    points: 115.6,
    tirsReussis: 42.0,
    tirsTentes: 89.1,
    troisReussis: 13.3,
    troisTentes: 37.0,
    lancersReussis: 18.4,
    lancersTentes: 23.5,
    rebondsOffensifs: 11.4,
    rebondsDefensifs: 32.4,
    passes: 26.7,
    interceptions: 8.4,
    contres: 4.8,
    pertes: 14.5,
    fautes: 19.9,
  },
  pourcentages: { tirs: 0.471, trois: 0.36, lancers: 0.783 },
  avance: {
    rythme: { valeur: 99.4, definition: 'Possessions par 48 minutes (Pace).' },
    efficaciteOffensive: { valeur: 115.8, definition: 'Points par 100 possessions (ORtg).' },
    tauxDePertes: { valeur: 0.127, definition: 'Balles perdues par possession jouée (TOV%).' },
    tauxDeRebondsOffensifs: { valeur: 0.26, definition: 'Part des rebonds offensifs disponibles prise par l’attaque (ORB%).' },
    lancersParTir: { valeur: 0.206, definition: 'Lancers francs réussis par tir tenté (FT/FGA).' },
  },
  tirsParDistance: {
    definition: 'Part des tirs tentés et réussite, par distance au panier (Shooting Stats, League Average).',
    zero_trois_pieds: { part: 0.231, reussite: 0.703 },
    trois_dix_pieds: { part: 0.209, reussite: 0.463 },
    dix_seize_pieds: { part: 0.095, reussite: 0.446 },
    seize_pieds_ligne: { part: 0.049, reussite: 0.401 },
    trois_points: { part: 0.415, reussite: 0.36 },
    partPassesSurPaniersA2: 0.537,
    partPassesSurPaniersA3: 0.854,
  },
  domicile: {
    victoires: 679,
    defaites: 546,
    definition: 'Bilan cumulé des 30 équipes à domicile ; les 10 matchs sur terrain neutre sont exclus.',
  },
};

for (const [chemin, contenu] of [
  ['data/statistiques/2025-26/joueurs.json', fichierJoueurs],
  ['data/statistiques/2025-26/ligue.json', ligue],
] as const) {
  const complet = join(depot, chemin);
  mkdirSync(join(complet, '..'), { recursive: true });
  writeFileSync(complet, JSON.stringify(contenu, null, 2) + '\n', 'utf8');
  console.log(`Écrit : ${chemin}`);
}
const compter = (cle: string) => Object.values(tries).filter((f) => f?.[cle]).length;
console.log(
  `Saison régulière ${compter('saisonReguliere')} · Play-In ${compter('playIn')} (${playInNonRattaches} hors effectif) · playoffs ${compter('playoffs')} · 2024-25 ${compter('saison2024_25')} · draft ${compter('draft2026')}`,
);
