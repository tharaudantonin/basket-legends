// Tranche 9 (réponse 33) : les échanges. Légalité selon la CBA (correspondance des salaires selon le niveau de l'équipe
// après l'échange, aprons, agrégation interdite au-delà du second apron, plafond strict, effectifs, choix échangeables
// sur sept ans, règle Stepien, choix gelés, délai après la signature d'un agent libre, date limite), avis de l'IA (avec
// ses raisons), exécution et contre-proposition (« Qu'est-ce qu'il vous faudrait ? »).
import { creerHasard } from '@basket-legends/engine';
import { salaireDeLaSaison, saisonCourte, situationEquipe, taxeDeLuxe, type ParametresCba } from '../cba';
import { ajouterJours } from '../calendrier';
import type { Univers } from '../carriere/types';
import type { ContexteLigue, EtatSaison } from '../types';
import {
  anneesEchangeables,
  cbaDeLUnivers,
  choixGele,
  droitsSurLesChoix,
  noterComposition,
  noterTransaction,
  placerJoueur,
  respecteStepien,
  salairesDeLUnivers,
  situationDansLUnivers,
  transfererChoix,
  universDe,
  type DroitChoix,
} from './operations';
import { margeEchange } from './plafond';
import type { Actif, AvisEchange, ModeleMarche, PropositionEchange, StrategieGm, VerdictEchange } from './types';
import { force, valeurDuChoix, valeurDuJoueur } from './valeur';

const M$ = (x: number) => `${(x / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M$`;

/** L'univers d'un état (sans le créer : lecture seule). */
const universLu = (ctx: ContexteLigue, etat: EtatSaison): Univers => {
  const u = etat.univers ?? (ctx.base ?? ctx).univers;
  if (!u) throw new Error('Pas de carrière dans cette partie : aucun échange possible.');
  return u;
};
const P0 = (ctx: ContexteLigue) => (ctx.base ?? ctx).salaires.cba;

/** Décale une date de la saison de référence vers une autre saison (semaines entières, comme le calendrier). */
export function dateDeLaSaison(reference: string, saison: string, date: string): string {
  const n = Number(saison.slice(0, 4)) - Number(reference.slice(0, 4));
  return n ? ajouterJours(date, 7 * Math.round((365.2425 * n) / 7)) : date;
}

/** La date limite des échanges de la saison de l'état. */
export function dateLimiteDesEchanges(ctx: ContexteLigue, saison: string): string | undefined {
  const D = (ctx.base ?? ctx).marche;
  return D ? dateDeLaSaison(D.saisonDeReference, saison, D.dates.dateLimiteEchanges) : undefined;
}

/** Les échanges sont-ils ouverts ? Intersaison, ou saison régulière jusqu'à la date limite. */
export function echangesOuverts(ctx: ContexteLigue, etat: EtatSaison): boolean {
  if (etat.phase === 'intersaison') return true;
  if (etat.phase !== 'reguliere') return false;
  const limite = dateLimiteDesEchanges(ctx, etat.saison);
  return !limite || etat.date < limite;
}

// --- Stratégie et personnalité des GM de l'IA (réponses 40 et 41). ---

const cacheForces = new WeakMap<Univers, { version: number; effectifs: Univers['effectifs']; forces: Record<string, number> }>();

/** Les forces des 30 équipes (moyenne pondérée de leurs meilleures notes), mises en cache tant que l'univers ne change pas. */
export function forcesDesEquipes(M: ModeleMarche, u: Univers): Record<string, number> {
  const c = cacheForces.get(u);
  if (c && c.version === (u.version ?? 0) && c.effectifs === u.effectifs) return c.forces;
  const forces = Object.fromEntries(
    Object.entries(u.effectifs).map(([e, js]) => [
      e,
      force(
        M,
        js.map((j) => u.joueurs[j]?.note ?? 40),
      ),
    ]),
  );
  cacheForces.set(u, { version: u.version ?? 0, effectifs: u.effectifs, forces });
  return forces;
}

/** La stratégie d'une équipe selon le rang de sa force (1 = la plus forte). */
export function strategieDe(M: ModeleMarche, forces: Record<string, number>, equipe: string): StrategieGm {
  const rang = 1 + Object.values(forces).filter((f) => f > (forces[equipe] ?? 0)).length;
  for (const s of ['pretendant', 'playoffs', 'transition'] as const) if (rang <= M.strategies[s].rangForceMax) return s;
  return 'reconstruction';
}

