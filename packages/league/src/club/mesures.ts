// Tranche 10 (réponse 56) : les mesures du critère de sortie — sur 10 saisons au pilote automatique, le nombre de GM
// licenciés par saison reste dans la fourchette calée sur le relevé réel (data/ligue/directions.json), le moral moyen
// reste stable, l'effet du moral en match reste de moyenne nulle (calibration inchangée).
import type { EtatSaison } from '../types';
import type { ModeleClub } from './types';

export interface MesuresClub {
  saison: string;
  licenciements: number;
  moralMoyen: number;
  /** Moyenne, sur les matchs, de la forme des deux équipes (doit rester proche de 0). */
  effetMoyen: number;
  /** Plus grand écart de forme observé entre deux équipes d'un match. */
  ecartMax: number;
  messages: number;
  dixJours: number;
  gLeagueMatchs: number;
}

export function mesurerClub(etat: EtatSaison): MesuresClub {
  const u = etat.univers;
  const C = u?.club;
  const moraux = Object.entries(u?.effectifs ?? {}).flatMap(([, js]) =>
    js.map((j) => C?.moral[j]).filter((x): x is number => x !== undefined),
  );
  const formes = etat.matchs.filter((m) => m.nature !== 'all-star').map((m): [number, number] => m.forme ?? [0, 0]);
  return {
    saison: etat.saison,
    licenciements: C?.licenciements[etat.saison]?.length ?? 0,
    moralMoyen: moraux.length ? moraux.reduce((s, x) => s + x, 0) / moraux.length : 0,
    effetMoyen: formes.length ? formes.reduce((s, [a, b]) => s + (a + b) / 2, 0) / formes.length : 0,
    ecartMax: formes.reduce((m, [a, b]) => Math.max(m, Math.abs(a - b)), 0),
    messages: etat.club?.messages.length ?? 0,
    dixJours: Object.values(etat.club?.dixJoursSignes ?? {}).reduce((s, x) => s + x, 0),
    gLeagueMatchs: etat.club?.gLeague?.matchs.filter((m) => m.score).length ?? 0,
  };
}

/** Les écarts au critère de sortie sur une suite de saisons (vide : critère tenu). */
export function ecartsDuClub(M: ModeleClub, mesures: readonly MesuresClub[]): string[] {
  const K = M.critereSortie;
  const e: string[] = [];
  if (!mesures.length) return e;
  const lic = mesures.map((m) => m.licenciements);
  const moyenne = lic.reduce((s, x) => s + x, 0) / lic.length;
  if (moyenne < K.licenciementsParSaison[0] || moyenne > K.licenciementsParSaison[1])
    e.push(`Licenciements de GM : ${moyenne.toFixed(1)} par saison (fourchette ${K.licenciementsParSaison.join(' à ')}).`);
  for (const m of mesures) {
    if (m.moralMoyen < K.moralMoyen[0] || m.moralMoyen > K.moralMoyen[1])
      e.push(`${m.saison} : moral moyen ${m.moralMoyen.toFixed(1)} (fourchette ${K.moralMoyen.join(' à ')}).`);
    if (Math.abs(m.effetMoyen) > K.effetMoyenMax)
      e.push(`${m.saison} : effet moyen du moral en match ${m.effetMoyen.toExponential(2)} (au plus ${K.effetMoyenMax}).`);
  }
  const derive = Math.abs(mesures.at(-1)!.moralMoyen - mesures[0]!.moralMoyen);
  if (derive > K.deriveMoralMax) e.push(`Dérive du moral moyen : ${derive.toFixed(1)} points (au plus ${K.deriveMoralMax}).`);
  return e;
}
