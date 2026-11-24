// Migration de la tranche 2 (24 novembre 2026) — écrit les paramètres versionnés de la tranche.
//
// 1. data/regles/nba-2026-27.json : règles vérifiées le 24/11/2026 contre les pages du NBA Official Rulebook 2026-27
//    (official.nba.com, chaque page renvoyant au PDF « 2026-27 NBA Rulebook »), avec la section précise de chaque valeur.
//    Statut « validated ». Ajout de la règle d'horloge après une faute défensive hors tir (Rule No. 7, Section IV, 5.1).
// 2. data/modeles/notes-v1.json : les paramètres du modèle de notes v1 (packages/data/src/notes.ts, docs/NOTES_JOUEURS.md).
// 3. data/moteur/match-v1.json : les réglages du moteur de match, calibrés sur 1 000 matchs contre les moyennes de la
//    ligue 2025-2026 (data/statistiques/2025-26/ligue.json, docs/SIMULATION_MATCH.md § 3). Remplace match-v0.json.
//
// Usage : npx tsx tools/migrations/2026-11-24-tranche2-parametres.ts [dépôt]
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();
const regle = (valeur: number, unite: string, definition: string, reference: string) => ({ valeur, unite, definition, reference });

const regles = {
  schemaVersion: 1,
  datasetId: 'basket-legends-regles-nba-2026-27',
  season: '2026-2027',
  league: 'NBA',
  status: 'validated',
  source: {
    title: 'NBA Official Rulebook',
    url: 'https://official.nba.com/rulebook/',
    edition: '2026-27 NBA Rulebook (pages HTML des règles sur official.nba.com, qui renvoient au PDF de l’édition 2026-27)',
    verifiedAt: '2026-11-24',
    note: 'Vérifié le 24/11/2026 contre les pages des règles 3, 5, 6, 7, 9 et 12 et la page « 2026-27 Points of Emphasis » (29/09/2026), qui n’annonce aucun changement sur ces valeurs. Le PDF lui-même n’a pas pu être lu (délai dépassé) : à relire si une différence est signalée.',
  },
  parametres: {
    joueursSurLeTerrain: regle(5, 'joueurs', 'Nombre de joueurs de chaque équipe sur le terrain.', 'Rule No. 3, Section I, 1 (« Each team shall consist of five players »)'),
    periodesReglementaires: regle(4, 'périodes', 'Nombre de quart-temps du temps réglementaire.', 'Rule No. 5, Sections IV et VI (premier à quatrième quart-temps)'),
    dureePeriodeSecondes: regle(720, 'secondes', 'Durée d’un quart-temps (12 minutes).', 'Rule No. 5, Section II, 1'),
    dureeProlongationSecondes: regle(300, 'secondes', 'Durée d’une prolongation (5 minutes), jouée en cas d’égalité.', 'Rule No. 5, Section II, 2'),
    horlogeDePossessionSecondes: regle(24, 'secondes', 'Temps de possession avant de devoir tirer.', 'Rule No. 7, Section I'),
    horlogeApresRebondOffensifSecondes: regle(
      14,
      'secondes',
      'Horloge remise à 14 s quand l’attaque reprend le ballon après un tir manqué qui a touché le cercle (rebond offensif).',
      'Rule No. 7, Section IV, 4.1',
    ),
    valeurPanierInterieur: regle(2, 'points', 'Valeur d’un panier marqué à l’intérieur de la ligne à trois points.', 'Rule No. 5, Section I, 2'),
    valeurPanierATroisPoints: regle(3, 'points', 'Valeur d’un panier marqué derrière la ligne à trois points.', 'Rule No. 5, Section I, 3'),
    valeurLancerFranc: regle(1, 'points', 'Valeur d’un lancer franc réussi.', 'Rule No. 5, Section I, 6'),
    lancersFrancsFauteSurTirInterieur: regle(2, 'lancers', 'Lancers accordés pour une faute sur un tir à deux points manqué.', 'Rule No. 12-B, Section I, 5.2.4 (« two/three free throw attempts »)'),
    lancersFrancsFauteSurTirATroisPoints: regle(3, 'lancers', 'Lancers accordés pour une faute sur un tir à trois points manqué.', 'Rule No. 12-B, Section I, 5.2.4 (« two/three free throw attempts »)'),
    lancersFrancsPanierAvecFaute: regle(1, 'lancers', 'Lancer accordé quand le tir est réussi malgré la faute.', 'Rule No. 12-B, Section I, 5.2.3'),
    lancersFrancsPenalite: regle(
      2,
      'lancers',
      'Lancers accordés pour une faute défensive hors tir quand l’équipe fautive est en pénalité (un lancer plus un lancer de pénalité).',
      'Rule No. 12-B, Section I, 5.2.5',
    ),
    fautesPersonnellesExclusion: regle(6, 'fautes', 'Nombre de fautes personnelles qui exclut un joueur du match.', 'Rule No. 3, Section I, 1'),
    rangFauteEquipePenalite: regle(
      5,
      'rang',
      'Rang de la faute d’équipe, dans un quart-temps, à partir duquel l’adversaire tire des lancers (quatre fautes d’équipe sans pénalité).',
      'Rule No. 12-B, Section V, 1 et 1.1',
    ),
    rangFauteEquipePenaliteProlongation: regle(4, 'rang', 'Même rang pour une prolongation (trois fautes d’équipe sans pénalité).', 'Rule No. 12-B, Section V, 1.2 et 1.4'),
    finDePeriodeSecondes: regle(120, 'secondes', 'Les deux dernières minutes d’une période, où une règle de pénalité particulière s’applique.', 'Rule No. 12-B, Section V, 1.3'),
    rangFauteEquipeFinDePeriode: regle(
      2,
      'rang',
      'Une équipe pas encore en pénalité a droit à une faute d’équipe sans pénalité dans les deux dernières minutes : la deuxième la met en pénalité.',
      'Rule No. 12-B, Section V, 1.3',
    ),
    horlogeMinimaleApresFauteDefensiveSecondes: regle(
      14,
      'secondes',
      'Après une faute défensive hors tir (remise en jeu en zone avant), l’horloge garde sa valeur ou remonte à 14 s, la plus grande des deux.',
      'Rule No. 7, Section IV, 5.1',
    ),
  },
  possessionDebutDePeriode: {
    valeur: ['entre-deux', 'perdant', 'perdant', 'gagnant'],
    definition:
      'Qui a le ballon au début de chaque quart-temps : entre-deux au premier, puis l’équipe qui a perdu l’entre-deux (2e et 3e), puis celle qui l’a gagné (4e). Chaque prolongation commence par un entre-deux.',
    reference: 'Rule No. 6, Section I, 1 et 2 ; Section V, 1.2',
  },
};

