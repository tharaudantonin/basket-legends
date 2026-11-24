// Migration de la tranche 7 (24 novembre 2026) — âge de saison des joueurs du snapshot.
//
// Le dépôt n'a pas les dates de naissance (docs/PLAYER_MIRROR.md les demande ; elles ne sont pas relevées). La seule
// source d'âge est data/statistiques/2025-26/joueurs.json : l'âge selon Basketball-Reference, qui le donne au
// 1er février de la saison (2025-26 : au 1er février 2026). L'âge au 1er février 2027, même convention pour la saison
// 2026-27, s'en déduit exactement : + 1 (et + 2 depuis la ligne 2024-25 des joueurs qui n'ont pas joué en 2025-26).
// Les joueurs sans ligne de statistiques (choix de la Draft 2026, joueurs sans match NBA) gardent un âge inconnu
// (null) : il n'est jamais estimé.
//
// Sortie : champ `seasonAge` de chaque joueur de data/rosters/2026-27/*.json (après `country`) et `provenance.age`.
// Usage : npx tsx tools/migrations/2026-11-24-tranche7-ages.ts [dépôt]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();
type Ligne = { age?: number };
const stats = JSON.parse(readFileSync(join(depot, 'data/statistiques/2025-26/joueurs.json'), 'utf8')) as {
  joueurs: Record<string, { saisonReguliere?: Ligne; playIn?: Ligne; playoffs?: Ligne; saison2024_25?: Ligne }>;
};

function ageDeSaison(id: string): number | null {
  const s = stats.joueurs[id];
  const a2526 = s?.saisonReguliere?.age ?? s?.playIn?.age ?? s?.playoffs?.age;
  if (a2526 !== undefined) return a2526 + 1;
  if (s?.saison2024_25?.age !== undefined) return s.saison2024_25.age + 2;
  return null;
}

const dossier = join(depot, 'data/rosters/2026-27');
let connus = 0;
let inconnus = 0;
for (const f of readdirSync(dossier).filter((x) => x.endsWith('.json')).sort()) {
  const chemin = join(dossier, f);
  const e = JSON.parse(readFileSync(chemin, 'utf8')) as { provenance: Record<string, unknown>; players: Record<string, unknown>[] };
  e.players = e.players.map((j) => {
    const age = ageDeSaison(j['id'] as string);
    if (age === null) inconnus++;
    else connus++;
    const sortie: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(j)) {
      if (k === 'seasonAge') continue;
      sortie[k] = v;
      if (k === 'country') sortie['seasonAge'] = age;
    }
    return sortie;
  });
  e.provenance['age'] =
    'seasonAge : âge au 1er février 2027 (convention de Basketball-Reference pour la saison 2026-27), déduit de l’âge 2025-26 (+ 1) ou 2024-25 (+ 2) de data/statistiques/2025-26/joueurs.json ; null si inconnu (aucune date de naissance relevée).';
  writeFileSync(chemin, `${JSON.stringify(e, null, 2)}\n`);
}
console.log(`Âge de saison : ${connus} connus, ${inconnus} inconnus (null).`);
