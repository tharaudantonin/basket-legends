// Tranche 9 (réponses 36, 37, 42) : l'IA des GM sur le marché des échanges.
//
// Une tentative d'échange : une équipe qui vend (en transition ou en reconstruction, ou au-delà de la taxe qu'elle
// accepte) et une équipe qui achète (prétendant, playoffs) ; l'acheteur vise un joueur qui le renforce, compose une
// offre qui équilibre les salaires selon la CBA, puis ajoute des jeunes ou des choix tant que le vendeur n'est pas
// convaincu. L'échange se fait si les deux équipes y gagnent selon leur stratégie et leur personnalité. Même mécanique
// pour les propositions faites au GM du joueur (dans son bureau). Les volumes visés viennent de
// data/ligue/transactions-2026-27.json (58 échanges en 2025-26), réglés par la probabilité de tentative du modèle.
import { creerHasard, type Hasard } from '@basket-legends/engine';
import { salaireDeLaSaison, saisonCourte } from '../cba';
import type { Univers } from '../carriere/types';
import type { Actualite, ContexteLigue, EtatSaison } from '../types';
import {
  actifsDe,
  echangesOuverts,
  evaluerEchange,
  executerEchange,
  forcesDesEquipes,
  maximumRecevable,
  strategieDe,
  utiliteDeLEchange,
  verifierEchange,
} from './echanges';
import { accepterProlongation } from './agents';
import { cbaDeLUnivers, situationDansLUnivers, universDe } from './operations';
import type { Actif, MessageBureau, ModeleMarche, PropositionEchange } from './types';

const P0 = (ctx: ContexteLigue) => (ctx.base ?? ctx).salaires.cba;
const nomEquipe = (ctx: ContexteLigue, e: string) => ctx.equipes[e]?.nom ?? e;

/** L'équipe du joueur agit-elle comme l'IA sur le marché des échanges ? (délégation « le staff décide ») */
const gmDelegue = (etat: EtatSaison) => etat.delegations?.echanges === 'staff';

