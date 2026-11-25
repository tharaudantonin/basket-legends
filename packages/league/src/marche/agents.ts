// Tranche 9 (réponses 29 à 32, 35) : la free agency de l'intersaison, par journées.
//
// Journée 0 (décisions) : options des joueurs et des équipes, offres qualificatives des agents libres restreints,
// renonciation aux droits. Journées 1 à N : les équipes font des offres (l'IA, et le GM du joueur à l'écran) ; à la fin
// de chaque journée, chaque agent libre choisit la meilleure offre selon sa personnalité (argent, victoire, rôle,
// fidélité) si elle atteint sa demande, qui baisse au fil des journées. Un agent libre restreint qui signe ailleurs donne
// à son équipe le droit de s'aligner (deux jours : jusqu'à la journée suivante). Après la dernière journée, le camp :
// les équipes complètent leur effectif au minimum, les autres agents libres passent hors NBA.
//
// Moyens de signer (CBA) : droits de Bird sur ses propres agents libres (au-dessus du plafond), espace salarial (moins
// les « cap holds » des droits gardés), mid-level et bi-annuelle (une fois par saison), minimum. Réorganisation tracée
// de rugby-legends@19dd48f:src/manager/moteur/marche.ts (demande du joueur, réponses typées de l'agent, offres de l'IA) ;
// réécrite pour la CBA (réponse 44).
import { creerHasard } from '@basket-legends/engine';
import {
  exceptionsDisponibles,
  salaireDeLaSaison,
  salaireMaximum,
  salaireMinimum,
  saisonCourte,
  type ContratJoueur,
  type ParametresCba,
} from '../cba';
import { ajouterJours } from '../calendrier';
import type { JoueurCarriere, Univers } from '../carriere/types';
import type { ContexteLigue, EtatSaison } from '../types';
import { dateDeLaSaison, forcesDesEquipes, gmDe, strategieDe } from './echanges';
import {
  cbaDeLUnivers,
  droitsBird,
  estRestreint,
  limitesDuContrat,
  maximumAvecDroits,
  noterTransaction,
  offreQualificative,
  placerJoueur,
  salairesDuContrat,
  salairesDeLUnivers,
  universDe,
} from './operations';
import { personnalite } from './personnalite';
import type { AgentLibre, EtatIntersaison, ModeleMarche, MoyenOffre, Offre } from './types';
import { force, notesProjetees, salaireDeMarche, valeurDuJoueur } from './valeur';
import { facteurFidelite } from '../club/vestiaire';

const M$ = (x: number) => `${(x / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M$`;
const P0 = (ctx: ContexteLigue) => (ctx.base ?? ctx).salaires.cba;
const modele = (ctx: ContexteLigue): ModeleMarche => (ctx.base ?? ctx).marche!.modele;

/** La durée souhaitée par un joueur selon son âge. */
export function dureeSouhaitee(M: ModeleMarche, age: number): number {
  for (const [max, n] of M.agentsLibres.dureeSelonAge) if (age <= max) return n;
  return 1;
}

/** La demande d'un agent libre (salaire de première saison) : salaire de marché, selon son goût pour l'argent. */
export function demandeDuJoueur(M: ModeleMarche, P: ParametresCba, j: JoueurCarriere, anciennete: number, graine: number): number {
  const p = personnalite(M, j.id, graine);
  const marche = salaireDeMarche(M, P, j.note, anciennete);
  const brut = marche * (1 + (0.2 * (p.argent - 50)) / 50);
  return Math.round(Math.min(salaireMaximum(P, anciennete), Math.max(salaireMinimum(P, anciennete), brut)));
}

/** Coefficient de « cap hold » d'un agent libre dont l'équipe garde les droits (Hoops Rumors : 150 % à 300 %, 130 %, 120 %). */
const HOLD: Record<string, number> = { bird: 1.5, 'early-bird': 1.3, 'non-bird': 1.2 };

/** La masse d'une équipe pour son espace salarial : contrats, argent mort et cap holds des droits qu'elle garde. */
export function masseAvecHolds(ctx: ContexteLigue, etat: EtatSaison, equipe: string): number {
  const u = etat.univers!;
  const D = salairesDeLUnivers(P0(ctx), u);
  const Sc = saisonCourte(u.saison);
  const contrats = (u.effectifs[equipe] ?? []).reduce((t, j) => t + salaireDeLaSaison(u.contrats[j], Sc), 0);
  const I = etat.intersaison;
  const holds = I
    ? Object.values(I.agents)
        .filter((a) => a.ancienne === equipe && a.droits && !I.renonces[equipe]?.includes(a.joueur))
        .reduce((t, a) => t + Math.min(salaireMaximum(D.cba, 10), a.precedent * HOLD[a.droits!]!), 0)
    : 0;
  return contrats + (D.equipes[equipe]?.autresCharges ?? 0) + holds;
}

/** Les moyens qu'a une équipe pour offrir `salaire` à un agent libre (le meilleur d'abord), ou aucun. */
export function moyensPourOffrir(ctx: ContexteLigue, etat: EtatSaison, equipe: string, a: AgentLibre, salaire: number): MoyenOffre[] {
  const u = etat.univers!;
  const P = cbaDeLUnivers(P0(ctx), u);
  const anc = u.contrats[a.joueur]?.anciennete ?? 0;
  const moyens: MoyenOffre[] = [];
  if (a.ancienne === equipe && a.droits && !etat.intersaison?.renonces[equipe]?.includes(a.joueur)) {
    if (salaire <= maximumAvecDroits(P, a.droits, a.precedent, anc, salaireMaximum(P, anc))) moyens.push(a.droits);
  }
  const masse = masseAvecHolds(ctx, etat, equipe);
  const utilisees = new Set(u.exceptionsUtilisees?.[equipe] ?? []);
  for (const x of exceptionsDisponibles(P, masse, salairesDeLUnivers(P0(ctx), u).equipes[equipe])) {
    if (x.moyen !== 'minimum' && x.moyen !== 'espace' && utilisees.has(x.moyen)) continue;
    if (x.moyen === 'minimum') {
      if (salaire <= salaireMinimum(P, anc)) moyens.push('minimum');
    } else if (salaire <= x.montantMax) moyens.push(x.moyen);
  }
  return moyens;
}

