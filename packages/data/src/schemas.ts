// Schémas Zod des données de référence (tranche 0). Ils décrivent les fichiers tels qu'ils sont dans `data/` :
// les noms de champs déjà établis sont conservés (CLAUDE.md, « Conventions de code »).
import { z } from 'zod';

const hex = z.string().regex(/^#[0-9A-F]{6}$/, 'couleur HEX en majuscules attendue (#RRGGBB)');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date AAAA-MM-JJ attendue');
const saison = z.string().regex(/^\d{4}-\d{4}$/, 'saison AAAA-AAAA attendue');
const note = z.number().int().min(1).max(100);

/** Les identifiants canoniques des franchises : ceux de `data/franchises.json`. */
export const idFranchise = z.string().regex(/^[a-z]+(?:-[a-z]+)*$/, 'identifiant de franchise en minuscules (kebab-case) attendu');

/** Les identifiants stables des joueurs du snapshot, sans nom réel. */
export const idJoueur = z.string().regex(/^j\d{4}$/, 'identifiant de joueur « j0001 » attendu');

export const schemaFranchise = z.looseObject({
  id: idFranchise,
  city: z.string().min(1),
  referenceClub: z.string().min(1),
  fictionalName: z.string().min(1),
  creativeTerritory: z.string().min(1),
  palette: z.strictObject({ primary: hex, secondary: hex, accent: hex, neutral: hex }),
  nameStatus: z.string(),
  nameClearance: z.string(),
  visualStatus: z.string(),
  historyMirror: z.looseObject({ status: z.string() }),
  playStyleMirror: z.looseObject({ status: z.string(), referenceSeason: saison }),
  playerMirror: z.looseObject({ status: z.string(), referenceSeason: saison }),
  identityFiles: z.array(z.string()).optional(),
  artDirectionStatus: z.string(),
  paletteStatus: z.literal('validated'),
  paletteNames: z.array(z.string().min(1)).length(4),
});

export const schemaRegistre = z.looseObject({
  schemaVersion: z.literal(3),
  updatedAt: date,
  snapshot: z.looseObject({ season: saison, date, status: z.literal('approved'), statisticsSeason: saison }),
  franchises: z.array(schemaFranchise).length(30),
});

const conversion = z.enum(['derived-rounded', 'source-provided']);
const taille = z.strictObject({
  sourceValue: z.string(),
  sourceUnit: z.literal('ft-in'),
  heightCm: z.number().int().min(150).max(250),
  conversionStatus: conversion,
});
const poids = z.strictObject({
  sourceValue: z.number().positive(),
  sourceUnit: z.enum(['lb', 'kg']),
  weightKg: z.number().int().min(50).max(180),
  conversionStatus: conversion,
});

export const schemaJoueur = z.strictObject({
  id: idJoueur,
  fictionalDisplayName: z.string().min(3),
  fictionalFirstName: z.string().min(1),
  fictionalLastName: z.string().min(1),
  fictionalSuffix: z.enum(['Jr.', 'Sr.', 'II', 'III', 'IV']).nullable(),
  fictionalInitials: z.string().regex(/^[A-Z]{2,5}$/),
  nameStatus: z.enum(['proposed-pending-review', 'validated']),
  jerseyNumber: z.string().regex(/^\d{1,2}$/),
  sourcePosition: z.enum(['G', 'F', 'C', 'G-F', 'F-G', 'F-C', 'C-F']),
  measurements: z.strictObject({ height: taille, weight: poids }),
  lastAttended: z.string().nullable(),
  country: z.string().min(2),
  sourcePlayerId: z.string().nullable(),
  rosterStatus: z.string(),
  ratings: z.looseObject({ overall: note, scale: z.literal(100), source: z.string(), status: z.string() }),
  attributes: z.strictObject({ technique: note, physical: note, mental: note, tactical: note, endurance: note, scale: z.literal(100) }),
  notes: z.strictObject({ archetype: z.string().optional() }).nullable(),
});

export const schemaEffectif = z.strictObject({
  schemaVersion: z.literal(2),
  datasetId: z.literal('basket-legends-rosters-2026-27'),
  snapshot: z.strictObject({ season: z.literal('2026-2027'), date: z.literal('2026-11-17'), timezone: z.string(), status: z.literal('approved') }),
  franchise: z.strictObject({ id: idFranchise, fictionalName: z.string(), referenceClub: z.string(), referenceAbbreviation: z.string() }),
  roster: z.looseObject({ status: z.string(), playerCount: z.number().int().positive() }),
  provenance: z.looseObject({ sourceType: z.string() }),
  units: z.looseObject({ canonical: z.literal('metric') }),
  players: z.array(schemaJoueur).min(1),
});

const listeParInitiale = z.record(z.string(), z.array(z.string().min(1)));
export const schemaBanques = z.looseObject({
  schemaVersion: z.literal(1),
  culturesParPays: z.record(z.string(), z.strictObject({ prenoms: z.string(), noms: z.string() })),
  cultures: z.record(z.string(), z.strictObject({ prenoms: listeParInitiale.optional(), noms: listeParInitiale.optional() })),
});

const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
export const schemaEmpreintes = z.looseObject({
  schemaVersion: z.literal(1),
  normalisation: z.string(),
  nomsComplets: z.array(sha256).min(1),
  nomsDeFamille: z.array(sha256).min(1),
});

export type Franchise = z.infer<typeof schemaFranchise>;
export type Registre = z.infer<typeof schemaRegistre>;
export type Joueur = z.infer<typeof schemaJoueur>;
export type Effectif = z.infer<typeof schemaEffectif>;
export type Banques = z.infer<typeof schemaBanques>;
export type Empreintes = z.infer<typeof schemaEmpreintes>;

// --- Tranche 1 : paramètres du match. ---

/** Les statuts de validation d'une règle (docs/03-basketball-rules/GAME_RULES.md § 8). */
export const statutRegle = z.enum(['not_started', 'researching', 'drafted', 'review_required', 'validated', 'implemented', 'tested']);

const regle = z.strictObject({ valeur: z.number(), unite: z.string().min(1), definition: z.string().min(1), reference: z.string().min(1) });
const entier = (min: number) => regle.extend({ valeur: z.number().int().min(min) });

/** data/regles/nba-<saison>.json : les règles NBA lues par le moteur, chacune avec sa référence au règlement. */
export const schemaRegles = z.strictObject({
  schemaVersion: z.literal(1),
  datasetId: z.string().regex(/^basket-legends-regles-nba-\d{4}-\d{2}$/),
  season: saison,
  league: z.literal('NBA'),
  status: statutRegle,
  source: z.looseObject({ title: z.string(), url: z.url(), edition: z.string(), verifiedAt: date.nullable() }),
  parametres: z.strictObject({
    joueursSurLeTerrain: entier(1),
    periodesReglementaires: entier(1),
    dureePeriodeSecondes: entier(60),
    dureeProlongationSecondes: entier(60),
    horlogeDePossessionSecondes: entier(5),
    horlogeApresRebondOffensifSecondes: entier(5),
    valeurPanierInterieur: entier(1),
    valeurPanierATroisPoints: entier(1),
    valeurLancerFranc: entier(1),
    lancersFrancsFauteSurTirInterieur: entier(1),
    lancersFrancsFauteSurTirATroisPoints: entier(1),
    lancersFrancsPanierAvecFaute: entier(1),
    lancersFrancsPenalite: entier(1),
    fautesPersonnellesExclusion: entier(1),
    rangFauteEquipePenalite: entier(1),
    rangFauteEquipePenaliteProlongation: entier(1),
    finDePeriodeSecondes: entier(0),
    rangFauteEquipeFinDePeriode: entier(1),
    horlogeMinimaleApresFauteDefensiveSecondes: entier(1),
    tempsMortsParMatch: entier(0),
    tempsMortsMaxQuatriemePeriode: entier(0),
    tempsMortsMaxFinDeMatch: entier(0),
    debutFinDeMatchTempsMortsSecondes: entier(0),
    tempsMortsParProlongation: entier(0),
    repereTempsMortObligatoire1Secondes: entier(0),
    repereTempsMortObligatoire2Secondes: entier(0),
    dureeTempsMortObligatoireSecondes: entier(0),
    dureeTempsMortSecondes: entier(0),
    horlogeEteinteSousSecondes: entier(0),
    tempsMinimalPourTirerSecondes: regle.extend({ valeur: z.number().min(0) }),
    ligneATroisPointsPieds: regle.extend({ valeur: z.number().positive() }),
    zoneRestreintePieds: regle.extend({ valeur: z.number().positive() }),
  }),
  possessionDebutDePeriode: z.strictObject({
    valeur: z.array(z.enum(['entre-deux', 'gagnant', 'perdant'])).min(1),
    definition: z.string().min(1),
    reference: z.string().min(1),
  }),
});

const proba = z.number().min(0).max(1);
const parTir = <T extends z.ZodType>(t: T) => z.strictObject({ cercle: t, miDistance: t, troisPoints: t });
const parGroupe = <T extends z.ZodType>(t: T) => z.strictObject({ meneur: t, ailier: t, interieur: t });
const positif = z.number().positive();
const effetRythme = z.strictObject({ facteurDuree: positif, pertes: z.number().min(-0.1).max(0.1), fatigue: positif });

/** data/moteur/match-v<n>.json : les réglages du modèle de match (non sourcés, à calibrer). */
export const schemaReglagesMatch = z.strictObject({
  schemaVersion: z.literal(1),
  datasetId: z.string().regex(/^basket-legends-moteur-match-v\d+$/),
  status: z.enum(['provisoire-non-calibre', 'calibre']),
  note: z.string(),
  possession: z.strictObject({ dureeMoyenneSecondes: positif, dureeEcartSecondes: positif, dureeMinimaleSecondes: positif, tempsRestantMinimalPourTirer: z.number().min(0) }),
  tirs: z.strictObject({
    repartition: parTir(proba),
    profilParGroupe: parGroupe(parTir(z.number().min(0))),
    reussiteDeBase: parTir(proba),
    sensibiliteParPoint: z.number().min(0),
    avantageDomicile: z.number(),
    usageEchelle: positif,
  }),
  lancersFrancs: z.strictObject({ reussiteDeBase: proba, sensibiliteParPoint: z.number().min(0), reussiteMin: proba, reussiteMax: proba }),
  pertesDeBalle: z.strictObject({ probabiliteDeBase: proba, sensibiliteParPoint: z.number().min(0), partInterceptions: proba }),
  fautes: z.strictObject({ surTirParType: parTir(proba), partPanierAvecFaute: proba, horsTirParPossession: proba }),
  rebonds: z.strictObject({ offensifDeBase: proba, sensibiliteParPoint: z.number().min(0), poidsParGroupe: parGroupe(positif), partRebondsDEquipe: proba }),
  passes: z.strictObject({ probabiliteSurPanier: proba, poidsParGroupe: parGroupe(positif) }),
  contres: z.strictObject({ probabiliteSurEchecParType: parTir(proba), poidsParGroupe: parGroupe(positif) }),
  fatigue: z.strictObject({
    perteParMinute: z.number().min(0),
    recuperationParMinute: z.number().min(0),
    seuilRemplacement: z.number().min(0).max(100),
    seuilRetour: z.number().min(0).max(100),
    malusParPointPerdu: z.number().min(0),
    effetEndurance: z.number().min(0).max(1),
  }),
  rotation: z.strictObject({ profondeur: z.number().int().min(5), relaisMinimalSecondes: z.number().min(0) }),
  tempsMorts: z.strictObject({ serieAdverseDeclencheur: z.number().int().min(1), bonusActionPreparee: z.number().min(0), recuperationParMinute: z.number().min(0) }),
  finDeMatch: z.strictObject({
    fauteVolontaireEcartMax: z.number().int().min(0),
    fauteVolontaireSecondesParPoint: z.number().min(0),
    fauteVolontaireSecondesMax: z.number().min(0),
    dureeFauteVolontaireSecondes: positif,
    gestionAvanceFraction: proba,
    presseEcartMin: z.number().int().min(1),
    presseDureeSecondes: positif,
    malusTirPresse: proba,
    partTroisEnRetardDeTrois: proba,
    margeDernierTirSecondes: positif,
  }),
  blessures: z.strictObject({
    probabiliteParMinute: proba,
    gravites: z.array(z.strictObject({ part: proba, matchsMin: z.number().int().min(1), matchsMax: z.number().int().min(1) })).min(1),
  }),
  // Tranche 5 : effets des plans de jeu et du défenseur direct (choix du modèle).
  plans: z.strictObject({
    rythme: z.strictObject({ lent: effetRythme, normal: effetRythme, rapide: effetRythme }),
    troisPoints: z.strictObject({ moins: positif, normal: positif, plus: positif }),
    zone: z.strictObject({
      repartition: parTir(positif),
      reussite: parTir(z.number().min(-0.2).max(0.2)),
      rebondOffensif: z.number().min(-0.2).max(0.2),
      pertes: z.number().min(-0.1).max(0.1),
    }),
  }),
  defenseurDirect: z.strictObject({ poids: proba, tailleCercleParCm: z.number().min(0) }),
  positions: z.strictObject({
    partTroisDansLesCoins: proba,
    distanceTroisDansLesCoinsPieds: positif,
    miDistanceParTranche: z.strictObject({ troisDix: proba, dixSeize: proba, seizeLigne: proba }),
  }),
});

export type Regles = z.infer<typeof schemaRegles>;
export type ReglagesMatchFichier = z.infer<typeof schemaReglagesMatch>;

// --- Tranche 2 : statistiques 2025-2026 et modèle de notes. ---

const entierPositif = z.number().int().min(0);
const minutes = z.number().min(0);
const lignesCommunes = {
  age: z.number().int().min(15).max(50),
  equipe: z.string().min(2),
  matchs: entierPositif,
  minutes,
  tirsReussis: entierPositif,
  tirsTentes: entierPositif,
  troisReussis: entierPositif,
  troisTentes: entierPositif,
  lancersReussis: entierPositif,
  lancersTentes: entierPositif,
  rebondsOffensifs: entierPositif,
  rebondsDefensifs: entierPositif,
  passes: entierPositif,
  interceptions: entierPositif,
  contres: entierPositif,
  pertes: entierPositif,
  fautes: entierPositif,
  points: entierPositif,
};
/** Les totaux d'une saison chez Basketball-Reference (saison régulière, playoffs). */
export const schemaTotauxSaison = z.strictObject({
  ...lignesCommunes,
  equipes: z.array(z.string().min(2)).min(1),
  poste: z.string().min(1),
  titularisations: entierPositif,
});
/** Les totaux du Play-In chez NBA.com (pas de titularisations ni de poste). */
export const schemaTotauxPlayIn = z.strictObject(lignesCommunes);

const source = z.strictObject({ fournisseur: z.string().min(1), titre: z.string().min(1), url: z.url(), perimetre: z.string().min(1) });

/** data/statistiques/2025-26/joueurs.json : totaux par joueur, sans nom réel ni identifiant de fournisseur. */
export const schemaStatistiquesJoueurs = z.strictObject({
  schemaVersion: z.literal(1),
  datasetId: z.literal('basket-legends-statistiques-joueurs-2025-26'),
  saison: saison,
  consulteLe: date,
  note: z.string(),
  sources: z.strictObject({
    saisonReguliere: source,
    playIn: source,
    playoffs: source,
    saison2024_25: source,
    draft2026: source,
    conditions: z.string().min(1),
  }),
  champs: z.record(z.string(), z.strictObject({ unite: z.string().min(1), definition: z.string().min(1) })),
  joueurs: z.record(
    idJoueur,
    z.strictObject({
      saisonReguliere: schemaTotauxSaison.optional(),
      playIn: schemaTotauxPlayIn.optional(),
      playoffs: schemaTotauxSaison.optional(),
      saison2024_25: schemaTotauxSaison.optional(),
      draft2026: z.strictObject({ choix: z.number().int().min(1).max(60) }).optional(),
    }),
  ),
});

const parMatch = z.number().positive();
/** data/statistiques/2025-26/ligue.json : moyennes de la ligue, cibles de la calibration du moteur. */
export const schemaStatistiquesLigue = z.strictObject({
  schemaVersion: z.literal(1),
  datasetId: z.literal('basket-legends-statistiques-ligue-2025-26'),
  saison: saison,
  competition: z.string(),
  consulteLe: date,
  sources: z.record(z.string(), z.strictObject({ fournisseur: z.string(), titre: z.string(), url: z.url() })),
  parEquipeParMatch: z.strictObject({
    unite: z.string(),
    points: parMatch,
    tirsReussis: parMatch,
    tirsTentes: parMatch,
    troisReussis: parMatch,
    troisTentes: parMatch,
    lancersReussis: parMatch,
    lancersTentes: parMatch,
    rebondsOffensifs: parMatch,
    rebondsDefensifs: parMatch,
    passes: parMatch,
    interceptions: parMatch,
    contres: parMatch,
    pertes: parMatch,
    fautes: parMatch,
  }),
  pourcentages: z.strictObject({ tirs: proba, trois: proba, lancers: proba }),
  avance: z.record(z.string(), z.strictObject({ valeur: z.number(), definition: z.string() })),
  tirsParDistance: z.looseObject({
    zero_trois_pieds: z.strictObject({ part: proba, reussite: proba }),
    trois_dix_pieds: z.strictObject({ part: proba, reussite: proba }),
    dix_seize_pieds: z.strictObject({ part: proba, reussite: proba }),
    seize_pieds_ligne: z.strictObject({ part: proba, reussite: proba }),
    trois_points: z.strictObject({ part: proba, reussite: proba }),
    partTroisDansLesCoins: proba.optional(),
    reussiteTroisDansLesCoins: proba.optional(),
  }),
  domicile: z.strictObject({ victoires: entierPositif, defaites: entierPositif, definition: z.string() }),
});

const ancrages = z.array(z.tuple([z.number(), z.number()])).min(2);
const poidsIndice = z.record(z.string(), z.number());
/** data/modeles/notes-v<n>.json : les paramètres du modèle de notes. */
export const schemaParametresNotes = z.strictObject({
  schemaVersion: z.literal(1),
  datasetId: z.string().regex(/^basket-legends-modele-notes-v\d+$/),
  version: z.string().regex(/^notes-v\d+$/),
  status: z.enum(['proposition', 'valide']),
  note: z.string(),
  statistiques: z.string().min(1),
  retrecissement: z.strictObject({
    minutesDePrior: positif,
    tentativesDePriorTirs: positif,
    tentativesDePriorTrois: positif,
    tentativesDePriorLancers: positif,
    minutesPourLaReference: z.number().min(0),
  }),
  poids: z.strictObject({ globale: poidsIndice, technique: poidsIndice, physique: poidsIndice, mental: poidsIndice, tactique: poidsIndice, endurance: poidsIndice }),
  ancrages: z.strictObject({ globale: ancrages, attributs: ancrages }),
  sansStatistique: z.strictObject({ parRangDeDraft: ancrages, nonDrafte: z.number().int().min(40).max(67) }),
  bornes: z.strictObject({ min: z.number().int().min(1), max: z.number().int().max(100) }),
});

export type TotauxSaison = z.infer<typeof schemaTotauxSaison>;
export type StatistiquesJoueurs = z.infer<typeof schemaStatistiquesJoueurs>;
export type StatistiquesLigue = z.infer<typeof schemaStatistiquesLigue>;
export type ParametresNotes = z.infer<typeof schemaParametresNotes>;

// --- Tranche 4 : structure de la saison. ---

const sourceLigue = z.strictObject({ fournisseur: z.string().min(1), url: z.url(), niveau: z.enum(['primaire', 'secondaire']), consulteLe: date });
const critere = z.enum([
  'confrontations',
  'vainqueur-division',
  'bilan-division',
  'bilan-conference',
  'bilan-qualifiables-conference',
  'bilan-qualifiables-autre-conference',
  'difference-points',
]);

/** data/ligue/saison-<saison>.json : conférences, calendrier, Play-In, playoffs, départages, récompenses, All-Star. */
export const schemaSaisonLigue = z.strictObject({
  schemaVersion: z.literal(1),
  datasetId: z.string().regex(/^basket-legends-ligue-\d{4}-\d{2}$/),
  saison: saison,
  note: z.string(),
  conferences: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        nom: z.string().min(1),
        divisions: z.array(z.strictObject({ id: z.string().min(1), nom: z.string().min(1), franchises: z.array(idFranchise).min(1) })).min(1),
      }),
    )
    .length(2),
  sourceAlignement: sourceLigue,
  calendrier: z.strictObject({
    matchsParEquipe: z.number().int().positive(),
    contreChaqueAdversaireDeDivision: z.number().int().min(0),
    adversairesDeConferenceA4Matchs: z.number().int().min(0),
    adversairesDeConferenceA3Matchs: z.number().int().min(0),
    contreChaqueAdversaireDeLAutreConference: z.number().int().min(0),
    premierJour: date,
    dernierJour: date,
    note: z.string(),
    sources: z.array(sourceLigue).min(1),
  }),
  playIn: z.strictObject({
    qualifiesDirects: z.number().int().min(1),
    rangsDuPlayIn: z.tuple([z.number().int(), z.number().int()]),
    note: z.string(),
    source: sourceLigue,
  }),
  playoffs: z.strictObject({
    equipesParConference: z.number().int().min(2),
    victoiresPourGagnerUneSerie: z.number().int().min(1),
    appariementsPremierTour: z.array(z.tuple([z.number().int(), z.number().int()])).min(1),
    receveurParMatch: z.array(z.enum(['haut', 'bas'])).min(1),
    note: z.string(),
    sources: z.array(sourceLigue).min(1),
  }),
  departages: z.strictObject({
    deuxEquipes: z.array(critere).min(1),
    plusieursEquipes: z.array(critere).min(1),
    dernierRecours: z.literal('tirage'),
    note: z.string(),
    source: sourceLigue,
  }),
  recompenses: z.strictObject({
    matchsMinimum: z.number().int().min(0),
    minutesPourCompter: z.number().min(0),
    concernees: z.array(z.string()),
    sansMinimum: z.array(z.string()),
    equipesAllNba: z.number().int().min(1),
    joueursParEquipeAllNba: z.number().int().min(1),
    note: z.string(),
    sources: z.array(sourceLigue).min(1),
  }),
  allStar: z.strictObject({
    titulairesParConference: z.number().int().min(1),
    remplacantsParConference: z.number().int().min(0),
    poidsDuVote: z.strictObject({ fans: proba, joueurs: proba, medias: proba }),
    sansPoste: z.boolean(),
    partDeLaSaison: proba,
    note: z.string(),
    source: sourceLigue,
  }),
});
export type SaisonLigue = z.infer<typeof schemaSaisonLigue>;

