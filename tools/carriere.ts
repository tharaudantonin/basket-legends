// `npm run carriere [saisons] [-- --matchs] [-- --graine=n]` : enchaîne des saisons de carrière et mesure la distribution
// des notes (critère de sortie de la tranche 8 : stable sur 20 saisons, fourchettes de packages/league/src/carriere/mesures.ts).
// Sans `--matchs`, chaque saison est « accélérée » (aucun match, Draft dans l'ordre de la force des équipes) : 20 saisons
// en quelques secondes. Avec `--matchs`, chaque saison est jouée en entier par le moteur (environ 4 s par saison).
import {
  avancer,
  avancerDraft,
  contexteDeLaSaison,
  ecartsDeStabilite,
  mesurerUnivers,
  nouvelleSaison,
  passerALaSaisonSuivante,
  terminerSansMatchs,
  type EtatSaison,
  type MesuresUnivers,
} from '../packages/league/src';
import { chargerContexte } from '../packages/league/tests/outils';

const args = process.argv.slice(2);
const saisons = Number(args.find((a) => /^\d+$/.test(a)) ?? 20);
const avecMatchs = args.includes('--matchs');
const graine = Number(args.find((a) => a.startsWith('--graine='))?.slice(9) ?? 2026);

const base = chargerContexte(false, true);
let etat: EtatSaison = nouvelleSaison(base, graine, 'boston');
const mesures: MesuresUnivers[] = [mesurerUnivers(base.univers!)];
const debut = Date.now();
const demenagements: string[] = [];
let retraites = 0;
for (let s = 1; s <= saisons; s++) {
  const ctx = contexteDeLaSaison(base, etat);
  if (avecMatchs) {
    etat = avancer(ctx, etat, 'fin');
    etat = avancerDraft(ctx, { ...etat, draft: { ...etat.draft!, delegue: true } });
  } else etat = terminerSansMatchs(ctx, etat);
  etat = passerALaSaisonSuivante(base, etat);
  const a = etat.archives!.at(-1)!;
  retraites += a.retraites.length;
  if (a.demenagement) demenagements.push(`${a.saison} : ${a.demenagement.de} → ${a.demenagement.vers}`);
  mesures.push(mesurerUnivers(etat.univers!));
}

const colonnes: (keyof MesuresUnivers)[] = [
  'saison',
  'nba',
  'moyenne',
  'p10',
  'p50',
  'p90',
  'au80',
  'au90',
  'max',
  'ageMoyen',
  'horsNba',
  'population',
];
console.log(colonnes.map((c) => String(c).padStart(9)).join(''));
for (const m of mesures) console.log(colonnes.map((c) => String(m[c]).padStart(9)).join(''));
const ecarts = mesures.slice(1).flatMap((m) => ecartsDeStabilite(mesures[0]!, m));
console.log(
  `\n${saisons} saisons ${avecMatchs ? 'jouées' : 'accélérées'} en ${((Date.now() - debut) / 1000).toFixed(1)} s ; ${retraites} retraites (${(retraites / saisons).toFixed(0)} par saison).`,
);
console.log(`Changements de franchise : ${demenagements.length ? demenagements.join(' ; ') : 'aucun'}.`);
console.log(
  ecarts.length
    ? `Hors fourchette (${ecarts.length}) :\n  ${ecarts.join('\n  ')}`
    : 'Distribution stable : toutes les saisons dans leurs fourchettes.',
);
if (ecarts.length) process.exitCode = 1;