/** Le plus haut premier salaire qu'une équipe peut offrir à un agent libre, et avec quel moyen. */
export function capaciteDOffre(
  ctx: ContexteLigue,
  etat: EtatSaison,
  equipe: string,
  a: AgentLibre,
): { moyen: MoyenOffre; max: number } | undefined {
  const u = etat.univers!;
  const P = cbaDeLUnivers(P0(ctx), u);
  const anc = u.contrats[a.joueur]?.anciennete ?? 0;
  const options: { moyen: MoyenOffre; max: number }[] = [];
  if (a.ancienne === equipe && a.droits && !etat.intersaison?.renonces[equipe]?.includes(a.joueur))
    options.push({ moyen: a.droits, max: maximumAvecDroits(P, a.droits, a.precedent, anc, salaireMaximum(P, anc)) });
  const utilisees = new Set(u.exceptionsUtilisees?.[equipe] ?? []);
  for (const x of exceptionsDisponibles(P, masseAvecHolds(ctx, etat, equipe), salairesDeLUnivers(P0(ctx), u).equipes[equipe])) {
    if (x.moyen === 'minimum') options.push({ moyen: 'minimum', max: salaireMinimum(P, anc) });
    else if (x.moyen === 'espace' || !utilisees.has(x.moyen))
      options.push({ moyen: x.moyen, max: Math.min(x.montantMax, salaireMaximum(P, anc)) });
  }
  return options.sort((x, y) => y.max - x.max)[0];
}

/** La personnalité est un trait de personnage généré (réponse 35). */
export { personnalite };

// --- Ouverture : journée 0. ---

/**
 * Ouvre la free agency de la saison de l'univers : options (décidées par le staff de chaque équipe ; celles de la
 * franchise du joueur restent modifiables pendant la journée 0), contrats échus, agents libres restreints.
 * `echus` : équipe → joueurs dont le contrat est échu (sortis de l'effectif).
 */
export function ouvrirAgentsLibres(ctx: ContexteLigue, etat: EtatSaison, echus: Record<string, string[]>): EtatIntersaison {
  const u = universDe(ctx, etat);
  const M = modele(ctx);
  const P = cbaDeLUnivers(P0(ctx), u);
  const Mc = (ctx.base ?? ctx).carriere!.modele.progression;
  const Sc = saisonCourte(u.saison);
  const I: EtatIntersaison = {
    journee: 0,
    journees: M.agentsLibres.journees,
    agents: {},
    offres: [],
    feuilles: [],
    signatures: [],
    renonces: {},
  };
  const precedente = (c: ContratJoueur | undefined) => c?.salaires.filter((s) => s.saison < Sc).at(-1)?.montant ?? 0;
  const ajouter = (j: string, ancienne: string | null) => {
    const joueur = u.joueurs[j];
    if (!joueur) return;
    const c = u.contrats[j];
    const anc = c?.anciennete ?? 0;
    const restreint = !!(ancienne && c && c.type === 'standard' && estRestreint(P, c));
    const a: AgentLibre = {
      joueur: j,
      ancienne,
      droits: ancienne && c ? droitsBird(P, c) : null,
      restreint,
      precedent: precedente(c),
      demande: demandeDuJoueur(M, P, joueur, anc, etat.graine),
      duree: dureeSouhaitee(M, joueur.age),
    };
    // Choix du modèle : un joueur payé près du minimum ne signe pas plus de deux saisons.
    if (a.demande < 3 * salaireMinimum(P, anc)) a.duree = Math.min(a.duree, 2);
    if (restreint && c) {
      const qo = offreQualificative(P, c, a.precedent);
      // Le staff tend l'offre qualificative si le joueur la vaut (réponse 30).
      if (salaireDeMarche(M, P, joueur.note, anc) >= qo * M.agentsLibres.seuilOffreQualificative) a.offreQualificative = qo;
      else a.restreint = false;
    }
    I.agents[j] = a;
  };
  // Options des joueurs et des équipes sur la saison qui commence.
  for (const [e, js] of Object.entries(u.effectifs))
    for (const j of [...js]) {
      const c = u.contrats[j];
      const ligne = c?.salaires.find((s) => s.saison === Sc);
      if (!c || !ligne?.option) continue;
      const joueur = u.joueurs[j]!;
      const marche = salaireDeMarche(M, P, joueur.note, c.anciennete ?? 0);
      // Option d'équipe sur l'échelle des rookies : exercée sauf si le joueur est sous le niveau NBA (choix du modèle :
      // les équipes gardent leurs jeunes choix de 1er tour pour leur marge de progression) ; autres options : selon sa valeur.
      const rookie = c.draft?.tour === 1 && (c.anciennete ?? 0) <= 3;
      const exercee =
        ligne.option === 'joueur'
          ? ligne.montant * M.agentsLibres.seuilOptionJoueur >= marche
          : rookie
            ? joueur.note >= M.agentsLibres.noteMinNba
            : valeurDuJoueur(M, Mc, P, joueur, c, Sc).present >= 0;
      if (exercee) {
        delete ligne.option;
        continue;
      }
      c.salaires = c.salaires.filter((s) => s.saison < Sc);
      u.effectifs[e] = u.effectifs[e]!.filter((x) => x !== j);
      (echus[e] ??= []).push(j);
      noterTransaction(u, {
        date: etat.date,
        genre: 'option',
        equipes: [e],
        joueurs: [j],
        texte: `${joueur.nom} : option ${ligne.option === 'joueur' ? 'du joueur déclinée, il devient agent libre' : 'de l’équipe déclinée'}.`,
      });
    }
  for (const [e, js] of Object.entries(echus)) for (const j of js) ajouter(j, e);
  // Joueurs libres hors NBA, au niveau NBA : ils rejoignent le marché.
  for (const [j, statut] of Object.entries(u.horsNba))
    if ((u.joueurs[j]?.note ?? 0) >= (statut === 'libre' ? M.agentsLibres.noteMinNba : 70) && !I.agents[j]) ajouter(j, null);
  // Le staff renonce aux droits des agents libres qu'il ne veut pas garder (libère l'espace des cap holds) : joueur sous
  // le niveau NBA, ou qui coûterait plus qu'il ne rapporte au salaire qu'il demande.
  for (const a of Object.values(I.agents)) {
    if (!a.ancienne || !a.droits) continue;
    const j = u.joueurs[a.joueur]!;
    const c: ContratJoueur = {
      type: 'standard',
      salaires: salairesDuContrat(Sc, a.demande, a.duree, M.agentsLibres.hausseParDefaut),
      garanti: null,
      anciennete: 0,
      draft: null,
    };
    const v = valeurDuJoueur(M, Mc, P, j, c, Sc);
    if (j.note < M.agentsLibres.noteMinNba || v.present + v.futur < 0) (I.renonces[a.ancienne] ??= []).push(a.joueur);
  }
  return I;
}

