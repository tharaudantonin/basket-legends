// Tranche 4 : passage des données de référence au contexte de la ligue (packages/league).
import type { ReglagesMatch, ReglesMatch } from '@basket-legends/engine';
import type { ContexteLigue, StructureLigue } from '@basket-legends/league';
import { equipeDuMatch } from './match';
import type { Effectif, SaisonLigue, StatistiquesJoueurs } from './schemas';

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
  return { structure: structureDeLaLigue(saison), equipes, regles, reglages, recrues, pointsParMatchPrecedents };
}
