// Migration de la tranche 1 (24 novembre 2026) — écrit deux fichiers de paramètres du match rapide.
//
// 1. data/regles/nba-2026-27.json : les règles NBA dont le moteur a besoin, chacune avec sa référence au NBA Official
//    Rulebook (docs/03-basketball-rules/GAME_RULES.md). Statut « review_required » : les valeurs sont celles du règlement
//    connu, mais elles n'ont pas encore été vérifiées ligne à ligne contre l'édition 2026-27 (GAME_RULES.md § 8).
// 2. data/moteur/match-v0.json : les réglages du modèle de match (probabilités de base, sensibilités, fatigue). Ce ne sont
//    pas des statistiques sourcées : ce sont des valeurs de départ, marquées « provisoire-non-calibre », que la tranche 2
//    recalera sur les statistiques 2025-2026 relevées (docs/AUDIT_2026-11.md § 7).
//
// Usage : npx tsx tools/migrations/2026-11-24-tranche1.ts <dossier du dépôt>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();

const regle = (valeur: number, unite: string, definition: string, reference: string) => ({ valeur, unite, definition, reference });

const regles = {
  schemaVersion: 1,
  datasetId: 'basket-legends-regles-nba-2026-27',
  season: '2026-2027',
  league: 'NBA',
  status: 'review_required',
  source: {
    title: 'NBA Official Rulebook',
    url: 'https://official.nba.com/rulebook/',
    edition: 'à confirmer : édition applicable à la saison 2026-2027',
    verifiedAt: null,
    note: 'Valeurs reportées depuis le règlement NBA connu ; vérification ligne à ligne contre l’édition 2026-27 à faire avant le statut « validated » (GAME_RULES.md § 8).',
  },
  parametres: {
    joueursSurLeTerrain: regle(5, 'joueurs', 'Nombre de joueurs de chaque équipe sur le terrain.', 'Rule No. 3'),
    periodesReglementaires: regle(4, 'périodes', 'Nombre de quart-temps du temps réglementaire.', 'Rule No. 5'),
    dureePeriodeSecondes: regle(720, 'secondes', 'Durée d’un quart-temps (12 minutes).', 'Rule No. 5'),
    dureeProlongationSecondes: regle(300, 'secondes', 'Durée d’une prolongation (5 minutes), jouée en cas d’égalité.', 'Rule No. 5'),
    horlogeDePossessionSecondes: regle(24, 'secondes', 'Temps de possession avant de devoir tirer.', 'Rule No. 7'),
    horlogeApresRebondOffensifSecondes: regle(14, 'secondes', 'Temps de possession après un rebond offensif (remise à 14).', 'Rule No. 7'),
    valeurPanierInterieur: regle(2, 'points', 'Valeur d’un panier marqué à l’intérieur de la ligne à trois points.', 'Rule No. 5'),
    valeurPanierATroisPoints: regle(3, 'points', 'Valeur d’un panier marqué derrière la ligne à trois points.', 'Rule No. 5'),
    valeurLancerFranc: regle(1, 'points', 'Valeur d’un lancer franc réussi.', 'Rule No. 5'),
    lancersFrancsFauteSurTirInterieur: regle(2, 'lancers', 'Lancers accordés pour une faute sur un tir à deux points manqué.', 'Rule No. 12'),
    lancersFrancsFauteSurTirATroisPoints: regle(3, 'lancers', 'Lancers accordés pour une faute sur un tir à trois points manqué.', 'Rule No. 12'),
    lancersFrancsPanierAvecFaute: regle(1, 'lancers', 'Lancer accordé quand le tir est réussi malgré la faute.', 'Rule No. 12'),
    lancersFrancsPenalite: regle(2, 'lancers', 'Lancers accordés pour une faute défensive hors tir quand l’équipe fautive est en pénalité.', 'Rule No. 12'),
    fautesPersonnellesExclusion: regle(6, 'fautes', 'Nombre de fautes personnelles qui exclut un joueur du match.', 'Rule No. 3 et Rule No. 12'),
    rangFauteEquipePenalite: regle(5, 'rang', 'Rang de la faute d’équipe, dans un quart-temps, à partir duquel l’adversaire tire des lancers.', 'Rule No. 12'),
    rangFauteEquipePenaliteProlongation: regle(4, 'rang', 'Même rang pour une prolongation.', 'Rule No. 12'),
    finDePeriodeSecondes: regle(120, 'secondes', 'Les deux dernières minutes d’une période, où une règle de pénalité particulière s’applique.', 'Rule No. 12'),
    rangFauteEquipeFinDePeriode: regle(2, 'rang', 'Rang de la faute d’équipe commise dans les deux dernières minutes qui met en pénalité une équipe qui ne l’est pas encore.', 'Rule No. 12'),
  },
  possessionDebutDePeriode: {
    valeur: ['entre-deux', 'perdant', 'perdant', 'gagnant'],
    definition: 'Qui a le ballon au début de chaque quart-temps : entre-deux au premier, puis l’équipe qui a perdu l’entre-deux (2e et 3e), puis celle qui l’a gagné (4e). Chaque prolongation commence par un entre-deux.',
    reference: 'Rule No. 6',
  },
};

