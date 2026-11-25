// Tranche 8 : la carrière multi-saisons. L'univers d'une partie (joueurs, effectifs, contrats, franchises) évolue d'une
// saison à l'autre ; il est gardé dans l'état de la saison (objet JSON pur, sauvegardé tel quel dans IndexedDB). La
// première saison n'en a pas : elle joue l'univers des données de référence (data/), identique pour toutes les parties.
import type { AttributsDetailles } from '@basket-legends/engine';
import type { ContratJoueur, SituationPubliee } from '../cba';
import type { ChoixTransmis, HistoriqueChoix, ProprieteChoix } from '../draft/types';
import type { MembreStaff, StaffEquipe, Transaction } from '../marche/types';

export interface Familles {
  technique: number;
  physique: number;
  mental: number;
  tactique: number;
  endurance: number;
}

export type OrigineJoueur = 'snapshot' | 'vivier' | 'draft';

/** Un joueur de l'univers, qu'il soit sous contrat NBA ou hors NBA. */
export interface JoueurCarriere {
  id: string;
  nom: string;
  numero: string;
  poste: string;
  tailleCm: number;
  poidsKg: number | null;
  pays: string | null;
  /** Âge de la saison en cours (au 1er février de la saison, convention de docs/DRAFT.md § 11). */
  age: number;
  note: number;
  /** Note attendue au sommet de la carrière : connue pour les joueurs générés, absente pour ceux du snapshot. */
  potentiel: number | null;
  familles: Familles;
  details: AttributsDetailles;
  origine: OrigineJoueur;
  /** Première saison dans l'univers de la partie. */
  depuis: string;
  /** Note au début de chaque saison jouée (la plus récente en dernier). */
  notes: { saison: string; note: number }[];
}

/** Les joueurs hors NBA : en développement (profil G League) ou libres. */
export type StatutHorsNba = 'developpement' | 'libre';

export interface Retraite {
  nom: string;
  saison: string;
  age: number;
  /** Meilleure note de sa carrière dans la partie. */
  noteMax: number;
  /** Dernière équipe NBA (null : hors NBA). */
  equipe: string | null;
}

/** L'identité d'une franchise dans la partie : celle des données, ou une nouvelle après un changement de ville. */
export interface IdentiteFranchise {
  ville: string;
  nom: string;
  abreviation: string;
  /** Saison du changement (absent : identité d'origine). */
  depuis?: string;
  /** Les identités précédentes, de la plus ancienne à la plus récente. */
  anciennes?: { ville: string; nom: string; jusqua: string }[];
}

export interface Univers {
  /** La saison que cet univers va jouer (« 2027-2028 »). */
  saison: string;
  joueurs: Record<string, JoueurCarriere>;
  /** Franchise → joueurs sous contrat (standard et two-way). */
  effectifs: Record<string, string[]>;
  horsNba: Record<string, StatutHorsNba>;
  contrats: Record<string, ContratJoueur>;
  /** Situation salariale propre à chaque équipe (récidive de taxe, argent mort de la saison). */
  equipes: Record<string, SituationPubliee>;
  /** Franchises dont l'identité a changé (déménagement). */
  franchises: Record<string, IdentiteFranchise>;
  retraites: Record<string, Retraite>;
  /** Rang du choix propre de chaque équipe lors des Drafts passées (limites de la loterie). */
  historiqueLoterie: HistoriqueChoix;
  /** Les joueurs draftés l'été précédent (pour le rookie de l'année). */
  recrues: string[];
  /** Points par match de la saison précédente, pour le joueur ayant le plus progressé. */
  pointsParMatchPrecedents: Record<string, number>;
  /** Équipes ayant payé la taxe de luxe, par saison (récidive : 3 des 4 saisons précédentes). */
  taxesPayees: Record<string, string[]>;
  // --- Tranche 9 (absent des univers plus anciens : `initialiserMarche` les complète). ---
  /** Incrémenté à chaque transaction (le contexte de la saison est recalculé). */
  version?: number;
  /** Propriété des choix de Draft à venir (année → règles), modifiée par les échanges. */
  choix?: Record<string, ProprieteChoix>;
  /** Qui a fait chaque choix des Drafts passées (conditions des choix futurs). */
  choixTransmis?: ChoixTransmis;
  staff?: Record<string, StaffEquipe>;
  /** Membres du staff sans équipe (recrutables). */
  staffLibre?: MembreStaff[];
  /** Argent mort (joueurs coupés, étalement) : équipe → saison courte (« 2027-28 ») → montant. */
  argentMort?: Record<string, Record<string, number>>;
  /** Plafond et seuil de taxe de chaque saison (estimations relevées, puis croissance tirée) : saison courte → montants. */
  plafonds?: Record<string, { plafondSalarial: number; seuilTaxe: number }>;
  /** Exceptions déjà utilisées dans la saison (une seule fois chacune), par équipe. */
  exceptionsUtilisees?: Record<string, string[]>;
  /** Journal des transactions de la saison. */
  journal?: Transaction[];
}

/** Ce qu'on garde d'une saison terminée. */
export interface ArchiveSaison {
  saison: string;
  franchise: string;
  champion: string;
  finaliste: string;
  palmares: { mvp?: string; mvpFinale?: string; defenseur?: string; rookie?: string; sixiemeHomme?: string; progression?: string };
  /** Bilan de saison régulière de chaque équipe. */
  bilans: Record<string, [number, number]>;
  /** Identité de chaque équipe cette saison-là (nom affiché). */
  noms: Record<string, string>;
  /** Lignes de saison régulière : équipe, matchs, minutes, points, rebonds, passes. */
  statistiques: Record<string, [string, number, number, number, number, number]>;
  /** Premier choix de la Draft qui a suivi (prospect, équipe). */
  premierChoix?: { joueur: string; equipe: string };
  /** Joueurs partis à la retraite à la fin de la saison. */
  retraites: string[];
  /** Changement de franchise de l'intersaison. */
  demenagement?: { franchise: string; de: string; vers: string };
  /** Tranche 9 : échanges et signatures de la saison (critère de sortie). */
  transactions?: { echanges: number; signatures: number };
}

/** Bilan d'une intersaison (pour les actualités et les tests). */
export interface BilanIntersaison {
  progressions: { joueur: string; avant: number; apres: number }[];
  retraites: string[];
  prolongations: string[];
  liberes: string[];
  signatures: { joueur: string; equipe: string; type: 'standard' | 'two-way' }[];
  recrues: string[];
  demenagement?: { franchise: string; de: string; vers: string };
}