/**
 * Avant la première journée, les équipes prolongent leurs propres agents libres (droits de Bird), comme la règle validée
 * de la tranche 8 (`carriere-v1.json`, bloc `effectifs` : note et âge, place dans l'effectif, les meilleurs d'abord),
 * mais au salaire qu'ils demandent et seulement s'ils acceptent : fidèles, ou attirés par une équipe qui gagne.
 * Les équipes de l'IA le font toujours ; le GM du joueur seulement s'il a délégué les prolongations à son staff ; sinon
 * son staff lui recommande ces prolongations dans son bureau.
 */
export function prolongerAvantMarche(
  ctx: ContexteLigue,
  etat: EtatSaison,
): { joueur: string; equipe: string; salaire: number; duree: number }[] {
  const u = etat.univers!;
  const I = etat.intersaison!;
  const M = modele(ctx);
  const C = (ctx.base ?? ctx).carriere!.modele.effectifs;
  const P = cbaDeLUnivers(P0(ctx), u);
  const forces = forcesDesEquipes(M, u);
  const valeurs = Object.values(forces);
  const [fMin, fMax] = [Math.min(...valeurs), Math.max(...valeurs)];
  const faites: { joueur: string; equipe: string; salaire: number; duree: number }[] = [];
  const standard = (e: string) => (u.effectifs[e] ?? []).filter((j) => u.contrats[j]?.type === 'standard').length;
  for (const e of Object.keys(u.effectifs).sort()) {
    const gm = e === etat.franchise;
    const liste = Object.values(I.agents)
      .filter((a) => a.ancienne === e && a.droits && !I.renonces[e]?.includes(a.joueur))
      .filter((a) => {
        const j = u.joueurs[a.joueur];
        return j && j.note >= C.noteMinProlongation && j.age <= C.ageMaxProlongation;
      })
      .sort((x, y) => u.joueurs[y.joueur]!.note - u.joueurs[x.joueur]!.note || (x.joueur < y.joueur ? -1 : 1));
    for (const a of liste) {
      if (standard(e) >= P.contratsStandardMax && !peutFaireDeLaPlace(u, e, a.joueur)) continue;
      const p = personnalite(M, a.joueur, etat.graine);
      const gagne = (forces[e]! - fMin) / Math.max(1e-9, fMax - fMin);
      if (p.fidelite + p.victoire * gagne < 50) continue;
      const L = limitesDuContrat(P, a.droits!);
      const offre: Offre = {
        joueur: a.joueur,
        equipe: e,
        salaire: a.demande,
        duree: Math.max(L.dureeMin, Math.min(L.dureeMax, a.duree)),
        hausse: Math.min(L.hausseMax, M.agentsLibres.hausseParDefaut),
        moyen: a.droits!,
        journee: 0,
      };
      if (verifierOffre(ctx, etat, offre).length) continue;
      if (gm && etat.delegations?.prolongations !== 'staff') {
        if (etat.delegations?.prolongations === 'propose')
          (etat.bureau ??= []).push({
            id: (etat.bureau?.at(-1)?.id ?? 0) + 1,
            date: etat.date,
            genre: 'staff',
            titre: `Le staff recommande de prolonger ${u.joueurs[a.joueur]!.nom}`,
            texte: `${u.joueurs[a.joueur]!.nom} accepterait ${offre.duree} saison(s) à ${M$(offre.salaire)} la première (droits ${a.droits}).`,
            action: { type: 'offre-staff', offre },
            statut: 'ouvert',
          });
        continue;
      }
      signer(ctx, etat, offre);
      faites.push({ joueur: a.joueur, equipe: e, salaire: offre.salaire, duree: offre.duree });
    }
  }
  return faites;
}

/** Le GM du joueur accepte une prolongation recommandée par son staff (journée 0) : le joueur signe tout de suite. */
export function accepterProlongation(ctx: ContexteLigue, etat: EtatSaison, o: Offre): string {
  const motifs = verifierOffre(ctx, etat, o);
  if (motifs.length) return `Prolongation impossible : ${motifs.join(' ')}`;
  signer(ctx, etat, o);
  return `${etat.univers!.joueurs[o.joueur]!.nom} prolonge.`;
}

