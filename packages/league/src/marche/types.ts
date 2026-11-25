// Tranche 9 : le marché — échanges, agents libres, IA des GM, staff et délégations (docs/MARCHE.md).
//
// Tout l'état du marché vit dans l'univers et dans l'état de la saison (objets JSON purs, sauvegardés tels quels). Les
// paramètres viennent de data/cba/ (règles sourcées), data/ligue/transactions-*.json (dates, volumes) et des modèles
// data/modeles/marche-v1.json et staff-v1.json (choix du modèle).
import type { PlanDeJeu } from '@basket-legends/engine';
import type { MoyenDeSignature } from '../cba';

export type Ancrages = [number, number][];
export type StrategieGm = 'pretendant' | 'playoffs' | 'transition' | 'reconstruction';
type Intervalle = [number, number];
interface Strategie {
  rangForceMax: number;
  present: number;
  futur: number;
}

/** data/modeles/marche-v1.json, sans l'en-tête. */
export interface ModeleMarche {
  valeur: {
    salaireSelonNote: Ancrages;
    primeStar: { seuil: number; parPoint: number };
    horizon: number;
    actualisation: number;
    retenueApresContrat: number;
  };
  force: { poids: number[]; valeurPoint: number };
  choix: { valeurParRang: Ancrages; actualisationParAn: number; incertitudeParAn: number };
  strategies: Record<StrategieGm, Strategie>;
  gm: {
    patience: Intervalle;
    aversionTaxe: number;
    aversionTaxeRecidiviste: number;
    margeAcceptation: number;
    refusAvantFermeture: number;
  };
  personnalite: { moyenne: number; ecartType: number; bornes: Intervalle };
  agentsLibres: {
    journees: number;
    baisseDemandeParJournee: number;
    demandePlancher: number;
    poids: { argent: number; victoire: number; role: number; fidelite: number };
    dureeSelonAge: [number, number][];
    offresParEquipeParJournee: number;
    hausseParDefaut: number;
    seuilOptionJoueur: number;
    seuilOffreQualificative: number;
    noteMinNba: number;
    /** Valeur (dollars) qu'une équipe accorde à garder son propre agent libre (continuité, droits de Bird). */
    fideliteEquipe: number;
  };
  echangesIa: {
    tentativesParJourSaison: number;
    tentativesParJourneeIntersaison: number;
    candidatsParTentative: number;
    propositionsAuGmParSaison: number;
  };
  critereSortie: {
    saisons: number;
    standardParEquipe: Intervalle;
    equipesTaxe: Intervalle;
    equipesDeuxiemeApron: Intervalle;
    correlationSalaireNoteMin: number;
    noteMaxAgentLibreNonSigne: number;
    joueurs85ParEquipeMax: number;
    echangesParSaison: Intervalle;
    signaturesParSaison: Intervalle;
    giniForceMax: number;
  };
}

export type Poste = 'entraineur' | 'developpement' | 'recruteur' | 'medical';
export type Competence = 'tactique' | 'developpement' | 'motivation' | 'scouting' | 'medical';

/** data/modeles/staff-v1.json, sans l'en-tête. */
export interface ModeleStaff {
  postes: { id: Poste; libelle: string; competences: Competence[] }[];
  competence: { moyenne: number; ecartType: number; bornes: Intervalle; reference: number; etendue: number };
  effets: { scouting: Intervalle; blessures: Intervalle; progression: { max: number; ageMax: number } };
  preferences: {
    rythme: Record<PlanDeJeu['rythme'], number>;
    defense: Record<PlanDeJeu['defense'], number>;
    troisPoints: Record<PlanDeJeu['troisPoints'], number>;
  };
  libresParPoste: number;
  ages: Intervalle;
}

/** Dates des transactions de la saison de référence (data/ligue/transactions-*.json). */
export interface DatesTransactions {
  negociationsAgentsLibres: string;
  signaturesAgentsLibres: string;
  contratsGarantis: string;
  dateLimiteEchanges: string;
  dateLimiteBallottagePhaseFinale: string;
}

/** Ce dont le marché a besoin dans le contexte de la ligue. */
export interface DonneesMarche {
  modele: ModeleMarche;
  staff: ModeleStaff;
  /** Saison de référence des dates (« 2026-2027 ») : les saisons suivantes les décalent comme le calendrier. */
  saisonDeReference: string;
  dates: DatesTransactions;
  volumes: { echanges: number; signatures: number };
}

// --- Délégations (réponses 37 et 38). ---

export type NiveauDelegation = 'gm' | 'propose' | 'staff';
export type DomaineDelegation = 'draft' | 'agentsLibres' | 'prolongations' | 'echanges' | 'rotation';
export type Delegations = Record<DomaineDelegation, NiveauDelegation>;
export const DELEGATIONS_PAR_DEFAUT: Readonly<Delegations> = {
  draft: 'gm',
  agentsLibres: 'propose',
  prolongations: 'propose',
  echanges: 'propose',
  rotation: 'staff',
};
/** Pilote automatique (critère de sortie, réponse 45) : le staff décide de tout. */
export const DELEGATIONS_STAFF: Readonly<Delegations> = {
  draft: 'staff',
  agentsLibres: 'staff',
  prolongations: 'staff',
  echanges: 'staff',
  rotation: 'staff',
};

