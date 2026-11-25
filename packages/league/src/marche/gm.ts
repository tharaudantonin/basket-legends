// Tranche 9 : les actions du GM du joueur sur le marché, son effectif et son staff. Un seul point d'entrée
// (`actionDuGm`) : l'interface l'appelle dans le Web Worker et reçoit un nouvel état (l'ancien n'est pas modifié), plus
// une réponse à afficher (avis de l'IA, réaction d'un agent, contre-proposition).
import { salaireMinimum, saisonCourte } from '../cba';
import { contexteDeLaSaison } from '../carriere/univers';
import { jouerJourneeIntersaison, ouvrirIntersaison, terminerIntersaison } from '../carriere/intersaison';
import type { ContexteLigue, EtatSaison } from '../types';
import {
  deciderQualificative,
  deciderRenonciation,
  demandeDuJoueur,
  faireOffre,
  reactionDeLAgent,
  retirerOffre,
  type ReponseAgent,
} from './agents';
import { ceQuIlFaudrait, evaluerEchange, executerEchange, verifierEchange } from './echanges';
import { decrireEchange, repondreAuBureau } from './ia';
import {
  cbaDeLUnivers,
  couperJoueur,
  noterComposition,
  noterTransaction,
  placerJoueur,
  salairesDuContrat,
  situationDansLUnivers,
  universDe,
} from './operations';
import { planDuStaff } from './staff';
import type { AvisEchange, Delegations, MembreStaff, Offre, PropositionEchange, VerdictEchange } from './types';
import { valeurDuJoueur } from './valeur';

export type ActionDuGm =
  | { genre: 'echange-evaluer'; proposition: PropositionEchange }
  | { genre: 'echange-proposer'; proposition: PropositionEchange }
  | { genre: 'ce-qu-il-faudrait'; proposition: PropositionEchange }
  | { genre: 'bureau'; id: number; accepter: boolean }
  | { genre: 'offre'; offre: Omit<Offre, 'journee'> }
  | { genre: 'offre-reaction'; offre: Omit<Offre, 'journee'> }
  | { genre: 'retirer-offre'; joueur: string }
  | { genre: 'qualificative'; joueur: string; tendre: boolean }
  | { genre: 'renoncer'; joueur: string; renoncer: boolean }
  | { genre: 'ouvrir-intersaison' }
  | { genre: 'journee' }
  | { genre: 'terminer-intersaison' }
  | { genre: 'couper'; joueur: string; etaler: boolean }
  | { genre: 'signer-libre'; joueur: string; salaire: number; duree: number }
  | { genre: 'delegations'; delegations: Delegations }
  | { genre: 'composition'; ordre: string[] | null }
  | { genre: 'staff'; membre: string };

export interface ReponseDuGm {
  etat: EtatSaison;
  message?: string;
  avis?: AvisEchange;
  verdict?: VerdictEchange;
  proposition?: PropositionEchange;
  agent?: ReponseAgent;
}

const M$ = (x: number) => `${(x / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M$`;

/** Le cinq de départ et la rotation choisis par le GM (null : le staff compose). */
function composer(ctx: ContexteLigue, etat: EtatSaison, ordre: string[] | null): string {
  const u = universDe(ctx, etat);
  const effectif = u.effectifs[etat.franchise] ?? [];
  if (ordre === null) {
    delete etat.compositionManuelle;
    etat.delegations = { ...etat.delegations!, rotation: 'staff' };
    noterComposition(ctx, etat, etat.franchise, undefined, { joueurs: [...effectif] });
    return 'Le staff compose l’équipe.';
  }
  const inconnus = ordre.filter((j) => !effectif.includes(j));
  if (inconnus.length) throw new Error('Un joueur de la composition n’est pas dans votre effectif.');
  if (new Set(ordre).size !== ordre.length) throw new Error('Un joueur figure deux fois dans la composition.');
  const complet = [...ordre, ...effectif.filter((j) => !ordre.includes(j))];
  etat.compositionManuelle = complet;
  etat.delegations = { ...etat.delegations!, rotation: 'gm' };
  noterComposition(ctx, etat, etat.franchise, undefined, { joueurs: complet, ordre: true });
  return 'Composition enregistrée : elle s’applique dès le prochain match.';
}