/** La personnalité du GM d'une franchise (fixe pour une partie) : patience et aversion pour la taxe. */
export function gmDe(M: ModeleMarche, u: Univers, graine: number, equipe: string): { patience: number; aversionTaxe: number } {
  // Tranche 10 : un GM licencié est remplacé ; son successeur a sa propre personnalité.
  const rang = u.club?.proprietaires[equipe]?.gm ?? 0;
  const h = creerHasard(graine, rang ? `gm-${equipe}-${rang}` : `gm-${equipe}`);
  const [a, b] = M.gm.patience;
  // Réponse 41 : les récidivistes au snapshot (et depuis) paient plus volontiers la taxe.
  const aversionTaxe = u.equipes[equipe]?.recidiviste ? M.gm.aversionTaxeRecidiviste : M.gm.aversionTaxe;
  return { patience: a + (b - a) * h.reel(), aversionTaxe };
}

/** Le rang de Draft attendu du choix propre d'une équipe (1er tour), selon le rang de sa force (la plus faible : 1). */
export function rangAttendu(forces: Record<string, number>, equipe: string, tour: 1 | 2): number {
  const rangForce = 1 + Object.values(forces).filter((f) => f > (forces[equipe] ?? 0)).length;
  const n = Object.keys(forces).length;
  return n + 1 - rangForce + (tour === 2 ? n : 0);
}

/** La valeur d'un droit sur un choix pour son détenteur. */
export function valeurDuDroit(
  M: ModeleMarche,
  u: Univers,
  forces: Record<string, number>,
  d: Pick<DroitChoix, 'annee' | 'tour' | 'original' | 'regle'>,
  detenteur: string,
): number {
  const ans = d.annee - Number(u.saison.slice(5, 9));
  if (d.regle === undefined) return valeurDuChoix(M, rangAttendu(forces, d.original, d.tour), ans);
  const r = u.choix?.[String(d.annee)]?.tours[String(d.tour) as '1' | '2'][d.regle];
  if (!r) return 0;
  const originaux = r.membres.filter((m): m is { original: string } => 'original' in m).map((m) => m.original);
  if (!originaux.length) return valeurDuChoix(M, d.tour === 1 ? 15 : 45, ans) * 0.5;
  const attrib = Object.values(r.attributions).sort((a, b) => b.length - a.length)[0] ?? [];
  const part = attrib.filter((a) => a.beneficiaire === detenteur).length / Math.max(1, attrib.length);
  const moyenne = originaux.reduce((s, o) => s + valeurDuChoix(M, rangAttendu(forces, o, d.tour), ans), 0) / originaux.length;
  return moyenne * Math.max(part, 0.25) * originaux.length * (attrib.length ? 1 : 0.5);
}

// --- Légalité. ---

const droitDe = (u: Univers, equipe: string, a: Extract<Actif, { type: 'choix' }>, annees: readonly number[]): DroitChoix | undefined =>
  droitsSurLesChoix(u, equipe, annees).find((d) => d.annee === a.annee && d.tour === a.tour && d.original === a.original);

/** Le salaire maximum qu'une équipe peut recevoir pour `cedes` dollars de salaires, selon sa masse après l'échange. */
export function maximumRecevable(P: ParametresCba, cedes: number, masseApres: number): number {
  if (masseApres <= P.plafondSalarial + P.supplementEchange) return Infinity;
  if (masseApres > P.premierApron) return cedes * P.partEchangeApron;
  return Math.max(
    Math.min(cedes * P.partEchangeBasse + P.supplementEchange, cedes + margeEchange(P)),
    cedes * P.partEchangeHaute + P.supplementEchange,
  );
}

