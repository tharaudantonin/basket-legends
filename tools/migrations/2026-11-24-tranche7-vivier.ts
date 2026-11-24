// Migration de la tranche 7 (24 novembre 2026) — vivier de joueurs originaux hors NBA (réponse 16 de
// docs/DECISIONS_2026-11.md : environ 320 joueurs générés, échelle 40-67).
//
// Le GDD vise environ 840 joueurs au départ (450 NBA, 180 en développement, 210 libres ou prospects, cible indicative).
// Le snapshot en compte 523 ; le vivier en ajoute 320 : 160 joueurs « en développement » (profil G League, jeunes, plus
// de marge) et 160 joueurs « libres » (profil agent libre ou championnat étranger, plus âgés, plus proches de leur
// plafond). Ils ne sont rattachés à aucune franchise avant la tranche 9 (free agency) et la tranche 10 (G League).
//
// Tous les paramètres ci-dessous sont des choix du modèle (aucune cible sourcée), au statut « proposition ». La
// génération reprend celle des prospects (packages/league/src/draft/prospects.ts) avec ses propres moyennes ; les noms
// viennent des banques de data/noms/ (jamais un nom réel interdit, jamais un nom du snapshot, jamais deux fois le même).
//
// Sortie : data/vivier/2026-27.json. Usage : npx tsx tools/migrations/2026-11-24-tranche7-vivier.ts [dépôt]
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { creerHasard } from '../../packages/engine/src';
import { generateurDeNoms, nomsPrisDesEffectifs, schemaBanques, schemaEffectif, schemaEmpreintes, schemaModeleDraft } from '../../packages/data/src';
import { gaussien, genererJoueur, type ModeleDraft, type OrigineProspect } from '../../packages/league/src';

const depot = process.argv[2] ?? process.cwd();
const json = (chemin: string): unknown => JSON.parse(readFileSync(join(depot, chemin), 'utf8'));
const GRAINE = 2026;

type Statut = 'developpement' | 'libre';
interface ModeleVivier {
  effectif: number;
  ages: Record<string, number>;
  origines: Partial<Record<OrigineProspect, number>>;
  ageDeReference: number;
  note: ModeleDraft['classe']['note'];
  potentiel: ModeleDraft['classe']['potentiel'];
}

const MODELE: Record<Statut, ModeleVivier> = {
  developpement: {
    effectif: 160,
    ages: { '20': 0.12, '21': 0.18, '22': 0.2, '23': 0.18, '24': 0.14, '25': 0.1, '26': 0.08 },
    origines: { 'g-league': 0.8, international: 0.2 },
    ageDeReference: 23,
    note: { moyenne: 55, ecartTalent: 4.5, parAnnee: 0.8, bruit: 2, min: 40, max: 67 },
    potentiel: { marge: 6, ecartTalent: 4, ecartPropre: 3, parAnneeDAge: 1.5, max: 80 },
  },
  libre: {
    effectif: 160,
    ages: { '24': 0.1, '25': 0.12, '26': 0.13, '27': 0.13, '28': 0.12, '29': 0.11, '30': 0.1, '31': 0.08, '32': 0.06, '33': 0.05 },
    origines: { 'g-league': 0.45, international: 0.55 },
    ageDeReference: 27,
    note: { moyenne: 57, ecartTalent: 4.5, parAnnee: 0.3, bruit: 2, min: 40, max: 67 },
    potentiel: { marge: 1, ecartTalent: 2, ecartPropre: 2, parAnneeDAge: 1, max: 72 },
  },
};

const effectifs = readdirSync(join(depot, 'data/rosters/2026-27'))
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => schemaEffectif.parse(json(`data/rosters/2026-27/${f}`)));
const noms = generateurDeNoms(schemaBanques.parse(json('data/noms/banques.json')), schemaEmpreintes.parse(json('data/noms/empreintes.json')));
const modeleDraft = schemaModeleDraft.parse(json('data/draft/modele-draft.json')) as unknown as ModeleDraft;
const pris = new Set(nomsPrisDesEffectifs(effectifs));

const pondere = <T extends string>(h: ReturnType<typeof creerHasard>, table: Partial<Record<T, number>>): T =>
  h.pondere(Object.keys(table) as T[], (k) => table[k] ?? 0);

type Genere = ReturnType<typeof genererJoueur> & { statut: Statut; origine: OrigineProspect };
const joueurs: Genere[] = [];
for (const statut of ['developpement', 'libre'] as const) {
  const V = MODELE[statut];
  const h = creerHasard(GRAINE, `vivier-${statut}`);
  const classe = { ...modeleDraft.classe, note: V.note, potentiel: V.potentiel };
  for (let i = 0; i < V.effectif; i++) {
    const age = Number(pondere(h, V.ages));
    const origine = pondere(h, V.origines);
    const j = genererJoueur(h, classe, noms, pris, gaussien(h), age, origine, V.ageDeReference);
    joueurs.push({ statut, origine, ...j });
  }
}
// Identifiants stables, du meilleur au moins bon dans chaque statut (lecture plus simple du fichier).
const tries = joueurs
  .map((j, k) => ({ j, k }))
  .sort((a, b) => a.j.statut.localeCompare(b.j.statut) || b.j.note - a.j.note || a.k - b.k)
  .map(({ j }, i) => ({ id: `g${String(i + 1).padStart(4, '0')}`, ...j }));

mkdirSync(join(depot, 'data/vivier'), { recursive: true });
writeFileSync(
  join(depot, 'data/vivier/2026-27.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      datasetId: 'basket-legends-vivier-2026-27',
      statut: 'proposition',
      note: 'Joueurs originaux générés hors NBA (échelle 40-67) pour approcher les 840 joueurs du GDD : 160 en développement, 160 libres. Choix du modèle, sans cible sourcée ; à valider par Antonin. Notes et attributs vrais (le scouting à notes incertaines ne concerne que les prospects de la Draft).',
      graine: GRAINE,
      modele: MODELE,
      joueurs: tries,
    },
    null,
    2,
  )}\n`,
);
const n = (s: Statut) => tries.filter((j) => j.statut === s);
const moy = (xs: Genere[]) => (xs.reduce((s, j) => s + j.note, 0) / xs.length).toFixed(1);
console.log(`Vivier : ${tries.length} joueurs (développement ${n('developpement').length}, note moyenne ${moy(n('developpement'))} ; libres ${n('libre').length}, note moyenne ${moy(n('libre'))}).`);