/** Journée 0 : le GM renonce (ou non) à ses droits sur un de ses agents libres (son « cap hold » libère de l'espace). */
export function deciderRenonciation(etat: EtatSaison, joueur: string, renoncer: boolean): void {
  const I = etat.intersaison;
  const a = I?.agents[joueur];
  if (!I || !a || a.ancienne !== etat.franchise) throw new Error('Ce joueur n’est pas un de vos agents libres.');
  const liste = (I.renonces[etat.franchise] ??= []).filter((x) => x !== joueur);
  if (renoncer) liste.push(joueur);
  I.renonces[etat.franchise] = liste;
}

/** Journée 0 : le GM tend ou retire l'offre qualificative d'un de ses agents libres restreints. */
export function deciderQualificative(ctx: ContexteLigue, etat: EtatSaison, joueur: string, tendre: boolean): void {
  const I = etat.intersaison;
  const a = I?.agents[joueur];
  const u = etat.univers!;
  if (!I || !a || a.ancienne !== etat.franchise) throw new Error('Ce joueur n’est pas un de vos agents libres.');
  if (I.journee > 0) throw new Error('Les offres qualificatives se décident avant la première journée.');
  const c = u.contrats[joueur];
  const P = cbaDeLUnivers(P0(ctx), u);
  if (tendre) {
    if (!c || !estRestreint(P, c)) throw new Error('Ce joueur ne peut pas devenir agent libre restreint.');
    a.restreint = true;
    a.offreQualificative = offreQualificative(P, c, a.precedent);
  } else {
    a.restreint = false;
    delete a.offreQualificative;
  }
}

// --- Offres. ---

export interface ReponseAgent {
  type: 'accord' | 'contre-salaire' | 'contre-duree' | 'refus' | 'mieux-ailleurs' | 'invalide';
  texte: string;
  /** Contre-proposition de l'agent (salaire, durée). */
  salaire?: number;
  duree?: number;
}

/** La demande courante d'un agent libre (elle baisse au fil des journées, jusqu'à un plancher). */
export const demandeCourante = (M: ModeleMarche, a: AgentLibre, journee: number): number =>
  Math.round(a.demande * Math.max(M.agentsLibres.demandePlancher, 1 - M.agentsLibres.baisseDemandeParJournee * Math.max(0, journee - 1)));

/** Contrôle une offre selon la CBA ; rend les motifs de refus (vide : valide). */
export function verifierOffre(ctx: ContexteLigue, etat: EtatSaison, o: Offre): string[] {
  const u = etat.univers!;
  const I = etat.intersaison;
  const P = cbaDeLUnivers(P0(ctx), u);
  const a = I?.agents[o.joueur];
  const motifs: string[] = [];
  if (!I || !a) return ['Ce joueur n’est pas agent libre.'];
  if (I.terminee || I.journee >= I.journees) motifs.push('La free agency est terminée.');
  const anc = u.contrats[o.joueur]?.anciennete ?? 0;
  const L = limitesDuContrat(P, o.moyen);
  if (o.duree < L.dureeMin || o.duree > L.dureeMax) motifs.push(`Durée de ${L.dureeMin} à ${L.dureeMax} saisons avec ce moyen.`);
  if (o.hausse < 0 || o.hausse > L.hausseMax + 1e-9) motifs.push(`Hausse annuelle de ${Math.round(L.hausseMax * 100)} % au plus.`);
  if (o.salaire < salaireMinimum(P, anc)) motifs.push(`Salaire sous le minimum (${M$(salaireMinimum(P, anc))}).`);
  if (o.salaire > salaireMaximum(P, anc)) motifs.push(`Salaire au-delà du maximum (${M$(salaireMaximum(P, anc))}).`);
  const moyens = moyensPourOffrir(ctx, etat, o.equipe, a, o.salaire);
  if (!moyens.includes(o.moyen))
    motifs.push(`Moyen « ${o.moyen} » indisponible pour ce salaire (possibles : ${moyens.join(', ') || 'aucun'}).`);
  const std = (u.effectifs[o.equipe] ?? []).filter((j) => u.contrats[j]?.type === 'standard').length;
  if (std >= P.contratsStandardMax && !peutFaireDeLaPlace(u, o.equipe, o.joueur))
    motifs.push(
      `Déjà ${P.contratsStandardMax} contrats standard (il faudrait un joueur nettement meilleur que le moins bon pour faire de la place).`,
    );
  return motifs;
}

/** La réaction immédiate de l'agent à une offre (elle ne vaut signature qu'à la fin de la journée). */
export function reactionDeLAgent(ctx: ContexteLigue, etat: EtatSaison, o: Offre): ReponseAgent {
  const M = modele(ctx);
  const I = etat.intersaison!;
  const a = I.agents[o.joueur]!;
  const motifs = verifierOffre(ctx, etat, o);
  if (motifs.length) return { type: 'invalide', texte: motifs.join(' ') };
  const demande = demandeCourante(M, a, Math.max(1, I.journee + 1));
  const nom = etat.univers!.joueurs[o.joueur]!.nom;
  if (o.salaire < demande * 0.75)
    return { type: 'refus', texte: `L’agent de ${nom} juge l’offre très loin de sa valeur (${M$(demande)} demandés).`, salaire: demande };
  if (o.salaire < demande)
    return { type: 'contre-salaire', texte: `L’agent de ${nom} demande ${M$(demande)} par saison.`, salaire: demande, duree: a.duree };
  if (Math.abs(o.duree - a.duree) >= 2)
    return {
      type: 'contre-duree',
      texte: `${nom} souhaite un contrat de ${a.duree} saison${a.duree > 1 ? 's' : ''}.`,
      duree: a.duree,
      salaire: o.salaire,
    };
  const concurrentes = I.offres.filter((x) => x.joueur === o.joueur && x.equipe !== o.equipe && x.salaire > o.salaire * 1.1);
  if (concurrentes.length) return { type: 'mieux-ailleurs', texte: `${nom} a une offre plus élevée ailleurs ; il réfléchit.` };
  return { type: 'accord', texte: `Accord de principe : ${nom} signera à la fin de la journée si personne ne fait mieux.` };
}

