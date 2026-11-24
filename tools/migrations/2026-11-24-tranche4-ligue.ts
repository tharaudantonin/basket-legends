// Migration de la tranche 4 (24 novembre 2026) — la structure de la saison 2026-27 et l'endurance des joueurs.
//
// 1. data/ligue/saison-2026-27.json : conférences et divisions, formule du calendrier de 82 matchs, Play-In, playoffs,
//    critères de départage, éligibilité aux récompenses, All-Star Game. Chaque bloc porte sa source et son niveau
//    (primaire : NBA.com ; secondaire : presse, à recouper avant publication).
// 2. data/modeles/notes-v1.json : ajout de l'indice d'endurance (courbe de fatigue propre à chaque joueur, amélioration
//    validée le 24/11/2026, tranche 4). Les autres paramètres, validés, ne changent pas.
// 3. data/moteur/match-v3.json : endurance et blessures en match (remplace match-v2.json).
//
// Usage : npx tsx tools/migrations/2026-11-24-tranche4-ligue.ts [dépôt]
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();
const ecrire = (chemin: string, contenu: unknown) => {
  mkdirSync(join(depot, chemin, '..'), { recursive: true });
  writeFileSync(join(depot, chemin), JSON.stringify(contenu, null, 2) + '\n', 'utf8');
  console.log(`Écrit : ${chemin}`);
};
const CONSULTE = '2026-11-24';
const source = (fournisseur: string, url: string, niveau: 'primaire' | 'secondaire') => ({ fournisseur, url, niveau, consulteLe: CONSULTE });

const saison = {
  schemaVersion: 1,
  datasetId: 'basket-legends-ligue-2026-27',
  saison: '2026-2027',
  note: 'Structure de la saison NBA 2026-27 appliquée aux franchises de Basket Legends (chacune prend la place de son club de référence). Les noms des conférences et divisions sont des traductions géographiques.',
  conferences: [
    {
      id: 'est',
      nom: 'Conférence Est',
      divisions: [
        { id: 'atlantique', nom: 'Division Atlantique', franchises: ['boston', 'brooklyn', 'new-york', 'philadelphia', 'toronto'] },
        { id: 'centrale', nom: 'Division Centrale', franchises: ['chicago', 'cleveland', 'detroit', 'indianapolis', 'milwaukee'] },
        { id: 'sud-est', nom: 'Division Sud-Est', franchises: ['atlanta', 'charlotte', 'miami', 'orlando', 'washington'] },
      ],
    },
    {
      id: 'ouest',
      nom: 'Conférence Ouest',
      divisions: [
        { id: 'nord-ouest', nom: 'Division Nord-Ouest', franchises: ['denver', 'minnesota', 'oklahoma-city', 'portland', 'utah'] },
        { id: 'pacifique', nom: 'Division Pacifique', franchises: ['golden-state', 'clippers', 'lakers', 'phoenix', 'sacramento'] },
        { id: 'sud-ouest', nom: 'Division Sud-Ouest', franchises: ['dallas', 'houston', 'memphis', 'new-orleans', 'san-antonio'] },
      ],
    },
  ],
  sourceAlignement: source('NBA.com — Standings 2025-26 (liste des équipes par division)', 'https://www.nba.com/standings?Season=2025-26', 'primaire'),
  calendrier: {
    matchsParEquipe: 82,
    contreChaqueAdversaireDeDivision: 4,
    adversairesDeConferenceA4Matchs: 6,
    adversairesDeConferenceA3Matchs: 4,
    contreChaqueAdversaireDeLAutreConference: 2,
    premierJour: '2026-10-20',
    dernierJour: '2027-04-11',
    note: 'Formule en place depuis 2004-05 : 16 matchs de division, 24 + 12 matchs de conférence, 30 contre l’autre conférence. Les matchs de la NBA Cup comptent dans les 82 ; la Cup elle-même n’est pas simulée (simplification de la tranche 4).',
    sources: [
      source('NBA.com — 2026-27 regular season schedule (dates, 82 matchs dont 80 fixés d’avance)', 'https://www.nba.com/news/2026-27-nba-regular-season-schedule', 'primaire'),
      source('NBA.com — schedule takeaways 2023-24 (formule 4/4/3/2)', 'https://www.nba.com/news/5-schedule-takeaways-2023-24-schedule', 'primaire'),
    ],
  },
  playIn: {
    qualifiesDirects: 6,
    rangsDuPlayIn: [7, 10],
    note: 'Le 7e reçoit le 8e (le vainqueur est 7e), le 9e reçoit le 10e (le perdant est éliminé), le perdant de 7-8 reçoit le vainqueur de 9-10 (le vainqueur est 8e).',
    source: source('NBA.com — NBA Play-In Tournament', 'https://www.nba.com/news/nba-play-in-tournament', 'primaire'),
  },
  playoffs: {
    equipesParConference: 8,
    victoiresPourGagnerUneSerie: 4,
    appariementsPremierTour: [
      [1, 8],
      [4, 5],
      [3, 6],
      [2, 7],
    ],
    receveurParMatch: ['haut', 'haut', 'bas', 'bas', 'haut', 'bas', 'haut'],
    note: 'Séries au meilleur des sept matchs, format 2-2-1-1-1, tableau fixe sans nouveau classement entre les tours ; avantage du terrain à la meilleure tête de série dans la conférence, au meilleur bilan en finale.',
    sources: [
      source('Sports Illustrated — NBA Playoffs format', 'https://www.si.com/nba/nba-playoffs-format-key-dates-and-more', 'secondaire'),
      source('Ticketmaster — NBA Playoffs seeding explained', 'https://blog.ticketmaster.com/nba-playoffs-format-explained', 'secondaire'),
    ],
  },
  departages: {
    deuxEquipes: [
      'confrontations',
      'vainqueur-division',
      'bilan-division',
      'bilan-conference',
      'bilan-qualifiables-conference',
      'bilan-qualifiables-autre-conference',
      'difference-points',
    ],
    plusieursEquipes: ['vainqueur-division', 'confrontations', 'bilan-division', 'bilan-conference', 'bilan-qualifiables-conference', 'difference-points'],
    dernierRecours: 'tirage',
    note: 'S’appliquent aux places de playoffs, de Play-In et au titre de division (départagé d’abord). « bilan-division » seulement si les équipes sont de la même division ; « qualifiables » : équipes aux dix meilleurs bilans de leur conférence, ex aequo compris. Départage partiel : on reprend les critères depuis le début pour les équipes encore à égalité.',
    source: source('NBA.com — Standings, tiebreaker procedures', 'https://www.nba.com/standings?Season=2025-26', 'primaire'),
  },
  recompenses: {
    matchsMinimum: 65,
    minutesPourCompter: 20,
    concernees: ['mvp', 'defenseur', 'progression', 'all-nba'],
    sansMinimum: ['rookie', 'sixieme-homme'],
    equipesAllNba: 3,
    joueursParEquipeAllNba: 5,
    note: 'Règle des 65 matchs (CBA 2023) : un match compte à partir de 20 minutes. Les exceptions (deux matchs entre 15 et 20 minutes, blessure de fin de saison après 62 matchs) ne sont pas simulées. Équipes All-NBA sans poste.',
    sources: [
      source('Yahoo Sports — Explaining the NBA’s 65-game rule', 'https://sports.yahoo.com/explaining-nbas-65-game-rule-030826797.html', 'secondaire'),
      source('Hoops Rumors — glossary, 65-game rule', 'https://hoopsrumors.com/2024/03/hoops-rumors-glossary-65-game-rule.html', 'secondaire'),
    ],
  },
  allStar: {
    titulairesParConference: 5,
    remplacantsParConference: 7,
    poidsDuVote: { fans: 0.5, joueurs: 0.25, medias: 0.25 },
    sansPoste: true,
    partDeLaSaison: 0.6,
    note: 'Titulaires : moyenne pondérée des rangs (fans 50 %, joueurs 25 %, médias 25 %), sans poste ; remplaçants choisis par les entraîneurs. Le match oppose l’Est à l’Ouest (décision du 24/11/2026, réponse 9), alors que l’édition 2026 réelle était un tournoi à trois équipes. Date : après 60 % de la saison (choix du jeu).',
    source: source('NBA Communications — 2026 All-Star starters voting results', 'https://pr.nba.com/2026-nba-all-star-game-starters-voting-results', 'primaire'),
  },
};
ecrire('data/ligue/saison-2026-27.json', saison);

