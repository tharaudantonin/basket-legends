// Tranche 4 : passage des données de référence au contexte de la ligue (packages/league).
import type { ReglagesMatch, ReglesMatch } from '@basket-legends/engine';
import type { ContexteLigue, DonneesCarriere, DonneesDraft, DonneesSalariales, ParametresCba, StructureLigue, Univers } from '@basket-legends/league';
import { equipeDuMatch } from './match';
import type { CbaFichier, ContratsFichier, Effectif, SaisonLigue, StatistiquesJoueurs } from './schemas';

/** Tranche 6 : les valeurs seules des paramètres de la CBA (les sources restent dans le fichier). */
export function parametresDeLaCba(f: CbaFichier): ParametresCba {
  return Object.fromEntries(Object.entries(f.parametres).map(([cle, p]) => [cle, p.valeur])) as unknown as ParametresCba;
}

/** Tranche 6 : CBA et contrats d'une saison, pour la ligue et l'interface. */
export function donneesSalariales(cba: CbaFichier, contrats: ContratsFichier): DonneesSalariales {
  if (cba.saison !== contrats.saison) throw new Error(`CBA ${cba.saison} et contrats ${contrats.saison} : saisons différentes.`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const joueurs = Object.fromEntries(Object.entries(contrats.joueurs).map(([id, { sources, ...c }]) => [id, c]));
  return { saison: cba.saison, cba: parametresDeLaCba(cba), contrats: joueurs, equipes: contrats.equipes };
}

/** La structure de la saison, sans les sources ni les notes (elles restent dans le fichier). */
export function structureDeLaLigue(f: SaisonLigue): StructureLigue {
  return {
    saison: f.saison,
    conferences: f.conferences,
    calendrier: f.calendrier,
    playIn: { qualifiesDirects: f.playIn.qualifiesDirects, rangsDuPlayIn: f.playIn.rangsDuPlayIn },
    playoffs: f.playoffs,
    departages: f.departages,
    recompenses: f.recompenses,
    allStar: f.allStar,
  };
}

/** Le contexte complet d'une saison : structure, 30 équipes, règles, réglages, recrues et points de la saison passée. */
export function contexteDeLaLigue(
  saison: SaisonLigue,
  effectifs: readonly Effectif[],
  regles: ReglesMatch,
  reglages: ReglagesMatch,
  stats: StatistiquesJoueurs,
  salaires: DonneesSalariales,
  draft?: DonneesDraft,
  carriere?: { univers: Univers; donnees: DonneesCarriere },
): ContexteLigue {
  const equipes = Object.fromEntries(effectifs.map((e) => [e.franchise.id, equipeDuMatch(e)]));
  const recrues = Object.entries(stats.joueurs)
    .filter(([, s]) => s.draft2026)
    .map(([id]) => id);
  const pointsParMatchPrecedents = Object.fromEntries(
    Object.entries(stats.joueurs)
      .filter(([, s]) => s.saisonReguliere?.matchs)
      .map(([id, s]) => [id, s.saisonReguliere!.points / s.saisonReguliere!.matchs]),
  );
  return { structure: structureDeLaLigue(saison), equipes, regles, reglages, recrues, pointsParMatchPrecedents, salaires,
    ...(draft ? { draft } : {}),
    ...(carriere ? { univers: carriere.univers, carriere: carriere.donnees } : {}),
  };
}