/** Contrôle un échange selon la CBA ; ne modifie rien. */
export function verifierEchange(ctx: ContexteLigue, etat: EtatSaison, prop: PropositionEchange): VerdictEchange {
  const u = universLu(ctx, etat);
  const P = cbaDeLUnivers(P0(ctx), u);
  const Sc = saisonCourte(u.saison);
  const motifs: string[] = [];
  const details: VerdictEchange['details'] = [];
  if (!echangesOuverts(ctx, etat)) motifs.push('Les échanges sont fermés (date limite passée ou phase finale).');
  if (prop.equipes[0] === prop.equipes[1]) motifs.push('Un échange se fait entre deux équipes différentes.');
  if (!prop.actifs[0].length && !prop.actifs[1].length) motifs.push('L’échange est vide.');
  const annees = anneesEchangeables(P, u, etat.phase === 'terminee');
  // Copie de travail pour vérifier les effectifs et la règle Stepien après l'échange.
  const avecChoix = prop.actifs.some((l) => l.some((a) => a.type === 'choix'));
  const apres: Univers = { ...u, effectifs: { ...u.effectifs }, choix: avecChoix ? structuredClone(u.choix ?? {}) : u.choix };
  const D = salairesDeLUnivers(P0(ctx), u);
  for (const i of [0, 1] as const) {
    const e = prop.equipes[i];
    const autre = prop.equipes[1 - i]!;
    for (const a of prop.actifs[i]) {
      if (a.type === 'joueur') {
        const nom = u.joueurs[a.id]?.nom ?? a.id;
        if (!u.effectifs[e]?.includes(a.id)) motifs.push(`${nom} n’est pas sous contrat avec ${e}.`);
        const c = u.contrats[a.id];
        if (c?.signeLe) {
          const D = P.delaiEchangeApresSignature;
          const annee = Number(u.saison.slice(0, 4));
          const plancher = `${annee}-${D.dateMin}`;
          const delai = ajouterJours(c.signeLe, Math.round(D.mois * 30.44));
          const libre = delai > plancher ? delai : plancher;
          if (etat.date < libre) motifs.push(`${nom} a signé le ${c.signeLe} : il ne peut pas être échangé avant le ${libre}.`);
        }
        apres.effectifs[e] = (apres.effectifs[e] ?? []).filter((x) => x !== a.id);
        apres.effectifs[autre] = [...(apres.effectifs[autre] ?? []), a.id];
      } else {
        const d = droitDe(u, e, a, annees);
        if (!annees.includes(a.annee)) motifs.push(`Choix ${a.annee} : hors des Drafts échangeables (${annees[0]}-${annees.at(-1)}).`);
        else if (!d) motifs.push(`${e} ne détient pas de droit sur le choix ${a.annee} (${a.tour}e tour) de ${a.original}.`);
        else {
          if (a.tour === 1 && a.original === e && choixGele(u, a.annee, e))
            motifs.push(`Le 1er tour ${a.annee} de ${e} est gelé (second apron).`);
          transfererChoix(apres, e, autre, d);
        }
      }
    }
  }
  for (const i of [0, 1] as const) {
    const e = prop.equipes[i];
    const s = situationEquipe(D, e, u.effectifs[e] ?? []);
    const cedes = prop.actifs[i].filter((a) => a.type === 'joueur').map((a) => salaireDeLaSaison(u.contrats[(a as { id: string }).id], Sc));
    const recus = prop.actifs[1 - i]!.filter((a) => a.type === 'joueur').map((a) =>
      salaireDeLaSaison(u.contrats[(a as { id: string }).id], Sc),
    );
    const O = cedes.reduce((t, x) => t + x, 0);
    const I = recus.reduce((t, x) => t + x, 0);
    const masseApres = s.masse - O + I;
    const max = I > O ? maximumRecevable(P, O, masseApres) : Infinity;
    details.push({ equipe: e, cedes: O, recus: I, masseApres, maxRecevable: max });
    if (I > max) motifs.push(`${e} reçoit ${M$(I)} pour ${M$(O)} cédés : au plus ${M$(max)} (masse après l’échange : ${M$(masseApres)}).`);
    if (
      P.agregationInterditeDeuxiemeApron &&
      masseApres > P.deuxiemeApron &&
      cedes.filter((x) => x > 0).length >= 2 &&
      I > Math.max(0, ...cedes)
    )
      motifs.push(`${e} serait au-delà du second apron : il ne peut pas additionner plusieurs salaires pour recevoir un joueur.`);
    const strict = s.plafondStrict === 'premier' ? P.premierApron : s.plafondStrict === 'deuxieme' ? P.deuxiemeApron : Infinity;
    if (I > O && masseApres > strict) motifs.push(`${e} a un plafond strict à ${M$(strict)} : la masse passerait à ${M$(masseApres)}.`);
    const std = (apres.effectifs[e] ?? []).filter((j) => u.contrats[j]?.type === 'standard').length;
    const tw = (apres.effectifs[e] ?? []).filter((j) => u.contrats[j]?.type === 'two-way').length;
    if (std > P.contratsStandardMax)
      motifs.push(`${e} aurait ${std} contrats standard (${P.contratsStandardMax} au plus) : libérez une place d’abord.`);
    if (tw > P.contratsTwoWayMax) motifs.push(`${e} aurait ${tw} contrats two-way (${P.contratsTwoWayMax} au plus).`);
    if (std < 1) motifs.push(`${e} n’aurait plus de joueur.`);
    if (P.choixFuturs.stepien && prop.actifs[i].some((a) => a.type === 'choix' && a.tour === 1) && !respecteStepien(apres, e, annees))
      motifs.push(`Règle Stepien : ${e} serait sans 1er tour deux Drafts de suite.`);
  }
  return { legal: !motifs.length, motifs, details };
}

