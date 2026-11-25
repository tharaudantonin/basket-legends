// Tranche 7 : la Draft dans la saison. La classe de Draft existe dès le début de la saison (le GM la scoute pendant la
// saison) ; à la fin des playoffs, la loterie fixe les 16 premiers choix, le bilan fixe les autres, les échanges de
// choix (data/draft/choix-<année>.json) désignent qui choisit ; puis les 60 choix s'enchaînent. Le staff choisit pour
// les équipes de l'IA (et pour le GM s'il délègue) selon ses propres rapports de scouting, jamais selon les vraies notes.
import { creerHasard, groupeDuPoste } from '@basket-legends/engine';
import { calculerBilans, pctBilan } from '../classement';
import type { Bilan, ContexteLigue, EtatSaison } from '../types';
import { tirerLoterie } from './loterie';
import { appliquerProprietes } from './proprietes';
import { facteurScouting } from '../marche/staff';
import { genererClasse } from './prospects';
import { observationsDe, rapport } from './scouting';
import type {
  ChoixDeDraft,
  EtatDraft,
  GenerateurDeNoms,
  ChoixTransmis,
  HistoriqueChoix,
  ModeleDraft,
  ParticipantLoterie,
  ProprieteChoix,
  Prospect,
  Recrue,
  ReglesLoterie,
} from './types';

/** Ce dont la ligue a besoin pour la Draft (dans le contexte de la ligue). */
export interface DonneesDraft {
  loterie: ReglesLoterie;
  /** Année → propriété des choix ; une année absente : chaque équipe garde ses choix. */
  proprietes: Record<string, ProprieteChoix>;
  /** Tranche 9 : qui a fait les choix des Drafts passées (conditions des choix futurs). */
  transmis?: ChoixTransmis;
  historique: HistoriqueChoix;
  modele: ModeleDraft;
  noms: GenerateurDeNoms;
  /** Échelle des rookies à 120 % (rang 1 à 30 → 4 saisons) et plafond de la saison de référence. */
  echelle: { plafondDeReference: number; rangs: number[][] };
  /** Noms déjà pris (joueurs du snapshot et du vivier) : jamais redonnés. */
  nomsPris: string[];
}

