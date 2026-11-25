// Tranche 10 : la vie du club (docs/CLUB.md). Points d'entrée appelés par la saison, l'intersaison et le GM.
import type { ContexteLigue, EtatSaison } from '../types';
import type { Univers } from '../carriere/types';
import { clubActif, clubDe, etatClubVide, modeleClub } from './commun';
import { journeeDesContrats } from './contrats';
import { jouerGLeague, nouvelleSaisonGLeague } from './gleague';
import { bilanDeFinDeSaison, fixerObjectifs, rendezVousDuJour } from './proprietaire';
import { intersaisonDuVestiaire, journeeDuVestiaire } from './vestiaire';

export * from './types';
export { clubActif, etatClubVide, dateDansLaSaison } from './commun';
export {
  initialiserClub,
  fixerObjectifs,
  niveauAtteint,
  libelleObjectif,
  LIBELLES_OBJECTIF,
  NIVEAU_REQUIS,
  offresDEmploi,
  accepterOffre,
  proposerDemenagement,
  repondreDemenagement,
  bilanDeFinDeSaison,
} from './proprietaire';
export {
  temperamentDe,
  moralDe,
  roleDe,
  moralDuGroupe,
  formeDuMatch,
  apresMatch,
  repondreAuMessage,
  facteurFidelite,
  vestiaireDeLEquipe,
} from './vestiaire';
export { effectifGLeague, peutEtreAssigne, assignerEnGLeague, bilansGLeague, bonusGLeague, jouerGLeague } from './gleague';
export {
  signerTwoWayEnSaison,
  convertirTwoWay,
  signerDixJours,
  garderJusquALaFin,
  hardshipDisponibles,
  blessesHardship,
  dixJoursDe,
} from './contrats';
export { mesurerClub, ecartsDuClub, type MesuresClub } from './mesures';

/** Début de la saison régulière : objectifs du propriétaire, saison de G League. */
export function debutDeSaisonDuClub(ctx: ContexteLigue, etat: EtatSaison): void {
  if (!clubActif(ctx, etat)) return;
  const gLeague = etat.club?.gLeague;
  etat.club = { ...etatClubVide(), ...(etat.club?.demenagement ? { demenagement: etat.club.demenagement } : {}) };
  if (gLeague?.matchs.some((m) => !m.score)) etat.club.gLeague = gLeague;
  fixerObjectifs(ctx, etat);
  nouvelleSaisonGLeague(ctx, etat);
}

/**
 * Un jour de saison : rendez-vous du propriétaire, vestiaire, G League, contrats en saison (saison régulière). Rend
 * vrai si un effectif a changé (le contexte de la saison doit être recalculé).
 */
export function journeeDuClub(ctx: ContexteLigue, etat: EtatSaison): boolean {
  if (!clubActif(ctx, etat) || !etat.club) return false;
  rendezVousDuJour(ctx, etat);
  journeeDuVestiaire(ctx, etat);
  jouerGLeague(ctx, etat, etat.date);
  return etat.phase === 'reguliere' ? journeeDesContrats(ctx, etat) : false;
}

/** Fin de la saison (après la finale) : fin de la G League, bilan du propriétaire, licenciements. */
export function finDeSaisonDuClub(ctx: ContexteLigue, etat: EtatSaison): void {
  if (!clubActif(ctx, etat) || !etat.club) return;
  jouerGLeague(ctx, etat, '9999-12-31');
  bilanDeFinDeSaison(ctx, etat);
}

/** À l'ouverture de l'intersaison : le moral retombe vers son niveau de départ ; assignations et rattachements finissent. */
export function intersaisonDuClub(ctx: ContexteLigue, u: Univers): void {
  if (!u.club || !(ctx.base ?? ctx).club) return;
  const C = clubDe(u);
  intersaisonDuVestiaire(modeleClub(ctx), C);
  C.assignes = {};
  C.affilies = {};
}