// --- Avis de l'IA. ---

interface Bilan {
  force: number;
  futur: number;
  present: number;
  salaires: number;
}

function bilanDesActifs(ctx: ContexteLigue, u: Univers, forces: Record<string, number>, actifs: Actif[], detenteur: string): Bilan {
  const M = (ctx.base ?? ctx).marche!.modele;
  const Mc = (ctx.base ?? ctx).carriere!.modele.progression;
  const P = cbaDeLUnivers(P0(ctx), u);
  const Sc = saisonCourte(u.saison);
  const b: Bilan = { force: 0, futur: 0, present: 0, salaires: 0 };
  const annees = anneesEchangeables(P, u, true).concat(Number(u.saison.slice(5, 9)));
  for (const a of actifs) {
    if (a.type === 'joueur') {
      const j = u.joueurs[a.id];
      if (!j) continue;
      const v = valeurDuJoueur(M, Mc, P, j, u.contrats[a.id], Sc);
      b.futur += v.futur;
      b.present += v.present;
      b.salaires += v.salaire;
    } else {
      const d = droitsSurLesChoix(u, detenteur, annees).find((x) => x.annee === a.annee && x.tour === a.tour && x.original === a.original);
      if (d) b.futur += valeurDuDroit(M, u, forces, d, detenteur);
    }
  }
  return b;
}

/** L'utilité d'un échange pour une équipe (dollars) et ses raisons, sans tenir compte de sa marge d'acceptation. */
export function utiliteDeLEchange(
  ctx: ContexteLigue,
  etat: EtatSaison,
  prop: PropositionEchange,
  equipe: string,
): { utilite: number; cede: number; raisons: string[] } {
  const base = ctx.base ?? ctx;
  const M = base.marche!.modele;
  const u = universLu(ctx, etat);
  const P = cbaDeLUnivers(P0(ctx), u);
  const i = prop.equipes.indexOf(equipe);
  if (i < 0) throw new Error(`${equipe} ne participe pas à cet échange.`);
  const forces = forcesDesEquipes(M, u);
  const strategie = strategieDe(M, forces, equipe);
  const S = M.strategies[strategie];
  const gm = gmDe(M, u, etat.graine, equipe);
  const out = bilanDesActifs(ctx, u, forces, prop.actifs[i]!, equipe);
  const inn = bilanDesActifs(ctx, u, forces, prop.actifs[1 - i]!, prop.equipes[1 - i]!);
  // Force de l'équipe avant et après (les joueurs reçus jouent tout de suite).
  const sortants = new Set(prop.actifs[i]!.filter((a) => a.type === 'joueur').map((a) => (a as { id: string }).id));
  const entrants = prop.actifs[1 - i]!.filter((a) => a.type === 'joueur').map((a) => (a as { id: string }).id);
  const avant = (u.effectifs[equipe] ?? []).map((j) => u.joueurs[j]?.note ?? 40);
  const ensuite = [...(u.effectifs[equipe] ?? []).filter((j) => !sortants.has(j)), ...entrants].map((j) => u.joueurs[j]?.note ?? 40);
  const dForce = force(M, ensuite) - force(M, avant);
  const s = situationDansLUnivers(P, u, equipe);
  const recid = u.equipes[equipe]?.recidiviste ?? false;
  const dTaxe = taxeDeLuxe(P, s.masse - out.salaires + inn.salaires, recid) - taxeDeLuxe(P, s.masse, recid);
  const dFutur = inn.futur - out.futur;
  const dPresent = inn.present - out.present;
  const utilite =
    S.present * M.force.valeurPoint * dForce + S.futur * (0.5 + gm.patience) * dFutur + 0.5 * dPresent - gm.aversionTaxe * dTaxe;
  const cede = Math.max(0, out.futur) + Math.max(0, out.present) + Math.max(0, -dForce) * M.force.valeurPoint;
  const raisons: string[] = [];
  const libelle = {
    pretendant: 'Nous jouons le titre',
    playoffs: 'Nous visons les playoffs',
    transition: 'Nous sommes en transition',
    reconstruction: 'Nous reconstruisons',
  }[strategie];
  if (dForce < -0.3 && S.present >= 1) raisons.push(`${libelle} : cet échange nous affaiblit cette saison (force ${dForce.toFixed(1)}).`);
  if (dFutur < -2e6 && S.futur >= 1) raisons.push(`${libelle} : nous voulons des jeunes et des choix, pas l’inverse.`);
  if (dTaxe > 1e6) raisons.push(`La taxe de luxe nous coûterait ${M$(dTaxe)} de plus.`);
  if (dForce > 0.3) raisons.push(`L’échange nous renforce (force +${dForce.toFixed(1)}).`);
  if (dFutur > 2e6) raisons.push('Nous aimons les actifs que nous recevons pour l’avenir.');
  return { utilite, cede, raisons };
}