/** Le GM du joueur fait une offre (remplace sa précédente offre au même joueur). Rend la réaction de l'agent. */
export function faireOffre(ctx: ContexteLigue, etat: EtatSaison, o: Omit<Offre, 'journee'>): ReponseAgent {
  const I = etat.intersaison;
  if (!I) throw new Error('Pas de free agency en cours.');
  const offre: Offre = { ...o, journee: I.journee + 1 };
  const r = reactionDeLAgent(ctx, etat, offre);
  if (r.type === 'invalide') return r;
  I.offres = I.offres.filter((x) => !(x.joueur === o.joueur && x.equipe === o.equipe));
  I.offres.push(offre);
  return r;
}

/** Retire une offre du GM. */
export function retirerOffre(etat: EtatSaison, joueur: string): void {
  if (etat.intersaison)
    etat.intersaison.offres = etat.intersaison.offres.filter((x) => !(x.joueur === joueur && x.equipe === etat.franchise));
}

// --- Offres de l'IA. ---

/** Les offres de l'IA d'une équipe pour la journée (besoins, valeur, moyens). */
function offresDeLIa(ctx: ContexteLigue, etat: EtatSaison, equipe: string, journee: number, prises: Set<string>): Offre[] {
  const u = etat.univers!;
  const M = modele(ctx);
  const P = cbaDeLUnivers(P0(ctx), u);
  const Mc = (ctx.base ?? ctx).carriere!.modele.progression;
  const I = etat.intersaison!;
  const Sc = saisonCourte(u.saison);
  const std = (u.effectifs[equipe] ?? []).filter((j) => u.contrats[j]?.type === 'standard').length;
  // Au-delà du maximum, une seule offre, pour un joueur nettement meilleur que le moins bon de l'effectif.
  const libres = P.contratsStandardMax - std - I.offres.filter((o) => o.equipe === equipe).length;
  const places = Math.max(1, libres);
  const amelioration = libres <= 0;
  const derniere = journee >= I.journees;
  const forces = forcesDesEquipes(M, u);
  const strategie = strategieDe(M, forces, equipe);
  const notes = (u.effectifs[equipe] ?? []).map((j) => u.joueurs[j]!.note);
  const fAvant = force(M, notes);
  // Argent qui ne coûte rien (ou peu) : sous la masse minimale de la CBA, l'équipe paiera la différence de toute façon ;
  // sous le plafond, l'espace inutilisé serait perdu (part du modèle).
  const masse = masseAvecHolds(ctx, etat, equipe);
  const gratuit = (salaire: number) =>
    Math.min(salaire, Math.max(0, P.masseMinimale - masse)) +
    M.agentsLibres.valeurEspaceInutilise * Math.min(salaire, Math.max(0, P.plafondSalarial - Math.max(masse, P.masseMinimale)));
  const candidats = Object.values(I.agents)
    .filter((a) => !prises.has(a.joueur) && u.joueurs[a.joueur])
    .map((a) => {
      const j = u.joueurs[a.joueur]!;
      const demande = demandeCourante(M, a, journee);
      const gain = (force(M, [...notes, j.note]) - fAvant) * M.force.valeurPoint * M.strategies[strategie].present;
      const jeune = j.age <= 24 ? M.strategies[strategie].futur : 1;
      const garde = a.ancienne === equipe && !I.renonces[equipe]?.includes(a.joueur) ? M.agentsLibres.fideliteEquipe : 0;
      // La durée offerte : celle qui donne le plus de valeur à l'équipe (un vétéran en déclin : un contrat court).
      let meilleur = { duree: Math.min(a.duree, 4), score: -Infinity };
      for (let duree = 1; duree <= Math.min(a.duree, 4); duree++) {
        const c: ContratJoueur = {
          type: 'standard',
          salaires: salairesDuContrat(Sc, demande, duree, M.agentsLibres.hausseParDefaut),
          garanti: null,
          anciennete: 0,
          draft: null,
        };
        const v = valeurDuJoueur(M, Mc, P, j, c, Sc);
        const score = v.present + jeune * v.futur + gain + garde + gratuit(demande) - 0.05 * Math.abs(duree - a.duree) * demande;
        if (score > meilleur.score) meilleur = { duree, score };
      }
      return { a, demande, duree: meilleur.duree, score: meilleur.score };
    })
    .filter((x) => x.score > 0 && (!amelioration || peutFaireDeLaPlace(u, equipe, x.a.joueur)))
    .sort((x, y) => y.score - x.score || (x.a.joueur < y.a.joueur ? -1 : 1));
  const offres: Offre[] = [];
  for (const x of candidats) {
    if (offres.length >= Math.min(places, M.agentsLibres.offresParEquipeParJournee)) break;
    // L'équipe offre la demande du jour si elle le peut ; à la dernière journée, ce qu'elle peut (au moins 35 %).
    let salaire = x.demande;
    let moyen = moyensPourOffrir(ctx, etat, equipe, x.a, salaire)[0];
    if (!moyen && derniere) {
      const capacite = capaciteDOffre(ctx, etat, equipe, x.a);
      if (capacite && capacite.max >= x.demande * 0.35) {
        salaire = capacite.max;
        moyen = capacite.moyen;
      }
    }
    if (!moyen) continue;
    const L = limitesDuContrat(P, moyen);
    offres.push({
      joueur: x.a.joueur,
      equipe,
      salaire,
      duree: Math.max(L.dureeMin, Math.min(L.dureeMax, x.duree)),
      hausse: Math.min(L.hausseMax, M.agentsLibres.hausseParDefaut),
      moyen,
      journee,
    });
    prises.add(x.a.joueur);
  }
  return offres;
}