// --- Staff. ---

export interface MembreStaff {
  id: string;
  nom: string;
  age: number;
  poste: Poste;
  competences: Partial<Record<Competence, number>>;
  /** Entraîneur : le plan de jeu qu'il applique (réponse 40). */
  preferences?: Pick<PlanDeJeu, 'rythme' | 'defense' | 'troisPoints'>;
}
export type StaffEquipe = Record<Poste, MembreStaff>;

// --- Échanges. ---

/** Ce qu'une équipe peut céder : un joueur sous contrat, ou un choix de Draft (son droit sur le choix d'une équipe). */
export type Actif = { type: 'joueur'; id: string } | { type: 'choix'; annee: number; tour: 1 | 2; original: string };

/** Une proposition d'échange : `actifs[i]` est ce que cède `equipes[i]`. */
export interface PropositionEchange {
  equipes: [string, string];
  actifs: [Actif[], Actif[]];
}

export interface VerdictEchange {
  legal: boolean;
  motifs: string[];
  /** Pour chaque équipe : salaires cédés, reçus, masse après, et le maximum qu'elle pouvait recevoir. */
  details: { equipe: string; cedes: number; recus: number; masseApres: number; maxRecevable: number }[];
}

export interface AvisEchange {
  accepte: boolean;
  /** Utilité de l'échange pour l'équipe, en dollars (positive : elle y gagne). */
  utilite: number;
  raisons: string[];
}

// --- Agents libres. ---

export type DroitsBird = 'bird' | 'early-bird' | 'non-bird';
export type MoyenOffre = MoyenDeSignature | DroitsBird | 'qualificative';

export interface Offre {
  joueur: string;
  equipe: string;
  /** Salaire de la première saison. */
  salaire: number;
  duree: number;
  /** Hausse annuelle (part du salaire de première saison). */
  hausse: number;
  option?: 'joueur' | 'equipe';
  moyen: MoyenOffre;
  journee: number;
}

export interface AgentLibre {
  joueur: string;
  /** Équipe qu'il quitte (droits de Bird, agent libre restreint), ou null. */
  ancienne: string | null;
  droits: DroitsBird | null;
  restreint: boolean;
  offreQualificative?: number;
  /** Salaire de la saison écoulée (droits de Bird). */
  precedent: number;
  /** Salaire demandé au début de la free agency (il baisse au fil des journées). */
  demande: number;
  duree: number;
}

/** Une offre signée par un agent libre restreint chez une autre équipe : l'équipe d'origine peut s'aligner. */
export interface FeuilleDOffre {
  offre: Offre;
  /** Journée jusqu'à laquelle l'équipe d'origine peut s'aligner. */
  jusqua: number;
}

export interface EtatIntersaison {
  journee: number;
  journees: number;
  agents: Record<string, AgentLibre>;
  /** Offres en attente de réponse (journée en cours). */
  offres: Offre[];
  feuilles: FeuilleDOffre[];
  signatures: { joueur: string; equipe: string; salaire: number; duree: number; journee: number }[];
  /** Équipe → joueurs dont elle a renoncé aux droits (plus de « cap hold »). */
  renonces: Record<string, string[]>;
  terminee?: boolean;
}

// --- Journal, bureau, compositions. ---

export interface Transaction {
  date: string;
  genre: 'echange' | 'signature' | 'coupe' | 'ballottage' | 'prolongation' | 'option' | 'qualificative' | 'alignement' | 'staff';
  equipes: string[];
  joueurs: string[];
  texte: string;
}

export type ActionBureau =
  | { type: 'echange'; proposition: PropositionEchange }
  | { type: 'alignement'; joueur: string; offre: Offre }
  | { type: 'offre-staff'; offre: Offre };

export interface MessageBureau {
  id: number;
  date: string;
  genre: 'echange' | 'alignement' | 'agent' | 'staff' | 'rumeur' | 'info';
  titre: string;
  texte: string;
  action?: ActionBureau;
  statut?: 'ouvert' | 'accepte' | 'refuse' | 'expire';
}

/** L'effectif d'une équipe à partir d'un match (rejeu à l'identique après un échange ou un changement de composition). */
export interface CompositionNotee {
  /** Nombre de matchs déjà joués dans la saison quand cette composition prend effet. */
  avantMatch: number;
  joueurs: string[];
  /** Ordre imposé par le GM (cinq de départ puis rotation) : pas recomposé par le staff. */
  ordre?: boolean;
  plan?: Partial<PlanDeJeu>;
  /** Numéros de maillot à ce moment (un joueur échangé peut en changer ; le numéro entre dans l'empreinte du match). */
  numeros?: Record<string, string>;
}

/** Compteurs du marché de la saison (mesures du critère de sortie, fermeture des GM). */
export interface CompteursMarche {
  echanges: number;
  signatures: number;
  /** Équipe → refus opposés au GM du joueur cette saison. */
  refus: Record<string, number>;
  /** Propositions de l'IA déjà faites au GM du joueur. */
  propositions: number;
}