/** L'avis d'une équipe de l'IA sur un échange (légalité comprise). */
export function evaluerEchange(ctx: ContexteLigue, etat: EtatSaison, prop: PropositionEchange, equipe: string): AvisEchange {
  const M = (ctx.base ?? ctx).marche!.modele;
  const v = verifierEchange(ctx, etat, prop);
  if (!v.legal) return { accepte: false, utilite: -Infinity, raisons: v.motifs };
  const refus = etat.marche?.refus[equipe] ?? 0;
  const gm = equipe !== etat.franchise && prop.equipes.includes(etat.franchise);
  if (gm && refus >= M.gm.refusAvantFermeture)
    return {
      accepte: false,
      utilite: -Infinity,
      raisons: ['Notre GM ne veut plus discuter avec vous pour le moment : trop de propositions refusées.'],
    };
  const { utilite, cede, raisons } = utiliteDeLEchange(ctx, etat, prop, equipe);
  const seuil = M.gm.margeAcceptation * Math.max(1e6, cede);
  const accepte = utilite > seuil;
  if (!accepte && !raisons.length) raisons.push('Ce que vous proposez ne compense pas ce que vous demandez.');
  if (accepte) raisons.unshift('Marché conclu.');
  else raisons.unshift(`Refusé (il manque environ ${M$(Math.max(0, seuil - utilite))} de valeur pour nous).`);
  return { accepte, utilite, raisons };
}

// --- Exécution. ---

/** Exécute un échange légal : joueurs, contrats (horloge de Bird conservée), choix, journal, compositions. */
export function executerEchange(ctx: ContexteLigue, etat: EtatSaison, prop: PropositionEchange): void {
  const v = verifierEchange(ctx, etat, prop);
  if (!v.legal) throw new Error(`Échange illégal : ${v.motifs.join(' ')}`);
  const u = universDe(ctx, etat);
  const P = cbaDeLUnivers(P0(ctx), u);
  const annees = anneesEchangeables(P, u, etat.phase === 'terminee');
  const avant = prop.equipes.map((e) => ({
    joueurs: [...(u.effectifs[e] ?? [])],
    numeros: Object.fromEntries((u.effectifs[e] ?? []).map((j) => [j, u.joueurs[j]?.numero ?? ''])),
  }));
  const noms: string[] = [];
  for (const i of [0, 1] as const) {
    const e = prop.equipes[i];
    const autre = prop.equipes[1 - i]!;
    for (const a of prop.actifs[i]) {
      if (a.type === 'joueur') {
        placerJoueur(u, a.id, autre, u.contrats[a.id]!);
        noms.push(`${u.joueurs[a.id]?.nom ?? a.id} (→ ${autre})`);
      } else {
        const d = droitsSurLesChoix(u, e, annees).find((x) => x.annee === a.annee && x.tour === a.tour && x.original === a.original)!;
        transfererChoix(u, e, autre, d);
        noms.push(`choix ${a.annee} (${a.tour}e tour, ${a.original}) → ${autre}`);
      }
    }
  }
  noterTransaction(u, {
    date: etat.date,
    genre: 'echange',
    equipes: [...prop.equipes],
    joueurs: prop.actifs
      .flat()
      .filter((a) => a.type === 'joueur')
      .map((a) => (a as { id: string }).id),
    texte: `Échange entre ${prop.equipes[0]} et ${prop.equipes[1]} : ${noms.join(', ')}.`,
  });
  prop.equipes.forEach((e, i) => noterComposition(ctx, etat, e, avant[i], { joueurs: [...(u.effectifs[e] ?? [])] }));
  if (etat.compositionManuelle && prop.equipes.includes(etat.franchise)) {
    const effectif = new Set(u.effectifs[etat.franchise] ?? []);
    etat.compositionManuelle = [
      ...etat.compositionManuelle.filter((j) => effectif.has(j)),
      ...[...effectif].filter((j) => !etat.compositionManuelle!.includes(j)),
    ];
  }
  (etat.marche ??= { echanges: 0, signatures: 0, refus: {}, propositions: 0 }).echanges++;
}