/** Une offre de `acheteur` pour le joueur `cible` de `vendeur` : salaires équilibrés, puis compléments. */
export function composerOffre(
  ctx: ContexteLigue,
  etat: EtatSaison,
  acheteur: string,
  vendeur: string,
  cible: string,
): PropositionEchange | undefined {
  const u = etat.univers!;
  const P = cbaDeLUnivers(P0(ctx), u);
  const Sc = saisonCourte(u.saison);
  const s = situationDansLUnivers(P, u, acheteur);
  // Les trois meilleurs joueurs de l'acheteur ne partent pas (il achète pour gagner).
  const intouchables = new Set([...(u.effectifs[acheteur] ?? [])].sort((a, b) => u.joueurs[b]!.note - u.joueurs[a]!.note).slice(0, 3));
  const disponibles = actifsDe(ctx, etat, acheteur).filter((a) => a.type !== 'joueur' || !intouchables.has(a.id));
  const joueurs = disponibles.filter((a): a is Extract<Actif, { type: 'joueur' }> => a.type === 'joueur');
  const choix = disponibles.filter((a) => a.type === 'choix');
  const prop: PropositionEchange = { equipes: [acheteur, vendeur], actifs: [[], [{ type: 'joueur', id: cible }]] };
  // 1. Effectif du vendeur : s'il recevait trop de contrats standard, il ajoute ses fins de banc (petits salaires).
  const standard = (e: string) => (u.effectifs[e] ?? []).filter((j) => u.contrats[j]?.type === 'standard').length;
  const salaire = (j: string) => salaireDeLaSaison(u.contrats[j], Sc);
  const fins = (u.effectifs[vendeur] ?? [])
    .filter((j) => j !== cible && u.contrats[j]?.type === 'standard')
    .sort((a, b) => salaire(a) - salaire(b) || u.joueurs[a]!.note - u.joueurs[b]!.note || (a < b ? -1 : 1));
  // 2. Salaires : l'acheteur ajoute les contrats les plus proches de ce qui manque, jusqu'à pouvoir tout recevoir.
  let cedes = 0;
  const pris = new Set<string>();
  for (let k = 0; k < 8; k++) {
    const recoit = prop.actifs[0].filter((a) => a.type === 'joueur' && u.contrats[a.id]?.type === 'standard').length;
    const exces = standard(vendeur) + recoit - prop.actifs[1].length - P.contratsStandardMax;
    if (exces > 0) {
      const j = fins.find((x) => !prop.actifs[1].some((a) => a.type === 'joueur' && a.id === x));
      if (!j) return undefined;
      prop.actifs[1].push({ type: 'joueur', id: j });
      continue;
    }
    const recus = prop.actifs[1].reduce((t, a) => t + (a.type === 'joueur' ? salaire(a.id) : 0), 0);
    const masseApres = s.masse - cedes + recus;
    if (recus <= maximumRecevable(P, cedes, masseApres)) break;
    const manque = (masseApres > P.premierApron ? recus / P.partEchangeApron : recus / P.partEchangeHaute) - cedes;
    const j = joueurs
      .filter((x) => !pris.has(x.id) && salaire(x.id) > 0)
      .sort((a, b) => Math.abs(salaire(a.id) - manque) - Math.abs(salaire(b.id) - manque))[0];
    if (!j) return undefined;
    pris.add(j.id);
    prop.actifs[0].push(j);
    cedes += salaire(j.id);
  }
  if (!verifierEchange(ctx, etat, prop).legal) return undefined;
  // 3. Compléments (jeunes, choix) tant que le vendeur n'est pas convaincu, au plus quatre actifs en tout.
  const complements = [...choix, ...joueurs.filter((x) => !pris.has(x.id) && (u.joueurs[x.id]?.age ?? 99) <= 24)];
  const restants = [...complements];
  for (let k = 0; k < 5 && prop.actifs[0].length < 6; k++) {
    if (evaluerEchange(ctx, etat, prop, vendeur).accepte) return prop;
    // Les compléments rangés par l'utilité qu'ils donnent au vendeur ; le premier légal est ajouté.
    const classes = restants
      .map((a) => ({ a, essai: { equipes: prop.equipes, actifs: [[...prop.actifs[0], a], prop.actifs[1]] } as PropositionEchange }))
      .map((x) => ({ ...x, u: utiliteDeLEchange(ctx, etat, x.essai, vendeur).utilite }))
      .sort((x, y) => y.u - x.u);
    const retenu = classes.slice(0, 3).find((x) => verifierEchange(ctx, etat, x.essai).legal);
    if (!retenu) break;
    prop.actifs[0].push(retenu.a);
    restants.splice(restants.indexOf(retenu.a), 1);
  }
  return evaluerEchange(ctx, etat, prop, vendeur).accepte ? prop : undefined;
}

/** Les cibles d'un acheteur chez un vendeur : vétérans sous contrat standard qui le renforcent. */
function cibles(M: ModeleMarche, u: Univers, acheteur: string, vendeur: string): string[] {
  const notes = (u.effectifs[acheteur] ?? []).map((j) => u.joueurs[j]!.note).sort((a, b) => b - a);
  const seuil = notes[6] ?? 60;
  return (u.effectifs[vendeur] ?? [])
    .filter((j) => u.contrats[j]?.type === 'standard' && u.joueurs[j]!.note > seuil && u.joueurs[j]!.age >= 24)
    .sort((a, b) => u.joueurs[b]!.note - u.joueurs[a]!.note || (a < b ? -1 : 1))
    .slice(0, M.echangesIa.candidatsParTentative);
}

/** Une tentative d'échange entre deux équipes de l'IA ; rend la proposition exécutée, ou undefined. */
export function tenterEchangeIa(ctx: ContexteLigue, etat: EtatSaison, h: Hasard): PropositionEchange | undefined {
  // Deux motifs : un achat (un prétendant renforce son effectif), ou un délestage (une équipe taxée cède un contrat).
  if (h.chance(0.5)) {
    const d = tenterDelestage(ctx, etat, h);
    if (d) return d;
  }
  return tenterAchat(ctx, etat, h);
}

