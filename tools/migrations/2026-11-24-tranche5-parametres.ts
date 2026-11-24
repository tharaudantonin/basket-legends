// Migration de la tranche 5 (24 novembre 2026) — plans de jeu et défenseur direct.
//
// data/moteur/match-v4.json remplace match-v3.json : mêmes réglages, plus
// - `plans` : effets du rythme (durée des possessions, pertes de balle, fatigue), de la part du tir à trois points et de
//   la défense de zone (répartition et réussite des tirs adverses, rebond offensif adverse, pertes de balle) ;
// - `defenseurDirect` : part du défenseur direct dans l'opposition au tir en défense individuelle, et effet de l'écart de
//   taille près du cercle.
// Ce sont des choix du modèle, sans cible sourcée (aucune statistique publique fiable par plan de jeu n'a été relevée) :
// ils sont mesurés par `npm run sonde` (section « Plans de jeu ») et notés dans docs/SIMULATION_MATCH.md § 8.
// Le plan par défaut (rythme normal, défense individuelle, part habituelle du tir à trois points) garde la calibration.
//
// Usage : npx tsx tools/migrations/2026-11-24-tranche5-parametres.ts [dépôt]
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();
const ancien = existsSync(join(depot, 'data/moteur/match-v3.json')) ? 'data/moteur/match-v3.json' : 'data/moteur/match-v4.json';
const base = JSON.parse(readFileSync(join(depot, ancien), 'utf8'));

const { positions, ...avant } = base;
const v4 = {
  ...avant,
  datasetId: 'basket-legends-moteur-match-v4',
  // Le meilleur défenseur part sur le meilleur attaquant : l'adresse baisse un peu ; réussite de base recalée (sonde).
  tirs: { ...avant.tirs, reussiteDeBase: { cercle: 0.661, miDistance: 0.417, troisPoints: 0.324 } },
  note: 'Réglages du modèle de match (tranche 5) : ceux de la v3, plus les effets des plans de jeu et du défenseur direct. Calibrés sur 1 000 matchs (npm run sonde) contre les moyennes de la saison régulière 2025-2026 avec le plan par défaut ; les effets des plans et du défenseur direct sont des choix du modèle, sans cible sourcée.',
  plans: {
    rythme: {
      lent: { facteurDuree: 1.15, pertes: -0.004, fatigue: 0.95 },
      normal: { facteurDuree: 1, pertes: 0, fatigue: 1 },
      rapide: { facteurDuree: 0.85, pertes: 0.008, fatigue: 1.08 },
    },
    troisPoints: { moins: 0.75, normal: 1, plus: 1.3 },
    zone: {
      repartition: { cercle: 0.85, miDistance: 1.05, troisPoints: 1.12 },
      reussite: { cercle: -0.025, miDistance: 0, troisPoints: 0.012 },
      rebondOffensif: 0.025,
      pertes: -0.004,
    },
  },
  defenseurDirect: { poids: 0.5, tailleCercleParCm: 0.15 },
  positions,
};

writeFileSync(join(depot, 'data/moteur/match-v4.json'), JSON.stringify(v4, null, 2) + '\n', 'utf8');
console.log('Écrit : data/moteur/match-v4.json');
if (ancien.endsWith('v3.json')) {
  rmSync(join(depot, ancien));
  console.log(`Supprimé : ${ancien} (gardé dans l'historique Git)`);
}
