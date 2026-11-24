// `npm run sonde [nombre de matchs]` : joue un lot de matchs rapides et affiche les moyennes par équipe et par match.
// Outil de mesure pour la calibration (tranche 2) : il ne compare encore à aucune statistique sourcée.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { equipeDuMatch, reglagesDuMoteur, schemaEffectif, schemaReglagesMatch, schemaRegles, valeursDesRegles } from '@basket-legends/data';
import { simulerMatch } from '@basket-legends/engine';

const racine = process.cwd();
const json = (chemin: string): unknown => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));
const regles = valeursDesRegles(schemaRegles.parse(json('data/regles/nba-2026-27.json')));
const reglages = reglagesDuMoteur(schemaReglagesMatch.parse(json('data/moteur/match-v0.json')));
const equipes = readdirSync(join(racine, 'data/rosters/2026-27'))
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => equipeDuMatch(schemaEffectif.parse(json(`data/rosters/2026-27/${f}`))));

const nombre = Number(process.argv[2] ?? 1000);
const mesures = new Map<string, number[]>();
const noter = (cle: string, v: number) => mesures.set(cle, [...(mesures.get(cle) ?? []), v]);
let prolongations = 0;
let victoiresDomicile = 0;
const debut = performance.now();
for (let g = 0; g < nombre; g++) {
  const a = equipes[g % 30]!;
  let b = equipes[(g * 7 + 3 + Math.floor(g / 30)) % 30]!;
  if (a.id === b.id) b = equipes[(g + 1) % 30]!;
  const r = simulerMatch({ graine: g, domicile: a, exterieur: b, regles, reglages });
  if (r.boxScore.prolongations) prolongations++;
  if (r.boxScore.equipes[0].points > r.boxScore.equipes[1].points) victoiresDomicile++;
  for (const e of r.boxScore.equipes) {
    const t = e.totaux;
    noter('points', e.points);
    noter('tirs tentés', t.tirsTentes);
    noter('% tirs', (100 * t.tirsReussis) / t.tirsTentes);
    noter('3 pts tentés', t.troisTentes);
    noter('% 3 pts', (100 * t.troisReussis) / t.troisTentes);
    noter('lancers tentés', t.lancersTentes);
    if (t.lancersTentes) noter('% lancers', (100 * t.lancersReussis) / t.lancersTentes);
    noter('rebonds off.', t.rebondsOffensifs);
    noter('rebonds déf.', t.rebondsDefensifs);
    noter('passes déc.', t.passes);
    noter('interceptions', t.interceptions);
    noter('contres', t.contres);
    noter('balles perdues', t.pertes);
    noter('fautes', t.fautes);
    const mins = e.joueurs.map((j) => j.dixiemes / 600).sort((x, y) => y - x);
    noter('minutes du 1er', mins[0]!);
    noter('minutes du 5e', mins[4]!);
    noter('minutes du 9e', mins[8]!);
    noter('joueurs utilisés', mins.filter((m) => m > 0).length);
  }
}
const duree = performance.now() - debut;
for (const [cle, v] of mesures) {
  const moy = v.reduce((s, x) => s + x, 0) / v.length;
  console.log(
    `${cle.padEnd(18)} moyenne ${moy.toFixed(1).padStart(6)}   min ${Math.min(...v)
      .toFixed(1)
      .padStart(6)}   max ${Math.max(...v)
      .toFixed(1)
      .padStart(6)}`,
  );
}
console.log(
  `${nombre} matchs · prolongations ${((100 * prolongations) / nombre).toFixed(1)} % · victoires à domicile ${((100 * victoiresDomicile) / nombre).toFixed(1)} % · ${(duree / nombre).toFixed(2)} ms par match`,
);
