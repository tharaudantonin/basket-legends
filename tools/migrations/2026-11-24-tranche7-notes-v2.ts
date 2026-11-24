// Migration de la tranche 7 (24 novembre 2026) — modèle de notes v2 (réponse 14 de docs/DECISIONS_2026-11.md).
//
// Le v2 reprend tels quels les paramètres validés du v1 (note globale, quatre familles, endurance, ancrages, notes a
// priori) et ajoute 16 attributs détaillés. Chacun est un indice pondéré des mêmes mesures rétrécies, recalé sur les
// ancrages des attributs. Les poids détaillés sont des choix du modèle (statut « proposition », à valider par Antonin) ;
// le niveau de confiance de chaque attribut dit ce que la statistique mesure vraiment (docs/NOTES_JOUEURS.md § 8).
//
// Sortie : data/modeles/notes-v2.json. Usage : npx tsx tools/migrations/2026-11-24-tranche7-notes-v2.ts [dépôt]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();
const v1 = JSON.parse(readFileSync(join(depot, 'data/modeles/notes-v1.json'), 'utf8')) as Record<string, unknown>;

const poidsDetailles = {
  tirCercle: { deux: 0.6, rebondsOffensifs: 0.3, taille: 0.3, lancersTentes: 0.2 },
  tirMiDistance: { lancers: 0.6, deux: 0.4 },
  tirATroisPoints: { trois: 1, troisTentes: 0.5 },
  lancersFrancs: { lancers: 1 },
  passe: { passes: 1, passesSurPertes: 0.4 },
  maniement: { usage: 0.5, passesSurPertes: 0.5, lancersTentes: 0.2 },
  defenseExterieure: { interceptions: 0.6, minutesParMatch: 0.3, taille: -0.2, fautes: -0.2 },
  defenseInterieure: { contres: 0.7, rebondsDefensifs: 0.4, taille: 0.4, fautes: -0.2 },
  interception: { interceptions: 1 },
  contre: { contres: 1, taille: 0.2 },
  rebondOffensif: { rebondsOffensifs: 1 },
  rebondDefensif: { rebondsDefensifs: 1 },
  vitesse: { interceptions: 0.4, lancersTentes: 0.3, taille: -0.5, poids: -0.3 },
  force: { poids: 0.6, rebondsOffensifs: 0.3, lancersTentes: 0.2 },
  qiOffensif: { passesSurPertes: 0.6, ts: 0.6, passes: 0.2 },
  qiDefensif: { interceptions: 0.3, contres: 0.3, rebondsDefensifs: 0.3, fautes: -0.5 },
};
const confianceDetails = {
  tirCercle: 'estime',
  tirMiDistance: 'estime',
  tirATroisPoints: 'mesure',
  lancersFrancs: 'mesure',
  passe: 'derive',
  maniement: 'estime',
  defenseExterieure: 'estime',
  defenseInterieure: 'estime',
  interception: 'derive',
  contre: 'derive',
  rebondOffensif: 'derive',
  rebondDefensif: 'derive',
  vitesse: 'estime',
  force: 'estime',
  qiOffensif: 'estime',
  qiDefensif: 'estime',
};

const v2 = {
  ...v1,
  datasetId: 'basket-legends-modele-notes-v2',
  version: 'notes-v2',
  status: 'proposition',
  note: 'Modèle de notes v2 (tranche 7, 24/11/2026, réponse 14). Reprend sans changement les paramètres validés du v1 (note globale, quatre familles, endurance, ancrages, notes a priori) et ajoute 16 attributs détaillés, chacun recalé sur les ancrages des attributs. Les poids détaillés sont des choix du modèle, à valider par Antonin. Les statistiques ne séparent pas les tirs près du cercle et à mi-distance : ces deux attributs sont estimés (adresse à deux points, lancers, taille).',
  poidsDetailles,
  confianceDetails,
};
writeFileSync(join(depot, 'data/modeles/notes-v2.json'), JSON.stringify(v2, null, 2) + '\n', 'utf8');
console.log('Écrit : data/modeles/notes-v2.json');
