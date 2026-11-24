// Tranche 7 : les contrats de la Draft (loterie, propriété des choix, prospects, scouting). Comme l'état de la saison,
// tout est en objets JSON purs : l'état se sauvegarde tel quel dans IndexedDB.
import type { AttributsDetailles } from '@basket-legends/engine';

/** Une catégorie de la loterie : combien d'équipes, combien de boules chacune, et le pire rang possible. */
export interface CategorieLoterie {
  id: 'releguees' | 'non-qualifiees' | 'play-in-9-10' | 'perdants-7-8';
  boules: number;
  /** Nombre d'équipes attendues dans la catégorie. */
  equipes: number;
  /** Pire choix possible pour une équipe de la catégorie (12 pour les trois pires bilans). */
  plancher: number;
}

/** data/draft/loterie-<années>.json, sans les sources. */
export interface ReglesLoterie {
  id: string;
  drafts: number[];
  choixTires: number;
  categories: CategorieLoterie[];
  /** Le choix d'une équipe ne peut pas être n° 1 deux Drafts de suite. */
  premierChoixInterditApresUnPremier: boolean;
  /** Ni dans le top `top` trois Drafts de suite. */
  limiteTop: { top: number; draftsConsecutives: number };
}

/** Une équipe de la loterie : sa catégorie et son rang au bilan (1 = pire bilan de la ligue). */
export interface ParticipantLoterie {
  equipe: string;
  categorie: CategorieLoterie['id'];
  rangBilan: number;
}

/** L'historique utile aux limites : rang du choix propre de chaque équipe lors des Drafts précédentes. */
export type HistoriqueChoix = Record<string, number[]>;

export interface ResultatLoterie {
  /** Équipes dans l'ordre des choix 1 à `choixTires` (choix propres, avant les échanges). */
  ordre: string[];
  /** Les tirages refaits à cause des limites (pour l'actualité et les tests). */
  tiragesRefaits: number;
}

// --- Propriété des choix (échanges, protections, droits d'échange). ---

/** Désigne des choix : le choix propre d'une équipe (éventuellement seulement dans une plage de rangs), ou un choix déjà attribué à un détenteur provisoire (« @… »). */
export type SelecteurChoix = { original: string; rangs?: [number, number] } | { detenteur: string };

/** À qui va le k-ième choix le plus favorable d'une règle ; `rangs` : seulement si le choix tombe dans cette plage, sinon `sinon` (par défaut, le détenteur ne change pas). */
export interface AttributionChoix {
  beneficiaire: string;
  rangs?: [number, number];
  sinon?: string;
}

/** Une règle : les choix désignés, rangés du plus favorable au moins favorable, reçoivent les attributions prévues pour leur nombre. */
export interface RegleChoix {
  membres: SelecteurChoix[];
  /** Nombre de choix effectivement désignés → attributions dans l'ordre du plus favorable. */
  attributions: Record<string, AttributionChoix[]>;
  /** Condition sur le rang du choix propre d'une équipe au premier tour (ex. le choix de 2e tour suit la protection d'un 1er tour). */
  condition?: { original: string; rangs: [number, number] };
  /** Attributions quand la condition n'est pas remplie. */
  attributionsSinon?: Record<string, AttributionChoix[]>;
  description: string;
}

/** data/draft/choix-<année>.json, sans les sources. */
export interface ProprieteChoix {
  annee: number;
  statut: 'a-recouper' | 'valide';
  tours: Record<'1' | '2', RegleChoix[]>;
}

export interface ChoixDeDraft {
  tour: 1 | 2;
  /** Rang dans la Draft (1 à 60). */
  rang: number;
  /** L'équipe dont c'est le choix propre. */
  original: string;
  /** L'équipe qui choisit. */
  detenteur: string;
}

// --- Prospects et scouting. ---

export type OrigineProspect = 'universite' | 'international' | 'g-league';

export interface Prospect {
  id: string;
  prenom: string;
  nom: string;
  age: number;
  /** Poste au format des effectifs (G, F, C, G-F…). */
  poste: string;
  tailleCm: number;
  poidsKg: number;
  origine: OrigineProspect;
  pays: string;
  /** Vraie note globale actuelle (échelle hors NBA, 40-67) : jamais affichée au joueur. */
  note: number;
  /** Vrai potentiel (note globale attendue au sommet de la carrière) : jamais affiché. */
  potentiel: number;
  /** Vrais attributs : jamais affichés. */
  familles: { technique: number; physique: number; mental: number; tactique: number; endurance: number };
  details: AttributsDetailles;
}

/** Ce qu'une équipe croit savoir d'un prospect : une estimation et une fourchette à 90 %. */
export interface Estimation {
  valeur: number;
  bas: number;
  haut: number;
}

export interface RapportDeScouting {
  prospect: string;
  observations: number;
  note: Estimation;
  potentiel: Estimation;
  details: Record<keyof AttributsDetailles, Estimation>;
}

/** data/draft/modele-draft.json, sans l'en-tête : génération des classes et scouting (choix du modèle). */
export interface ModeleDraft {
  classe: {
    taille: number;
    ages: Record<string, number>;
    origines: Record<OrigineProspect, number>;
    postes: Record<string, number>;
    tailleParPoste: Record<string, [number, number]>;
    imcMoyen: number;
    paysParOrigine: Record<OrigineProspect, Record<string, number>>;
    note: { moyenne: number; ecartTalent: number; parAnnee: number; bruit: number; min: number; max: number };
    potentiel: { marge: number; ecartTalent: number; ecartPropre: number; parAnneeDAge: number; max: number };
    details: { ecart: number; min: number; max: number; profilParGroupe: Record<string, Partial<AttributsDetailles>> };
  };
  scouting: {
    /** Écart-type de l'erreur sans observation, en points, pour la note, le potentiel et chaque attribut. */
    ecartInitial: { note: number; potentiel: number; details: number };
    /** Observations attribuées à chaque prospect par le staff sans consigne (selon son rang au consensus). */
    observationsParDefaut: number;
    /** Observations que le GM peut répartir sur une saison. */
    budgetObservations: number;
    /** Plafond d'observations sur un même prospect. */
    observationsMax: number;
    /** Consensus de la presse (mock draft) : précision équivalente à ce nombre d'observations. */
    observationsDuConsensus: number;
  };
  choixIa: { poidsNote: number; poidsPotentiel: number; malusParAnnee: number; besoinDePoste: number };
}

/** L'état de la Draft d'une saison (dans l'état de la saison). */
export interface EtatDraft {
  annee: number;
  classe: Prospect[];
  /** Observations du GM : prospect → nombre. */
  observations: Record<string, number>;
  loterie?: ResultatLoterie & { participants: ParticipantLoterie[] };
  choix?: ChoixDeDraft[];
  /** Choix faits : rang → prospect. */
  selections: Record<string, string>;
  /** Le GM laisse son staff choisir pour lui. */
  delegue?: boolean;
  terminee?: boolean;
}

/** Banques de noms pour les joueurs générés, par pays, et filtre des vrais noms interdits. */
export interface GenerateurDeNoms {
  parPays: Record<string, { prenoms: string[]; noms: string[] }>;
  estInterdit: (prenom: string, nom: string) => boolean;
}
