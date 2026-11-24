// Tranche 4 : les contrats de la saison. L'état d'une saison est un objet JSON pur (pas de Map ni de classe) : il se
// sauvegarde tel quel dans IndexedDB et passe sans perte entre le Web Worker et l'écran.
import type { DecisionMatch, EquipeDuMatch, JoueurDuMatch, ReglagesMatch, ReglesMatch } from '@basket-legends/engine';
import type { DonneesSalariales } from './cba';
import type { DonneesDraft } from './draft/draft';
import type { EtatDraft } from './draft/types';

export type CritereDepartage =
  | 'confrontations'
  | 'vainqueur-division'
  | 'bilan-division'
  | 'bilan-conference'
  | 'bilan-qualifiables-conference'
  | 'bilan-qualifiables-autre-conference'
  | 'difference-points';

/** La structure d'une saison (data/ligue/saison-<saison>.json, sans les sources). */
export interface StructureLigue {
  saison: string;
  conferences: { id: string; nom: string; divisions: { id: string; nom: string; franchises: string[] }[] }[];
  calendrier: {
    matchsParEquipe: number;
    contreChaqueAdversaireDeDivision: number;
    adversairesDeConferenceA4Matchs: number;
    adversairesDeConferenceA3Matchs: number;
    contreChaqueAdversaireDeLAutreConference: number;
    premierJour: string;
    dernierJour: string;
  };
  playIn: { qualifiesDirects: number; rangsDuPlayIn: [number, number] };
  playoffs: {
    equipesParConference: number;
    victoiresPourGagnerUneSerie: number;
    appariementsPremierTour: [number, number][];
    receveurParMatch: ('haut' | 'bas')[];
  };
  departages: { deuxEquipes: CritereDepartage[]; plusieursEquipes: CritereDepartage[] };
  recompenses: { matchsMinimum: number; minutesPourCompter: number; equipesAllNba: number; joueursParEquipeAllNba: number };
  allStar: {
    titulairesParConference: number;
    remplacantsParConference: number;
    poidsDuVote: { fans: number; joueurs: number; medias: number };
    partDeLaSaison: number;
  };
}

/** Tout ce dont la ligue a besoin pour jouer : structure, équipes complètes, règles et réglages du moteur. */
export interface ContexteLigue {
  structure: StructureLigue;
  /** Les 30 équipes, composées par le staff avec tous leurs joueurs (les absents sont retirés match par match). */
  equipes: Record<string, EquipeDuMatch>;
  regles: ReglesMatch;
  reglages: ReglagesMatch;
  /** Les recrues de la saison (pour le rookie de l'année). */
  recrues: string[];
  /** Points par match de la saison précédente (statistiques sourcées), pour le joueur ayant le plus progressé. */
  pointsParMatchPrecedents: Record<string, number>;
  /** Tranche 6 : paramètres de la CBA et contrats. */
  salaires: DonneesSalariales;
  /** Tranche 7 : loterie, propriété des choix, génération des prospects et scouting (absent : pas de Draft). */
  draft?: DonneesDraft;
}

export type Phase = 'reguliere' | 'play-in' | 'playoffs' | 'terminee';
export type NatureMatch = 'reguliere' | 'play-in' | 'playoffs' | 'all-star';

export interface MatchPrevu {
  id: number;
  domicile: string;
  exterieur: string;
}

export interface JourCalendrier {
  /** AAAA-MM-JJ. */
  date: string;
  matchs: MatchPrevu[];
}

/** Ce qu'on garde d'un match joué : assez pour le classement, les actualités, et pour le rejouer à l'identique. */
export interface ResumeMatch {
  id: number;
  nature: NatureMatch;
  date: string;
  domicile: string;
  exterieur: string;
  graine: number;
  score: [number, number];
  prolongations: number;
  /** Joueurs absents (blessés) au coup d'envoi : avec la graine, ils suffisent à rejouer le match. */
  absents: string[];
  empreinte: string;
  interet: number;
  /** Moments marquants (importance 2 ou plus), déjà rédigés. */
  moments: string[];
  /** Terrain neutre (All-Star Game). */
  neutre?: boolean;
  /** Tranche 5 : décisions du coach (match joué en mode interactif) ; avec la graine et les absents, elles suffisent à le rejouer. */
  decisions?: DecisionMatch[];
}

