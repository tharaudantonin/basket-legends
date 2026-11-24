// Migration de la tranche 3 (24 novembre 2026) — complète les paramètres pour les temps-morts, les fins de match et la
// position des tirs. Elle part des fichiers écrits par la tranche 2 et ne change aucune valeur existante.
//
// 1. data/regles/nba-2026-27.json : règles des temps-morts (Rule No. 5, Section VI), horloge des 24 s éteinte en fin de
//    période (Rule No. 7, Section II, 9), temps minimal pour tirer (Comments on the Rules, L), ligne à trois points et
//    zone restreinte (Rule No. 1, Section I). Vérifiées le 24/11/2026 sur official.nba.com (pages de l'édition 2026-27).
// 2. data/statistiques/2025-26/ligue.json : part et réussite des tirs à trois points pris dans les coins (même page de
//    Basketball-Reference que les autres moyennes, tableau « Shooting Stats », relevé le 24/11/2026).
// 3. data/moteur/match-v2.json : réglages des temps-morts, des fins de match tactiques et de la position des tirs,
//    recalibrés sur 1 000 matchs. Remplace match-v1.json (gardé dans l'historique Git).
//
// Usage : npx tsx tools/migrations/2026-11-24-tranche3-parametres.ts [dépôt]
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();
const lire = (chemin: string) => JSON.parse(readFileSync(join(depot, chemin), 'utf8')) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const ecrire = (chemin: string, contenu: unknown) => {
  writeFileSync(join(depot, chemin), JSON.stringify(contenu, null, 2) + '\n', 'utf8');
  console.log(`Écrit : ${chemin}`);
};
const regle = (valeur: number, unite: string, definition: string, reference: string) => ({ valeur, unite, definition, reference });

// 1. Règles.
const regles = lire('data/regles/nba-2026-27.json');
Object.assign(regles.parametres, {
  tempsMortsParMatch: regle(7, 'temps-morts', 'Temps-morts accordés à chaque équipe pour le temps réglementaire.', 'Rule No. 5, Section VI, 1'),
  tempsMortsMaxQuatriemePeriode: regle(4, 'temps-morts', 'Nombre maximal de temps-morts d’une équipe dans le quatrième quart-temps.', 'Rule No. 5, Section VI, 1'),
  tempsMortsMaxFinDeMatch: regle(
    2,
    'temps-morts',
    'Nombre maximal de temps-morts d’une équipe après les trois dernières minutes du quatrième quart-temps.',
    'Rule No. 5, Section VI, 1',
  ),
  debutFinDeMatchTempsMortsSecondes: regle(180, 'secondes', 'Repère des trois dernières minutes du quatrième quart-temps pour la limite précédente.', 'Rule No. 5, Section VI, 1'),
  tempsMortsParProlongation: regle(2, 'temps-morts', 'Temps-morts accordés à chaque équipe pour chaque prolongation.', 'Rule No. 5, Section VI, 2'),
  repereTempsMortObligatoire1Secondes: regle(
    419,
    'secondes',
    'Si aucun temps-mort n’a été pris avant 6:59, le marqueur en accorde un à l’équipe qui reçoit au premier ballon mort.',
    'Rule No. 5, Section VI, 3',
  ),
  repereTempsMortObligatoire2Secondes: regle(
    179,
    'secondes',
    'Si aucun autre temps-mort n’a été pris avant 2:59, le marqueur en accorde un à l’équipe qui n’en a pas encore été chargée.',
    'Rule No. 5, Section VI, 3',
  ),
  dureeTempsMortObligatoireSecondes: regle(165, 'secondes', 'Durée d’un temps-mort obligatoire (2:45, match local).', 'Rule No. 5, Section VI, 3.c'),
  dureeTempsMortSecondes: regle(75, 'secondes', 'Durée d’un temps-mort supplémentaire (1:15).', 'Rule No. 5, Section VI, 3.c'),
  horlogeEteinteSousSecondes: regle(
    24,
    'secondes',
    'S’il reste 24 s ou moins dans la période, l’horloge des tirs ne fonctionne plus après un changement de possession.',
    'Rule No. 7, Section II, 9',
  ),
  tempsMinimalPourTirerSecondes: regle(
    0.3,
    'secondes',
    'Temps minimal au chronomètre pour recevoir le ballon et tirer (en dessous, seule une claquette peut compter).',
    'Comments on the Rules, L (Expiration of Time)',
  ),
  ligneATroisPointsPieds: regle(23.75, 'pieds', 'Distance de la ligne à trois points au centre du panier, en haut de l’arc (23’9”).', 'Rule No. 1, Section I, 4'),
  zoneRestreintePieds: regle(4, 'pieds', 'Rayon du demi-cercle de la zone restreinte autour du centre du panier.', 'Rule No. 1, Section I, 9'),
});
regles.source.note = `${String(regles.source.note).replace(/ ?Tranche 3 :.*$/, '')} Tranche 3 : règles 1, 4, 5 (temps-morts) et Comments on the Rules (0,3 s) vérifiées le 24/11/2026 sur les mêmes pages.`;
ecrire('data/regles/nba-2026-27.json', regles);

