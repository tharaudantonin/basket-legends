// Migration du 25 novembre 2026 — loterie 3-2-1 : table des probabilités par choix transmise par Antonin.
//
// La table (probabilités moyennes par catégorie, choix 1 à 16) vient d'une analyse communautaire publiée sur Reddit,
// dont l'URL n'a pas été fournie : elle n'entre pas dans `sources` (une source doit avoir une URL). Le calcul exact du
// mécanisme du jeu (tirage au prorata des boules restantes, plancher au 12e choix appliqué de la pire à la meilleure au
// bilan) la reproduit à 0,02 point près pour les 64 valeurs ; packages/league/tests/draft.test.ts la contrôle par
// simulation. Le statut reste « à recouper » : la table officielle de la NBA n'est toujours pas relevée.
//
// Usage : npx tsx tools/migrations/2026-11-25-loterie-table.ts [dépôt]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { schemaLoterie } from '../../packages/data/src';

const depot = process.argv[2] ?? process.cwd();
const chemin = join(depot, 'data/draft/loterie-2027-2029.json');
const l = schemaLoterie.parse(JSON.parse(readFileSync(chemin, 'utf8')));
l.note =
  'Loterie « 3-2-1 » adoptée le 28/05/2026 pour les Drafts 2027 à 2029. Sourcé : 16 équipes, boules par catégorie, 16 choix tirés, plancher au 12e choix pour les trois pires bilans, limites de choix consécutifs, choix 17 à 30 au bilan inverse des 14 autres équipes, 2e tour au bilan inverse des 30. Le 25/11/2026, Antonin a transmis une table des probabilités par choix et par catégorie issue d’une analyse communautaire (Reddit, URL non fournie) : le mécanisme du jeu la reproduit à 0,02 point près (calcul exact, contrôlé par simulation dans les tests). À recouper avec la table officielle de la NBA : application du plancher entre les trois reléguées (la table ne donne que leur moyenne), limites de choix consécutifs, départage des bilans égaux (tirage au sort déterministe dans le jeu).';
writeFileSync(chemin, `${JSON.stringify(schemaLoterie.parse(l), null, 2)}\n`);
console.log('Loterie : note mise à jour.');
