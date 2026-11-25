// Migration de la tranche 10 (25 novembre 2026) — G League, two-way, propriétaire, vestiaire (réponses 46 à 56 de
// docs/DECISIONS_2026-11.md). Idempotente : on la relance après chaque réglage du modèle du club.
//
// Sorties :
// 1. data/modeles/marche-v1.json et staff-v1.json : statut « valide » (réponse 47), paramètres inchangés.
// 2. data/cba/nba-2026-27.json : contrats de 10 jours, exception de difficulté (hardship), two-way en cours de saison.
//    Chaque paramètre est sourcé (Hoops Rumors), consulté le 25/11/2026.
// 3. data/ligue/g-league-2026-27.json : format de la saison de G League (NBA G League, FAQ et présentation).
// 4. data/ligue/directions.json : changements de direction sportive relevés (critère de sortie, réponse 56).
// 5. data/modeles/club-v1.json : modèle du club (statut « proposition ») — propriétaire, vestiaire, G League accélérée,
//    contrats de l'IA, critère de sortie. Tout y est choix du jeu, transposé de Rugby Legends (contenu/manager/
//    carriere.yaml et vestiaire.yaml, commit 19dd48f) et réglé à la mesure (`npm run carriere 10 -- --matchs --club`).
//
// Usage : npx tsx tools/migrations/2026-11-25-tranche10-club.ts [dépôt]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schemaCba,
  schemaDirections,
  schemaGLeague,
  schemaModeleClub,
  schemaModeleMarche,
  schemaModeleStaff,
} from '../../packages/data/src';

const depot = process.argv[2] ?? process.cwd();
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
  dixJours: src(HR, 'Hoops Rumors Glossary: 10-Day Contract (03/01/2024)', 'https://hoopsrumors.com/2024/01/hoops-rumors-glossary-10-day-contract.html'),
  hardship: src(HR, 'Hoops Rumors Glossary: Hardship Exception (05/12/2023)', 'https://hoopsrumors.com/2023/12/hoops-rumors-glossary-hardship-exception.html'),
  grizzlies: src(HR, 'How The Grizzlies Are Carrying A 22-Man Roster (01/04/2026)', 'https://www.hoopsrumors.com/2026/04/how-the-grizzlies-are-carrying-a-22-man-roster.html'),
  limites: src(HR, 'Active Game Limits For Two-Way Players In 2025/26 (18/11/2025)', 'https://www.hoopsrumors.com/2025/11/active-game-limits-for-two-way-players-in-2025-26.html'),
  dateLimite: src(HR, 'NBA Teams Can’t Sign Players To Two-Way Deals After Wednesday (02/03/2026)', 'https://www.hoopsrumors.com/2026/03/nba-teams-cant-sign-players-to-two-way-deals-after-wednesday.html'),
  glAbout: src('NBA G League', 'What You Need to Know About the NBA G League', 'https://gleague.nba.com/about', 'primaire'),
  glFaq: src('NBA G League', 'Frequently Asked Questions: NBA G League', 'https://gleague.nba.com/faq', 'primaire'),
  glCalendrier: src('NBA Communications', 'NBA G League’s 25th season tips off Nov. 7 (calendrier 2025-26)', 'https://pr.nba.com/2025-26-nba-g-league-schedule/', 'primaire'),
};

// --- 1. Validation des modèles de la tranche 9 (réponse 47). ---
const VALIDE = 'Validé par Antonin le 25/11/2026 (réponse 47).';
const avecMention = (note: string) => (note.includes(VALIDE) ? note : `${note.replace(/,? ?[àÀ] valider par Antonin\.?/g, '.').replace(/\.\.$/, '.')} ${VALIDE}`);
for (const [fichier, schema] of [
  ['data/modeles/marche-v1.json', schemaModeleMarche],
  ['data/modeles/staff-v1.json', schemaModeleStaff],
] as const) {
  const m = schema.parse(lire(fichier)) as { statut: string; note: string };
  m.statut = 'valide';
  m.note = avecMention(m.note);
  ecrire(fichier, schema, m);
}