/** Le GM engage un membre du staff libre ; celui qu'il remplace rejoint le staff libre. */
function engager(ctx: ContexteLigue, etat: EtatSaison, id: string): string {
  const u = universDe(ctx, etat);
  const libres = (u.staffLibre ??= []);
  const m = libres.find((x) => x.id === id);
  const staff = u.staff?.[etat.franchise];
  if (!m || !staff) throw new Error('Ce membre du staff n’est pas libre.');
  const ancien: MembreStaff = staff[m.poste];
  const avant = { joueurs: [...(u.effectifs[etat.franchise] ?? [])], plan: planDuStaff(staff) };
  staff[m.poste] = m;
  u.staffLibre = [...libres.filter((x) => x.id !== id), ancien];
  noterTransaction(u, {
    date: etat.date,
    genre: 'staff',
    equipes: [etat.franchise],
    joueurs: [],
    texte: `${m.nom} remplace ${ancien.nom}.`,
  });
  if (m.poste === 'entraineur')
    noterComposition(ctx, etat, etat.franchise, avant, {
      joueurs: etat.compositionManuelle ?? [...(u.effectifs[etat.franchise] ?? [])],
      ...(etat.compositionManuelle ? { ordre: true } : {}),
      ...(planDuStaff(staff) ? { plan: planDuStaff(staff) } : {}),
    });
  return `${m.nom} est engagé (${m.poste}).`;
}

/** Signature d'un joueur libre en saison (contrat d'une à deux saisons), s'il accepte et si la CBA le permet. */
function signerLibre(ctx: ContexteLigue, etat: EtatSaison, joueur: string, salaire: number, duree: number): string {
  const u = universDe(ctx, etat);
  const base = ctx.base ?? ctx;
  const M = base.marche!.modele;
  const P = cbaDeLUnivers(base.salaires.cba, u);
  if (u.horsNba[joueur] !== 'libre') throw new Error('Ce joueur n’est pas libre.');
  if (etat.phase !== 'reguliere') throw new Error('Les signatures en saison se font pendant la saison régulière.');
  const j = u.joueurs[joueur]!;
  const s = situationDansLUnivers(base.salaires.cba, u, etat.franchise);
  if (s.effectif.standard >= P.contratsStandardMax)
    return `Effectif complet (${P.contratsStandardMax} contrats standard) : coupez d’abord un joueur.`;
  const min = salaireMinimum(P, 0);
  const moyen = s.exceptions.find((x) => (x.moyen === 'minimum' ? salaire <= min * 1.0001 : salaire <= x.montantMax));
  if (!moyen) return `Aucun moyen de signer pour ${M$(salaire)} (espace ou exception insuffisants).`;
  const demande = demandeDuJoueur(M, P, j, 0, etat.graine);
  if (salaire < demande * 0.9) return `${j.nom} demande au moins ${M$(demande * 0.9)}.`;
  const Sc = saisonCourte(u.saison);
  placerJoueur(u, joueur, etat.franchise, {
    type: 'standard',
    salaires: salairesDuContrat(Sc, salaire, Math.min(2, Math.max(1, duree)), 0),
    garanti: salaire * Math.min(2, Math.max(1, duree)),
    anciennete: 0,
    draft: null,
    saisonsAvecEquipe: 0,
    signeLe: etat.date,
  });
  noterTransaction(u, {
    date: etat.date,
    genre: 'signature',
    equipes: [etat.franchise],
    joueurs: [joueur],
    texte: `${j.nom} signe avec ${etat.franchise} (${M$(salaire)}).`,
  });
  noterComposition(ctx, etat, etat.franchise, undefined, { joueurs: [...(u.effectifs[etat.franchise] ?? [])] });
  (etat.marche ??= { echanges: 0, signatures: 0, refus: {}, propositions: 0 }).signatures++;
  return `${j.nom} signe.`;
}