// --- Fin de journée : choix des agents, droit de s'aligner. ---

/** Écart de note qui justifie de couper le moins bon joueur d'un effectif complet pour signer un agent libre (choix du modèle). */
const ECART_POUR_FAIRE_DE_LA_PLACE = 8;

/** Le moins bon joueur sous contrat standard d'une équipe (ou rien). */
function moinsBon(u: Univers, equipe: string): string | undefined {
  return (u.effectifs[equipe] ?? [])
    .filter((j) => u.contrats[j]?.type === 'standard')
    .sort((a, b) => u.joueurs[a]!.note - u.joueurs[b]!.note || (a < b ? -1 : 1))[0];
}

/** Une équipe complète peut-elle faire de la place pour ce joueur (nettement meilleur que son moins bon) ? */
function peutFaireDeLaPlace(u: Univers, equipe: string, joueur: string): boolean {
  const m = moinsBon(u, equipe);
  return !!m && (u.joueurs[joueur]?.note ?? 0) >= u.joueurs[m]!.note + ECART_POUR_FAIRE_DE_LA_PLACE;
}

/** Coupe le moins bon joueur d'une équipe complète : ses salaires restants deviennent de l'argent mort. */
function faireDeLaPlace(u: Univers, equipe: string, date: string): void {
  const j = moinsBon(u, equipe);
  if (!j) return;
  const Sc = saisonCourte(u.saison);
  const mort = ((u.argentMort ??= {})[equipe] ??= {});
  for (const s of u.contrats[j]!.salaires.filter((x) => x.saison >= Sc)) mort[s.saison] = (mort[s.saison] ?? 0) + s.montant;
  u.effectifs[equipe] = u.effectifs[equipe]!.filter((x) => x !== j);
  delete u.contrats[j];
  u.horsNba[j] = 'libre';
  noterTransaction(u, {
    date,
    genre: 'coupe',
    equipes: [equipe],
    joueurs: [j],
    texte: `${u.joueurs[j]?.nom ?? j} est coupé par ${equipe} pour faire de la place.`,
  });
}

function signer(ctx: ContexteLigue, etat: EtatSaison, o: Offre, alignement = false): void {
  const u = etat.univers!;
  const I = etat.intersaison!;
  const Sc = saisonCourte(u.saison);
  const a = I.agents[o.joueur]!;
  const Pm = cbaDeLUnivers(P0(ctx), u);
  if ((u.effectifs[o.equipe] ?? []).filter((j) => u.contrats[j]?.type === 'standard').length >= Pm.contratsStandardMax)
    faireDeLaPlace(u, o.equipe, dateDeJournee(ctx, etat, I.journee));
  const ancien = u.contrats[o.joueur];
  const memeEquipe = a.ancienne === o.equipe;
  const date = dateDeJournee(ctx, etat, I.journee);
  placerJoueur(u, o.joueur, o.equipe, {
    type: 'standard',
    salaires: salairesDuContrat(Sc, o.salaire, o.duree, o.hausse, o.option),
    garanti: Math.round(o.salaire * o.duree * (1 + (o.hausse * (o.duree - 1)) / 2)),
    anciennete: ancien?.anciennete ?? 0,
    draft: ancien?.draft ?? null,
    saisonsAvecEquipe: memeEquipe ? (ancien?.saisonsAvecEquipe ?? 0) : 0,
    signeLe: date,
  });
  if (['mid-level', 'mid-level-contribuable', 'mid-level-espace', 'biannuelle'].includes(o.moyen))
    ((u.exceptionsUtilisees ??= {})[o.equipe] ??= []).push(o.moyen);
  delete I.agents[o.joueur];
  I.offres = I.offres.filter((x) => x.joueur !== o.joueur);
  I.signatures.push({ joueur: o.joueur, equipe: o.equipe, salaire: o.salaire, duree: o.duree, journee: I.journee });
  noterTransaction(u, {
    date,
    genre: alignement ? 'alignement' : 'signature',
    equipes: [o.equipe],
    joueurs: [o.joueur],
    texte: `${u.joueurs[o.joueur]!.nom} signe ${alignement ? '(alignement) ' : ''}avec ${o.equipe} : ${o.duree} saison${o.duree > 1 ? 's' : ''}, ${M$(o.salaire)} la première.`,
  });
  (etat.marche ??= { echanges: 0, signatures: 0, refus: {}, propositions: 0 }).signatures++;
}

/** La date d'une journée de free agency (à partir du jour des signatures de la saison). */
export function dateDeJournee(ctx: ContexteLigue, etat: EtatSaison, journee: number): string {
  const D = (ctx.base ?? ctx).marche!;
  const debut = dateDeLaSaison(D.saisonDeReference, etat.saison, D.dates.signaturesAgentsLibres);
  return ajouterJours(debut, Math.max(0, journee - 1));
}

