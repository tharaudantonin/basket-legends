// Tranche 6 : contrats et convention collective (CBA). Masse salariale, niveau salarial (plafond, taxe, aprons), taxe de
// luxe, salaires minimum et maximum, exceptions auxquelles une équipe a droit, contrôle d'une signature et des effectifs.
//
// Aucune valeur de la CBA n'est écrite ici : tout vient de data/cba/ (une valeur par paramètre, chacune sourcée). Les
// contrats viennent de data/contrats/. Les fonctions sont pures et ne lisent que ces données.

/** Les paramètres de la CBA d'une saison (data/cba/, sans les sources). */
export interface ParametresCba {
  plafondSalarial: number;
  seuilTaxe: number;
  premierApron: number;
  deuxiemeApron: number;
  masseMinimale: number;
  midLevelNonContribuable: number;
  midLevelContribuable: number;
  midLevelEspace: number;
  exceptionBiannuelle: number;
  salaireMaximum: { ancienneteMin: number; ancienneteMax: number | null; partDuPlafond: number; montant: number }[];
  salaireMinimum: number[];
  minimumImputeVeteran: number;
  salaireTwoWay: number;
  matchsMaxTwoWay: number;
  twoWayEnPhaseFinale: boolean;
  contratsStandardMax: number;
  contratsTwoWayMax: number;
  taxe: { largeurTranche: number; taux: number[]; tauxRecidiviste: number[]; hausseParTrancheSuivante: number };
  // Tranche 9 : échanges, droits de Bird, agents libres restreints, ballottage, choix futurs, plafonds à venir.
  margeEchange: { montant: number; plafondDeReference: number };
  partEchangeBasse: number;
  partEchangeHaute: number;
  supplementEchange: number;
  partEchangeApron: number;
  agregationInterditeDeuxiemeApron: boolean;
  saisonsBird: number;
  saisonsEarlyBird: number;
  dureeMaxBird: number;
  dureeMaxAutre: number;
  hausseMaxBird: number;
  hausseMaxAutre: number;
  earlyBird: { partDuPrecedent: number; dureeMin: number };
  nonBird: { partDuPrecedent: number; partDuMinimum: number };
  agentLibreRestreint: {
    ancienneteMax: number;
    partVeteran: number;
    minimumPlus: number;
    partRookiePremierChoix: number;
    partRookieDernierChoix: number;
    delaiAlignementJours: number;
  };
  ballottage: { delaiJours: number; etalementFacteur: number; etalementPlus: number; etalementGarantiMin: number };
  choixFuturs: { anneesMax: number; stepien: boolean; gelDeuxiemeApronAnnees: number };
  delaiEchangeApresSignature: { mois: number; dateMin: string };
  croissancePlafondMax: number;
  estimationsPlafond: { saison: string; plafondSalarial: number; seuilTaxe: number }[];
  // Tranche 10 : contrats en cours de saison (docs/CLUB.md § 5).
  dixJours: {
    premierJour: string;
    jours: number;
    matchsMin: number;
    joursSaison: number;
    parJoueurEtEquipe: number;
    joursRestantsMin: number;
  };
  hardship: { blessesMin: number; matchsManquesMin: number; joursRestantsMin: number };
  twoWayEnSaison: { dateLimiteSignature: string; joursSaison: number; matchsEquipeIncomplete: number };
}

export interface ContratJoueur {
  type: 'standard' | 'two-way' | 'non-releve';
  salaires: { saison: string; montant: number; option?: 'joueur' | 'equipe' }[];
  garanti: number | null;
  /** Saisons depuis la première saison NBA (approximation des années d'expérience de la CBA). */
  anciennete: number | null;
  draft: { annee: number; tour: number; rang: number } | null;
  note?: string;
  /** Tranche 9 : horloge de Bird (saisons avec l'équipe sans en changer comme agent libre). */
  saisonsAvecEquipe?: number;
  saisonsAvecEquipeStatut?: 'releve' | 'approximation';
  /** Tranche 9 : date de signature comme agent libre (délai avant de pouvoir l'échanger). */
  signeLe?: string;
  /** Tranche 10 : contrat de 10 jours (fin, rang du contrat avec cette équipe, exception de difficulté). */
  dixJours?: { fin: string; numero: number; hardship: boolean };
  /** Tranche 10 : limite de matchs d'un two-way signé en cours de saison (au prorata). */
  limiteMatchs?: number;
}