// --- Tranche 6 : convention collective (CBA) et contrats. ---

const sourceContrat = z.strictObject({
  fournisseur: z.string().min(1),
  titre: z.string().min(1),
  url: z.url(),
  niveau: z.enum(['primaire', 'secondaire']),
  consulteLe: date,
});
const parametreCba = <T extends z.ZodType>(valeur: T) =>
  z.strictObject({ valeur, unite: z.string().min(1), definition: z.string().min(1), source: sourceContrat });
const dollars = z.number().int().min(0);

/** data/cba/nba-AAAA-AA.json : les paramètres de la CBA d'une saison, chacun sourcé. */
export const schemaCba = z.strictObject({
  schemaVersion: z.literal(1),
  datasetId: z.string().regex(/^basket-legends-cba-nba-\d{4}-\d{2}$/),
  saison,
  note: z.string(),
  parametres: z.strictObject({
    plafondSalarial: parametreCba(dollars),
    seuilTaxe: parametreCba(dollars),
    premierApron: parametreCba(dollars),
    deuxiemeApron: parametreCba(dollars),
    masseMinimale: parametreCba(dollars),
    midLevelNonContribuable: parametreCba(dollars),
    midLevelContribuable: parametreCba(dollars),
    midLevelEspace: parametreCba(dollars),
    exceptionBiannuelle: parametreCba(dollars),
    salaireMaximum: parametreCba(
      z
        .array(
          z.strictObject({
            ancienneteMin: z.number().int().min(0),
            ancienneteMax: z.number().int().min(0).nullable(),
            partDuPlafond: proba,
            montant: dollars,
          }),
        )
        .min(1),
    ),
    salaireMinimum: parametreCba(z.array(dollars).min(1)),
    minimumImputeVeteran: parametreCba(dollars),
    salaireTwoWay: parametreCba(dollars),
    matchsMaxTwoWay: parametreCba(z.number().int().min(0)),
    twoWayEnPhaseFinale: parametreCba(z.boolean()),
    contratsStandardMax: parametreCba(z.number().int().min(1)),
    contratsTwoWayMax: parametreCba(z.number().int().min(0)),
    taxe: parametreCba(
      z.strictObject({
        largeurTranche: dollars,
        taux: z.array(z.number().positive()).min(1),
        tauxRecidiviste: z.array(z.number().positive()).min(1),
        hausseParTrancheSuivante: z.number().min(0),
      }),
    ),
  }),
  recoupements: z.array(sourceContrat),
});