// --- Contre-proposition. ---

/** Les actifs qu'une équipe peut céder (joueurs sous contrat, droits sur les choix échangeables). */
export function actifsDe(ctx: ContexteLigue, etat: EtatSaison, equipe: string): Actif[] {
  const u = universLu(ctx, etat);
  const P = cbaDeLUnivers(P0(ctx), u);
  const annees = anneesEchangeables(P, u, etat.phase === 'terminee');
  const vus = new Set<string>();
  const choix: Actif[] = [];
  for (const d of droitsSurLesChoix(u, equipe, annees)) {
    const cle = `${d.annee}-${d.tour}-${d.original}`;
    if (vus.has(cle) || (d.tour === 1 && d.original === equipe && choixGele(u, d.annee, equipe))) continue;
    vus.add(cle);
    choix.push({ type: 'choix', annee: d.annee, tour: d.tour, original: d.original });
  }
  return [...(u.effectifs[equipe] ?? []).map((id) => ({ type: 'joueur' as const, id })), ...choix];
}

/**
 * « Qu'est-ce qu'il vous faudrait ? » : complète l'offre de `demandeur` pour que `partenaire` l'accepte, en ajoutant
 * des actifs du demandeur (d'abord ce que le partenaire valorise le plus, puis de quoi équilibrer les salaires).
 * Rend la proposition complétée, ou undefined si rien ne suffit.
 */
export function ceQuIlFaudrait(
  ctx: ContexteLigue,
  etat: EtatSaison,
  prop: PropositionEchange,
  demandeur: string,
): PropositionEchange | undefined {
  const i = prop.equipes.indexOf(demandeur);
  const partenaire = prop.equipes[1 - i]!;
  let courante: PropositionEchange = { equipes: prop.equipes, actifs: [[...prop.actifs[0]], [...prop.actifs[1]]] };
  const cle = (a: Actif) => (a.type === 'joueur' ? a.id : `${a.annee}-${a.tour}-${a.original}`);
  const pris = new Set(courante.actifs[i]!.map(cle));
  const candidats = actifsDe(ctx, etat, demandeur).filter((a) => !pris.has(cle(a)));
  for (let tour = 0; tour < 6; tour++) {
    const avis = evaluerEchange(ctx, etat, courante, partenaire);
    if (avis.accepte) return courante;
    // Le candidat qui améliore le plus l'utilité du partenaire tout en gardant (ou rendant) l'échange légal.
    let meilleur: { p: PropositionEchange; u: number } | undefined;
    for (const a of candidats) {
      if (courante.actifs[i]!.some((x) => cle(x) === cle(a))) continue;
      const essai: PropositionEchange = { equipes: courante.equipes, actifs: [[...courante.actifs[0]], [...courante.actifs[1]]] };
      essai.actifs[i]!.push(a);
      const v = verifierEchange(ctx, etat, essai);
      const u = utiliteDeLEchange(ctx, etat, essai, partenaire).utilite - (v.legal ? 0 : 1e9);
      if (!meilleur || u > meilleur.u) meilleur = { p: essai, u };
    }
    if (!meilleur || meilleur.u < -1e8) return undefined;
    courante = meilleur.p;
  }
  return evaluerEchange(ctx, etat, courante, partenaire).accepte ? courante : undefined;
}