/**
 * Délestage : une équipe au-delà du seuil de taxe cède un contrat (et, s'il le faut, un choix en compensation) à une
 * équipe qui peut l'absorber ; elle reçoit au plus des contrats plus petits. Les deux équipes doivent y gagner.
 */
export function tenterDelestage(ctx: ContexteLigue, etat: EtatSaison, h: Hasard): PropositionEchange | undefined {
  const u = universDe(ctx, etat);
  const P = cbaDeLUnivers(P0(ctx), u);
  const Sc = saisonCourte(u.saison);
  const equipes = Object.keys(u.effectifs)
    .filter((e) => e !== etat.franchise || gmDelegue(etat))
    .sort();
  const situations = Object.fromEntries(equipes.map((e) => [e, situationDansLUnivers(P0(ctx), u, e)]));
  const taxees = equipes.filter((e) => situations[e]!.taxe > 0);
  const preneurs = equipes.filter((e) => situations[e]!.masse < P.seuilTaxe - 5e6);
  if (!taxees.length || !preneurs.length) return undefined;
  const cedant = h.choisir(taxees);
  const preneur = h.choisir(preneurs);
  // Les contrats moyens ou gros du cédant, hors ses trois meilleurs joueurs.
  const tri = [...(u.effectifs[cedant] ?? [])].sort((a, b) => u.joueurs[b]!.note - u.joueurs[a]!.note);
  const candidats = tri
    .slice(3)
    .filter((j) => u.contrats[j]?.type === 'standard' && salaireDeLaSaison(u.contrats[j], Sc) > 5e6)
    .sort((a, b) => salaireDeLaSaison(u.contrats[b], Sc) - salaireDeLaSaison(u.contrats[a], Sc))
    .slice(0, 3);
  const choixDuCedant = actifsDe(ctx, etat, cedant)
    .filter((a) => a.type === 'choix')
    .sort((a, b) => (a.type === 'choix' && b.type === 'choix' ? b.tour - a.tour || a.annee - b.annee : 0));
  for (const j of candidats) {
    const prop: PropositionEchange = { equipes: [cedant, preneur], actifs: [[{ type: 'joueur', id: j }], []] };
    // Le preneur sous le plafond absorbe ; sinon il renvoie un petit contrat pour équilibrer.
    if (!verifierEchange(ctx, etat, prop).legal) {
      const petit = [...(u.effectifs[preneur] ?? [])]
        .filter((x) => u.contrats[x]?.type === 'standard')
        .sort((a, b) => salaireDeLaSaison(u.contrats[a], Sc) - salaireDeLaSaison(u.contrats[b], Sc))[0];
      if (!petit) continue;
      prop.actifs[1].push({ type: 'joueur', id: petit });
      if (!verifierEchange(ctx, etat, prop).legal) continue;
    }
    for (let k = 0; k <= 2; k++) {
      if (evaluerEchange(ctx, etat, prop, preneur).accepte && evaluerEchange(ctx, etat, prop, cedant).accepte) {
        executerEchange(ctx, etat, prop);
        return prop;
      }
      const sucre = choixDuCedant[k];
      if (!sucre) break;
      prop.actifs[0].push(sucre);
      if (!verifierEchange(ctx, etat, prop).legal) break;
    }
  }
  return undefined;
}