/** La situation publiée d'une équipe au relevé (masse, taxe, récidiviste, plafond strict) et ce que les contrats n'expliquent pas. */
export interface SituationPubliee {
  massePubliee: number;
  taxePubliee: number;
  recidiviste: boolean;
  /** Plafond strict déjà déclenché par une opération de l'intersaison (premier ou second apron). */
  plafondStrict: 'premier' | 'deuxieme' | null;
  /** Argent mort, écarts entre salaire et montant imputé : masse publiée moins la somme des contrats de l'effectif. */
  autresCharges: number;
}

export interface DonneesSalariales {
  saison: string;
  cba: ParametresCba;
  contrats: Record<string, ContratJoueur>;
  equipes: Record<string, SituationPubliee>;
}

export type NiveauSalarial = 'sous-plafond' | 'au-dessus-du-plafond' | 'taxe' | 'premier-apron' | 'deuxieme-apron';

export const LIBELLES_NIVEAU: Record<NiveauSalarial, string> = {
  'sous-plafond': 'Sous le plafond',
  'au-dessus-du-plafond': 'Au-dessus du plafond',
  taxe: 'Au-dessus du seuil de taxe',
  'premier-apron': 'Au-dessus du premier apron',
  'deuxieme-apron': 'Au-dessus du second apron',
};

/** Le salaire d'un joueur pour une saison (0 pour un two-way : il ne compte pas dans la masse ; 0 si non relevé). */
export function salaireDeLaSaison(c: ContratJoueur | undefined, saison: string): number {
  if (!c || c.type !== 'standard') return 0;
  return c.salaires.find((s) => s.saison === saison)?.montant ?? 0;
}

/** La saison au format des contrats (« 2026-2027 » → « 2026-27 »). */
export const saisonCourte = (saison: string): string => (saison.length === 9 ? `${saison.slice(0, 5)}${saison.slice(7)}` : saison);

export function niveauSalarial(P: ParametresCba, masse: number): NiveauSalarial {
  if (masse > P.deuxiemeApron) return 'deuxieme-apron';
  if (masse > P.premierApron) return 'premier-apron';
  if (masse > P.seuilTaxe) return 'taxe';
  if (masse > P.plafondSalarial) return 'au-dessus-du-plafond';
  return 'sous-plafond';
}

/** Le taux de la tranche n (0 = la première) : barème, puis + hausse par tranche au-delà. */
function tauxDeTranche(P: ParametresCba, n: number, recidiviste: boolean): number {
  const bareme = recidiviste ? P.taxe.tauxRecidiviste : P.taxe.taux;
  if (n < bareme.length) return bareme[n]!;
  return bareme[bareme.length - 1]! + (n - bareme.length + 1) * P.taxe.hausseParTrancheSuivante;
}

/** La taxe de luxe due pour une masse (dollars), au barème normal ou récidiviste. */
export function taxeDeLuxe(P: ParametresCba, masse: number, recidiviste: boolean): number {
  let depassement = masse - P.seuilTaxe;
  let taxe = 0;
  for (let n = 0; depassement > 0; n++) {
    const tranche = Math.min(depassement, P.taxe.largeurTranche);
    taxe += tranche * tauxDeTranche(P, n, recidiviste);
    depassement -= tranche;
  }
  return Math.round(taxe);
}

export function salaireMinimum(P: ParametresCba, anciennete: number): number {
  const m = P.salaireMinimum;
  return m[Math.min(Math.max(0, anciennete), m.length - 1)]!;
}

export function salaireMaximum(P: ParametresCba, anciennete: number): number {
  const palier = P.salaireMaximum.find((x) => anciennete >= x.ancienneteMin && (x.ancienneteMax === null || anciennete <= x.ancienneteMax));
  return (palier ?? P.salaireMaximum[P.salaireMaximum.length - 1]!).montant;
}

/** Le plafond strict d'une équipe : celui déjà déclenché (situation publiée), en dollars. */
function plafondStrictEnDollars(P: ParametresCba, s: SituationPubliee | undefined): number {
  if (s?.plafondStrict === 'premier') return P.premierApron;
  if (s?.plafondStrict === 'deuxieme') return P.deuxiemeApron;
  return Infinity;
}

export type MoyenDeSignature = 'espace' | 'mid-level' | 'mid-level-contribuable' | 'mid-level-espace' | 'biannuelle' | 'minimum';

