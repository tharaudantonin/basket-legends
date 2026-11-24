// `npm run verifier` : contrôle les données de référence de `data/` et explique chaque problème en français.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifierDonnees, type SourcesDonnees } from '@basket-legends/data/verification';

export function lireSources(racine: string): SourcesDonnees {
  const json = (chemin: string): unknown => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));
  const dossier = 'data/rosters/2026-27';
  const effectifs: Record<string, unknown> = {};
  for (const f of readdirSync(join(racine, dossier)).filter((x) => x.endsWith('.json'))) effectifs[f] = json(`${dossier}/${f}`);
  return {
    registre: json('data/franchises.json'),
    csv: readFileSync(join(racine, 'data/franchises.csv'), 'utf8'),
    effectifs,
    banques: json('data/noms/banques.json'),
    empreintes: json('data/noms/empreintes.json'),
  };
}

const appelDirect = process.argv[1]?.replace(/\\/g, '/').endsWith('tools/verifier-donnees.ts');
if (appelDirect) {
  const rapport = verifierDonnees(lireSources(process.cwd()));
  for (const a of rapport.avertissements) console.log(`Avertissement — ${a}`);
  for (const e of rapport.erreurs) console.log(`Erreur — ${e}`);
  console.log(
    `${rapport.joueurs} joueurs contrôlés : ${rapport.erreurs.length} erreur(s), ${rapport.avertissements.length} avertissement(s).`,
  );
  process.exitCode = rapport.erreurs.length ? 1 : 0;
}