// --- 2. CBA : contrats en cours de saison. ---
const p = <T>(valeur: T, unite: string, definition: string, source: Source) => ({ valeur, unite, definition, source });
const cba = lire('data/cba/nba-2026-27.json') as ReturnType<typeof schemaCba.parse>;
Object.assign(cba.parametres, {
  dixJours: p(
    { premierJour: '01-05', jours: 10, matchsMin: 3, joursSaison: 174, parJoueurEtEquipe: 2, joursRestantsMin: 10 },
    'date (MM-JJ), jours, matchs',
    'Contrat de 10 jours : signé à partir du 5 janvier, il couvre 10 jours (jour de la signature compris), prolongé jusqu’à trois matchs de l’équipe s’il en compte moins ; salaire = minimum de l’ancienneté du joueur × 10/174 (174 jours de saison régulière). Deux contrats de 10 jours au plus avec la même équipe, ensuite elle le signe jusqu’à la fin de la saison ou le laisse partir. Contrat standard : il prend une place parmi les 15 (sauf exception de difficulté). Pas de contrat standard de 10 jours à moins de 10 jours de la fin de la saison régulière.',
    S.dixJours,
  ),
  hardship: p(
    { blessesMin: 4, matchsManquesMin: 3, joursRestantsMin: 14 },
    'joueurs, matchs, jours',
    'Exception de difficulté (hardship) : une équipe dont l’effectif de 15 est complet et qui a au moins quatre joueurs blessés ou malades, chacun absent depuis au moins trois matchs consécutifs et encore absent au moins deux semaines, signe un contrat de 10 jours hors des 15 (à tout moment de la saison). Une exception par groupe de quatre ; une de plus pour chaque joueur au-delà (cinq joueurs : deux). Quand l’équipe ne remplit plus les conditions, elle revient à 15.',
    S.hardship,
  ),
  twoWayEnSaison: p(
    { dateLimiteSignature: '03-04', joursSaison: 174, matchsEquipeIncomplete: 90 },
    'date (MM-JJ), jours, matchs',
    'Two-way en cours de saison : pas de signature après le 4 mars ; limite de 50 matchs actifs au prorata des jours restants (jours restants ÷ 174 × 50, arrondi) ; conversion en contrat standard possible jusqu’au dernier jour de la saison régulière (place parmi les 15 nécessaire) ; une équipe à moins de 15 contrats standard est limitée à 90 matchs actifs de two-way au total.',
    S.limites,
  ),
});
if (!cba.recoupements.some((r) => r.url === S.dateLimite.url)) cba.recoupements.push(S.dateLimite, S.grizzlies);
ecrire('data/cba/nba-2026-27.json', schemaCba, cba);

// --- 3. G League. ---
ecrire('data/ligue/g-league-2026-27.json', schemaGLeague, {
  schemaVersion: 1,
  datasetId: 'basket-legends-g-league-2026-27',
  saison: '2026-2027',
  note: 'Format de la saison 2026-27 de la NBA G League (relevé le 25/11/2026). 31 équipes, dont 30 affiliées, une par franchise NBA (depuis 2024-25) ; le jeu ne simule que les 30 affiliées (réponse 48), l’équipe indépendante est laissée de côté. Tip-Off Tournament de 14 matchs en quatre régions, à partir du 6 novembre 2026 ; Winter Showcase en décembre (huit qualifiés : le premier de chaque région et les quatre meilleurs suivants, élimination directe) ; bilans remis à zéro, saison régulière de 36 matchs par conférence ; playoffs : huit équipes par conférence, à partir du 30 mars 2027, finale au meilleur des trois matchs. Dates de fin du Tip-Off et de la saison régulière, et dates exactes du Showcase : estimées (la FAQ se contredit sur la reprise, 19 ou 27 décembre).',
  equipes: 31,
  affiliees: 30,
  tipOff: { matchs: 14, regions: 4, debut: '2026-11-06', fin: '2026-12-16' },
  showcase: { qualifies: 8, debut: '2026-12-19', fin: '2026-12-22' },
  saisonReguliere: { matchs: 36, debut: '2026-12-27', fin: '2027-03-28' },
  playoffs: { parConference: 8, debut: '2027-03-30', finaleVictoires: 2 },
  sources: [S.glAbout, S.glFaq, S.glCalendrier],
});

