// Tranche 10 : la vie du club — propriétaire (objectifs, confiance, licenciement, offres d'emploi), vestiaire (moral des
// joueurs et du groupe, messages à choix), G League (30 équipes affiliées, saison accélérée) et contrats en cours de
// saison (two-way, 10 jours, hardship). Réponses 46 à 56 de docs/DECISIONS_2026-11.md ; organisation reprise de
// rugby-legends@19dd48f:src/manager/moteur/carriere.ts et vestiaire.ts (docs/CLUB.md § 1).
//
// Tout l'état vit dans l'univers (ce qui dure d'une saison à l'autre) et dans l'état de la saison (ce qui ne dure
// qu'une saison) : objets JSON purs, sauvegardés tels quels.

type Intervalle = [number, number];

export type ProfilProprietaire = 'exigeant' | 'patient' | 'ambitieux';
export type TypeObjectif = 'titre' | 'finale-conference' | 'playoffs' | 'play-in' | 'reconstruction';
export type Temperament = 'meneur' | 'calme' | 'sanguin' | 'discret';
export type Role = 'titulaire' | 'rotation' | 'banc';
export type Expediteur = 'adjoint' | 'proprietaire' | 'recrutement';

export interface ChoixMessage {
  texte: string;
  defaut?: boolean;
  /** Effets tirés au hasard dans chaque liste (une même réponse peut bien ou mal tourner). */
  effets: Partial<Record<'joueur' | 'joueur2' | 'groupe' | 'confiance', number[]>>;
  /** La première valeur de chaque liste a pour chance le poids des meneurs du groupe. */
  chance?: 'meneurs';
  action?: 'promesse' | 'ecarter' | 'gleague' | 'role' | 'echange' | 'garder';
}

export interface EvenementClub {
  id: string;
  de: Expediteur;
  titre: string;
  texte: string;
  choix: ChoixMessage[];
}

/** data/modeles/club-v1.json, sans l'en-tête. */
export interface ModeleClub {
  proprietaire: {
    profils: Record<ProfilProprietaire, { part: number; depart: number; seuil: number; severite: number; toleranceTaxe: number }>;
    /** Réponse 51 : un propriétaire récidiviste de la taxe au snapshot (miroir) est « ambitieux » avec cette probabilité. */
    recidivisteAmbitieux: number;
    /** Objectif selon le rang de force de l'équipe dans la ligue au début de la saison (1 = la plus forte). */
    objectifs: { jusqua: number; type: TypeObjectif; rangConference: number; victoiresMin?: number }[];
    rendezVous: number[];
    confiance: {
      parPlace: number;
      miSaison: number;
      finSaison: number;
      plafondHausse: number;
      plafondBaisse: number;
      titre: number;
      finale: number;
      objectifTenuMarge: number;
      /** Points perdus par tranche de 10 M$ de taxe de luxe au-delà de la tolérance du propriétaire. */
      taxeParDixMillions: number;
      demenagementRefuse: number;
    };
    reputation: {
      depart: number;
      objectifTenu: number;
      objectifManque: number;
      titre: number;
      finale: number;
      licenciement: number;
      ecartOffres: number;
    };
    offres: number;
    /** Probabilité par saison que le propriétaire propose un déménagement au GM du joueur (réponse 54, choix du jeu). */
    propositionDemenagement: number;
    textes: Record<'bon' | 'moyen' | 'mauvais' | 'licenciement' | 'demenagement', string[]>;
  };
  vestiaire: {
    moral: {
      depart: number;
      recrue: number;
      victoire: number;
      defaite: number;
      /** Chaque jour de saison, le moral revient de cette part de son écart avec « depart ». */
      retour: number;
      intersaison: number;
      poidsMeneur: number;
      demandeSeuil: number;
      demandeJours: number;
      promesseRompue: number;
      minutesRotation: number;
      minutesTitulaire: number;
    };
    /** Effet du temps de jeu d'un match selon le rôle : [moins de « minutesRotation », rotation, titulaire]. */
    tempsDeJeu: Record<Role, [number, number, number]>;
    roles: { titulaires: number; rotation: number };
    temperaments: Record<Temperament, { part: number; variation: number; tempsDeJeu: number }>;
    /** Note de la famille « mental » à partir de laquelle un meneur est trois fois plus probable. */
    meneurMental: number;
    /** Effet du moral du groupe en match : points de réussite au tir par point d'écart avec la moyenne de la ligue, borné. */
    effetMatch: { parPoint: number; max: number };
    /** Effet du moral sur la fidélité d'un agent libre envers son équipe (multiplicateur au moral de départ). */
    fidelite: Intervalle;
    messages: { parJour: number; parSaison: number; delai: number };
    chances: Record<string, number>;
    seuils: Record<string, number>;
    evenements: EvenementClub[];
  };
  gLeague: {
    effectif: number;
    forceTop: number[];
    echelle: number;
    avantageDomicile: number;
    pointsMoyens: number;
    ecartPoints: number;
    minutes: number[];
    progression: { matchsMin: number; bonus: number; ageMax: number };
    /** Assignation d'un joueur sous contrat standard : ancienneté maximale (choix du jeu, à recouper). */
    assignationAncienneteMax: number;
    /** L'IA assigne ses jeunes au-delà de ce rang dans son effectif. */
    rangAssignationIa: number;
  };
  contratsIa: { noteMinHardship: number; noteMinConversion: number; ageMaxTwoWay: number };
  critereSortie: {
    saisons: number;
    licenciementsParSaison: Intervalle;
    moralMoyen: Intervalle;
    deriveMoralMax: number;
    effetMoyenMax: number;
  };
}