/** Achat : un prétendant vise un joueur d'une équipe qui vend. */
export function tenterAchat(ctx: ContexteLigue, etat: EtatSaison, h: Hasard): PropositionEchange | undefined {
  const u = universDe(ctx, etat);
  const M = (ctx.base ?? ctx).marche!.modele;
  const forces = forcesDesEquipes(M, u);
  const equipes = Object.keys(u.effectifs)
    .filter((e) => e !== etat.franchise || gmDelegue(etat))
    .sort();
  const strat = Object.fromEntries(equipes.map((e) => [e, strategieDe(M, forces, e)]));
  const vendeurs = equipes.filter((e) => strat[e] === 'transition' || strat[e] === 'reconstruction');
  const acheteurs = equipes.filter((e) => strat[e] === 'pretendant' || strat[e] === 'playoffs');
  if (!vendeurs.length || !acheteurs.length) return undefined;
  const vendeur = h.choisir(vendeurs);
  const acheteur = h.choisir(acheteurs);
  for (const cible of cibles(M, u, acheteur, vendeur)) {
    const prop = composerOffre(ctx, etat, acheteur, vendeur, cible);
    if (!prop) continue;
    if (!evaluerEchange(ctx, etat, prop, acheteur).accepte) continue;
    executerEchange(ctx, etat, prop);
    return prop;
  }
  return undefined;
}

/** Décrit un échange pour les actualités et le bureau. */
export function decrireEchange(ctx: ContexteLigue, etat: EtatSaison, prop: PropositionEchange): string {
  const u = etat.univers!;
  const cote = (i: 0 | 1) =>
    prop.actifs[i]
      .map((a) =>
        a.type === 'joueur'
          ? `${u.joueurs[a.id]?.nom ?? a.id} (${u.joueurs[a.id]?.note ?? '?'})`
          : `le ${a.tour === 1 ? '1er' : '2e'} tour ${a.annee}${a.original !== prop.equipes[i] ? ` (de ${nomEquipe(ctx, a.original)})` : ''}`,
      )
      .join(', ') || 'rien';
  return `${nomEquipe(ctx, prop.equipes[0])} cède ${cote(0)} ; ${nomEquipe(ctx, prop.equipes[1])} cède ${cote(1)}.`;
}

function publier(etat: EtatSaison, a: Omit<Actualite, 'id'>): void {
  etat.actualites.push({ id: etat.actualites.length + 1, ...a });
}

export function ecrireAuBureau(etat: EtatSaison, m: Omit<MessageBureau, 'id'>): MessageBureau {
  const bureau = (etat.bureau ??= []);
  const msg = { id: (bureau.at(-1)?.id ?? 0) + 1, ...m };
  bureau.push(msg);
  return msg;
}

/** Une proposition d'une équipe de l'IA au GM du joueur, déposée dans son bureau (avec l'avis du staff). */
export function proposerAuGm(ctx: ContexteLigue, etat: EtatSaison, h: Hasard): MessageBureau | undefined {
  if (gmDelegue(etat)) return undefined;
  const u = universDe(ctx, etat);
  const M = (ctx.base ?? ctx).marche!.modele;
  const forces = forcesDesEquipes(M, u);
  const acheteurs = Object.keys(u.effectifs)
    .filter((e) => e !== etat.franchise && strategieDe(M, forces, e) !== 'reconstruction')
    .sort();
  if (!acheteurs.length) return undefined;
  const acheteur = h.choisir(acheteurs);
  for (const cible of cibles(M, u, acheteur, etat.franchise)) {
    const prop = composerOffre(ctx, etat, acheteur, etat.franchise, cible);
    if (!prop || !evaluerEchange(ctx, etat, prop, acheteur).accepte) continue;
    const avis = utiliteDeLEchange(ctx, etat, prop, etat.franchise);
    (etat.marche ??= { echanges: 0, signatures: 0, refus: {}, propositions: 0 }).propositions++;
    return ecrireAuBureau(etat, {
      date: etat.date,
      genre: 'echange',
      titre: `Proposition de ${nomEquipe(ctx, acheteur)}`,
      texte: `${decrireEchange(ctx, etat, prop)} Avis du staff : ${avis.utilite > 0 ? 'à accepter' : 'à refuser'}${avis.raisons.length ? ` (${avis.raisons.join(' ')})` : ''}.`,
      action: { type: 'echange', proposition: prop },
      statut: 'ouvert',
    });
  }
  return undefined;
}