// --- 4. Changements de direction sportive (réponse 56). ---
const d = (franchise: string, mois: string, saison: string, nature: 'licenciement' | 'depart', source: Source) => ({
  franchise,
  mois,
  saison,
  nature,
  source,
});
ecrire('data/ligue/directions.json', schemaDirections, {
  schemaVersion: 1,
  datasetId: 'basket-legends-changements-direction',
  note: 'Relevé partiel (recherches du 25/11/2026), à recouper avant publication : aucune source ne donne la liste complète. Il fixe l’ordre de grandeur des licenciements de GM de la tranche 10 : 5 changements relevés pour 2024-25, au moins 3 pour 2025-26. Les noms des dirigeants ne sont pas repris (certaines adresses des sources en contiennent). Fourchette du jeu (data/modeles/club-v1.json, critereSortie) : 1 à 7 par saison.',
  definition: 'Changement du premier responsable des opérations basket (président des opérations ou GM) d’une franchise, à son initiative ou à celle de la franchise, entre la fin d’une saison régulière et la fin de la saison suivante.',
  changements: [
    d('atlanta', '2025-04', '2024-2025', 'licenciement', src('ESPN', 'Atlanta : le GM licencié, son adjoint promu (titre sans les noms)', 'https://www.espn.com/nba/story/_/id/44784004/hawks-promote-onsi-saleh-gm-firing-landry-fields')),
    d('denver', '2025-04', '2024-2025', 'licenciement', src(HR, 'NBA 2025 Offseason Check-In: Denver Nuggets', 'https://www.hoopsrumors.com/offseason-check-in/page/3')),
    d('sacramento', '2025-04', '2024-2025', 'depart', src('Bleacher Report', 'Sacramento : départ du GM après le Play-In (titre sans les noms)', 'https://bleacherreport.com/articles/25187376-monte-mcnair-reportedly-out-kings-gm-after-nba-play-loss-mavericks')),
    d('phoenix', '2025-05', '2024-2025', 'depart', src('Sports Illustrated', 'Phoenix : nouveau GM promu en interne (titre sans les noms)', 'https://www.si.com/nba/suns-new-general-manager-brian-gregory-still-searching-head-coach')),
    d('toronto', '2025-06', '2024-2025', 'licenciement', src(HR, 'Toronto : départ du président des opérations basket (fil de nouvelles)', 'https://www.hoopsrumors.com/masai-ujiri')),
    d('dallas', '2025-11', '2025-2026', 'licenciement', src(HR, 'NBA 2026 Offseason Check-In: Dallas Mavericks', 'https://www.hoopsrumors.com/2026/09/nba-2026-offseason-check-in-dallas-mavericks.html')),
    d('chicago', '2026-04', '2025-2026', 'licenciement', src('TSN (ESPN)', 'Why the Bulls fired their front office with just one week left in the regular season', 'https://www.tsn.ca/nba/article/why-bulls-fired-their-front-office-with-just-one-week-left-in-regular-season-n1-48413848/')),
    d('philadelphia', '2026-05', '2025-2026', 'licenciement', src(HR, 'NBA 2026 Offseason Check-In: Philadelphia 76ers', 'https://www.hoopsrumors.com/2026/08/nba-2026-offseason-check-in-philadelphia-76ers.html')),
  ],
  completude: { '2024-2025': 'partiel', '2025-2026': 'partiel' },
});

