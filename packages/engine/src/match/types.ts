// Tranche 1 : les contrats du moteur de match (entrée, journal d'événements, box score).
// Le moteur ne lit ni fichier ni schéma : l'interface lui passe des objets déjà validés (packages/data).

/** Le rôle de jeu d'un joueur, tiré de son poste source (G, F, C, G-F…), pour la composition et le profil de tir. */
export type Groupe = 'meneur' | 'ailier' | 'interieur';

/** La position d'un tir sur le terrain (tranche 3). */
export interface PositionTir {
  /** Distance au centre du panier, en pieds (une décimale). */
  distance: number;
  /** Angle en degrés : 0 face au panier, -90 et 90 le long de la ligne de fond. */
  angle: number;
}

/** Les trois zones de tir du modèle de la tranche 1. */
export type TypeTir = 'cercle' | 'miDistance' | 'troisPoints';
export const TYPES_TIR: readonly TypeTir[] = ['cercle', 'miDistance', 'troisPoints'];

/** 0 : l'équipe qui reçoit ; 1 : celle qui se déplace. */
export type Camp = 0 | 1;

// --- Tranche 5 : plans de jeu et décisions du mode interactif. ---

export type Rythme = 'lent' | 'normal' | 'rapide';
export type DefenseDeJeu = 'individuelle' | 'zone';
export type VolumeTrois = 'moins' | 'normal' | 'plus';
/** Qui décide des changements ou des temps-morts : le staff (automatique) ou le coach (l'utilisateur). */
export type Gestion = 'staff' | 'coach';

/** Le plan de jeu d'une équipe : rythme, défense, part du tir à trois points, et ce que le coach délègue au staff. */
export interface PlanDeJeu {
  rythme: Rythme;
  defense: DefenseDeJeu;
  troisPoints: VolumeTrois;
  remplacements: Gestion;
  tempsMorts: Gestion;
}

export const PLAN_PAR_DEFAUT: Readonly<PlanDeJeu> = {
  rythme: 'normal',
  defense: 'individuelle',
  troisPoints: 'normal',
  remplacements: 'staff',
  tempsMorts: 'staff',
};
export const RYTHMES: readonly Rythme[] = ['lent', 'normal', 'rapide'];
export const DEFENSES: readonly DefenseDeJeu[] = ['individuelle', 'zone'];
export const VOLUMES_TROIS: readonly VolumeTrois[] = ['moins', 'normal', 'plus'];
export const GESTIONS: readonly Gestion[] = ['staff', 'coach'];

/**
 * Une décision du coach, prise à un arrêt de jeu numéroté (0 = avant le coup d'envoi, puis chaque début de période et
 * chaque ballon mort avant une possession). Les décisions sont la seule entrée du mode interactif : le moteur rejoue le
 * match depuis le coup d'envoi avec la même graine et les mêmes décisions, et obtient le même match.
 */
export type DecisionMatch =
  | { arret: number; equipe: Camp; genre: 'plan'; plan: Partial<PlanDeJeu> }
  | { arret: number; equipe: Camp; genre: 'temps_mort' }
  | { arret: number; equipe: Camp; genre: 'remplacement'; entrant: string; sortant: string };

/** L'état d'un joueur à un arrêt de jeu (mode interactif). */
export interface JoueurALArret {
  id: string;
  /** Fraîcheur, de 0 à 100 (arrondie). */
  fraicheur: number;
  fautes: number;
  exclu: boolean;
  blesse: boolean;
}

/** Un arrêt de jeu, où le coach peut décider : l'état du match après les décisions prises à cet arrêt. */
export interface ArretDeJeu {
  numero: number;
  /** Nombre d'événements écrits avant l'arrêt : le journal jusque-là ne dépend pas des décisions prises à cet arrêt. */
  indice: number;
  periode: number;
  restant: number;
  score: [number, number];
  /** Début de période (dont l'avant-match) : ni temps-mort ; au coup d'envoi, le cinq de départ reste celui du staff. */
  debutDePeriode: boolean;
  /** L'équipe qui aura le ballon (null en début de période). */
  possession: Camp | null;
  plans: [PlanDeJeu, PlanDeJeu];
  surTerrain: [string[], string[]];
  joueurs: [JoueurALArret[], JoueurALArret[]];
  tempsMortsRestants: [number, number];
  peutTempsMort: [boolean, boolean];
  /** État du générateur à l'arrêt (sérialisable) : identique à chaque reprise avec les mêmes décisions. */
  hasard: number;
}