/** Réponse du GM du joueur à une proposition de son bureau. */
export function repondreAuBureau(ctx: ContexteLigue, etat: EtatSaison, id: number, accepter: boolean): string {
  const m = etat.bureau?.find((x) => x.id === id);
  if (!m || m.statut !== 'ouvert' || !m.action) throw new Error('Ce message n’attend pas de réponse.');
  if (m.action.type === 'echange') {
    if (accepter) {
      const v = verifierEchange(ctx, etat, m.action.proposition);
      if (!v.legal) {
        m.statut = 'expire';
        return `L’échange n’est plus possible : ${v.motifs.join(' ')}`;
      }
      executerEchange(ctx, etat, m.action.proposition);
      publier(etat, {
        date: etat.date,
        genre: 'marche',
        importance: 2,
        equipes: [...m.action.proposition.equipes],
        titre: 'Échange conclu',
        texte: decrireEchange(ctx, etat, m.action.proposition),
      });
    }
    m.statut = accepter ? 'accepte' : 'refuse';
    return accepter ? 'Échange conclu.' : 'Proposition refusée.';
  }
  if (m.action.type === 'offre-staff' && accepter) {
    const r = accepterProlongation(ctx, etat, m.action.offre);
    m.statut = r.endsWith('prolonge.') ? 'accepte' : 'expire';
    return r;
  }
  m.statut = accepter ? 'accepte' : 'refuse';
  return accepter ? 'C’est noté.' : 'Refusé.';
}

/**
 * Le marché d'un jour de saison régulière (avant la date limite) : peut-être un échange entre équipes de l'IA, peut-être
 * une proposition au GM du joueur. Rend vrai si l'univers a changé (le contexte de la saison doit être recalculé).
 */
export function journeeDeMarche(ctx: ContexteLigue, etat: EtatSaison): boolean {
  const base = ctx.base ?? ctx;
  if (!base.marche || !base.univers || !etat.univers) return false;
  if (!echangesOuverts(ctx, etat)) return false;
  const M = base.marche.modele;
  const h = creerHasard(etat.graine, `marche-jour-${etat.saison}-${etat.date}`);
  let change = false;
  // Tentatives du jour : la partie entière, plus une avec la probabilité de la partie décimale.
  const n = Math.floor(M.echangesIa.tentativesParJourSaison) + (h.chance(M.echangesIa.tentativesParJourSaison % 1) ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const prop = tenterEchangeIa(ctx, etat, h);
    if (prop) {
      change = true;
      publier(etat, {
        date: etat.date,
        genre: 'marche',
        importance: prop.equipes.includes(etat.franchise) ? 3 : 2,
        equipes: [...prop.equipes],
        titre: `Échange : ${nomEquipe(ctx, prop.equipes[0])} et ${nomEquipe(ctx, prop.equipes[1])}`,
        texte: decrireEchange(ctx, etat, prop),
      });
    }
  }
  // Propositions au GM : en moyenne `propositionsAuGmParSaison` sur la saison régulière avant la date limite (≈ 110 jours).
  if (h.chance(M.echangesIa.propositionsAuGmParSaison / 110)) proposerAuGm(ctx, etat, h);
  return change;
}

/** Les tentatives d'échanges de l'IA pendant une journée de free agency. */
export function echangesDeLIntersaison(ctx: ContexteLigue, etat: EtatSaison, journee: number): number {
  const M = (ctx.base ?? ctx).marche!.modele;
  const h = creerHasard(etat.graine, `marche-intersaison-${etat.saison}-${journee}`);
  let n = 0;
  for (let k = 0; k < M.echangesIa.tentativesParJourneeIntersaison; k++) {
    const prop = tenterEchangeIa(ctx, etat, h);
    if (!prop) continue;
    n++;
    publier(etat, {
      date: etat.date,
      genre: 'marche',
      importance: prop.equipes.includes(etat.franchise) ? 3 : 2,
      equipes: [...prop.equipes],
      titre: `Échange : ${nomEquipe(ctx, prop.equipes[0])} et ${nomEquipe(ctx, prop.equipes[1])}`,
      texte: decrireEchange(ctx, etat, prop),
    });
  }
  return n;
}
