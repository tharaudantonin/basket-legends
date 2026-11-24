// Tranche 1 : passage des données de référence (validées par Zod) aux contrats du moteur de match.
import { composerEquipe, groupeDuPoste, type EquipeDuMatch, type JoueurDuMatch, type ReglagesMatch, type ReglesMatch } from '@basket-legends/engine';
import type { Effectif, Joueur, ReglagesMatchFichier, Regles } from './schemas';

/** Les valeurs seules des règles (les sources restent dans le fichier). */
export function valeursDesRegles(r: Regles): ReglesMatch {
  const valeurs = Object.fromEntries(Object.entries(r.parametres).map(([cle, p]) => [cle, p.valeur])) as Omit<ReglesMatch, 'possessionDebutDePeriode'>;
  return { ...valeurs, possessionDebutDePeriode: r.possessionDebutDePeriode.valeur };
}

/** Les réglages du modèle, sans l'en-tête du fichier. */
export function reglagesDuMoteur(f: ReglagesMatchFichier): ReglagesMatch {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { schemaVersion, datasetId, status, note, ...reglages } = f;
  return reglages;
}

export function joueurDuMatch(j: Joueur): JoueurDuMatch {
  return {
    id: j.id,
    nom: j.fictionalDisplayName,
    numero: j.jerseyNumber,
    poste: j.sourcePosition,
    groupe: groupeDuPoste(j.sourcePosition),
    note: j.ratings.overall,
    technique: j.attributes.technique,
    physique: j.attributes.physical,
    mental: j.attributes.mental,
    tactique: j.attributes.tactical,
    endurance: j.attributes.endurance,
    tailleCm: j.measurements.height.heightCm,
  };
}

/** L'équipe composée par le staff à partir d'un effectif. */
export function equipeDuMatch(e: Effectif): EquipeDuMatch {
  return composerEquipe(e.franchise.id, e.franchise.fictionalName, e.players.map(joueurDuMatch));
}