export interface OptionsSimulation {
  /** Rend l'état du match à chaque arrêt de jeu (mode interactif). */
  arrets?: boolean;
}

/** Ce que le moteur lit d'un joueur. Les notes sont sur 100 (provisoires jusqu'au modèle de notes v1, tranche 2). */
export interface JoueurDuMatch {
  id: string;
  nom: string;
  numero: string;
  poste: string;
  groupe: Groupe;
  note: number;
  technique: number;
  physique: number;
  mental: number;
  tactique: number;
  /** Tranche 4 : endurance (1-100) ; 70 = fatigue moyenne du modèle. */
  endurance: number;
  tailleCm: number;
}

/** Une équipe prête à jouer : les 5 premiers joueurs sont les titulaires, les suivants le banc, dans l'ordre de rotation. */
export interface EquipeDuMatch {
  id: string;
  nom: string;
  joueurs: JoueurDuMatch[];
}

/** Qui a le ballon au début d'une période : entre-deux, ou l'équipe qui a gagné / perdu l'entre-deux initial. */
export type PossessionDebutDePeriode = 'entre-deux' | 'gagnant' | 'perdant';

/** Les règles NBA dont le moteur a besoin (data/regles/, une valeur par paramètre, chacune sourcée dans le fichier). */
export interface ReglesMatch {
  joueursSurLeTerrain: number;
  periodesReglementaires: number;
  dureePeriodeSecondes: number;
  dureeProlongationSecondes: number;
  horlogeDePossessionSecondes: number;
  horlogeApresRebondOffensifSecondes: number;
  valeurPanierInterieur: number;
  valeurPanierATroisPoints: number;
  valeurLancerFranc: number;
  lancersFrancsFauteSurTirInterieur: number;
  lancersFrancsFauteSurTirATroisPoints: number;
  lancersFrancsPanierAvecFaute: number;
  lancersFrancsPenalite: number;
  fautesPersonnellesExclusion: number;
  rangFauteEquipePenalite: number;
  rangFauteEquipePenaliteProlongation: number;
  finDePeriodeSecondes: number;
  rangFauteEquipeFinDePeriode: number;
  /** Après une faute défensive hors tir sans lancers : horloge gardée, ou remontée à cette valeur si elle était plus basse. */
  horlogeMinimaleApresFauteDefensiveSecondes: number;
  // Tranche 3 : temps-morts (Rule No. 5, Section VI), fin de période et terrain.
  tempsMortsParMatch: number;
  tempsMortsMaxQuatriemePeriode: number;
  tempsMortsMaxFinDeMatch: number;
  debutFinDeMatchTempsMortsSecondes: number;
  tempsMortsParProlongation: number;
  repereTempsMortObligatoire1Secondes: number;
  repereTempsMortObligatoire2Secondes: number;
  dureeTempsMortObligatoireSecondes: number;
  dureeTempsMortSecondes: number;
  horlogeEteinteSousSecondes: number;
  tempsMinimalPourTirerSecondes: number;
  ligneATroisPointsPieds: number;
  zoneRestreintePieds: number;
  possessionDebutDePeriode: PossessionDebutDePeriode[];
}

type ParTir = Record<TypeTir, number>;
type ParGroupe = Record<Groupe, number>;