const notes = {
  schemaVersion: 1,
  datasetId: 'basket-legends-modele-notes-v1',
  version: 'notes-v1',
  status: 'proposition',
  note: 'Modèle de notes v1 (tranche 2, 24/11/2026). Formule maison à partir des statistiques 2025-2026 sourcées, recalée par quantiles sur l’échelle « NBA » (décision du 23/11/2026). Les poids et ancrages sont des choix de conception, à valider par Antonin ; les corrections manuelles seront marquées « corrigé par Antonin ».',
  statistiques: 'data/statistiques/2025-26/joueurs.json',
  retrecissement: {
    minutesDePrior: 400,
    tentativesDePriorTirs: 150,
    tentativesDePriorTrois: 100,
    tentativesDePriorLancers: 50,
    minutesPourLaReference: 500,
  },
  poids: {
    globale: { gameScore: 1, minutesParMatch: 0.8, partTitulaire: 0.3 },
    technique: { ts: 1, points: 0.6, trois: 0.4, lancers: 0.4, troisTentes: 0.3 },
    physique: { rebondsOffensifs: 0.6, rebondsDefensifs: 0.6, contres: 0.5, lancersTentes: 0.3, taille: 0.4 },
    mental: { usage: 0.6, passesSurPertes: 0.5, lancers: 0.3, minutesParMatch: 0.5 },
    tactique: { passes: 0.7, interceptions: 0.7, contres: 0.3, rebondsDefensifs: 0.3, fautes: -0.3, pertes: -0.3 },
  },
  ancrages: {
    globale: [
      [0, 58],
      [0.1, 63],
      [0.25, 67],
      [0.5, 72],
      [0.75, 76],
      [0.9, 81],
      [0.97, 87],
      [0.99, 91],
      [1, 96],
    ],
    attributs: [
      [0, 50],
      [0.1, 58],
      [0.25, 64],
      [0.5, 70],
      [0.75, 76],
      [0.9, 82],
      [0.97, 88],
      [1, 95],
    ],
  },
  sansStatistique: {
    parRangDeDraft: [
      [1, 73],
      [5, 70],
      [14, 67],
      [30, 64],
      [60, 60],
    ],
    nonDrafte: 58,
  },
  bornes: { min: 40, max: 99 },
};