/** Tranche 5 : le match interactif en cours de la franchise du joueur (enregistré à chaque décision). */
export interface MatchInteractif {
  /** Identifiant du match dans la saison. */
  id: number;
  decisions: DecisionMatch[];
  /** Dernier arrêt de jeu atteint, pour reprendre l'affichage au même point. */
  arret: number;
}

/** Totaux d'un joueur sur une phase. Minutes en dixièmes de seconde, comme le box score. */
export interface LigneSaison {
  equipe: string;
  matchs: number;
  titularisations: number;
  /** Matchs d'au moins `minutesPourCompter` minutes (règle des 65 matchs). */
  matchsEligibles: number;
  dixiemes: number;
  points: number;
  tirsReussis: number;
  tirsTentes: number;
  troisReussis: number;
  troisTentes: number;
  lancersReussis: number;
  lancersTentes: number;
  rebondsOffensifs: number;
  rebondsDefensifs: number;
  passes: number;
  interceptions: number;
  contres: number;
  pertes: number;
  fautes: number;
  plusMoins: number;
}

export interface Bilan {
  equipe: string;
  victoires: number;
  defaites: number;
  domicile: [number, number];
  exterieur: [number, number];
  division: [number, number];
  conference: [number, number];
  /** Bilan contre chaque adversaire. */
  contre: Record<string, [number, number]>;
  pointsPour: number;
  pointsContre: number;
  /** Série en cours : positive en victoires, négative en défaites. */
  serie: number;
  /** Les dix derniers matchs. */
  dixDerniers: [number, number];
}

export interface Serie {
  id: string;
  tour: number;
  conference: string | null;
  /** Meilleure tête de série (avantage du terrain) puis l'autre. */
  haut: string;
  bas: string;
  teteHaut: number;
  teteBas: number;
  victoires: [number, number];
  matchs: number[];
  vainqueur?: string;
}

export interface EtatPlayIn {
  conference: string;
  /** Équipes classées 7 à 10, dans l'ordre. */
  equipes: string[];
  matchs: { etape: '7-8' | '9-10' | 'finale'; domicile: string; exterieur: string; resultat?: number }[];
  septieme?: string;
  huitieme?: string;
}

export interface Palmares {
  champion: string;
  finaliste: string;
  mvpFinale?: string;
  mvp?: string;
  defenseur?: string;
  rookie?: string;
  sixiemeHomme?: string;
  progression?: string;
  allNba: string[][];
}

export interface AllStar {
  date: string;
  titulaires: Record<string, string[]>;
  remplacants: Record<string, string[]>;
  resultat?: number;
  mvp?: string;
}

export interface Actualite {
  id: number;
  date: string;
  titre: string;
  texte: string;
  equipes: string[];
  importance: 1 | 2 | 3;
  /** Match à rejouer (mode commenté) depuis l'actualité. */
  match?: number;
  genre:
    | 'resultat'
    | 'moment'
    | 'blessure'
    | 'serie'
    | 'match-de-la-semaine'
    | 'all-star'
    | 'play-in'
    | 'playoffs'
    | 'palmares'
    | 'finances'
    | 'draft';
}

export interface EtatSaison {
  version: 1;
  saison: string;
  graine: number;
  /** La franchise dirigée par le joueur. */
  franchise: string;
  phase: Phase;
  calendrier: JourCalendrier[];
  /** Prochain jour du calendrier de saison régulière à jouer. */
  jour: number;
  /** Dernière date jouée (toutes phases). */
  date: string;
  matchs: ResumeMatch[];
  /** Tranche 5 : match interactif en cours ; ses décisions s'appliquent quand la saison joue ce match. */
  matchInteractif?: MatchInteractif;
  /** Joueur → matchs encore à manquer. */
  blessures: Record<string, number>;
  statistiques: Record<string, LigneSaison>;
  statistiquesPlayoffs: Record<string, LigneSaison>;
  statistiquesFinale: Record<string, LigneSaison>;
  allStar?: AllStar;
  playIn?: EtatPlayIn[];
  /** Têtes de série des playoffs, par conférence. */
  tetesDeSerie?: Record<string, string[]>;
  series?: Serie[];
  palmares?: Palmares;
  actualites: Actualite[];
  /** Le dernier « match de la semaine » choisi (date de fin de semaine). */
  derniereSemaine: number;
  /** Tranche 7 : la Draft qui suit la saison (classe, scouting du GM, loterie, choix). Absente des sauvegardes plus anciennes. */
  draft?: EtatDraft;
}

export type { EquipeDuMatch, JoueurDuMatch };