const hacher = (...parties: (string | number)[]): number => {
  let h = 2166136261;
  for (const c of parties.join(':')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

/** L'année de la Draft qui suit une saison « 2026-2027 » : 2027. */
export const anneeDeDraft = (saison: string): number => Number(saison.slice(5, 9));

export function nouvelleDraft(ctx: ContexteLigue, graine: number, saison: string): EtatDraft | undefined {
  const D = ctx.draft;
  if (!D) return undefined;
  const annee = anneeDeDraft(saison);
  return { annee, classe: genererClasse(D.modele, D.noms, graine, annee, D.nomsPris), observations: {}, selections: {} };
}

/** Rang au bilan de chaque équipe, du pire (1) au meilleur (30) ; égalités départagées par un tirage déterministe. */
export function rangsAuBilan(bilans: Record<string, Bilan>, graine: number): string[] {
  return Object.keys(bilans).sort(
    (a, b) => pctBilan(bilans[a]!) - pctBilan(bilans[b]!) || hacher(graine, 'departage-draft', a) - hacher(graine, 'departage-draft', b),
  );
}

/** Les 16 équipes de la loterie et leur catégorie, à la fin du Play-In. */
export function participantsDeLaLoterie(ctx: ContexteLigue, etat: EtatSaison, ordreBilan: readonly string[]): ParticipantLoterie[] {
  if (!etat.playIn) throw new Error('La loterie suppose un Play-In terminé.');
  const rangBilan = (e: string) => ordreBilan.indexOf(e) + 1;
  const perdants78 = etat.playIn.map((p) => {
    const m = etat.matchs.find((x) => x.id === p.matchs.find((y) => y.etape === '7-8')?.resultat);
    if (!m) throw new Error('Play-In non terminé.');
    return m.score[0] > m.score[1] ? m.exterieur : m.domicile;
  });
  const neufDix = etat.playIn.flatMap((p) => p.equipes.slice(2, 4));
  const auPlayIn = new Set(etat.playIn.flatMap((p) => p.equipes));
  const qualifies = new Set(Object.values(etat.tetesDeSerie ?? {}).flat());
  const dehors = ordreBilan.filter((e) => !auPlayIn.has(e) && !qualifies.has(e));
  const releguees = new Set(dehors.slice(0, ctx.draft!.loterie.categories.find((c) => c.id === 'releguees')!.equipes));
  const participants: ParticipantLoterie[] = [
    ...dehors.map((e) => ({
      equipe: e,
      categorie: releguees.has(e) ? ('releguees' as const) : ('non-qualifiees' as const),
      rangBilan: rangBilan(e),
    })),
    ...neufDix.map((e) => ({ equipe: e, categorie: 'play-in-9-10' as const, rangBilan: rangBilan(e) })),
    ...perdants78.map((e) => ({ equipe: e, categorie: 'perdants-7-8' as const, rangBilan: rangBilan(e) })),
  ];
  return participants.sort((a, b) => a.rangBilan - b.rangBilan);
}

/** Tire la loterie et fixe les 60 choix (avec leurs détenteurs). À appeler quand la saison est terminée. */
export function preparerDraft(ctx: ContexteLigue, etat: EtatSaison): EtatDraft {
  const D = ctx.draft;
  const draft = etat.draft;
  if (!D || !draft) throw new Error('Pas de Draft dans cette partie.');
  if (draft.choix) return draft;
  const ordreBilan = rangsAuBilan(calculerBilans(ctx.structure, etat.matchs), etat.graine);
  const participants = participantsDeLaLoterie(ctx, etat, ordreBilan);
  const loterie = tirerLoterie(D.loterie, participants, D.historique, etat.graine, `loterie-${draft.annee}`);
  const autres = ordreBilan.filter((e) => !loterie.ordre.includes(e));
  const rangs1 = Object.fromEntries([...loterie.ordre, ...autres].map((e, i) => [e, i + 1]));
  const rangs2 = Object.fromEntries(ordreBilan.map((e, i) => [e, ordreBilan.length + i + 1]));
  const P = D.proprietes[String(draft.annee)];
  const transmis = D.transmis ?? {};
  const premier = appliquerProprietes(1, rangs1, P?.tours['1'] ?? [], rangs1, transmis);
  // Les conditions du 2e tour peuvent viser le 1er tour de la même Draft.
  const avecPremier = {
    ...transmis,
    [String(draft.annee)]: premier.map((c) => ({ tour: 1 as const, original: c.original, detenteur: c.detenteur })),
  };
  const choix: ChoixDeDraft[] = [...premier, ...appliquerProprietes(2, rangs2, P?.tours['2'] ?? [], rangs1, avecPremier)];
  return { ...draft, loterie: { ...loterie, participants }, choix };
}

/** La valeur d'un prospect pour une équipe, selon ses propres rapports de scouting (jamais les vraies notes). */
export function valeurPourLEquipe(ctx: ContexteLigue, etat: EtatSaison, equipe: string, p: Prospect): number {
  const D = ctx.draft!;
  const draft = etat.draft!;
  const demandees = equipe === etat.franchise ? draft.observations : undefined;
  const staff = ctx.marche ? ctx.univers?.staff?.[equipe] : undefined;
  const precision = ctx.marche && staff ? facteurScouting(ctx.marche.staff, staff) : 1;
  const r = rapport(D.modele.scouting, etat.graine, equipe, p, observationsDe(D.modele.scouting, demandees, p.id), precision);
  const I = D.modele.choixIa;
  // Besoin : un groupe de poste peu fourni dans l'effectif vaut un petit bonus.
  const groupe = groupeDuPoste(p.poste);
  const effectif = ctx.equipes[equipe]?.joueurs ?? [];
  const memes = effectif.filter((j) => j.groupe === groupe).length;
  const besoin = memes < effectif.length / 3 ? I.besoinDePoste : 0;
  return I.poidsNote * r.note.valeur + I.poidsPotentiel * r.potentiel.valeur - I.malusParAnnee * (p.age - 19) + besoin;
}

/** Le choix du staff d'une équipe parmi les prospects encore disponibles. */
export function choixDuStaff(ctx: ContexteLigue, etat: EtatSaison, equipe: string): Prospect {
  const draft = etat.draft!;
  const pris = new Set(Object.values(draft.selections));
  const dispo = draft.classe.filter((p) => !pris.has(p.id));
  if (!dispo.length) throw new Error('Plus aucun prospect disponible.');
  const h = creerHasard(etat.graine, `draft-${draft.annee}-${equipe}-${pris.size}`);
  // Petit écart propre au staff, pour que deux Drafts avec les mêmes rapports ne soient pas des copies.
  return dispo
    .map((p) => ({ p, v: valeurPourLEquipe(ctx, etat, equipe, p) + 0.5 * (h.reel() - 0.5) }))
    .sort((a, b) => b.v - a.v || (a.p.id < b.p.id ? -1 : 1))[0]!.p;
}

/** Le prochain choix à faire (ou rien si la Draft est terminée). */
export const prochainChoix = (draft: EtatDraft): ChoixDeDraft | undefined =>
  draft.choix?.find((c) => draft.selections[String(c.rang)] === undefined);

/**
 * Fait les choix jusqu'au prochain choix du GM (non délégué), ou jusqu'à la fin. `choixDuGm` : prospect choisi par le
 * GM pour son choix en cours. Rend un nouvel état.
 */
export function avancerDraft(ctx: ContexteLigue, etatInitial: EtatSaison, choixDuGm?: string): EtatSaison {
  const etat = structuredClone(etatInitial);
  if (!etat.draft) throw new Error('Pas de Draft dans cette partie.');
  if (etat.club?.licenciement) throw new Error('Vous avez été licencié : choisissez d’abord votre nouvelle franchise.');
  etat.draft = preparerDraft(ctx, etat);
  const draft = etat.draft;
  for (let c = prochainChoix(draft); c; c = prochainChoix(draft)) {
    const duGm = c.detenteur === etat.franchise && !draft.delegue;
    if (duGm) {
      if (!choixDuGm) break;
      const p = draft.classe.find((x) => x.id === choixDuGm);
      if (!p || Object.values(draft.selections).includes(p.id)) throw new Error(`Prospect indisponible : ${choixDuGm}`);
      draft.selections[String(c.rang)] = p.id;
      choixDuGm = undefined;
      continue;
    }
    draft.selections[String(c.rang)] = choixDuStaff(ctx, etat, c.detenteur).id;
  }
  if (!prochainChoix(draft) && !draft.terminee) {
    draft.terminee = true;
    draft.recrues = recruesDeLaDraft(ctx, draft);
    publierLaDraft(ctx, etat);
  }
  return etat;
}

/**
 * Les joueurs draftés et leur contrat. L'échelle de la Draft N s'applique à la saison N-(N+1) ; le dépôt n'a que la CBA
 * de la saison en cours : son plafond sert tant que le suivant n'est pas relevé (montants provisoires).
 */
export function recruesDeLaDraft(ctx: ContexteLigue, draft: EtatDraft): Recrue[] {
  const D = ctx.draft!;
  const saisonDuContrat = `${draft.annee}-${draft.annee + 1}`;
  const plafond = {
    saison: ctx.salaires.saison,
    montant: ctx.salaires.cba.plafondSalarial,
    provisoire: ctx.salaires.saison !== saisonDuContrat,
  };
  return (draft.choix ?? []).map((c) => {
    const salaires = c.tour === 1 ? contratDeRookie(D, c.rang, plafond.montant) : undefined;
    return { prospect: draft.selections[String(c.rang)]!, equipe: c.detenteur, rang: c.rang, ...(salaires ? { salaires } : {}), plafond };
  });
}

function publierLaDraft(ctx: ContexteLigue, etat: EtatSaison): void {
  const draft = etat.draft!;
  const nom = (id: string) => {
    const p = draft.classe.find((x) => x.id === id);
    return p ? `${p.prenom} ${p.nom}` : id;
  };
  const equipe = (id: string) => ctx.equipes[id]?.nom ?? id;
  const r = draft.recrues ?? [];
  const premier = r[0];
  const siens = r.filter((x) => x.equipe === etat.franchise);
  etat.actualites.push({
    id: etat.actualites.length + 1,
    date: etat.date,
    genre: 'draft',
    importance: 3,
    equipes: r.slice(0, 3).map((x) => x.equipe),
    titre: premier
      ? `Draft ${draft.annee} : ${equipe(premier.equipe)} choisit ${nom(premier.prospect)} en n° 1`
      : `Draft ${draft.annee} terminée`,
    texte: `${r
      .slice(0, 5)
      .map((x) => `${x.rang}. ${nom(x.prospect)} (${equipe(x.equipe)})`)
      .join(
        ', ',
      )}.${siens.length ? ` Vos choix : ${siens.map((x) => `n° ${x.rang} ${nom(x.prospect)}`).join(', ')}.` : ' Vous n’aviez aucun choix.'}`,
  });
}

/** Salaires d'un choix de premier tour (120 % de l'échelle, en proportion du plafond de la saison de la Draft). */
export function contratDeRookie(D: DonneesDraft, rang: number, plafondDeLaSaison: number): number[] | undefined {
  const base = D.echelle.rangs[rang - 1];
  if (!base) return undefined;
  return base.map((m) => Math.round((m * plafondDeLaSaison) / D.echelle.plafondDeReference));
}
