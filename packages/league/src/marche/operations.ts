// Tranche 9 : les opérations du marché sur l'univers de la partie — initialisation (staff, plafonds, propriété des
// choix), signature, coupe (ballottage, argent mort, étalement), droits de Bird, droits sur les choix de Draft, journal
// des transactions et compositions notées (pour rejouer un match à l'identique après un échange).
import { creerHasard } from '@basket-legends/engine';
import {
  salaireDeLaSaison,
  salaireMinimum,
  saisonCourte,
  situationEquipe,
  type ContratJoueur,
  type DonneesSalariales,
  type ParametresCba,
} from '../cba';
import { calculerBilans, pctBilan } from '../classement';
import type { Univers } from '../carriere/types';
import type { ProprieteChoix, RegleChoix } from '../draft/types';
import { CONFISQUE } from '../draft/proprietes';
import { nouvelleSaison } from '../saison';
import type { ContexteLigue, EtatSaison } from '../types';
import { cbaDeLaSaison } from './plafond';
import { genererStaff } from './staff';
import { DELEGATIONS_PAR_DEFAUT, type CompositionNotee, type DroitsBird, type Transaction } from './types';
import { saisonCourteSuivante } from './valeur';

/** L'année de la Draft qui suit une saison « 2026-2027 » (2027). */
const anneeDraft = (saison: string): number => Number(saison.slice(5, 9));

/** Complète un univers avec l'état du marché (univers de la tranche 8 ou univers de départ). Modifie `u`. */
export function initialiserMarche(ctx: ContexteLigue, u: Univers, graine: number): Univers {
  u.version ??= 0;
  u.choixTransmis ??= {};
  u.argentMort ??= {};
  u.exceptionsUtilisees ??= {};
  u.journal ??= [];
  const Sc = saisonCourte(u.saison);
  u.plafonds ??= { [Sc]: { plafondSalarial: ctx.salaires.cba.plafondSalarial, seuilTaxe: ctx.salaires.cba.seuilTaxe } };
  if (!u.choix) {
    const debut = anneeDraft(u.saison);
    u.choix = Object.fromEntries(
      Object.entries(ctx.draft?.proprietes ?? {})
        .filter(([a]) => Number(a) >= debut)
        .map(([a, p]) => [a, structuredClone(p)]),
    );
  }
  if (!u.staff && ctx.marche && ctx.draft) {
    const noms = [...Object.values(u.joueurs).map((j) => j.nom), ...Object.values(u.retraites).map((r) => r.nom)];
    const { staff, libres } = genererStaff(ctx.marche.staff, ctx.draft.noms, Object.keys(ctx.equipes), graine, noms);
    u.staff = staff;
    u.staffLibre = libres;
  }
  return u;
}

/** Une nouvelle partie de la tranche 9 : la première saison avec son univers, son staff et les délégations par défaut. */
export function nouvellePartie(ctx: ContexteLigue, graine: number, franchise: string): EtatSaison {
  const etat = nouvelleSaison(ctx, graine, franchise);
  if (ctx.univers) etat.univers = initialiserMarche(ctx, structuredClone(ctx.univers), graine);
  etat.delegations = { ...DELEGATIONS_PAR_DEFAUT };
  etat.bureau = [];
  etat.marche = { echanges: 0, signatures: 0, refus: {}, propositions: 0 };
  return etat;
}

/** L'univers de l'état, créé s'il manque (parties de la tranche 8) ; rend l'univers à modifier. */
export function universDe(ctx: ContexteLigue, etat: EtatSaison): Univers {
  const base = ctx.base ?? ctx;
  if (!etat.univers) {
    if (!base.univers) throw new Error('Pas de carrière dans cette partie : aucun marché possible.');
    etat.univers = structuredClone(base.univers);
  }
  initialiserMarche(base, etat.univers, etat.graine);
  etat.marche ??= { echanges: 0, signatures: 0, refus: {}, propositions: 0 };
  etat.delegations ??= { ...DELEGATIONS_PAR_DEFAUT };
  etat.bureau ??= [];
  return etat.univers;
}

/** La CBA de la saison de l'univers (plafond projeté). */
export const cbaDeLUnivers = (P: ParametresCba, u: Univers): ParametresCba => cbaDeLaSaison(P, u.plafonds?.[saisonCourte(u.saison)]);