const reglages = {
  schemaVersion: 1,
  datasetId: 'basket-legends-moteur-match-v0',
  status: 'provisoire-non-calibre',
  note: 'Valeurs de départ du modèle de match rapide (tranche 1), choisies pour produire des matchs plausibles. Aucune n’est une statistique sourcée. La tranche 2 les recale sur les statistiques 2025-2026 relevées (saison régulière, Play-In et playoffs séparés).',
  possession: { dureeMoyenneSecondes: 14.5, dureeEcartSecondes: 4.5, dureeMinimaleSecondes: 4, tempsRestantMinimalPourTirer: 2 },
  tirs: {
    repartition: { cercle: 0.34, miDistance: 0.24, troisPoints: 0.42 },
    profilParGroupe: {
      meneur: { cercle: 0.8, miDistance: 1.0, troisPoints: 1.25 },
      ailier: { cercle: 1.0, miDistance: 1.0, troisPoints: 1.0 },
      interieur: { cercle: 1.7, miDistance: 0.9, troisPoints: 0.35 },
    },
    reussiteDeBase: { cercle: 0.62, miDistance: 0.41, troisPoints: 0.345 },
    sensibiliteParPoint: 0.006,
    avantageDomicile: 0.012,
    usageEchelle: 14,
  },
  lancersFrancs: { reussiteDeBase: 0.74, sensibiliteParPoint: 0.006, reussiteMin: 0.4, reussiteMax: 0.95 },
  pertesDeBalle: { probabiliteDeBase: 0.13, sensibiliteParPoint: 0.003, partInterceptions: 0.55 },
  fautes: { surTirParType: { cercle: 0.2, miDistance: 0.07, troisPoints: 0.025 }, partPanierAvecFaute: 0.22, horsTirParPossession: 0.1 },
  rebonds: { offensifDeBase: 0.25, sensibiliteParPoint: 0.004, poidsParGroupe: { meneur: 0.6, ailier: 1.1, interieur: 2.0 } },
  passes: { probabiliteSurPanier: 0.6, poidsParGroupe: { meneur: 2.2, ailier: 1.0, interieur: 0.6 } },
  contres: { probabiliteSurEchecParType: { cercle: 0.3, miDistance: 0.1, troisPoints: 0.03 }, poidsParGroupe: { meneur: 0.4, ailier: 1.0, interieur: 2.4 } },
  fatigue: { perteParMinute: 3.2, recuperationParMinute: 5, seuilRemplacement: 72, seuilRetour: 90, malusParPointPerdu: 0.12 },
  rotation: { profondeur: 10, relaisMinimalSecondes: 240 },
};

for (const [chemin, contenu] of [
  ['data/regles/nba-2026-27.json', regles],
  ['data/moteur/match-v0.json', reglages],
] as const) {
  const complet = join(depot, chemin);
  mkdirSync(join(complet, '..'), { recursive: true });
  writeFileSync(complet, JSON.stringify(contenu, null, 2) + '\n', 'utf8');
  console.log(`Écrit : ${chemin}`);
}
