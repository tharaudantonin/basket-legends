// Tranche 9 (réponse 43) : le critère de sortie — « 10 saisons au pilote automatique sans dérive ». Mesures de l'univers
// au début de chaque saison (effectifs, masses, salaires et notes, agents libres laissés de côté, concentration des
// stars, équilibre des forces) et volumes de la saison écoulée (échanges, signatures). Les fourchettes sont des choix
// du jeu (data/modeles/marche-v1.json, bloc `critereSortie`), non sourcées, sauf les volumes visés (2025-26 relevé).
import { saisonCourte, salaireDeLaSaison } from '../cba';
import type { Univers } from '../carriere/types';
import type { ParametresCba } from '../cba';
import { situationDansLUnivers } from './operations';
import type { ModeleMarche } from './types';
import { force } from './valeur';

export interface MesuresMarche {
  saison: string;
  standardMin: number;
  standardMax: number;
  equipesTaxe: number;
  equipesDeuxiemeApron: number;
  /** Corrélation entre salaire de la saison et note (contrats standard hors échelle des rookies). */
  correlationSalaireNote: number;
  /** Meilleure note d'un joueur libre hors NBA au début de la saison. */
  meilleurLibre: number;
  /** Le plus grand nombre de joueurs notés 85 ou plus dans une même équipe. */
  joueurs85Max: number;
  /** Coefficient de Gini des forces des équipes. */
  giniForce: number;
}

function correlation(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy || 1);
}

function gini(xs: number[]): number {
  const t = [...xs].sort((a, b) => a - b);
  const n = t.length;
  const somme = t.reduce((a, b) => a + b, 0);
  let s = 0;
  t.forEach((x, i) => (s += (2 * (i + 1) - n - 1) * x));
  return s / (n * somme || 1);
}

/** Les mesures du marché d'un univers au début de sa saison. */
export function mesurerMarche(M: ModeleMarche, P0: ParametresCba, u: Univers): MesuresMarche {
  const Sc = saisonCourte(u.saison);
  const equipes = Object.keys(u.effectifs);
  const situations = equipes.map((e) => situationDansLUnivers(P0, u, e));
  const lignes = Object.values(u.effectifs)
    .flat()
    .filter((j) => {
      const c = u.contrats[j];
      return c?.type === 'standard' && !(c.draft?.tour === 1 && (c.anciennete ?? 0) <= 4 && c.salaires.some((s) => s.option === 'equipe'));
    });
  return {
    saison: u.saison,
    standardMin: Math.min(...situations.map((s) => s.effectif.standard)),
    standardMax: Math.max(...situations.map((s) => s.effectif.standard)),
    equipesTaxe: situations.filter((s) => s.taxe > 0).length,
    equipesDeuxiemeApron: situations.filter((s) => s.niveau === 'deuxieme-apron').length,
    correlationSalaireNote:
      Math.round(
        100 *
          correlation(
            lignes.map((j) => salaireDeLaSaison(u.contrats[j], Sc)),
            lignes.map((j) => u.joueurs[j]!.note),
          ),
      ) / 100,
    meilleurLibre: Math.max(0, ...Object.keys(u.horsNba).map((j) => u.joueurs[j]?.note ?? 0)),
    joueurs85Max: Math.max(...equipes.map((e) => (u.effectifs[e] ?? []).filter((j) => (u.joueurs[j]?.note ?? 0) >= 85).length)),
    giniForce:
      Math.round(
        1000 *
          gini(
            equipes.map((e) =>
              force(
                M,
                (u.effectifs[e] ?? []).map((j) => u.joueurs[j]?.note ?? 40),
              ),
            ),
          ),
      ) / 1000,
  };
}

/** Les écarts d'une saison aux fourchettes du critère de sortie (vide : dans les fourchettes). */
export function ecartsDuMarche(M: ModeleMarche, m: MesuresMarche, volumes?: { echanges: number; signatures: number }): string[] {
  const C = M.critereSortie;
  const e: string[] = [];
  const dans = (x: number, [a, b]: [number, number]) => x >= a && x <= b;
  if (m.standardMin < C.standardParEquipe[0] || m.standardMax > C.standardParEquipe[1])
    e.push(`${m.saison} contrats standard : ${m.standardMin} à ${m.standardMax}`);
  if (!dans(m.equipesTaxe, C.equipesTaxe)) e.push(`${m.saison} équipes à la taxe : ${m.equipesTaxe}`);
  if (!dans(m.equipesDeuxiemeApron, C.equipesDeuxiemeApron))
    e.push(`${m.saison} équipes au-delà du second apron : ${m.equipesDeuxiemeApron}`);
  if (m.correlationSalaireNote < C.correlationSalaireNoteMin) e.push(`${m.saison} corrélation salaire-note : ${m.correlationSalaireNote}`);
  if (m.meilleurLibre >= C.noteMaxAgentLibreNonSigne) e.push(`${m.saison} agent libre non signé noté ${m.meilleurLibre}`);
  if (m.joueurs85Max > C.joueurs85ParEquipeMax) e.push(`${m.saison} ${m.joueurs85Max} joueurs à 85+ dans une équipe`);
  if (m.giniForce > C.giniForceMax) e.push(`${m.saison} Gini des forces : ${m.giniForce}`);
  if (volumes && !dans(volumes.echanges, C.echangesParSaison)) e.push(`${m.saison} échanges : ${volumes.echanges}`);
  if (volumes && !dans(volumes.signatures, C.signaturesParSaison)) e.push(`${m.saison} signatures : ${volumes.signatures}`);
  return e;
}
