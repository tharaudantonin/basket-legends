// Migration de la tranche 7 (24 novembre 2026) — âge de saison des joueurs du snapshot.
//
// Le dépôt n'a pas les dates de naissance (docs/PLAYER_MIRROR.md les demande ; elles ne sont pas relevées). La seule
// source d'âge est data/statistiques/2025-26/joueurs.json : l'âge selon Basketball-Reference, qui le donne au
// 1er février de la saison (2025-26 : au 1er février 2026). L'âge au 1er février 2027, même convention pour la saison
// 2026-27, s'en déduit exactement : + 1 (et + 2 depuis la ligne 2024-25 des joueurs qui n'ont pas joué en 2025-26).
// Les joueurs sans ligne de statistiques (53 choix de la Draft 2026, 21 joueurs sans match NBA) ont leur âge calculé
// depuis leur date de naissance, relevée le 24/11/2026 sur les 30 pages d'effectif 2026-27 de Basketball-Reference
// (`teams/<ÉQUIPE>/2027.html`), même convention (âge au 1er février 2027). Le relevé brut (vrais noms) et son
// rattachement aux identifiants du jeu restent dans le dossier privé : `naissances-2026-27/naissances-par-identifiant.csv`
// (identifiant, date). Contrôle : quand les deux sources existent, l'âge déduit de la date doit être égal à celui des
// statistiques, sinon la migration s'arrête. Un joueur absent des deux sources garde un âge inconnu (null) : il n'est
// jamais estimé.
//
// Sortie : champ `seasonAge` de chaque joueur de data/rosters/2026-27/*.json (après `country`) et `provenance.age`.
// Usage : npx tsx tools/migrations/2026-11-24-tranche7-ages.ts [dépôt] [dossier privé]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const depot = process.argv[2] ?? process.cwd();
const prive = process.argv[3] ?? join(depot, '..', 'basket-legends-prive');
type Ligne = { age?: number };
const stats = JSON.parse(readFileSync(join(depot, 'data/statistiques/2025-26/joueurs.json'), 'utf8')) as {
  joueurs: Record<string, { saisonReguliere?: Ligne; playIn?: Ligne; playoffs?: Ligne; saison2024_25?: Ligne }>;
};

const dateDe = new Map(
  readFileSync(join(prive, 'naissances-2026-27/naissances-par-identifiant.csv'), 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(',') as [string, string]),
);

/** Âge au 1er février 2027 (convention de Basketball-Reference pour la saison 2026-27). */
function ageAu1erFevrier2027(date: string): number {
  const [a, m, j] = date.split('-').map(Number) as [number, number, number];
  return 2027 - a - (m > 2 || (m === 2 && j > 1) ? 1 : 0);
}

let parDate = 0;
let controles = 0;
function ageDeSaison(id: string): number | null {
  const s = stats.joueurs[id];
  const a2526 = s?.saisonReguliere?.age ?? s?.playIn?.age ?? s?.playoffs?.age;
  const parStats = a2526 !== undefined ? a2526 + 1 : s?.saison2024_25?.age !== undefined ? s.saison2024_25.age + 2 : undefined;
  const date = dateDe.get(id);
  const parNaissance = date ? ageAu1erFevrier2027(date) : undefined;
  if (parStats !== undefined && parNaissance !== undefined) {
    if (parStats !== parNaissance) throw new Error(`${id} : âge ${parStats} par les statistiques, ${parNaissance} par la date de naissance.`);
    controles++;
  }
  if (parStats === undefined && parNaissance !== undefined) parDate++;
  return parStats ?? parNaissance ?? null;
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
    'seasonAge : âge au 1er février 2027 (convention de Basketball-Reference pour la saison 2026-27), déduit de l’âge 2025-26 (+ 1) ou 2024-25 (+ 2) de data/statistiques/2025-26/joueurs.json, sinon de la date de naissance relevée le 24/11/2026 sur la page d’effectif 2026-27 de Basketball-Reference (relevé hors du dépôt) ; null si inconnu.';
  writeFileSync(chemin, `${JSON.stringify(e, null, 2)}\n`);
}
console.log(
  `Âge de saison : ${connus} connus (dont ${parDate} par la date de naissance), ${inconnus} inconnus ; ${controles} âges des statistiques confirmés par la date de naissance.`,
);
