// Tranche 8 : mesures de la distribution des notes d'un univers, et fourchettes de stabilité sur 20 saisons (critère de
// sortie de la tranche 8). Les fourchettes sont des tolérances choisies pour le jeu, pas des valeurs sourcées.
import type { Univers } from './types';

export interface MesuresUnivers {
  saison: string;
  /** Joueurs sous contrat standard NBA. */
  nba: number;
  moyenne: number;
  p10: number;
  p50: number;
  p90: number;
  /** Joueurs NBA à 80 ou plus, à 90 ou plus. */
  au80: number;
  au90: number;
  max: number;
  ageMoyen: number;
  horsNba: number;
  population: number;
}

const quantile = (tries: number[], q: number) => tries[Math.round(q * (tries.length - 1))] ?? 0;
const arrondi = (x: number) => Math.round(x * 10) / 10;

export function mesurerUnivers(u: Univers): MesuresUnivers {
  const nba = Object.values(u.effectifs)
    .flat()
    .filter((j) => u.contrats[j]?.type === 'standard')
    .map((j) => u.joueurs[j]!);
  const notes = nba.map((j) => j.note).sort((a, b) => a - b);
  return {
    saison: u.saison,
    nba: nba.length,
    moyenne: arrondi(notes.reduce((s, x) => s + x, 0) / notes.length),
    p10: quantile(notes, 0.1),
    p50: quantile(notes, 0.5),
    p90: quantile(notes, 0.9),
    au80: notes.filter((x) => x >= 80).length,
    au90: notes.filter((x) => x >= 90).length,
    max: notes.at(-1) ?? 0,
    ageMoyen: arrondi(nba.reduce((s, j) => s + j.age, 0) / nba.length),
    horsNba: Object.keys(u.horsNba).length,
    population: Object.keys(u.joueurs).length,
  };
}

/** Écarts tolérés par rapport à la première saison. */
export const FOURCHETTES_STABILITE = {
  moyenne: 1.5,
  p10: 2.5,
  p50: 2.5,
  p90: 2.5,
  /** Part relative. */
  au80: 0.3,
  au90: 5,
  ageMoyen: 1.5,
  /** Part relative. */
  population: 0.1,
} as const;

/** Les écarts hors fourchette d'une saison par rapport à la première (vide : stable). */
export function ecartsDeStabilite(depart: MesuresUnivers, m: MesuresUnivers): string[] {
  const F = FOURCHETTES_STABILITE;
  const e: string[] = [];
  const abs = (cle: 'moyenne' | 'p10' | 'p50' | 'p90' | 'au90' | 'ageMoyen') => {
    if (Math.abs(m[cle] - depart[cle]) > F[cle]) e.push(`${m.saison} ${cle} : ${m[cle]} (départ ${depart[cle]}, ±${F[cle]})`);
  };
  const rel = (cle: 'au80' | 'population') => {
    if (Math.abs(m[cle] - depart[cle]) > F[cle] * depart[cle])
      e.push(`${m.saison} ${cle} : ${m[cle]} (départ ${depart[cle]}, ±${F[cle] * 100} %)`);
  };
  abs('moyenne');
  abs('p10');
  abs('p50');
  abs('p90');
  abs('au90');
  abs('ageMoyen');
  rel('au80');
  rel('population');
  return e;
}