/** data/ligue/g-league-AAAA-AA.json, sans les sources. */
export interface StructureGLeague {
  saison: string;
  equipes: number;
  affiliees: number;
  tipOff: { matchs: number; regions: number; debut: string; fin: string };
  showcase: { qualifies: number; debut: string; fin: string };
  saisonReguliere: { matchs: number; debut: string; fin: string };
  playoffs: { parConference: number; debut: string; finaleVictoires: number };
}

export interface DonneesClub {
  modele: ModeleClub;
  gLeague: StructureGLeague;
  /** Changements de direction sportive relevés par saison (critère de sortie, réponse 56). */
  licenciementsReleves: Record<string, number>;
}

// --- Ce qui dure d'une saison à l'autre (univers). ---

export interface ProprietaireEquipe {
  profil: ProfilProprietaire;
  confiance: number;
  /** Rang du GM en poste (0 : celui du début de partie) ; il change la personnalité du GM (gmDe). */
  gm: number;
  gmDepuis: string;
}

export interface ClubUnivers {
  proprietaires: Record<string, ProprietaireEquipe>;
  /** Réputation du GM du joueur (0 à 100) : elle décide des offres d'emploi. */
  reputation: number;
  moral: Record<string, number>;
  /** Rôle promis à un joueur (sinon, son rang dans l'effectif). */
  roles: Record<string, Role>;
  /** Joueur → date depuis laquelle son moral est sous le seuil de la demande d'échange. */
  basDepuis: Record<string, string>;
  /** Joueurs qui ont demandé à être échangés : date, équipe, et si le GM a accepté de les échanger. */
  demandes: Record<string, { date: string; equipe: string; acceptee?: boolean }>;
  /** Dernière équipe connue de chaque joueur NBA (un changement d'équipe remet son moral à celui d'une recrue). */
  equipes: Record<string, string>;
  /** Joueurs sous contrat standard assignés en G League (joueur → franchise). */
  assignes: Record<string, string>;
  /** Joueurs hors NBA rattachés à une équipe affiliée de G League pour la saison (joueur → franchise). */
  affilies: Record<string, string>;
  /** Licenciements de GM par saison (mesure du critère de sortie). */
  licenciements: Record<string, string[]>;
  /** Carrière du GM du joueur : franchises dirigées. */
  parcours: { franchise: string; de: string; jusqua?: string; fin?: 'licencie' | 'parti' }[];
}

// --- Ce qui ne dure qu'une saison (état de la saison). ---

export interface Objectif {
  type: TypeObjectif;
  rangConference: number;
  victoiresMin?: number;
  /** Rang attendu dans la ligue (1 = la meilleure) : force de l'effectif, puis aussi bilan de la saison passée. */
  rangForce: number;
}

export interface MessageClub {
  id: number;
  evenement: string;
  date: string;
  titre: string;
  texte: string;
  de: Expediteur;
  joueur?: string;
  joueur2?: string;
  choix: string[];
  reponse?: number;
  parDefaut?: boolean;
  resultat?: string;
}

export interface LigneGLeague {
  equipe: string;
  matchs: number;
  minutes: number;
  points: number;
  rebonds: number;
  passes: number;
}

export interface MatchGLeague {
  date: string;
  phase: 'tip-off' | 'showcase' | 'reguliere' | 'playoffs';
  domicile: string;
  exterieur: string;
  score?: [number, number];
  /** Tour des phases finales (showcase, playoffs). */
  tour?: number;
  /** Match de la finale de G League (au meilleur des trois). */
  finale?: boolean;
}

export interface SaisonGLeague {
  matchs: MatchGLeague[];
  /** Prochain match à jouer (index dans `matchs`). */
  prochain: number;
  statistiques: Record<string, LigneGLeague>;
  vainqueurShowcase?: string;
  champion?: string;
}

export interface ContratEnSaison {
  joueur: string;
  equipe: string;
  debut: string;
  fin: string;
  numero: number;
  hardship: boolean;
}

export interface EtatClub {
  objectifs: Record<string, Objectif>;
  /** Rendez-vous du propriétaire déjà tenus cette saison. */
  rendezVous: number;
  /** Bilan de fin de saison (après les playoffs). */
  bilan?: Record<string, { tenu: boolean; confiance: number; licencie: boolean }>;
  messages: MessageClub[];
  /** Joueur → nombre de matchs consécutifs manqués (blessure), pour l'exception de difficulté (hardship). */
  absences: Record<string, number>;
  /** Joueurs écartés du prochain match de leur équipe (sanction). */
  ecartes: Record<string, number>;
  /** Promesse de temps de jeu au prochain match. */
  promesses: Record<string, string>;
  /** Joueur → matchs consécutifs avec peu de minutes (sous « minutesRotation »). */
  peuJoue: Record<string, number>;
  /** Le propriétaire a déjà parlé de la taxe cette saison. */
  taxeSignalee?: boolean;
  /** Contrats de 10 jours en cours. */
  dixJours: ContratEnSaison[];
  /** Contrats de 10 jours signés cette saison par (joueur, équipe). */
  dixJoursSignes: Record<string, number>;
  gLeague?: SaisonGLeague;
  /** Le GM du joueur a été licencié : franchises qui lui offrent un poste. */
  licenciement?: { offres: string[] };
  /** Le propriétaire propose de déménager (réponse 54). */
  demenagement?: { ville: string; nom: string; abreviation: string; statut: 'ouvert' | 'accepte' | 'refuse' };
}
