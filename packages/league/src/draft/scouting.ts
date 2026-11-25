// Tranche 7 : le scouting à notes incertaines (amélioration validée le 24/11/2026 : la vraie note d'un prospect n'est
// jamais affichée). Chaque équipe voit chaque valeur avec une erreur qui lui est propre, fixée par la graine : observer
// davantage un prospect resserre la même erreur (écart-type ÷ √(1 + observations)), sans la retirer au hasard. Deux
// équipes peuvent donc se tromper différemment sur le même joueur. Paramètres : data/draft/modele-draft.json, bloc
// `scouting` (choix du modèle).
import { ATTRIBUTS_DETAILLES, creerHasard, type AttributsDetailles } from '@basket-legends/engine';
import { gaussien } from './prospects';
import type { Estimation, ModeleDraft, Prospect, RapportDeScouting } from './types';

/** Le quantile à 95 % de la loi normale : la fourchette affichée couvre 90 % des cas. */
const Z90 = 1.645;

function estimer(vraie: number, ecart: number, graine: number, sel: string): Estimation {
  const erreur = gaussien(creerHasard(graine, sel));
  const valeur = Math.round(vraie + ecart * erreur);
  return { valeur, bas: Math.round(valeur - Z90 * ecart), haut: Math.round(valeur + Z90 * ecart) };
}

/** Ce que l'équipe `equipe` croit savoir du prospect après `observations` observations. */
export function rapport(
  M: ModeleDraft['scouting'],
  graine: number,
  equipe: string,
  p: Prospect,
  observations: number,
  /** Tranche 9 : précision du recruteur de l'équipe (facteur de l'écart-type, 1 : référence). */
  precision = 1,
): RapportDeScouting {
  const obs = Math.min(observations, M.observationsMax);
  const facteur = precision / Math.sqrt(1 + obs);
  const sel = (quoi: string) => `scouting:${equipe}:${p.id}:${quoi}`;
  return {
    prospect: p.id,
    observations: obs,
    note: estimer(p.note, M.ecartInitial.note * facteur, graine, sel('note')),
    potentiel: estimer(p.potentiel, M.ecartInitial.potentiel * facteur, graine, sel('potentiel')),
    details: Object.fromEntries(
      ATTRIBUTS_DETAILLES.map((a) => [a, estimer(p.details[a], M.ecartInitial.details * facteur, graine, sel(a))]),
    ) as Record<keyof AttributsDetailles, Estimation>,
  };
}

/** Le consensus de la presse (mock draft) : une équipe fictive « presse », assez bien informée. */
export const rapportDuConsensus = (M: ModeleDraft['scouting'], graine: number, p: Prospect): RapportDeScouting =>
  rapport(M, graine, 'presse', p, M.observationsDuConsensus);

/** Les observations d'une équipe sur un prospect : celles du staff par défaut, plus celles que le GM a demandées. */
export const observationsDe = (M: ModeleDraft['scouting'], demandees: Record<string, number> | undefined, prospect: string): number =>
  Math.min(M.observationsMax, M.observationsParDefaut + (demandees?.[prospect] ?? 0));

/** Observations encore disponibles pour le GM. */
export const observationsRestantes = (M: ModeleDraft['scouting'], demandees: Record<string, number>): number =>
  M.budgetObservations - Object.values(demandees).reduce((s, n) => s + n, 0);