/** Le score d'une offre pour un agent libre (argent, victoire, rôle, fidélité). */
function scoreDeLOffre(ctx: ContexteLigue, etat: EtatSaison, o: Offre, demande: number, forces: Record<string, number>): number {
  const M = modele(ctx);
  const u = etat.univers!;
  const a = etat.intersaison!.agents[o.joueur]!;
  const p = personnalite(M, o.joueur, etat.graine);
  const W = M.agentsLibres.poids;
  const moyenne = o.salaire * (1 + (o.hausse * (o.duree - 1)) / 2);
  const valeurs = Object.values(forces);
  const fMin = Math.min(...valeurs);
  const fMax = Math.max(...valeurs);
  const victoire = ((forces[o.equipe]! - fMin) / Math.max(1e-9, fMax - fMin) - 0.5) * (p.victoire / 50);
  const note = u.joueurs[o.joueur]!.note;
  const devant = (u.effectifs[o.equipe] ?? []).filter((j) => (u.joueurs[j]?.note ?? 0) > note).length;
  const role = (devant < 5 ? 1 : devant < 8 ? 0.5 : 0) * (p.role / 50);
  // Tranche 10 (réponse 53) : un joueur au moral bas tient moins à rester ; un joueur heureux, davantage.
  const club = (ctx.base ?? ctx).club;
  const moral = club ? facteurFidelite(club.modele, u.club, o.joueur) : 1;
  const fidelite = (a.ancienne === o.equipe ? 1 : 0) * (p.fidelite / 50) * moral;
  const duree = -0.05 * Math.abs(o.duree - a.duree);
  return W.argent * (moyenne / demande) + W.victoire * victoire + W.role * role + W.fidelite * fidelite + duree;
}

/** Fin de journée : chaque agent libre choisit (ou attend) ; alignements ; offres expirées. */
function resoudreJournee(ctx: ContexteLigue, etat: EtatSaison, decider: (equipe: string, o: Offre) => boolean | undefined): void {
  const M = modele(ctx);
  const u = etat.univers!;
  const I = etat.intersaison!;
  const forces = forcesDesEquipes(M, u);
  // Alignements échus : l'équipe d'origine décide (le GM du joueur : par le bureau ; défaut : son staff).
  for (const f of [...I.feuilles].filter((x) => x.jusqua <= I.journee)) {
    I.feuilles = I.feuilles.filter((x) => x !== f);
    const a = I.agents[f.offre.joueur];
    if (!a || !a.ancienne) continue;
    const choix = decider(a.ancienne, f.offre);
    const aligne = choix ?? alignementDuStaff(ctx, etat, a.ancienne, f.offre);
    if (aligne && a.droits) signer(ctx, etat, { ...f.offre, equipe: a.ancienne, moyen: a.droits }, true);
    else signer(ctx, etat, f.offre);
  }
  const parJoueur = new Map<string, Offre[]>();
  for (const o of I.offres) {
    if (!I.agents[o.joueur] || verifierOffre(ctx, etat, o).length) continue;
    if (I.feuilles.some((f) => f.offre.joueur === o.joueur)) continue;
    parJoueur.set(o.joueur, [...(parJoueur.get(o.joueur) ?? []), o]);
  }
  for (const [joueur, offres] of [...parJoueur].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const a = I.agents[joueur]!;
    const demande = demandeCourante(M, a, I.journee);
    // À la dernière journée, l'agent accepte la meilleure offre d'au moins 35 % de sa demande (la mid-level d'un vétéran ; sinon, le camp).
    const seuil = I.journee >= I.journees ? 0.35 : 0.98;
    const valides = offres.filter((o) => o.salaire >= demande * seuil && verifierOffre(ctx, etat, o).length === 0);
    if (!valides.length) continue;
    const meilleure = valides
      .map((o) => ({ o, s: scoreDeLOffre(ctx, etat, o, demande, forces) }))
      .sort((x, y) => y.s - x.s || (x.o.equipe < y.o.equipe ? -1 : 1))[0]!.o;
    if (a.restreint && a.ancienne && meilleure.equipe !== a.ancienne && a.offreQualificative) {
      I.feuilles.push({ offre: meilleure, jusqua: I.journee + 1 });
      continue;
    }
    signer(ctx, etat, meilleure);
  }
  I.offres = [];
}

/** Le staff s'aligne-t-il sur une feuille d'offre ? Oui si le joueur vaut son contrat et que les droits le permettent. */
export function alignementDuStaff(ctx: ContexteLigue, etat: EtatSaison, equipe: string, o: Offre): boolean {
  const u = etat.univers!;
  const M = modele(ctx);
  const P = cbaDeLUnivers(P0(ctx), u);
  const Mc = (ctx.base ?? ctx).carriere!.modele.progression;
  const Sc = saisonCourte(u.saison);
  const j = u.joueurs[o.joueur]!;
  const c: ContratJoueur = {
    type: 'standard',
    salaires: salairesDuContrat(Sc, o.salaire, o.duree, o.hausse),
    garanti: null,
    anciennete: 0,
    draft: null,
  };
  const v = valeurDuJoueur(M, Mc, P, j, c, Sc);
  const gm = gmDe(M, u, etat.graine, equipe);
  return v.present + v.futur * (0.5 + gm.patience) >= 0;
}

/**
 * Une journée de free agency : offres de l'IA (et du staff du joueur s'il a la délégation), choix des agents.
 * `decider` : la décision du GM du joueur sur un alignement (undefined : son staff décide).
 */
export function jouerJourneeAgentsLibres(
  ctx: ContexteLigue,
  etat: EtatSaison,
  decider: (equipe: string, o: Offre) => boolean | undefined = () => undefined,
): void {
  const I = etat.intersaison;
  if (!I || I.terminee) throw new Error('Pas de free agency en cours.');
  if (I.journee >= I.journees) return;
  I.journee++;
  const u = etat.univers!;
  const h = creerHasard(etat.graine, `agents-libres-${u.saison}-${I.journee}`);
  const equipes = Object.keys(u.effectifs).sort();
  for (let i = equipes.length - 1; i > 0; i--) {
    const k = h.entier(0, i);
    [equipes[i], equipes[k]] = [equipes[k]!, equipes[i]!];
  }
  const staffDuGm = etat.delegations?.agentsLibres === 'staff';
  for (const e of equipes) {
    if (e === etat.franchise && !staffDuGm) continue;
    const deja = new Set(I.offres.filter((o) => o.equipe === e).map((o) => o.joueur));
    for (const o of offresDeLIa(ctx, etat, e, I.journee, deja)) I.offres.push(o);
  }
  resoudreJournee(ctx, etat, (equipe, o) =>
    equipe === etat.franchise && etat.delegations?.agentsLibres !== 'staff' ? decider(equipe, o) : undefined,
  );
}