const reglages = {
  schemaVersion: 1,
  datasetId: 'basket-legends-moteur-match-v1',
  status: 'calibre',
  note: 'Réglages du modèle de match, calibrés le 24/11/2026 sur 1 000 matchs (npm run sonde) contre les moyennes de la saison régulière 2025-2026 (data/statistiques/2025-26/ligue.json), avec les notes du modèle v1. Les réglages restent des paramètres du modèle, pas des statistiques : seules les cibles sont sourcées.',
  possession: { dureeMoyenneSecondes: 13.87, dureeEcartSecondes: 4.5, dureeMinimaleSecondes: 4, tempsRestantMinimalPourTirer: 2 },
  tirs: {
    repartition: { cercle: 0.249, miDistance: 0.355, troisPoints: 0.396 },
    profilParGroupe: {
      meneur: { cercle: 0.8, miDistance: 1.0, troisPoints: 1.25 },
      ailier: { cercle: 1.0, miDistance: 1.0, troisPoints: 1.0 },
      interieur: { cercle: 1.7, miDistance: 0.9, troisPoints: 0.35 },
    },
    reussiteDeBase: { cercle: 0.662, miDistance: 0.415, troisPoints: 0.323 },
    sensibiliteParPoint: 0.006,
    avantageDomicile: 0.02,
    usageEchelle: 14,
  },
  lancersFrancs: { reussiteDeBase: 0.767, sensibiliteParPoint: 0.006, reussiteMin: 0.4, reussiteMax: 0.95 },
  pertesDeBalle: { probabiliteDeBase: 0.125, sensibiliteParPoint: 0.003, partInterceptions: 0.57 },
  fautes: { surTirParType: { cercle: 0.216, miDistance: 0.076, troisPoints: 0.027 }, partPanierAvecFaute: 0.22, horsTirParPossession: 0.104 },
  rebonds: { offensifDeBase: 0.258, sensibiliteParPoint: 0.004, poidsParGroupe: { meneur: 0.6, ailier: 1.1, interieur: 2.0 }, partRebondsDEquipe: 0.118 },
  passes: { probabiliteSurPanier: 0.632, poidsParGroupe: { meneur: 2.2, ailier: 1.0, interieur: 0.6 } },
  contres: { probabiliteSurEchecParType: { cercle: 0.332, miDistance: 0.11, troisPoints: 0.033 }, poidsParGroupe: { meneur: 0.4, ailier: 1.0, interieur: 2.4 } },
  fatigue: { perteParMinute: 3.2, recuperationParMinute: 5, seuilRemplacement: 72, seuilRetour: 90, malusParPointPerdu: 0.12 },
  rotation: { profondeur: 10, relaisMinimalSecondes: 240 },
};

for (const [chemin, contenu] of [
  ['data/regles/nba-2026-27.json', regles],
  ['data/modeles/notes-v1.json', notes],
  ['data/moteur/match-v1.json', reglages],
] as const) {
  const complet = join(depot, chemin);
  mkdirSync(join(complet, '..'), { recursive: true });
  writeFileSync(complet, JSON.stringify(contenu, null, 2) + '\n', 'utf8');
  console.log(`Écrit : ${chemin}`);
}
rmSync(join(depot, 'data/moteur/match-v0.json'), { force: true });
console.log('Retiré : data/moteur/match-v0.json (remplacé par match-v1.json ; l’historique Git le garde)');