const saisonContrat = z.string().regex(/^\d{4}-\d{2}$/, 'saison « 2026-27 » attendue');
export const schemaContrat = z.strictObject({
  type: z.enum(['standard', 'two-way', 'non-releve']),
  salaires: z.array(z.strictObject({ saison: saisonContrat, montant: dollars, option: z.enum(['joueur', 'equipe']).optional() })),
  garanti: dollars.nullable(),
  anciennete: z.number().int().min(0).max(30).nullable(),
  draft: z.strictObject({ annee: z.number().int(), tour: z.number().int().min(1).max(2), rang: z.number().int().min(1).max(60) }).nullable(),
  sources: z.array(z.string().min(1)),
  note: z.string().optional(),
});

/** data/contrats/AAAA-AA.json : le contrat de chaque joueur et la situation salariale publiée de chaque équipe. */
export const schemaContrats = z.strictObject({
  schemaVersion: z.literal(1),
  datasetId: z.string().regex(/^basket-legends-contrats-\d{4}-\d{2}$/),
  saison,
  consulteLe: date,
  note: z.string(),
  sources: z.record(z.string(), z.union([sourceContrat, z.string()])),
  champs: z.record(z.string(), z.strictObject({ unite: z.string().min(1), definition: z.string().min(1) })),
  bilan: z.strictObject({
    standard: z.number().int().min(0),
    twoWay: z.number().int().min(0),
    nonReleve: z.number().int().min(0),
    lignesSansJoueurDuJeu: z.number().int().min(0),
    conflits: z.array(z.string()),
  }),
  joueurs: z.record(idJoueur, schemaContrat),
  equipes: z.record(
    z.string(),
    z.strictObject({
      massePubliee: dollars,
      taxePubliee: dollars,
      recidiviste: z.boolean(),
      plafondStrict: z.enum(['premier', 'deuxieme']).nullable(),
      autresCharges: z.number().int(),
    }),
  ),
});

export type CbaFichier = z.infer<typeof schemaCba>;
export type ContratsFichier = z.infer<typeof schemaContrats>;