/**
 * Les joueurs libres, les plus prometteurs d'abord (pour compléter les effectifs au camp) : le staff range les fins de
 * banc selon la note attendue dans deux saisons (choix du modèle : un jeune à potentiel passe devant un vétéran à peine
 * meilleur aujourd'hui, comme dans les effectifs réels).
 */
function libresTries(ctx: ContexteLigue, u: Univers, ids: string[]): string[] {
  const Mc = (ctx.base ?? ctx).carriere!.modele.progression;
  const cle = new Map(ids.filter((j) => u.joueurs[j]).map((j) => [j, notesProjetees(Mc, u.joueurs[j]!, 3)[2]!]));
  return [...cle.keys()].sort((a, b) => cle.get(b)! - cle.get(a)! || (a < b ? -1 : 1));
}

/**
 * Le camp : fin de la free agency. Les équipes complètent leurs contrats standard au minimum avec les meilleurs joueurs
 * libres, puis leurs two-way avec les jeunes ; au-delà du maximum, elles coupent les moins bons (argent mort) ; les
 * agents libres non signés passent hors NBA.
 */
export function camp(ctx: ContexteLigue, etat: EtatSaison): void {
  const u = etat.univers!;
  const I = etat.intersaison!;
  const P = cbaDeLUnivers(P0(ctx), u);
  const C = (ctx.base ?? ctx).carriere!.modele;
  const Sc = saisonCourte(u.saison);
  const date = dateDeJournee(ctx, etat, I.journees + 1);
  for (const j of Object.keys(I.agents)) {
    retirerContrat(u, j);
    u.horsNba[j] = 'libre';
  }
  I.agents = {};
  const ordre = Object.keys(u.effectifs).sort();
  const standard = (e: string) => (u.effectifs[e] ?? []).filter((j) => u.contrats[j]?.type === 'standard').length;
  const twoWay = (e: string) => (u.effectifs[e] ?? []).filter((j) => u.contrats[j]?.type === 'two-way').length;
  for (const e of ordre)
    while (standard(e) < C.effectifs.standardVises) {
      const j = libresTries(ctx, u, Object.keys(u.horsNba))[0];
      if (!j) break;
      const anc = u.contrats[j]?.anciennete ?? 0;
      placerJoueur(u, j, e, {
        type: 'standard',
        salaires: [{ saison: Sc, montant: salaireMinimum(P, anc) }],
        garanti: salaireMinimum(P, anc),
        anciennete: anc,
        draft: u.contrats[j]?.draft ?? null,
        saisonsAvecEquipe: 0,
        signeLe: date,
      });
      noterTransaction(u, {
        date,
        genre: 'signature',
        equipes: [e],
        joueurs: [j],
        texte: `${u.joueurs[j]!.nom} signe au minimum avec ${e} (camp).`,
      });
      (etat.marche ??= { echanges: 0, signatures: 0, refus: {}, propositions: 0 }).signatures++;
    }
  for (const e of ordre)
    while (twoWay(e) < P.contratsTwoWayMax) {
      const j = libresTries(ctx, u, Object.keys(u.horsNba)).find((x) => u.joueurs[x]!.age <= C.effectifs.ageMaxTwoWay);
      if (!j) break;
      placerJoueur(u, j, e, {
        type: 'two-way',
        salaires: [],
        garanti: null,
        anciennete: u.contrats[j]?.anciennete ?? 0,
        draft: u.contrats[j]?.draft ?? null,
        saisonsAvecEquipe: 0,
      });
    }
  // Au-delà du maximum : le moins bon est coupé ; son salaire de la saison reste à la charge de l'équipe.
  for (const e of ordre)
    while (standard(e) > P.contratsStandardMax) {
      const j = (u.effectifs[e] ?? [])
        .filter((x) => u.contrats[x]?.type === 'standard')
        .sort((x, y) => u.joueurs[x]!.note - u.joueurs[y]!.note || (x < y ? -1 : 1))[0]!;
      const mort = ((u.argentMort ??= {})[e] ??= {});
      for (const s of u.contrats[j]!.salaires.filter((x) => x.saison >= Sc)) mort[s.saison] = (mort[s.saison] ?? 0) + s.montant;
      u.effectifs[e] = u.effectifs[e]!.filter((x) => x !== j);
      retirerContrat(u, j);
      u.horsNba[j] = 'libre';
    }
  for (const j of Object.keys(u.horsNba)) delete u.contrats[j];
  I.terminee = true;
}

function retirerContrat(u: Univers, j: string): void {
  delete u.contrats[j];
}

/** Tout ce qui reste de la free agency, au pilote automatique, puis le camp. */
export function terminerAgentsLibres(
  ctx: ContexteLigue,
  etat: EtatSaison,
  decider?: (equipe: string, o: Offre) => boolean | undefined,
): void {
  const I = etat.intersaison;
  if (!I || I.terminee) return;
  while (I.journee < I.journees) jouerJourneeAgentsLibres(ctx, etat, decider);
  // Les dernières feuilles d'offre se règlent avant le camp.
  I.journee++;
  resoudreJourneeFinale(ctx, etat, decider);
  camp(ctx, etat);
}

function resoudreJourneeFinale(ctx: ContexteLigue, etat: EtatSaison, decider?: (equipe: string, o: Offre) => boolean | undefined): void {
  const I = etat.intersaison!;
  for (const f of I.feuilles) f.jusqua = Math.min(f.jusqua, I.journee);
  I.offres = [];
  resoudreJournee(ctx, etat, (e, o) => decider?.(e, o));
}

export { salaireDeMarche };