/** Les réglages du modèle (data/moteur/match-v4.json), calibrés en tranche 2 et complétés à chaque tranche. */
export interface ReglagesMatch {
  possession: {
    dureeMoyenneSecondes: number;
    dureeEcartSecondes: number;
    dureeMinimaleSecondes: number;
    tempsRestantMinimalPourTirer: number;
  };
  tirs: {
    repartition: ParTir;
    profilParGroupe: Record<Groupe, ParTir>;
    reussiteDeBase: ParTir;
    sensibiliteParPoint: number;
    avantageDomicile: number;
    usageEchelle: number;
  };
  lancersFrancs: { reussiteDeBase: number; sensibiliteParPoint: number; reussiteMin: number; reussiteMax: number };
  pertesDeBalle: { probabiliteDeBase: number; sensibiliteParPoint: number; partInterceptions: number };
  fautes: { surTirParType: ParTir; partPanierAvecFaute: number; horsTirParPossession: number };
  rebonds: { offensifDeBase: number; sensibiliteParPoint: number; poidsParGroupe: ParGroupe; partRebondsDEquipe: number };
  passes: { probabiliteSurPanier: number; poidsParGroupe: ParGroupe };
  contres: { probabiliteSurEchecParType: ParTir; poidsParGroupe: ParGroupe };
  fatigue: {
    perteParMinute: number;
    recuperationParMinute: number;
    seuilRemplacement: number;
    seuilRetour: number;
    malusParPointPerdu: number;
    /** Effet de l'endurance : la perte de fraîcheur varie de ± cet effet entre l'endurance 40 et l'endurance 100. */
    effetEndurance: number;
  };
  rotation: { profondeur: number; relaisMinimalSecondes: number };
  tempsMorts: {
    /** Série de points adverses sans réponse qui pousse le coach à demander un temps-mort. */
    serieAdverseDeclencheur: number;
    /** Bonus de réussite du tir préparé pendant un temps-mort de fin de match. */
    bonusActionPreparee: number;
    /** Fraîcheur regagnée par minute de temps-mort (tous les joueurs). */
    recuperationParMinute: number;
  };
  finDeMatch: {
    fauteVolontaireEcartMax: number;
    fauteVolontaireSecondesParPoint: number;
    fauteVolontaireSecondesMax: number;
    dureeFauteVolontaireSecondes: number;
    /** Part de l'horloge des tirs consommée par l'équipe qui mène. */
    gestionAvanceFraction: number;
    presseEcartMin: number;
    presseDureeSecondes: number;
    malusTirPresse: number;
    partTroisEnRetardDeTrois: number;
    /** Temps laissé au plus sur le chronomètre quand une équipe garde le ballon pour le dernier tir. */
    margeDernierTirSecondes: number;
  };
  blessures: {
    /** Probabilité qu'un joueur sur le terrain se blesse, par minute jouée. */
    probabiliteParMinute: number;
    /** Durées d'indisponibilité, en matchs, et leur part. */
    gravites: { part: number; matchsMin: number; matchsMax: number }[];
  };
  /** Tranche 5 : effets des plans de jeu (choix du modèle, non sourcés). */
  plans: {
    rythme: Record<Rythme, { facteurDuree: number; pertes: number; fatigue: number }>;
    troisPoints: Record<VolumeTrois, number>;
    zone: { repartition: ParTir; reussite: ParTir; rebondOffensif: number; pertes: number };
  };
  /** Tranche 5 : qualité du tir selon le défenseur direct (défense individuelle). */
  defenseurDirect: {
    /** Part du défenseur direct dans l'opposition au tir (le reste : la moyenne des cinq défenseurs). */
    poids: number;
    /** Points de défense par centimètre d'écart de taille, pour les tirs près du cercle. */
    tailleCercleParCm: number;
  };
  positions: {
    partTroisDansLesCoins: number;
    distanceTroisDansLesCoinsPieds: number;
    miDistanceParTranche: { troisDix: number; dixSeize: number; seizeLigne: number };
  };
}

export interface EntreeMatch {
  graine: number;
  domicile: EquipeDuMatch;
  exterieur: EquipeDuMatch;
  regles: ReglesMatch;
  reglages: ReglagesMatch;
  /** Tranche 5 : décisions du coach (mode interactif), dans l'ordre où elles ont été prises. */
  decisions?: DecisionMatch[];
}

/** Repère commun à tous les événements : la période (1 à 4, puis 5, 6… en prolongation) et le temps restant, en dixièmes de seconde. */
interface Repere {
  periode: number;
  restant: number;
}