// 2. Moyennes de la ligue : tirs à trois points des coins.
const ligue = lire('data/statistiques/2025-26/ligue.json');
ligue.tirsParDistance.partTroisDansLesCoins = 0.246;
ligue.tirsParDistance.reussiteTroisDansLesCoins = 0.387;
ecrire('data/statistiques/2025-26/ligue.json', ligue);

// 3. Réglages du moteur, version 2.
// Refaisable : part de la v1 tant qu'elle existe, sinon de la v2 déjà écrite.
const v1 = lire(existsSync(join(depot, 'data/moteur/match-v1.json')) ? 'data/moteur/match-v1.json' : 'data/moteur/match-v2.json');
const reglages = {
  ...v1,
  datasetId: 'basket-legends-moteur-match-v2',
  status: 'calibre',
  note: 'Réglages du modèle de match (tranche 3) : ceux de la v1, plus les temps-morts, les fins de match tactiques et la position des tirs, recalibrés le 24/11/2026 sur 1 000 matchs (npm run sonde) contre les moyennes de la saison régulière 2025-2026. Les réglages sont des paramètres du modèle, pas des statistiques : seules les cibles sont sourcées.',
  // Recalibrés le 24/11/2026 (les temps-morts reposent les joueurs et les fins de période changent le nombre de possessions).
  possession: { ...v1.possession, dureeMoyenneSecondes: 13.95 },
  tirs: {
    ...v1.tirs,
    repartition: { cercle: 0.249, miDistance: 0.356, troisPoints: 0.395 },
    reussiteDeBase: { cercle: 0.661, miDistance: 0.411, troisPoints: 0.32 },
  },
  lancersFrancs: { ...v1.lancersFrancs, reussiteDeBase: 0.763 },
  pertesDeBalle: { ...v1.pertesDeBalle, probabiliteDeBase: 0.125, partInterceptions: 0.571 },
  fautes: { ...v1.fautes, surTirParType: { cercle: 0.219, miDistance: 0.077, troisPoints: 0.028 }, horsTirParPossession: 0.1 },
  rebonds: { ...v1.rebonds, offensifDeBase: 0.249, partRebondsDEquipe: 0.115 },
  passes: { ...v1.passes, probabiliteSurPanier: 0.637 },
  contres: { ...v1.contres, probabiliteSurEchecParType: { cercle: 0.339, miDistance: 0.112, troisPoints: 0.034 } },
  tempsMorts: {
    serieAdverseDeclencheur: 8,
    bonusActionPreparee: 0.03,
    recuperationParMinute: 1.5,
  },
  finDeMatch: {
    fauteVolontaireEcartMax: 8,
    fauteVolontaireSecondesParPoint: 8,
    fauteVolontaireSecondesMax: 45,
    dureeFauteVolontaireSecondes: 3,
    gestionAvanceFraction: 0.85,
    presseEcartMin: 4,
    presseDureeSecondes: 7,
    malusTirPresse: 0.15,
    partTroisEnRetardDeTrois: 0.85,
    margeDernierTirSecondes: 2.5,
  },
  positions: {
    partTroisDansLesCoins: 0.246,
    distanceTroisDansLesCoinsPieds: 22,
    miDistanceParTranche: { troisDix: 0.209, dixSeize: 0.095, seizeLigne: 0.049 },
  },
};
ecrire('data/moteur/match-v2.json', reglages);
rmSync(join(depot, 'data/moteur/match-v1.json'), { force: true });
console.log('Retiré : data/moteur/match-v1.json (remplacé par match-v2.json ; l’historique Git le garde)');
