// Tranche 3 : données de la fiche joueur tirées d'un match (graphique d'adresse) et rejeu du journal.
// Tout est déduit du journal : les modes rapide et commenté affichent donc les mêmes chiffres.
import { construireBoxScore } from './boxscore';
import type { BoxScore, Camp, EquipeDuMatch, Evenement, PositionTir, TypeTir } from './types';

/** Les tranches de distance du graphique d'adresse, alignées sur celles des statistiques de la ligue. */
export type TrancheTir = 'cercle' | 'trois_dix' | 'dix_seize' | 'seize_ligne' | 'trois_coin' | 'trois_arc';
export const TRANCHES_TIR: readonly TrancheTir[] = ['cercle', 'trois_dix', 'dix_seize', 'seize_ligne', 'trois_coin', 'trois_arc'];

export interface TirDuJoueur {
  indice: number;
  periode: number;
  restant: number;
  tir: TypeTir;
  reussi: boolean;
  position: PositionTir;
  tranche: TrancheTir;
}

export interface AdresseParTranche {
  tranche: TrancheTir;
  reussis: number;
  tentes: number;
}

/** Angle à partir duquel un tir à trois points est compté dans un coin (le long de la ligne de fond). */
const ANGLE_COIN = 78;

export function trancheDuTir(tir: TypeTir, p: PositionTir): TrancheTir {
  if (tir === 'troisPoints') return Math.abs(p.angle) >= ANGLE_COIN ? 'trois_coin' : 'trois_arc';
  if (tir === 'cercle') return 'cercle';
  return p.distance < 10 ? 'trois_dix' : p.distance < 16 ? 'dix_seize' : 'seize_ligne';
}

/** Les tirs d'un joueur dans un match (tentatives comptées au box score : les tirs manqués sur faute n'y sont pas). */
export function tirsDuJoueur(evenements: readonly Evenement[], joueur: string): TirDuJoueur[] {
  const tirs: TirDuJoueur[] = [];
  evenements.forEach((e, indice) => {
    if (e.type !== 'tir' || e.joueur !== joueur) return;
    tirs.push({
      indice,
      periode: e.periode,
      restant: e.restant,
      tir: e.tir,
      reussi: e.reussi,
      position: e.position,
      tranche: trancheDuTir(e.tir, e.position),
    });
  });
  return tirs;
}

/** Réussite par tranche de distance. */
export function adresseParTranche(tirs: readonly TirDuJoueur[]): AdresseParTranche[] {
  return TRANCHES_TIR.map((tranche) => {
    const ici = tirs.filter((t) => t.tranche === tranche);
    return { tranche, reussis: ici.filter((t) => t.reussi).length, tentes: ici.length };
  });
}

/** Coordonnées sur une demi-surface, en pieds : x latéral (négatif à gauche), y depuis le centre du panier vers le milieu. */
export function coordonnees(p: PositionTir): { x: number; y: number } {
  const a = (p.angle * Math.PI) / 180;
  return { x: p.distance * Math.sin(a), y: p.distance * Math.cos(a) };
}

/** Les titulaires d'un match, lus dans le premier « début de période » du journal. */
export function titulairesDuJournal(evenements: readonly Evenement[]): [string[], string[]] {
  const debut = evenements.find((e) => e.type === 'debut_periode');
  if (!debut || debut.type !== 'debut_periode') throw new Error('Journal sans début de période.');
  return [[...debut.cinq[0]], [...debut.cinq[1]]];
}

/** Le box score « en direct » après l'événement d'index `indice` (mode commenté). À la fin du journal, c'est le box score du match. */
export function boxScoreAuMoment(
  evenements: readonly Evenement[],
  equipes: [EquipeDuMatch, EquipeDuMatch],
  indice: number,
  periodesReglementaires: number,
): BoxScore {
  return construireBoxScore(evenements.slice(0, indice + 1), equipes, titulairesDuJournal(evenements), periodesReglementaires);
}

/** Les cinq joueurs sur le terrain après l'événement d'index `indice`. */
export function cinqAuMoment(evenements: readonly Evenement[], indice: number): [string[], string[]] {
  let cinq: [string[], string[]] = [[], []];
  for (let i = 0; i <= indice && i < evenements.length; i++) {
    const e = evenements[i]!;
    if (e.type === 'debut_periode') cinq = [[...e.cinq[0]], [...e.cinq[1]]];
    if (e.type === 'remplacement') {
      const c: Camp = e.equipe;
      cinq[c] = cinq[c].map((id) => (id === e.sortant ? e.entrant : id));
    }
  }
  return cinq;
}