/** Les données salariales de la saison de l'univers (argent mort de la saison compris). */
export function salairesDeLUnivers(P: ParametresCba, u: Univers): DonneesSalariales {
  const Sc = saisonCourte(u.saison);
  const equipes = Object.fromEntries(
    Object.entries(u.equipes).map(([e, s]) => [e, { ...s, autresCharges: s.autresCharges + (u.argentMort?.[e]?.[Sc] ?? 0) }]),
  );
  return { saison: u.saison, cba: cbaDeLUnivers(P, u), contrats: u.contrats, equipes };
}

/** La situation salariale d'une équipe dans l'univers. */
export const situationDansLUnivers = (P: ParametresCba, u: Univers, equipe: string) =>
  situationEquipe(salairesDeLUnivers(P, u), equipe, u.effectifs[equipe] ?? []);

export function equipeDuJoueur(u: Univers, joueur: string): string | undefined {
  for (const [e, js] of Object.entries(u.effectifs)) if (js.includes(joueur)) return e;
  return undefined;
}

/** Note une transaction dans le journal ; le contexte de la saison sera recalculé. */
export function noterTransaction(u: Univers, t: Transaction): void {
  u.version = (u.version ?? 0) + 1;
  (u.journal ??= []).push(t);
}

/**
 * Note l'effectif (et le plan) d'une équipe à partir du prochain match, pour rejouer à l'identique les matchs déjà
 * joués. Rien à noter avant le premier match de la saison (l'effectif courant suffit).
 */
export function noterComposition(
  ctx: ContexteLigue,
  etat: EtatSaison,
  equipe: string,
  avant: Omit<CompositionNotee, 'avantMatch'> | undefined,
  apres: Omit<CompositionNotee, 'avantMatch'>,
): void {
  const n = etat.matchs.length;
  if (!n) return;
  const u = etat.univers;
  const numeros = (js: string[]) => Object.fromEntries(js.map((j) => [j, u?.joueurs[j]?.numero ?? '']));
  const liste = ((etat.compositions ??= {})[equipe] ??= []);
  if (!liste.length) {
    const premiere = avant ?? { joueurs: ctx.equipes[equipe]?.joueurs.map((j) => j.id) ?? [] };
    const anciens = Object.fromEntries(ctx.equipes[equipe]?.joueurs.map((j) => [j.id, j.numero]) ?? []);
    liste.push({ numeros: { ...numeros(premiere.joueurs), ...anciens }, ...premiere, avantMatch: 0 });
  }
  const derniere = liste[liste.length - 1]!;
  const nouvelle = { numeros: numeros(apres.joueurs), ...apres, avantMatch: n };
  if (derniere.avantMatch === n) liste[liste.length - 1] = nouvelle;
  else liste.push(nouvelle);
}

/** La composition notée d'une équipe pour le match à la position `position` de la saison (ou rien). */
export function compositionDuMatch(etat: Pick<EtatSaison, 'compositions'>, equipe: string, position: number): CompositionNotee | undefined {
  const liste = etat.compositions?.[equipe];
  if (!liste) return undefined;
  let c: CompositionNotee | undefined;
  for (const x of liste) if (x.avantMatch <= position) c = x;
  return c;
}

/** Retire un joueur de son effectif (sans toucher à son contrat). */
export function retirerDeLEffectif(u: Univers, joueur: string): string | undefined {
  const e = equipeDuJoueur(u, joueur);
  if (e) u.effectifs[e] = u.effectifs[e]!.filter((x) => x !== joueur);
  return e;
}

/** Le premier numéro libre de l'équipe. */
function numeroLibre(u: Univers, equipe: string, joueur: string): string {
  const pris = new Set((u.effectifs[equipe] ?? []).filter((x) => x !== joueur).map((j) => u.joueurs[j]?.numero));
  const actuel = u.joueurs[joueur]?.numero;
  if (actuel && !pris.has(actuel)) return actuel;
  for (let n = 0; n < 100; n++) if (!pris.has(String(n))) return String(n);
  return '';
}

/** Place un joueur dans un effectif avec un contrat (il quitte son effectif et le vivier hors NBA). */
export function placerJoueur(u: Univers, joueur: string, equipe: string, contrat: ContratJoueur): void {
  retirerDeLEffectif(u, joueur);
  delete u.horsNba[joueur];
  (u.effectifs[equipe] ??= []).push(joueur);
  u.contrats[joueur] = contrat;
  if (u.joueurs[joueur]) u.joueurs[joueur]!.numero = numeroLibre(u, equipe, joueur);
}

