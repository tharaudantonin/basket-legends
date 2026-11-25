// Tranche 10 : outils communs aux modules du club (état, hasard, actualités, classements).
import { creerHasard, type Hasard } from '@basket-legends/engine';
import { ajouterJours, joursEntre } from '../calendrier';
import { appartenances, calculerBilans, classer } from '../classement';
import { nomDeFranchise } from '../carriere/univers';
import type { Univers } from '../carriere/types';
import type { Actualite, ContexteLigue, EtatSaison } from '../types';
import type { ClubUnivers, DonneesClub, EtatClub, ModeleClub } from './types';

export const donneesClub = (ctx: ContexteLigue): DonneesClub | undefined => (ctx.base ?? ctx).club ?? ctx.club;
export const modeleClub = (ctx: ContexteLigue): ModeleClub => donneesClub(ctx)!.modele;

/** La vie du club est active : données du club et du marché, univers de carrière. */
export const clubActif = (ctx: ContexteLigue, etat: Pick<EtatSaison, 'univers'>): boolean =>
  !!donneesClub(ctx) && !!(ctx.base ?? ctx).marche && !!etat.univers?.club;

export const hasardDuClub = (etat: Pick<EtatSaison, 'graine'>, sel: string): Hasard => creerHasard(etat.graine, `club-${sel}`);

export function etatClubVide(): EtatClub {
  return {
    objectifs: {},
    rendezVous: 0,
    messages: [],
    absences: {},
    ecartes: {},
    promesses: {},
    peuJoue: {},
    dixJours: [],
    dixJoursSignes: {},
  };
}

/** L'état du club de la saison (créé s'il manque). */
export const etatClub = (etat: EtatSaison): EtatClub => (etat.club ??= etatClubVide());
export const clubDe = (u: Univers): ClubUnivers => u.club!;

export const nomEquipe = (ctx: ContexteLigue, u: Univers | undefined, id: string): string => nomDeFranchise(ctx.base ?? ctx, u, id);

export function publier(etat: EtatSaison, a: Omit<Actualite, 'id'>): void {
  etat.actualites.push({ id: etat.actualites.length + 1, ...a });
}

export const borner = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));

/** Le rang de chaque équipe dans sa conférence (bilans de saison régulière, départages NBA). */
export function rangsDeConference(ctx: ContexteLigue, etat: EtatSaison): Record<string, number> {
  const bilans = calculerBilans(ctx.structure, etat.matchs);
  const C = classer(ctx.structure, bilans, etat.graine);
  const rangs: Record<string, number> = {};
  for (const liste of Object.values(C.conferences)) liste.forEach((e, i) => (rangs[e] = i + 1));
  return rangs;
}

export const conferenceDe = (ctx: ContexteLigue, equipe: string): string | undefined => appartenances(ctx.structure)[equipe]?.conference;

/** Dates de la saison régulière (première et dernière). */
export function bornesDeLaSaison(ctx: ContexteLigue, etat: EtatSaison): { debut: string; fin: string } {
  return {
    debut: etat.calendrier[0]?.date ?? ctx.structure.calendrier.premierJour,
    fin: etat.calendrier.at(-1)?.date ?? ctx.structure.calendrier.dernierJour,
  };
}

/** La date « MM-JJ » dans la saison (dans la seconde année civile si elle tombe avant juillet). */
export function dateDansLaSaison(saison: string, mmjj: string): string {
  const [a, b] = [Number(saison.slice(0, 4)), Number(saison.slice(5, 9))];
  return `${Number(mmjj.slice(0, 2)) < 7 ? b : a}-${mmjj}`;
}

/** Jours qui restent jusqu'à la fin de la saison régulière (le jour même compris). */
export const joursRestants = (ctx: ContexteLigue, etat: EtatSaison): number => joursEntre(etat.date, bornesDeLaSaison(ctx, etat).fin) + 1;

/** Décale une date de la saison de référence vers une autre saison (semaines entières, comme le calendrier NBA). */
export function decalerDate(date: string, saisonDeReference: string, saison: string): string {
  const n = Number(saison.slice(0, 4)) - Number(saisonDeReference.slice(0, 4));
  return n ? ajouterJours(date, 7 * Math.round((365.2425 * n) / 7)) : date;
}

/** Remplace les variables d'un texte ({club}, {joueur}…). */
export const remplir = (texte: string, v: Record<string, string>): string => texte.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);
