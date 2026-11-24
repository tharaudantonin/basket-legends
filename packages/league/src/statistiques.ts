// Tranche 4 : cumul des statistiques de saison à partir des box scores, et moyennes utiles aux récompenses.
import type { BoxScore } from '@basket-legends/engine';
import type { LigneSaison } from './types';

export const ligneSaisonVide = (equipe: string): LigneSaison => ({
  equipe,
  matchs: 0,
  titularisations: 0,
  matchsEligibles: 0,
  dixiemes: 0,
  points: 0,
  tirsReussis: 0,
  tirsTentes: 0,
  troisReussis: 0,
  troisTentes: 0,
  lancersReussis: 0,
  lancersTentes: 0,
  rebondsOffensifs: 0,
  rebondsDefensifs: 0,
  passes: 0,
  interceptions: 0,
  contres: 0,
  pertes: 0,
  fautes: 0,
  plusMoins: 0,
});

const CUMULS = [
  'dixiemes',
  'points',
  'tirsReussis',
  'tirsTentes',
  'troisReussis',
  'troisTentes',
  'lancersReussis',
  'lancersTentes',
  'rebondsOffensifs',
  'rebondsDefensifs',
  'passes',
  'interceptions',
  'contres',
  'pertes',
  'fautes',
  'plusMoins',
] as const;

/** Ajoute un box score aux totaux (seuls les joueurs entrés en jeu comptent un match). */
export function cumuler(totaux: Record<string, LigneSaison>, b: BoxScore, minutesPourCompter: number): void {
  for (const e of b.equipes) {
    for (const j of e.joueurs) {
      if (j.dixiemes <= 0) continue;
      const t = (totaux[j.id] ??= ligneSaisonVide(e.id));
      t.equipe = e.id;
      t.matchs++;
      if (j.titulaire) t.titularisations++;
      if (j.dixiemes >= minutesPourCompter * 600) t.matchsEligibles++;
      for (const k of CUMULS) t[k] += j[k];
    }
  }
}

/** Game Score de Hollinger d'une ligne de totaux, par match. */
export function gameScoreParMatch(t: LigneSaison): number {
  if (!t.matchs) return 0;
  const gs =
    t.points +
    0.4 * t.tirsReussis -
    0.7 * t.tirsTentes -
    0.4 * (t.lancersTentes - t.lancersReussis) +
    0.7 * t.rebondsOffensifs +
    0.3 * t.rebondsDefensifs +
    t.interceptions +
    0.7 * t.passes +
    0.7 * t.contres -
    0.4 * t.fautes -
    t.pertes;
  return gs / t.matchs;
}

export const parMatch = (t: LigneSaison, cle: keyof LigneSaison): number => (t.matchs ? Number(t[cle]) / t.matchs : 0);