/** Les salaires d'un contrat : `duree` saisons à partir de `saison` (courte), hausse annuelle sur le premier salaire. */
export function salairesDuContrat(
  saison: string,
  salaire: number,
  duree: number,
  hausse: number,
  option?: 'joueur' | 'equipe',
): ContratJoueur['salaires'] {
  return Array.from({ length: duree }, (_, i) => ({
    saison: saisonCourteSuivante(saison, i),
    montant: Math.round(salaire * (1 + hausse * i)),
    ...(option && i === duree - 1 && duree > 1 ? { option } : {}),
  }));
}

// --- Droits de Bird. ---

/** Les droits de Bird d'une équipe sur son joueur en fin de contrat (horloge à la fin de la saison écoulée). */
export function droitsBird(P: ParametresCba, c: ContratJoueur | undefined): DroitsBird {
  const s = c?.saisonsAvecEquipe ?? 0;
  if (s >= P.saisonsBird) return 'bird';
  if (s >= P.saisonsEarlyBird) return 'early-bird';
  return 'non-bird';
}

/** Le premier salaire maximum qu'une équipe peut offrir avec ses droits sur son agent libre (au-dessus du plafond). */
export function maximumAvecDroits(
  P: ParametresCba,
  droits: DroitsBird,
  precedent: number,
  anciennete: number,
  maxAnciennete: number,
): number {
  if (droits === 'bird') return maxAnciennete;
  if (droits === 'early-bird') return Math.min(maxAnciennete, Math.round(precedent * P.earlyBird.partDuPrecedent));
  return Math.min(
    maxAnciennete,
    Math.round(Math.max(precedent * P.nonBird.partDuPrecedent, salaireMinimum(P, anciennete) * P.nonBird.partDuMinimum)),
  );
}

/** Durée et hausse maximales d'un contrat selon le moyen de signature. */
export function limitesDuContrat(P: ParametresCba, moyen: string): { dureeMax: number; hausseMax: number; dureeMin: number } {
  if (moyen === 'bird') return { dureeMax: P.dureeMaxBird, hausseMax: P.hausseMaxBird, dureeMin: 1 };
  if (moyen === 'early-bird') return { dureeMax: P.dureeMaxAutre, hausseMax: P.hausseMaxBird, dureeMin: P.earlyBird.dureeMin };
  return { dureeMax: P.dureeMaxAutre, hausseMax: P.hausseMaxAutre, dureeMin: 1 };
}

/** L'offre qualificative d'un agent libre restreint (vétéran de trois saisons au plus, ou fin de l'échelle des rookies). */
export function offreQualificative(P: ParametresCba, c: ContratJoueur, precedent: number): number {
  const R = P.agentLibreRestreint;
  const rookie = c.draft?.tour === 1 && (c.anciennete ?? 0) >= 3 && (c.anciennete ?? 0) <= 4;
  if (rookie) {
    const t = Math.min(1, Math.max(0, (c.draft!.rang - 1) / 29));
    return Math.round(precedent * (R.partRookiePremierChoix + t * (R.partRookieDernierChoix - R.partRookiePremierChoix)));
  }
  return Math.round(Math.max(precedent * R.partVeteran, salaireMinimum(P, c.anciennete ?? 0) + R.minimumPlus));
}

/** Un agent libre est restreint s'il sort de l'échelle des rookies (1er tour) ou a trois saisons d'expérience au plus. */
export function estRestreint(P: ParametresCba, c: ContratJoueur): boolean {
  const anc = c.anciennete ?? 0;
  if (c.draft?.tour === 1 && anc >= 3 && anc <= 4 && c.salaires.length >= 2) return true;
  return anc <= P.agentLibreRestreint.ancienneteMax && c.type === 'standard';
}

// --- Coupe, ballottage, argent mort. ---

/**
 * Coupe un joueur : son salaire garanti restant devient de l'argent mort, étalé (2 × saisons restantes + 1) si
 * `etaler` et si le montant le permet ; en saison, la saison en cours reste sur son calendrier normal. Le joueur passe en
 * ballottage : l'équipe au plus mauvais bilan qui peut et veut le prendre reprend son contrat ; sinon il devient libre.
 * Rend l'équipe qui le réclame (ou null).
 */
