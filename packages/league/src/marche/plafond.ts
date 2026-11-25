// Tranche 9 (réponse 28) : la CBA des saisons à venir. Le plafond et le seuil de taxe suivent les estimations relevées
// (data/cba/ : 2027-28), puis une croissance tirée chaque saison, au plus le lissage de la CBA (10 %). Les aprons suivent
// le plafond (Hoops Rumors, Tax Aprons : « rising by the same rate as the salary cap ») ; les exceptions, minimums,
// maximums, la masse minimale et la marge d'échange aussi (choix du jeu : la CBA les indexe, montants non relevés).
import { creerHasard } from '@basket-legends/engine';
import type { ParametresCba } from '../cba';
import { gaussien } from '../draft/prospects';

export interface PlafondDeSaison {
  plafondSalarial: number;
  seuilTaxe: number;
}

/** Croissance moyenne du plafond retenue après les estimations (choix du jeu : celle de l'estimation 2027-28). */
export function croissanceDeReference(P: ParametresCba): number {
  const e = P.estimationsPlafond[0];
  return e ? e.plafondSalarial / P.plafondSalarial - 1 : 0.05;
}

/** Le plafond d'une saison courte (« 2028-29 ») à partir de celui de la précédente : estimation relevée, sinon tirage. */
export function plafondSuivant(P: ParametresCba, precedent: PlafondDeSaison, saison: string, graine: number): PlafondDeSaison {
  const estime = P.estimationsPlafond.find((e) => e.saison === saison);
  if (estime) return { plafondSalarial: estime.plafondSalarial, seuilTaxe: estime.seuilTaxe };
  const h = creerHasard(graine, `plafond-${saison}`);
  const g = Math.min(P.croissancePlafondMax, Math.max(0, gaussien(h, croissanceDeReference(P), 0.02)));
  const arrondi = (x: number) => Math.round(x / 1000) * 1000;
  return {
    plafondSalarial: arrondi(precedent.plafondSalarial * (1 + g)),
    seuilTaxe: arrondi(precedent.seuilTaxe * (1 + g)),
  };
}

/** Les paramètres de la CBA d'une saison : ceux de référence, mis à l'échelle de son plafond. */
export function cbaDeLaSaison(P: ParametresCba, plafond: PlafondDeSaison | undefined): ParametresCba {
  if (!plafond || plafond.plafondSalarial === P.plafondSalarial) return P;
  const k = plafond.plafondSalarial / P.plafondSalarial;
  const kt = plafond.seuilTaxe / P.seuilTaxe;
  const e = (x: number) => Math.round((x * k) / 1000) * 1000;
  return {
    ...P,
    plafondSalarial: plafond.plafondSalarial,
    seuilTaxe: plafond.seuilTaxe,
    premierApron: e(P.premierApron),
    deuxiemeApron: e(P.deuxiemeApron),
    masseMinimale: e(P.masseMinimale),
    midLevelNonContribuable: e(P.midLevelNonContribuable),
    midLevelContribuable: e(P.midLevelContribuable),
    midLevelEspace: e(P.midLevelEspace),
    exceptionBiannuelle: e(P.exceptionBiannuelle),
    salaireMaximum: P.salaireMaximum.map((m) => ({ ...m, montant: Math.round(m.partDuPlafond * plafond.plafondSalarial) })),
    salaireMinimum: P.salaireMinimum.map(e),
    minimumImputeVeteran: e(P.minimumImputeVeteran),
    salaireTwoWay: e(P.salaireTwoWay),
    taxe: { ...P.taxe, largeurTranche: Math.round((P.taxe.largeurTranche * kt) / 1000) * 1000 },
  };
}

/** La marge d'échange d'une saison (7,5 M$ en 2023-24, indexée sur le plafond, arrondie au millier). */
export function margeEchange(P: ParametresCba): number {
  return Math.round((P.margeEchange.montant * P.plafondSalarial) / P.margeEchange.plafondDeReference / 1000) * 1000;
}
