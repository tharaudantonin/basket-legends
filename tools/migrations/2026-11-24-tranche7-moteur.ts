// Migration de la tranche 7 (24 novembre 2026) — réglages du moteur pour les attributs détaillés (modèle de notes v2).
//
// data/moteur/match-v5.json remplace match-v4.json : mêmes réglages, plus
// - `tirs.preferenceZoneEchelle` : un joueur tire plus souvent dans la zone où il est adroit (poids exp((a − 70) / E)) ;
// - réussites de base recalées (sonde de 1 000 matchs) : le moteur lit désormais l'adresse de chaque zone, les lancers,
//   la passe, le maniement, la défense intérieure ou extérieure, l'interception, le contre et le rebond offensif ou
//   défensif du joueur (docs/SIMULATION_MATCH.md § 9), au lieu des quatre familles.
// Le plan par défaut garde les 19 cibles 2025-26 dans leurs fourchettes.
//
// Usage : npx tsx tools/migrations/2026-11-24-tranche7-moteur.ts [dépôt]
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();
const ancien = existsSync(join(depot, 'data/moteur/match-v4.json')) ? 'data/moteur/match-v4.json' : 'data/moteur/match-v5.json';
const base = JSON.parse(readFileSync(join(depot, ancien), 'utf8'));

// Valeurs de calibration (sonde de 1 000 matchs, 24/11/2026).
const CALIBRATION = {
  preferenceZoneEchelle: 20,
  reussiteDeBase: { cercle: 0.653, miDistance: 0.427, troisPoints: 0.346 },
  repartition: { cercle: 0.235, miDistance: 0.356, troisPoints: 0.409 },
  rebondOffensifDeBase: 0.266,
  pertesProbabiliteDeBase: 0.121,
  facteurContres: 1.045,
  lancersReussiteDeBase: 0.788,
};

const v5 = {
  ...base,
  datasetId: 'basket-legends-moteur-match-v5',
  note: 'Réglages du modèle de match (tranche 7) : ceux de la v4, lus sur les attributs détaillés du modèle de notes v2, plus la préférence de zone du tireur ; réussites de base recalées. Calibrés sur 1 000 matchs (npm run sonde) contre les moyennes de la saison régulière 2025-2026 avec le plan par défaut ; les effets des plans (validés le 24/11/2026) et du défenseur direct sont des choix du modèle.',
  tirs: {
    ...base.tirs,
    repartition: CALIBRATION.repartition,
    reussiteDeBase: CALIBRATION.reussiteDeBase, preferenceZoneEchelle: CALIBRATION.preferenceZoneEchelle },
  pertesDeBalle: { ...base.pertesDeBalle, probabiliteDeBase: CALIBRATION.pertesProbabiliteDeBase },
  contres: {
    ...base.contres,
    probabiliteSurEchecParType: Object.fromEntries(
      Object.entries(base.contres.probabiliteSurEchecParType as Record<string, number>).map(([t, p]) => [
        t,
        Math.round(p * CALIBRATION.facteurContres * 1000) / 1000,
      ]),
    ),
  },
  rebonds: { ...base.rebonds, offensifDeBase: CALIBRATION.rebondOffensifDeBase },
  lancersFrancs: { ...base.lancersFrancs, reussiteDeBase: CALIBRATION.lancersReussiteDeBase },
};

writeFileSync(join(depot, 'data/moteur/match-v5.json'), JSON.stringify(v5, null, 2) + '\n', 'utf8');
console.log('Écrit : data/moteur/match-v5.json');
if (ancien.endsWith('v4.json')) {
  rmSync(join(depot, ancien));
  console.log(`Supprimé : ${ancien} (gardé dans l'historique Git)`);
}