export const LIBELLES_MOYEN: Record<MoyenDeSignature, string> = {
  espace: 'Espace salarial',
  'mid-level': 'Mid-level (non contribuable)',
  'mid-level-contribuable': 'Mid-level contribuable',
  'mid-level-espace': 'Mid-level pour équipe sous le plafond',
  biannuelle: 'Exception bi-annuelle',
  minimum: 'Salaire minimum',
};

export interface Exception {
  moyen: MoyenDeSignature;
  /** Salaire de première saison au plus, compte tenu de la masse et des plafonds stricts. */
  montantMax: number;
  /** Plafond strict que l'opération déclenche (null : aucun). */
  declenche: 'premier' | 'deuxieme' | null;
}

/**
 * Les moyens de signer auxquels une équipe a droit selon sa masse et son plafond strict. L'usage déjà fait de chaque
 * exception pendant la saison n'est pas relevé : une exception listée ici est un droit, pas un solde.
 */
export function exceptionsDisponibles(P: ParametresCba, masse: number, publiee?: SituationPubliee): Exception[] {
  const strict = plafondStrictEnDollars(P, publiee);
  const sous = (limite: number) => Math.max(0, Math.min(limite, strict) - masse);
  const liste: Exception[] = [];
  if (masse < P.plafondSalarial) {
    liste.push({ moyen: 'espace', montantMax: sous(P.plafondSalarial), declenche: null });
    liste.push({ moyen: 'mid-level-espace', montantMax: Math.min(P.midLevelEspace, sous(Infinity)), declenche: null });
  } else {
    if (publiee?.plafondStrict !== 'deuxieme' && masse < P.premierApron)
      liste.push({ moyen: 'mid-level', montantMax: Math.min(P.midLevelNonContribuable, sous(P.premierApron)), declenche: 'premier' });
    if (masse < P.deuxiemeApron)
      liste.push({
        moyen: 'mid-level-contribuable',
        montantMax: Math.min(P.midLevelContribuable, sous(P.deuxiemeApron)),
        declenche: 'deuxieme',
      });
    if (masse < P.premierApron)
      liste.push({ moyen: 'biannuelle', montantMax: Math.min(P.exceptionBiannuelle, sous(P.premierApron)), declenche: 'premier' });
  }
  liste.push({ moyen: 'minimum', montantMax: P.salaireMinimum[P.salaireMinimum.length - 1]!, declenche: null });
  return liste.filter((e) => e.montantMax > 0);
}

export interface SituationEquipe {
  equipe: string;
  masse: number;
  /** Somme des salaires des contrats standard de l'effectif. */
  contrats: number;
  autresCharges: number;
  espace: number;
  niveau: NiveauSalarial;
  taxe: number;
  recidiviste: boolean;
  plafondStrict: 'premier' | 'deuxieme' | null;
  effectif: { standard: number; twoWay: number; nonReleve: number };
  exceptions: Exception[];
}

/** La situation salariale d'une équipe, à partir des joueurs de son effectif. */
export function situationEquipe(D: DonneesSalariales, equipe: string, joueurs: readonly string[]): SituationEquipe {
  const P = D.cba;
  const saison = saisonCourte(D.saison);
  const publiee = D.equipes[equipe];
  const contrats = joueurs.reduce((s, j) => s + salaireDeLaSaison(D.contrats[j], saison), 0);
  const autresCharges = publiee?.autresCharges ?? 0;
  const masse = contrats + autresCharges;
  // Tranche 10 : un contrat de 10 jours signé grâce à l'exception de difficulté (hardship) ne prend pas de place parmi les 15.
  const compter = (t: ContratJoueur['type']) =>
    joueurs.filter((j) => D.contrats[j]?.type === t && !D.contrats[j]?.dixJours?.hardship).length;
  return {
    equipe,
    masse,
    contrats,
    autresCharges,
    espace: P.plafondSalarial - masse,
    niveau: niveauSalarial(P, masse),
    taxe: taxeDeLuxe(P, masse, publiee?.recidiviste ?? false),
    recidiviste: publiee?.recidiviste ?? false,
    plafondStrict: publiee?.plafondStrict ?? null,
    effectif: { standard: compter('standard'), twoWay: compter('two-way'), nonReleve: compter('non-releve') },
    exceptions: exceptionsDisponibles(P, masse, publiee),
  };
}

/** Une signature à contrôler : salaire de première saison, ancienneté du joueur, moyen utilisé. */
export interface DemandeSignature {
  type: 'standard' | 'two-way';
  salaire: number;
  anciennete: number;
  moyen: MoyenDeSignature;
  /** Durée en saisons (pour le minimum d'un vétéran signé pour un an). */
  duree: number;
}