export type Evenement =
  | (Repere & { type: 'debut_periode'; cinq: [string[], string[]] })
  | (Repere & { type: 'entre_deux'; equipe: Camp; joueurs: [string, string] })
  | (Repere & {
      type: 'tir';
      equipe: Camp;
      joueur: string;
      tir: TypeTir;
      reussi: boolean;
      /** Points marqués par ce tir (0 si manqué). */
      points: number;
      passe?: string;
      contre?: string;
      score: [number, number];
      /** Tranche 3 : où le tir a été pris (pieds depuis le centre du panier ; angle en degrés, 0 = face au panier, négatif à gauche de l'attaque). */
      position: PositionTir;
      /** Tir pressé par le chronomètre (moins de temps que le minimum du modèle). */
      presse?: true;
      /** Tir lâché dans la dernière seconde de la période. */
      auBuzzer?: true;
      /** Action préparée pendant un temps-mort de fin de match. */
      preparee?: true;
      /** Tranche 5 : le défenseur direct (défense individuelle seulement). */
      defenseur?: string;
    })
  | (Repere & {
      type: 'lancer_franc';
      equipe: Camp;
      joueur: string;
      reussi: boolean;
      numero: number;
      sur: number;
      points: number;
      score: [number, number];
    })
  | (Repere & { type: 'rebond'; equipe: Camp; joueur: string; offensif: boolean })
  /** Rebond d'équipe (ballon sorti, tir contré hors du terrain…) : la possession change ou non, aucun joueur n'est crédité. */
  | (Repere & { type: 'rebond_equipe'; equipe: Camp; offensif: boolean })
  | (Repere & { type: 'perte_de_balle'; equipe: Camp; joueur: string; interception?: string })
  | (Repere & {
      type: 'faute';
      /** L'équipe fautive. */
      equipe: Camp;
      joueur: string;
      victime: string;
      nature: 'tir' | 'hors_tir';
      fautesJoueur: number;
      fautesEquipe: number;
      penalite: boolean;
      /** Faute volontaire de fin de match, pour arrêter le chronomètre. */
      volontaire?: true;
    })
  | (Repere & {
      type: 'temps_mort';
      /** L'équipe chargée du temps-mort (null : temps-mort obligatoire qu'aucune équipe ne pouvait plus prendre). */
      equipe: Camp | null;
      nature: 'obligatoire' | 'equipe';
      /** Pourquoi le coach l'a demandé (« demande » : décision de l'utilisateur, mode interactif). */
      motif: 'obligatoire' | 'serie' | 'fin_de_match' | 'demande';
      /** Temps-morts qui restent à l'équipe pour la période en cours de décompte (match ou prolongation). */
      restants: number;
    })
  | (Repere & { type: 'exclusion'; equipe: Camp; joueur: string })
  /** Tranche 4 : blessure en match ; le joueur sort au prochain arrêt de jeu et manque les matchs indiqués. */
  | (Repere & { type: 'blessure'; equipe: Camp; joueur: string; matchsAbsent: number })
  | (Repere & { type: 'remplacement'; equipe: Camp; entrant: string; sortant: string })
  | (Repere & { type: 'fin_periode'; score: [number, number] })
  /** Tranche 5 : nouveau plan de jeu d'une équipe (décision du coach). */
  | (Repere & { type: 'plan'; equipe: Camp; plan: PlanDeJeu });

export interface LigneStatistique {
  /** Temps de jeu, en dixièmes de seconde. */
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
  rebonds: number;
  passes: number;
  interceptions: number;
  contres: number;
  pertes: number;
  fautes: number;
  plusMoins: number;
}

export interface LigneJoueur extends LigneStatistique {
  id: string;
  nom: string;
  numero: string;
  poste: string;
  titulaire: boolean;
  exclu: boolean;
  blesse: boolean;
}

export interface BoxEquipe {
  id: string;
  nom: string;
  points: number;
  /** Points par période (prolongations comprises). */
  parPeriode: number[];
  joueurs: LigneJoueur[];
  totaux: LigneStatistique;
}

export interface BoxScore {
  equipes: [BoxEquipe, BoxEquipe];
  periodes: number;
  prolongations: number;
}

export interface ResultatMatch {
  graine: number;
  evenements: Evenement[];
  boxScore: BoxScore;
  /** Empreinte du box score : deux matchs identiques ont la même. */
  empreinte: string;
  /** Tranche 5 : l'état du match à chaque arrêt de jeu (seulement si demandé). */
  arrets?: ArretDeJeu[];
  /** Tranche 5 : rang, dans `decisions`, des décisions impossibles (ignorées). */
  decisionsRejetees?: number[];
}