export function couperJoueur(
  ctx: ContexteLigue,
  etat: EtatSaison,
  equipe: string,
  joueur: string,
  etaler: boolean,
  date: string,
  reclamer: (e: string) => boolean,
): string | null {
  const u = universDe(ctx, etat);
  const P = cbaDeLUnivers((ctx.base ?? ctx).salaires.cba, u);
  const c = u.contrats[joueur];
  if (!u.effectifs[equipe]?.includes(joueur) || !c) throw new Error('Ce joueur n’est pas dans votre effectif.');
  const Sc = saisonCourte(u.saison);
  // Ballottage : priorité au plus mauvais bilan (bilan de la saison, ou ordre fixe avant le premier match).
  const bilans = calculerBilans(ctx.structure, etat.matchs);
  const ordre = Object.keys(u.effectifs)
    .filter((e) => e !== equipe)
    .sort((a, b) => pctBilan(bilans[a]!) - pctBilan(bilans[b]!) || (a < b ? -1 : 1));
  const salaire = salaireDeLaSaison(c, Sc);
  const auMinimum = c.type === 'standard' && c.salaires.length <= 2 && salaire <= salaireMinimum(P, c.anciennete ?? 0) * 1.0001;
  const preneur = ordre.find((e) => {
    const s = situationDansLUnivers(P, u, e);
    const place = c.type === 'two-way' ? s.effectif.twoWay < P.contratsTwoWayMax : s.effectif.standard < P.contratsStandardMax;
    const peut = c.type === 'two-way' || auMinimum || s.espace >= salaire;
    return place && peut && reclamer(e);
  });
  if (preneur) {
    placerJoueur(u, joueur, preneur, { ...c, saisonsAvecEquipe: c.saisonsAvecEquipe });
    noterTransaction(u, {
      date,
      genre: 'ballottage',
      equipes: [equipe, preneur],
      joueurs: [joueur],
      texte: `${u.joueurs[joueur]?.nom ?? joueur} est réclamé au ballottage par ${preneur}.`,
    });
    return preneur;
  }
  // Argent mort : salaires restants (la saison en cours ne compte plus que pour ce qui reste à payer : simplification,
  // toute la saison reste à la charge de l'équipe).
  const restants = c.type === 'standard' ? c.salaires.filter((s) => s.saison >= Sc && !(s.option === 'equipe' && s.saison > Sc)) : [];
  const mort = ((u.argentMort ??= {})[equipe] ??= {});
  const total = restants.reduce((t, s) => t + s.montant, 0);
  const enSaison = etat.phase !== 'intersaison';
  if (etaler && restants.length && total > P.ballottage.etalementGarantiMin) {
    const aEtaler = enSaison ? restants.filter((s) => s.saison > Sc) : restants;
    if (enSaison) mort[Sc] = (mort[Sc] ?? 0) + salaireDeLaSaison(c, Sc);
    const n = aEtaler.length * P.ballottage.etalementFacteur + P.ballottage.etalementPlus;
    const montant = aEtaler.reduce((t, s) => t + s.montant, 0);
    const premiere = enSaison ? saisonCourteSuivante(Sc) : Sc;
    if (aEtaler.length)
      for (let i = 0; i < n; i++)
        mort[saisonCourteSuivante(premiere, i)] = (mort[saisonCourteSuivante(premiere, i)] ?? 0) + Math.round(montant / n);
  } else for (const s of restants) mort[s.saison] = (mort[s.saison] ?? 0) + s.montant;
  retirerDeLEffectif(u, joueur);
  delete u.contrats[joueur];
  u.horsNba[joueur] = 'libre';
  noterTransaction(u, {
    date,
    genre: 'coupe',
    equipes: [equipe],
    joueurs: [joueur],
    texte: `${u.joueurs[joueur]?.nom ?? joueur} est coupé par ${equipe}${total ? ` (argent mort : ${Math.round(total / 1e5) / 10} M$${etaler ? ', étalé' : ''})` : ''}.`,
  });
  return null;
}

// --- Droits sur les choix de Draft. ---

export interface DroitChoix {
  annee: number;
  tour: 1 | 2;
  /** Le choix propre visé (pour un choix encore à son équipe d'origine) ou le premier membre de la règle. */
  original: string;
  /** Index de la règle dans l'année et le tour (absent : choix propre non concerné par une règle). */
  regle?: number;
  description: string;
  /** Sans condition (le détenteur est sûr d'avoir ce choix) : compte pour la règle Stepien. */
  sur: boolean;
}

const beneficiaires = (r: RegleChoix): Set<string> => {
  const s = new Set<string>();
  const tables = [r.attributions, r.attributionsSinon ?? {}, ...(r.cas ?? []).map((c) => c.attributions)];
  for (const t of tables) for (const l of Object.values(t)) for (const a of l) for (const b of [a.beneficiaire, a.sinon]) if (b) s.add(b);
  return s;
};
const designe = (r: RegleChoix, original: string) => r.membres.some((m) => 'original' in m && m.original === original);

