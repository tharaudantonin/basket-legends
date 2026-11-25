// Migration de la tranche 8 (24 novembre 2026) — échelle des prospects alignée sur celle des vrais rookies (réponse 22 de
// docs/DECISIONS_2026-11.md : « Échelle des vrais rookies »).
//
// Le modèle de notes (validé, réponse 10) donne aux recrues réelles de 2026 une note a priori selon leur rang : 73 au
// 1er choix, 70 au 5e, 67 au 14e, 64 au 30e, 60 au 60e (docs/NOTES_JOUEURS.md § 3). Les prospects générés suivent
// désormais cette échelle : pour une classe de 100, le talent du 1er (≈ +2,3 écarts-types) donne 73, celui du 30e
// (≈ +0,5) 64, celui du 60e (≈ −0,25) 60. Les prospects non draftés restent sous 60 environ ; le vivier (40-67) ne change pas.
// Le potentiel est recalé avec la carrière (tranche 8, `npm run carriere`) : marge plus faible, écart de talent plus fort.
//
// Usage : npx tsx tools/migrations/2026-11-24-tranche8-prospects.ts [dépôt]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { schemaModeleDraft } from '../../packages/data/src';

const depot = process.argv[2] ?? process.cwd();
const chemin = join(depot, 'data/draft/modele-draft.json');
const m = schemaModeleDraft.parse(JSON.parse(readFileSync(chemin, 'utf8')));
m.classe.note = { moyenne: 60.5, ecartTalent: 5, parAnnee: 1, bruit: 2, min: 45, max: 73 };
m.classe.potentiel = { marge: 4, ecartTalent: 7.5, ecartPropre: 4, parAnneeDAge: 2, max: 97 };
m.note =
  'Choix du modèle (aucune cible sourcée) pour générer les classes de Draft et pour le scouting à notes incertaines. Depuis la tranche 8 (réponse 22), les prospects suivent l’échelle des vrais rookies : notes a priori du modèle de notes selon le rang (73 au 1er choix, 64 au 30e, 60 au 60e). Le vivier hors NBA garde l’échelle 40-67. Potentiel recalé avec la carrière sur 20 saisons. À valider par Antonin.';
writeFileSync(chemin, `${JSON.stringify(schemaModeleDraft.parse(m), null, 2)}\n`);
console.log('Modèle de Draft : échelle des vrais rookies.');
