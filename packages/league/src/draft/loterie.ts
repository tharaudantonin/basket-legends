// Tranche 7 : la loterie « 3-2-1 » de la NBA (Drafts 2027 à 2029, communiqué NBA du 28/05/2026 ; réponse 12 de
// docs/DECISIONS_2026-11.md), paramétrée par data/draft/loterie-2027-2029.json.
//
// Ce que dit la source : 16 équipes ; 3, 2 ou 1 boule par équipe selon sa catégorie ; les 16 premiers choix sont tirés ;
// les trois pires bilans choisissent au pire 12e ; le choix propre d'une équipe ne peut pas être n° 1 deux Drafts de
// suite, ni dans le top 5 trois Drafts de suite.
// Ce que la source ne précise pas (statut « à recouper » tant que la table officielle n'est pas relevée) :
// - le mécanisme exact du tirage : ici, chaque choix est tiré au prorata des boules des équipes pas encore tirées ;
// - l'application du plancher : quand il ne reste que des choix sous le plancher, les équipes reléguées pas encore
//   tirées prennent les choix suivants, de la pire à la meilleure au bilan ;
// - les limites : une équipe interdite pour un rang est écartée du tirage de ce rang (tirage refait).
import { creerHasard } from '@basket-legends/engine';
import type { HistoriqueChoix, ParticipantLoterie, ReglesLoterie, ResultatLoterie } from './types';

/** Vrai si l'équipe ne peut pas recevoir ce rang, vu ses rangs des Drafts précédentes (le plus récent en dernier). */
export function rangInterdit(regles: ReglesLoterie, historique: readonly number[], rang: number): boolean {
  const precedent = historique.at(-1);
  if (rang === 1 && regles.premierChoixInterditApresUnPremier && precedent === 1) return true;
  const { top, draftsConsecutives } = regles.limiteTop;
  if (rang <= top) {
    const derniers = historique.slice(-(draftsConsecutives - 1));
    if (derniers.length === draftsConsecutives - 1 && derniers.every((r) => r <= top)) return true;
  }
  return false;
}

/** Contrôle que les participants correspondent aux catégories des règles. */
export function verifierParticipants(regles: ReglesLoterie, participants: readonly ParticipantLoterie[]): void {
  if (participants.length !== regles.choixTires)
    throw new Error(`Loterie : ${participants.length} équipes au lieu de ${regles.choixTires}.`);
  for (const c of regles.categories) {
    const n = participants.filter((p) => p.categorie === c.id).length;
    if (n !== c.equipes) throw new Error(`Loterie : ${n} équipes dans la catégorie « ${c.id} » au lieu de ${c.equipes}.`);
  }
}

/** Tire l'ordre des `choixTires` premiers choix. Déterministe : même graine, mêmes participants, même ordre. */
export function tirerLoterie(
  regles: ReglesLoterie,
  participants: readonly ParticipantLoterie[],
  historique: HistoriqueChoix,
  graine: number,
  sel = 'loterie',
): ResultatLoterie {
  verifierParticipants(regles, participants);
  const h = creerHasard(graine, sel);
  const categorie = new Map(regles.categories.map((c) => [c.id, c]));
  const restants = [...participants].sort((a, b) => a.rangBilan - b.rangBilan);
  const ordre: string[] = [];
  let tiragesRefaits = 0;
  for (let rang = 1; rang <= regles.choixTires; rang++) {
    // Plancher : s'il reste autant d'équipes protégées que de rangs jusqu'à leur plancher, la plus mal classée au bilan
    // prend ce rang.
    const proteges = restants.filter((p) => categorie.get(p.categorie)!.plancher < regles.choixTires);
    const plancher = proteges.length ? Math.min(...proteges.map((p) => categorie.get(p.categorie)!.plancher)) : Infinity;
    let elu: ParticipantLoterie;
    if (proteges.length && proteges.length >= plancher - rang + 1) {
      elu = proteges[0]!;
    } else {
      const permis = restants.filter((p) => !rangInterdit(regles, historique[p.equipe] ?? [], rang));
      if (permis.length < restants.length) tiragesRefaits++;
      const vivier = permis.length ? permis : restants;
      elu = h.pondere(vivier, (p) => categorie.get(p.categorie)!.boules);
    }
    ordre.push(elu.equipe);
    restants.splice(restants.indexOf(elu), 1);
  }
  return { ordre, tiragesRefaits };
}

/** Probabilités estimées par simulation : équipe → probabilité de chaque rang (indice 0 = choix n° 1). */
export function probabilitesDeLaLoterie(
  regles: ReglesLoterie,
  participants: readonly ParticipantLoterie[],
  tirages: number,
  graine = 1,
): Record<string, number[]> {
  const compte: Record<string, number[]> = Object.fromEntries(
    participants.map((p) => [p.equipe, new Array<number>(regles.choixTires).fill(0)]),
  );
  for (let t = 0; t < tirages; t++) {
    const { ordre } = tirerLoterie(regles, participants, {}, graine, `simulation-${t}`);
    ordre.forEach((e, i) => compte[e]![i]!++);
  }
  for (const v of Object.values(compte)) for (let i = 0; i < v.length; i++) v[i] = v[i]! / tirages;
  return compte;
}