/** Une action du GM du joueur ; rend le nouvel état et la réponse à afficher. */
export function actionDuGm(base: ContexteLigue, etatInitial: EtatSaison, action: ActionDuGm): ReponseDuGm {
  const etat = structuredClone(etatInitial);
  if (action.genre === 'ouvrir-intersaison') return { etat: ouvrirIntersaison(base, etat), message: 'L’intersaison commence.' };
  if (action.genre === 'journee') return { etat: jouerJourneeIntersaison(base, etat) };
  if (action.genre === 'terminer-intersaison') return { etat: terminerIntersaison(base, etat), message: 'La saison peut commencer.' };
  const ctx = contexteDeLaSaison(base, etat);
  universDe(ctx, etat);
  const gm = etat.franchise;
  const autre = (p: PropositionEchange) => p.equipes.find((e) => e !== gm)!;
  switch (action.genre) {
    case 'echange-evaluer': {
      const verdict = verifierEchange(ctx, etat, action.proposition);
      const avis = verdict.legal ? evaluerEchange(ctx, etat, action.proposition, autre(action.proposition)) : undefined;
      return { etat: etatInitial, verdict, ...(avis ? { avis } : {}) };
    }
    case 'echange-proposer': {
      const avis = evaluerEchange(ctx, etat, action.proposition, autre(action.proposition));
      if (!avis.accepte) {
        const m = (etat.marche ??= { echanges: 0, signatures: 0, refus: {}, propositions: 0 });
        m.refus[autre(action.proposition)] = (m.refus[autre(action.proposition)] ?? 0) + 1;
        return { etat, avis };
      }
      executerEchange(ctx, etat, action.proposition);
      etat.actualites.push({
        id: etat.actualites.length + 1,
        date: etat.date,
        genre: 'marche',
        importance: 3,
        equipes: [...action.proposition.equipes],
        titre: 'Échange conclu',
        texte: decrireEchange(ctx, etat, action.proposition),
      });
      return { etat, avis, message: 'Échange conclu.' };
    }
    case 'ce-qu-il-faudrait': {
      const p = ceQuIlFaudrait(ctx, etat, action.proposition, gm);
      return {
        etat: etatInitial,
        ...(p ? { proposition: p } : {}),
        message: p ? 'Voici ce que l’équipe accepterait.' : 'Rien de ce que vous pouvez offrir ne suffit.',
      };
    }
    case 'bureau':
      return { etat, message: repondreAuBureau(ctx, etat, action.id, action.accepter) };
    case 'offre':
      return { etat, agent: faireOffre(ctx, etat, { ...action.offre, equipe: gm }) };
    case 'offre-reaction':
      return {
        etat: etatInitial,
        agent: reactionDeLAgent(ctx, etat, { ...action.offre, equipe: gm, journee: (etat.intersaison?.journee ?? 0) + 1 }),
      };
    case 'retirer-offre':
      retirerOffre(etat, action.joueur);
      return { etat };
    case 'qualificative':
      deciderQualificative(ctx, etat, action.joueur, action.tendre);
      return { etat };
    case 'renoncer':
      deciderRenonciation(etat, action.joueur, action.renoncer);
      return { etat };
    case 'couper': {
      const base0 = ctx.base ?? ctx;
      const M = base0.marche!.modele;
      const Mc = base0.carriere!.modele.progression;
      const u = etat.univers!;
      const P = cbaDeLUnivers(base0.salaires.cba, u);
      const c = u.contrats[action.joueur];
      // Une équipe le réclame au ballottage si son contrat vaut ce qu'il coûte.
      const preneur = couperJoueur(ctx, etat, gm, action.joueur, action.etaler, etat.date, () =>
        c ? valeurDuJoueur(M, Mc, P, u.joueurs[action.joueur]!, c, saisonCourte(u.saison)).present >= 0 : false,
      );
      noterComposition(ctx, etat, gm, undefined, { joueurs: [...(u.effectifs[gm] ?? [])] });
      if (etat.compositionManuelle) etat.compositionManuelle = etat.compositionManuelle.filter((j) => j !== action.joueur);
      return {
        etat,
        message: preneur
          ? `Réclamé au ballottage par ${ctx.equipes[preneur]?.nom ?? preneur} : son contrat le suit.`
          : 'Joueur coupé : il est libre.',
      };
    }
    case 'signer-libre':
      return { etat, message: signerLibre(ctx, etat, action.joueur, action.salaire, action.duree) };
    case 'delegations':
      etat.delegations = { ...action.delegations };
      if (etat.draft && !etat.draft.terminee) etat.draft = { ...etat.draft, delegue: action.delegations.draft === 'staff' };
      if (action.delegations.rotation === 'staff') delete etat.compositionManuelle;
      return { etat, message: 'Délégations enregistrées.' };
    case 'composition':
      return { etat, message: composer(ctx, etat, action.ordre) };
    case 'staff':
      return { etat, message: engager(ctx, etat, action.membre) };
  }
}
