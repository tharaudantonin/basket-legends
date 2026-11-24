// Tranche 7 : qui choisit à chaque rang, une fois appliqués les choix échangés (protections, droits d'échange de rang,
// choix « le plus favorable / le moins favorable » d'un groupe). Les règles viennent de data/draft/choix-<année>.json ;
// elles s'appliquent dans l'ordre du fichier, sur les choix propres placés à leur rang par la loterie et le bilan.
import type { AttributionChoix, ChoixDeDraft, RegleChoix } from './types';

const dans = (rang: number, plage?: [number, number]): boolean => !plage || (rang >= plage[0] && rang <= plage[1]);

/**
 * Applique les règles d'un tour. `rangs` : équipe → rang de son choix propre dans ce tour (1 à 60).
 * Rend les choix du tour, rangés par rang.
 */
export function appliquerProprietes(
  tour: 1 | 2,
  rangs: Record<string, number>,
  regles: readonly RegleChoix[],
  rangsPremierTour: Record<string, number> = tour === 1 ? rangs : {},
): ChoixDeDraft[] {
  const choix: ChoixDeDraft[] = Object.entries(rangs).map(([original, rang]) => ({ tour, rang, original, detenteur: original }));
  const designesParOriginal = new Set<string>();
  for (const regle of regles) {
    const designes: ChoixDeDraft[] = [];
    for (const m of regle.membres) {
      if ('original' in m) {
        const c = choix.find((x) => x.original === m.original);
        if (!c) throw new Error(`Choix de « ${m.original} » introuvable (règle : ${regle.description}).`);
        if (designesParOriginal.has(m.original))
          throw new Error(`Le choix de « ${m.original} » est désigné par deux règles (${regle.description}).`);
        designesParOriginal.add(m.original);
        if (dans(c.rang, m.rangs)) designes.push(c);
      } else {
        designes.push(...choix.filter((x) => x.detenteur === m.detenteur));
      }
    }
    designes.sort((a, b) => a.rang - b.rang);
    let table = regle.attributions;
    if (regle.condition) {
      const r = rangsPremierTour[regle.condition.original];
      if (r === undefined)
        throw new Error(`Condition sur le 1er tour de « ${regle.condition.original} » sans son rang (${regle.description}).`);
      if (!dans(r, regle.condition.rangs)) table = regle.attributionsSinon ?? {};
    }
    const attributions: AttributionChoix[] | undefined = table[String(designes.length)];
    if (!attributions) {
      if (designes.length === 0) continue;
      throw new Error(`Aucune attribution pour ${designes.length} choix (règle : ${regle.description}).`);
    }
    designes.forEach((c, i) => {
      const a = attributions[i]!;
      if (dans(c.rang, a.rangs)) c.detenteur = a.beneficiaire;
      else if (a.sinon) c.detenteur = a.sinon;
    });
  }
  const provisoire = choix.find((c) => c.detenteur.startsWith('@'));
  if (provisoire) throw new Error(`Choix de « ${provisoire.original} » laissé à un détenteur provisoire (${provisoire.detenteur}).`);
  return choix.sort((a, b) => a.rang - b.rang);
}