/** Les droits d'une équipe sur les choix des Drafts `annees` (choix propres libres et droits dans les règles). */
export function droitsSurLesChoix(u: Univers, equipe: string, annees: readonly number[]): DroitChoix[] {
  const droits: DroitChoix[] = [];
  for (const annee of annees) {
    const P: ProprieteChoix | undefined = u.choix?.[String(annee)];
    for (const tour of [1, 2] as const) {
      const regles = P?.tours[String(tour) as '1' | '2'] ?? [];
      if (!regles.some((r) => designe(r, equipe)))
        droits.push({
          annee,
          tour,
          original: equipe,
          description: `${annee}, ${tour}${tour === 1 ? 'er' : 'e'} tour (choix propre)`,
          sur: true,
        });
      regles.forEach((r, i) => {
        if (!beneficiaires(r).has(equipe)) return;
        const premier = r.membres.find((m) => 'original' in m) as { original: string } | undefined;
        const simple = r.membres.length === 1 && Object.keys(r.attributions).length === 1 && !r.condition && !r.cas;
        const a = r.attributions['1']?.[0];
        const sur = simple && !!a && a.beneficiaire === equipe && !a.rangs;
        droits.push({
          annee,
          tour,
          original: premier?.original ?? equipe,
          regle: i,
          description: `${annee}, ${tour}${tour === 1 ? 'er' : 'e'} tour : ${r.description}`,
          sur,
        });
      });
    }
  }
  return droits;
}

/** Transfère un droit sur un choix d'une équipe à une autre (dans l'univers). */
export function transfererChoix(u: Univers, de: string, vers: string, d: Pick<DroitChoix, 'annee' | 'tour' | 'original' | 'regle'>): void {
  const P = ((u.choix ??= {})[String(d.annee)] ??= { annee: d.annee, statut: 'a-recouper', tours: { '1': [], '2': [] } });
  const regles = P.tours[String(d.tour) as '1' | '2'];
  if (d.regle === undefined) {
    regles.push({
      membres: [{ original: d.original }],
      attributions: { '1': [{ beneficiaire: vers }] },
      description: `${d.original} → ${vers} (échange de la partie)`,
    });
    return;
  }
  const r = regles[d.regle];
  if (!r) throw new Error('Choix introuvable.');
  const remplacer = (t: Record<string, { beneficiaire: string; sinon?: string }[]>) => {
    for (const l of Object.values(t))
      for (const a of l) {
        if (a.beneficiaire === de) a.beneficiaire = vers;
        if (a.sinon === de) a.sinon = vers;
      }
  };
  remplacer(r.attributions);
  if (r.attributionsSinon) remplacer(r.attributionsSinon);
  for (const c of r.cas ?? []) remplacer(c.attributions);
  r.description = `${r.description} (droit de ${de} cédé à ${vers})`;
}

/** Un choix de premier tour gelé (second apron) ne s'échange pas. */
export const choixGele = (u: Univers, annee: number, equipe: string): boolean => !!u.choix?.[String(annee)]?.geles?.includes(equipe);

/** Les années de Draft dont les choix peuvent s'échanger pendant la saison de l'univers (règle des sept ans). */
export function anneesEchangeables(P: ParametresCba, u: Univers, draftFaite: boolean): number[] {
  const premiere = anneeDraft(u.saison) + (draftFaite ? 1 : 0);
  const derniere = anneeDraft(u.saison) + P.choixFuturs.anneesMax - 1;
  return Array.from({ length: Math.max(0, derniere - premiere + 1) }, (_, i) => premiere + i);
}

/** Règle Stepien : l'équipe garde un premier tour sûr dans au moins une de deux Drafts futures consécutives. */
export function respecteStepien(u: Univers, equipe: string, annees: readonly number[]): boolean {
  let sans = 0;
  for (const a of annees) {
    const ok = droitsSurLesChoix(u, equipe, [a]).some((d) => d.tour === 1 && d.sur);
    sans = ok ? 0 : sans + 1;
    if (sans >= 2) return false;
  }
  return true;
}

/** La graine d'une opération du marché (date et sel). */
export const hasardDuMarche = (etat: Pick<EtatSaison, 'graine'>, sel: string) => creerHasard(etat.graine, `marche-${sel}`);

/** Saisons de l'univers (« 2027-2028 ») au format des contrats. */
export const saisonDeLUnivers = (u: Univers): string => saisonCourte(u.saison);

export { CONFISQUE };