export interface VerdictSignature {
  autorise: boolean;
  /** Montant imputé sur la masse salariale. */
  impute: number;
  masseApres: number;
  motifs: string[];
}

const millions = (x: number) => `${(x / 1e6).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} M$`;

/** Contrôle une signature selon la CBA : effectif, minimum et maximum, moyen de signature, plafond strict. */
export function verifierSignature(D: DonneesSalariales, s: SituationEquipe, d: DemandeSignature): VerdictSignature {
  const P = D.cba;
  const motifs: string[] = [];
  if (d.type === 'two-way') {
    if (s.effectif.twoWay >= P.contratsTwoWayMax) motifs.push(`Déjà ${P.contratsTwoWayMax} contrats two-way.`);
    return { autorise: !motifs.length, impute: 0, masseApres: s.masse, motifs };
  }
  if (s.effectif.standard >= P.contratsStandardMax) motifs.push(`Déjà ${P.contratsStandardMax} contrats standard.`);
  const min = salaireMinimum(P, d.anciennete);
  const max = salaireMaximum(P, d.anciennete);
  if (d.salaire < min) motifs.push(`Salaire sous le minimum de ${millions(min)} pour ${d.anciennete} an(s) d'expérience.`);
  if (d.salaire > max) motifs.push(`Salaire au-dessus du maximum de ${millions(max)} pour ${d.anciennete} an(s) d'expérience.`);
  const veteranAuMinimum = d.moyen === 'minimum' && d.duree === 1 && d.anciennete >= 3;
  const impute = veteranAuMinimum ? Math.min(d.salaire, P.minimumImputeVeteran) : d.salaire;
  const masseApres = s.masse + impute;
  const droit = s.exceptions.find((e) => e.moyen === d.moyen);
  if (d.moyen === 'minimum') {
    if (d.salaire !== min) motifs.push(`Au minimum, le salaire doit être exactement ${millions(min)}.`);
  } else if (!droit) motifs.push(`${LIBELLES_MOYEN[d.moyen]} : l'équipe n'y a pas droit (${LIBELLES_NIVEAU[s.niveau].toLowerCase()}).`);
  else if (d.salaire > droit.montantMax) motifs.push(`${LIBELLES_MOYEN[d.moyen]} : ${millions(droit.montantMax)} au plus.`);
  const strict = s.plafondStrict === 'premier' ? P.premierApron : s.plafondStrict === 'deuxieme' ? P.deuxiemeApron : Infinity;
  if (masseApres > strict) motifs.push(`Plafond strict : la masse passerait à ${millions(masseApres)}, au-delà de ${millions(strict)}.`);
  return { autorise: !motifs.length, impute, masseApres, motifs };
}

/** Contrôle l'effectif et la masse d'une équipe (erreurs bloquantes ; avertissements pour les données manquantes). */
export function controlerEquipe(D: DonneesSalariales, s: SituationEquipe): { erreurs: string[]; avertissements: string[] } {
  const P = D.cba;
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  if (s.effectif.standard > P.contratsStandardMax)
    erreurs.push(`${s.equipe} : ${s.effectif.standard} contrats standard (${P.contratsStandardMax} au plus).`);
  if (s.effectif.twoWay > P.contratsTwoWayMax)
    erreurs.push(`${s.equipe} : ${s.effectif.twoWay} contrats two-way (${P.contratsTwoWayMax} au plus).`);
  const strict = s.plafondStrict === 'premier' ? P.premierApron : s.plafondStrict === 'deuxieme' ? P.deuxiemeApron : Infinity;
  // La situation publiée au relevé est admise telle quelle (une source peut l'avoir mal décrite) ; toute hausse au-delà
  // du plafond strict est une erreur.
  const publiee = D.equipes[s.equipe]?.massePubliee ?? 0;
  if (s.masse > Math.max(strict, publiee)) erreurs.push(`${s.equipe} : masse au-dessus de son plafond strict.`);
  else if (s.masse > strict)
    avertissements.push(`${s.equipe} : masse publiée au-dessus de son plafond strict (à vérifier dans la source).`);
  if (s.effectif.nonReleve) avertissements.push(`${s.equipe} : ${s.effectif.nonReleve} joueur(s) sans contrat relevé.`);
  if (s.masse < P.masseMinimale) avertissements.push(`${s.equipe} : masse sous le minimum ; l'équipe versera la différence à ses joueurs.`);
  return { erreurs, avertissements };
}