// Endurance : ajout au modèle de notes.
const chemin = 'data/modeles/notes-v1.json';
const notes = JSON.parse(readFileSync(join(depot, chemin), 'utf8'));
notes.poids.endurance = { minutesParMatch: 1, partTitulaire: 0.3 };
notes.note = String(notes.note).replace(/ Tranche 4 :.*$/, '') + ' Tranche 4 : indice d’endurance ajouté (minutes par match, titularisations), recalé sur les ancrages des attributs ; validé par Antonin le 24/11/2026.';
ecrire(chemin, notes);

// 3. Réglages du moteur, version 3 : endurance et blessures en match (paramètres du modèle, non sourcés).
const v2 = existsSync(join(depot, 'data/moteur/match-v2.json')) ? 'data/moteur/match-v2.json' : 'data/moteur/match-v3.json';
const base = JSON.parse(readFileSync(join(depot, v2), 'utf8'));
const v3 = {
  ...base,
  datasetId: 'basket-legends-moteur-match-v3',
  note: 'Réglages du modèle de match (tranche 4) : ceux de la v2, plus l’endurance propre à chaque joueur et les blessures en match. Calibrés sur 1 000 matchs (npm run sonde) contre les moyennes de la saison régulière 2025-2026 ; les fréquences et durées de blessure sont des choix du modèle, sans cible sourcée.',
  fatigue: { ...base.fatigue, effetEndurance: 0.3 },
  rebonds: { ...base.rebonds, offensifDeBase: 0.256 },
  // Usage recalé sur la distribution des marqueurs 2025-26 (1er 33,5 ; 5e 28,3 ; 10e 26,0 ; 30e 20,1 points par match).
  tirs: { ...base.tirs, usageEchelle: 35 },
  contres: { ...base.contres, probabiliteSurEchecParType: { cercle: 0.325, miDistance: 0.108, troisPoints: 0.033 } },
  blessures: {
    probabiliteParMinute: 0.0007,
    gravites: [
      { part: 0.55, matchsMin: 1, matchsMax: 3 },
      { part: 0.35, matchsMin: 4, matchsMax: 15 },
      { part: 0.1, matchsMin: 16, matchsMax: 50 },
    ],
  },
};
ecrire('data/moteur/match-v3.json', v3);
if (v2.endsWith('v2.json')) rmSync(join(depot, v2));
