// `npm run notes` : applique le modèle de notes (data/modeles/notes-v1.json) aux effectifs de data/rosters/2026-27/.
// Les effectifs se modifient par script : cet outil réécrit `ratings` et `attributes` de chaque joueur, et rien d'autre.
// Refaisable : mêmes statistiques et mêmes paramètres → mêmes notes (vérifié par les tests de packages/data).
// Une note corrigée à la main garde sa valeur si `ratings.correction` vaut « corrigé par Antonin ».
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { calculerNotes, schemaEffectif, schemaParametresNotes, schemaStatistiquesJoueurs, type NotesJoueur } from '@basket-legends/data';

export const FICHIER_MODELE = 'data/modeles/notes-v1.json';

/** Les notes du modèle pour tous les joueurs des effectifs, lues depuis le dépôt. */
export function notesDuDepot(racine: string): Map<string, NotesJoueur> {
  const json = (chemin: string): unknown => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));
  const P = schemaParametresNotes.parse(json(FICHIER_MODELE));
  const stats = schemaStatistiquesJoueurs.parse(json(P.statistiques));
  const dossier = 'data/rosters/2026-27';
  const joueurs = readdirSync(join(racine, dossier))
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => schemaEffectif.parse(json(`${dossier}/${f}`)).players)
    .map((j) => ({ id: j.id, tailleCm: j.measurements.height.heightCm }));
  return new Map(calculerNotes(joueurs, stats, P).map((n) => [n.id, n]));
}

export function noteDuJoueur(n: NotesJoueur, version: string) {
  const calcul =
    n.base === 'statistiques'
      ? `Modèle ${version} : statistiques de saison régulière ${n.saisonDeReference} (${n.minutes} minutes), recalées par quantiles.`
      : n.base === 'rang-de-draft'
        ? `Modèle ${version} : aucune statistique NBA ; note a priori selon le rang de draft 2026.`
        : `Modèle ${version} : aucune statistique NBA ni rang de draft ; note a priori des joueurs sans statistique.`;
  return {
    ratings: {
      overall: n.globale,
      scale: 100,
      source: version,
      status: n.base === 'statistiques' ? 'calcule' : 'a-priori',
      base: n.base,
      saisonDeReference: n.saisonDeReference,
      calculation: calcul,
    },
    attributes: { technique: n.technique, physical: n.physique, mental: n.mental, tactical: n.tactique, scale: 100 },
  };
}

const appelDirect = process.argv[1]?.replace(/\\/g, '/').endsWith('tools/calculer-notes.ts');
if (appelDirect) {
  const racine = process.cwd();
  const version = schemaParametresNotes.parse(JSON.parse(readFileSync(join(racine, FICHIER_MODELE), 'utf8'))).version;
  const notes = notesDuDepot(racine);
  const dossier = join(racine, 'data/rosters/2026-27');
  let corriges = 0;
  for (const f of readdirSync(dossier).filter((x) => x.endsWith('.json'))) {
    const brut = JSON.parse(readFileSync(join(dossier, f), 'utf8')) as {
      players: Record<string, unknown>[];
      provenance: Record<string, unknown>;
    };
    for (const j of brut.players) {
      const r = j.ratings as { correction?: string };
      if (r.correction === 'corrigé par Antonin') {
        corriges++;
        continue;
      }
      Object.assign(j, noteDuJoueur(notes.get(j.id as string)!, version));
    }
    brut.provenance.ratings = `Notes et attributs du modèle ${version} (data/modeles/notes-v1.json, docs/NOTES_JOUEURS.md), calculés par npm run notes.`;
    schemaEffectif.parse(brut);
    writeFileSync(join(dossier, f), JSON.stringify(brut, null, 2) + '\n', 'utf8');
  }
  const liste = [...notes.values()];
  const compte = (b: string) => liste.filter((n) => n.base === b).length;
  console.log(
    `${liste.length} joueurs notés : ${compte('statistiques')} sur statistiques, ${compte('rang-de-draft')} par rang de draft, ${compte('sans-statistique')} sans statistique ; ${corriges} correction(s) manuelle(s) gardée(s).`,
  );
}