// --- 5. Modèle du club (proposition). ---
const choix = (texte: string, effets: Record<string, number[]>, extra: Record<string, unknown> = {}) => ({ texte, effets, ...extra });
ecrire('data/modeles/club-v1.json', schemaModeleClub, {
  schemaVersion: 1,
  datasetId: 'basket-legends-modele-club',
  version: 'club-v1',
  statut: 'proposition',
  note: 'Modèle du club de la tranche 10 (25/11/2026, réponses 48 à 56), transposé de Rugby Legends (président, objectifs, confiance, réputation, vestiaire, messages à choix ; contenu/manager/carriere.yaml et vestiaire.yaml, commit 19dd48f) et adapté à la NBA (82 matchs, conférences, playoffs, taxe de luxe). Tous les paramètres sont des choix du jeu, aucun n’est relevé ; ils sont réglés à la mesure (`npm run carriere 10 -- --matchs --club`). Le profil des propriétaires est hérité du miroir pour la tolérance à la taxe (récidivistes au snapshot plus souvent « ambitieux », réponse 51), le reste est tiré et présenté comme généré. À valider par Antonin.',
  proprietaire: {
    profils: {
      exigeant: { part: 0.3, depart: 55, seuil: 30, severite: 1.3, toleranceTaxe: 0 },
      patient: { part: 0.4, depart: 65, seuil: 20, severite: 0.7, toleranceTaxe: 10_000_000 },
      ambitieux: { part: 0.3, depart: 60, seuil: 25, severite: 1, toleranceTaxe: 60_000_000 },
    },
    recidivisteAmbitieux: 0.7,
    objectifs: [
      { jusqua: 3, type: 'titre', rangConference: 1 },
      { jusqua: 7, type: 'finale-conference', rangConference: 3 },
      { jusqua: 14, type: 'playoffs', rangConference: 6 },
      { jusqua: 20, type: 'play-in', rangConference: 10 },
      { jusqua: 30, type: 'reconstruction', rangConference: 13, victoiresMin: 25 },
    ],
    rendezVous: [0.33, 0.66],
    confiance: {
      parPlace: 3,
      miSaison: 0.6,
      finSaison: 1.5,
      plafondHausse: 15,
      plafondBaisse: 30,
      titre: 15,
      finale: 5,
      objectifTenuMarge: 15,
      taxeParDixMillions: 3,
      demenagementRefuse: 5,
    },
    reputation: { depart: 50, objectifTenu: 8, objectifManque: 10, titre: 12, finale: 5, licenciement: 10, ecartOffres: 15 },
    offres: 3,
    propositionDemenagement: 0.03,
    textes: {
      bon: ['Le propriétaire vous félicite : {club} est en avance sur son objectif ({objectif}).', 'Le propriétaire est satisfait du travail accompli. Continuez comme ça.'],
      moyen: ['Le propriétaire attend mieux : l’objectif ({objectif}) reste à portée, mais il ne faut plus traîner.', 'Le propriétaire vous rappelle l’objectif de la saison : {objectif}.'],
      mauvais: ['Le propriétaire est inquiet : {club} est loin de son objectif ({objectif}). Sa patience a des limites.', 'Réunion tendue avec le propriétaire : les résultats ne sont pas au niveau attendu ({objectif}).'],
      licenciement: ['Le propriétaire met fin à votre mission à {club}. Les résultats ne suivaient pas.', 'C’est terminé : le propriétaire de {club} a décidé de se séparer de vous.'],
      demenagement: ['Le propriétaire de {club} étudie un départ pour {ville}. Il veut votre avis avant de trancher.'],
    },
  },
  vestiaire: {
    moral: {
      depart: 65,
      recrue: 65,
      victoire: 0.8,
      defaite: -0.8,
      retour: 0.02,
      intersaison: 0.5,
      poidsMeneur: 2,
      demandeSeuil: 30,
      demandeJours: 14,
      promesseRompue: -15,
      minutesRotation: 12,
      minutesTitulaire: 26,
    },
    tempsDeJeu: { titulaire: [-1.5, -0.3, 0.4], rotation: [-0.8, 0.3, 0.6], banc: [-0.1, 0.4, 0.6] },
    roles: { titulaires: 5, rotation: 4 },
    temperaments: {
      meneur: { part: 0.15, variation: 1, tempsDeJeu: 1 },
      calme: { part: 0.35, variation: 0.5, tempsDeJeu: 1 },
      sanguin: { part: 0.2, variation: 1.4, tempsDeJeu: 1 },
      discret: { part: 0.3, variation: 1, tempsDeJeu: 0.5 },
    },
    // Les 10 % de meilleurs mentaux de la NBA au snapshot (p90 = 81), comme le leadership de Rugby Legends.
    meneurMental: 81,
    effetMatch: { parPoint: 0.0001, max: 0.003 },
    fidelite: [0.5, 1.3],
    messages: { parJour: 1, parSaison: 12, delai: 3 },
    chances: { 'VES-001': 0.5, 'VES-002': 0.02, 'VES-002_par_sanguin': 0.01, 'VES-003': 0.3, 'VES-004': 1, 'VES-005': 0.1, 'VES-006': 0.5, 'PRO-001': 0.5, 'PRO-002': 0.3 },
    seuils: {
      'VES-001_moral': 50,
      'VES-001_matchs': 3,
      'VES-003_age': 28,
      'VES-003_rang': 5,
      'VES-003_defaites': 3,
      'VES-005_age': 22,
      'VES-005_potentiel': 70,
      'VES-006_defaites': 5,
      'PRO-001_confiance': 45,
    },
    evenements: [
      {
        id: 'VES-001',
        de: 'adjoint',
        titre: 'Temps de jeu réclamé',
        texte: '{joueur} est passé à votre bureau. Trois matchs presque sans jouer : il ne comprend pas, on lui avait promis un rôle.',
        choix: [
          choix('« Tu joues gros au prochain match, je te le promets. »', { joueur: [12] }, { action: 'promesse' }),
          choix('« Je t’explique mes choix : gagne ta place à l’entraînement. »', { joueur: [5, -5] }, { defaut: true }),
          choix('« C’est le staff qui fait l’équipe. »', { joueur: [-10] }),
        ],
      },
      {
        id: 'VES-002',
        de: 'adjoint',
        titre: 'Accrochage à l’entraînement',
        texte: 'Ça a chauffé à l’entraînement : {joueur} et {joueur2} en sont venus aux mains. Le groupe attend votre réaction.',
        choix: [
          choix('« Les deux sont écartés du prochain match. »', { joueur: [-10], joueur2: [-10], groupe: [3, 3, -1] }, { action: 'ecarter' }),
          choix('« Les cadres règlent ça entre eux. »', { groupe: [4, -4] }, { defaut: true, chance: 'meneurs' }),
          choix('« On oublie, place au match. »', { groupe: [-2] }),
        ],
      },
      {
        id: 'VES-003',
        de: 'adjoint',
        titre: 'Un cadre conteste',
        texte: 'Après une nouvelle défaite, {joueur} a remis en cause le plan de jeu devant tout le monde. Plusieurs joueurs ont acquiescé.',
        choix: [
          choix('« On en parle en tête à tête, tu as peut-être raison. »', { joueur: [8], groupe: [2, -2] }),
          choix('« Le plan ne change pas. »', { joueur: [-8], groupe: [2, -3] }, { defaut: true }),
          choix('« Tu seras sur le banc au prochain match. »', { joueur: [-15], groupe: [3, -4] }, { action: 'ecarter' }),
        ],
      },
      {
        id: 'VES-004',
        de: 'adjoint',
        titre: 'Demande d’échange',
        texte: '{joueur} ne se sent plus à sa place et demande officiellement à être échangé. Son agent a déjà appelé deux équipes.',
        choix: [
          choix('« D’accord, on va te trouver une équipe. »', { joueur: [10] }, { action: 'echange' }),
          choix('« Tu restes : tu as un contrat. »', { joueur: [-10], groupe: [-2] }, { action: 'garder' }),
          choix('« On en reparle à l’intersaison. »', { joueur: [0, -5] }, { defaut: true }),
        ],
      },
      {
        id: 'VES-005',
        de: 'recrutement',
        titre: 'Un jeune s’impatiente',
        texte: '{joueur} ne joue presque pas. Le recrutement pense qu’il progresserait plus vite avec des minutes.',
        choix: [
          choix('« Il part en G League pour jouer. »', { joueur: [5, -5] }, { action: 'gleague' }),
          choix('« Il entre dans la rotation. »', { joueur: [10] }, { action: 'role' }),
          choix('« Patience : son tour viendra. »', { joueur: [-3] }, { defaut: true }),
        ],
      },
      {
        id: 'VES-006',
        de: 'adjoint',
        titre: 'Le groupe doute',
        texte: 'Cinq défaites de suite : le vestiaire est silencieux. {joueur} propose de réunir l’équipe.',
        choix: [
          choix('« Réunion de toute l’équipe, ce soir. »', { groupe: [3, -2] }),
          choix('« Laissons les cadres reprendre la main. »', { groupe: [4, -3] }, { defaut: true, chance: 'meneurs' }),
          choix('« On travaille, on ne parle pas. »', { groupe: [-1, 1] }),
        ],
      },
      {
        id: 'PRO-001',
        de: 'proprietaire',
        titre: 'Le propriétaire s’inquiète',
        texte: 'Le propriétaire vous convoque : {club} est loin de son objectif ({objectif}). Il attend un plan.',
        choix: [
          choix('« Les résultats vont venir, je m’y engage. »', { confiance: [6, -6] }),
          choix('« Il faut du temps : le projet est sur plusieurs saisons. »', { confiance: [3, -3] }, { defaut: true }),
          choix('« J’ai besoin de renforts. »', { confiance: [-2] }),
        ],
      },
      {
        id: 'PRO-002',
        de: 'proprietaire',
        titre: 'La taxe de luxe',
        texte: 'Le propriétaire a vu la facture : {club} paiera la taxe de luxe, au-delà de ce qu’il accepte. Il vous demande des comptes.',
        choix: [
          choix('« Je vais alléger la masse salariale. »', { confiance: [4] }),
          choix('« C’est le prix d’une équipe qui gagne. »', { confiance: [3, -6] }, { defaut: true }),
        ],
      },
    ],
  },
  gLeague: {
    effectif: 12,
    forceTop: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3],
    echelle: 6,
    avantageDomicile: 1.5,
    pointsMoyens: 115,
    ecartPoints: 12,
    minutes: [34, 32, 30, 28, 26, 22, 18, 14, 12, 10, 8, 6],
    progression: { matchsMin: 20, bonus: 0.4, ageMax: 24 },
    assignationAncienneteMax: 2,
    rangAssignationIa: 13,
  },
  contratsIa: { noteMinHardship: 55, noteMinConversion: 62, ageMaxTwoWay: 24 },
  critereSortie: { saisons: 10, licenciementsParSaison: [1, 7], moralMoyen: [55, 75], deriveMoralMax: 6, effetMoyenMax: 0.001 },
});
