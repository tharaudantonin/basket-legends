// Migration du 25 novembre 2026 — validation en bloc des propositions (docs/DECISIONS_2026-11.md, réponse 26).
//
// Antonin a validé telles quelles les propositions des tranches 7 et 8 : poids du modèle de notes v2, modèle des
// prospects et du scouting, choix du staff à la Draft, vivier, modèle de carrière (fourchettes de stabilité comprises),
// noms et conférences des villes d'accueil. Aucun paramètre ne change : seuls les statuts et les notes de statut.
// Les noms des villes restent soumis à la revue juridique de la porte de publication.
//
// Usage : npx tsx tools/migrations/2026-11-25-tranche9-validations.ts [dépôt]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schemaModeleCarriere,
  schemaModeleDraft,
  schemaParametresNotes,
  schemaVillesDAccueil,
  schemaVivier,
} from '../../packages/data/src';

const depot = process.argv[2] ?? process.cwd();
const VALIDE = 'Validé par Antonin le 25/11/2026 (réponse 26).';

function modifier<T>(fichier: string, schema: { parse: (x: unknown) => T }, changer: (x: T) => void): void {
  const chemin = join(depot, fichier);
  const x = schema.parse(JSON.parse(readFileSync(chemin, 'utf8')));
  changer(x);
  writeFileSync(chemin, `${JSON.stringify(schema.parse(x), null, 2)}\n`);
  console.log(`${fichier} : validé.`);
}

// Idempotent : la mention n'est ajoutée qu'une fois (le script peut être relancé).
const avecMention = (note: string) => (note.includes(VALIDE) ? note : `${note} ${VALIDE}`);
const sansAValider = (note: string) => avecMention(note.replace(/ ?À valider par Antonin\.?/g, '').replace(/, à valider par Antonin/g, '').trim());

modifier('data/modeles/notes-v2.json', schemaParametresNotes, (m) => {
  m.status = 'valide';
  m.note = sansAValider(m.note);
});
modifier('data/draft/modele-draft.json', schemaModeleDraft, (m) => {
  m.statut = 'valide';
  m.note = sansAValider(m.note);
});
modifier('data/vivier/2026-27.json', schemaVivier, (m) => {
  m.statut = 'valide';
  m.note = sansAValider(m.note);
});
modifier('data/modeles/carriere-v1.json', schemaModeleCarriere, (m) => {
  m.statut = 'valide';
  m.note = avecMention(m.note);
});
modifier('data/ligue/villes-d-accueil.json', schemaVillesDAccueil, (m) => {
  m.statut = 'valide';
  m.note = `${m.note.replace('Noms : propositions originales à valider par Antonin, puis à soumettre', 'Noms : originaux, validés par Antonin le 25/11/2026 (réponse 26), à soumettre')}`;
  for (const v of m.villes) v.statutNoms = 'valide';
});
