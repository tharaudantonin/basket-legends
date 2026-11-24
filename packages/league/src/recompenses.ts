// Tranche 4 : All-Star Game (vote simulé) et récompenses de fin de saison.
//
// Les votes et les jurys sont simulés par des formules explicites : rang pondéré fans 50 %, joueurs 25 %, médias 25 %
// pour les titulaires du All-Star Game, choix des entraîneurs pour les remplaçants (data/ligue/saison-2026-27.json).
// Les récompenses suivent la règle des 65 matchs (au moins 20 minutes) pour le MVP, le défenseur, la progression et
// les équipes All-NBA. Chaque « avis » ajoute un petit écart déterministe (graine de la saison) pour que deux jurys ne
// votent pas exactement pareil.
import { creerHasard } from '@basket-legends/engine';
import { appartenances, pctBilan } from './classement';
import { gameScoreParMatch, parMatch } from './statistiques';
import type { Bilan, ContexteLigue, EtatSaison, LigneSaison, Palmares } from './types';

const tactiqueDe = (ctx: ContexteLigue, id: string): number =>
  Object.values(ctx.equipes)
    .flatMap((e) => e.joueurs)
    .find((j) => j.id === id)?.tactique ?? 60;

const noteDe = (ctx: ContexteLigue, id: string): number => {
  for (const e of Object.values(ctx.equipes)) {
    const j = e.joueurs.find((x) => x.id === id);
    if (j) return j.note;
  }
  return 60;
};

/** Rang (0 = premier) de chaque joueur selon un score décroissant. */
function rangs(ids: string[], score: (id: string) => number): Record<string, number> {
  const tries = [...ids].sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1));
  return Object.fromEntries(tries.map((id, i) => [id, i]));
}

/** Sélection du All-Star Game : titulaires par vote pondéré, remplaçants par les entraîneurs, sans poste. */
export function selectionnerAllStars(
  ctx: ContexteLigue,
  etat: EtatSaison,
  bilans: Record<string, Bilan>,
): { titulaires: Record<string, string[]>; remplacants: Record<string, string[]> } {
  const S = ctx.structure;
  const A = appartenances(S);
  const h = creerHasard(etat.graine, `all-star:${S.saison}`);
  const titulaires: Record<string, string[]> = {};
  const remplacants: Record<string, string[]> = {};
  for (const conf of S.conferences) {
    const candidats = Object.entries(etat.statistiques)
      .filter(([id, t]) => A[t.equipe]?.conference === conf.id && t.matchs >= 10 && !(etat.blessures[id] ?? 0))
      .map(([id]) => id)
      .sort();
    const t = (id: string) => etat.statistiques[id]!;
    const pctEquipe = (id: string) => pctBilan(bilans[t(id).equipe]!);
    const bruit = Object.fromEntries(candidats.map((id) => [id, [h.reel(), h.reel(), h.reel(), h.reel()]]));
    const fans = rangs(
      candidats,
      (id) => parMatch(t(id), 'points') + 0.5 * (noteDe(ctx, id) - 70) + 5 * pctEquipe(id) + 4 * bruit[id]![0]!,
    );
    const joueurs = rangs(candidats, (id) => gameScoreParMatch(t(id)) + 3 * bruit[id]![1]!);
    const medias = rangs(candidats, (id) => gameScoreParMatch(t(id)) + 6 * pctEquipe(id) + 3 * bruit[id]![2]!);
    const P = S.allStar.poidsDuVote;
    const vote = (id: string) => 2 * P.fans * fans[id]! + 2 * P.joueurs * joueurs[id]! + 2 * P.medias * medias[id]!;
    const ordre = [...candidats].sort((a, b) => vote(a) - vote(b) || fans[a]! - fans[b]!);
    titulaires[conf.id] = ordre.slice(0, S.allStar.titulairesParConference);
    const entraineurs = (id: string) => gameScoreParMatch(t(id)) + 4 * pctEquipe(id) + 2 * bruit[id]![3]!;
    remplacants[conf.id] = candidats
      .filter((id) => !titulaires[conf.id]!.includes(id))
      .sort((a, b) => entraineurs(b) - entraineurs(a) || (a < b ? -1 : 1))
      .slice(0, S.allStar.remplacantsParConference);
  }
  return { titulaires, remplacants };
}

/** Les récompenses de la saison régulière, puis le titre et le MVP de la finale. */
export function decernerRecompenses(
  ctx: ContexteLigue,
  etat: EtatSaison,
  bilans: Record<string, Bilan>,
  champion: string,
  finaliste: string,
): Palmares {
  const R = ctx.structure.recompenses;
  const h = creerHasard(etat.graine, `recompenses:${ctx.structure.saison}`);
  const lignes = Object.entries(etat.statistiques).sort(([a], [b]) => (a < b ? -1 : 1));
  const eligibles = lignes.filter(([, t]) => t.matchsEligibles >= R.matchsMinimum);
  const pct = (t: LigneSaison) => pctBilan(bilans[t.equipe]!);
  const avis = Object.fromEntries(lignes.map(([id]) => [id, h.reel()]));
  const meilleur = (liste: [string, LigneSaison][], score: (id: string, t: LigneSaison) => number): string | undefined =>
    [...liste].sort(([a, ta], [b, tb]) => score(b, tb) - score(a, ta) || (a < b ? -1 : 1))[0]?.[0];

  const valeurMvp = (id: string, t: LigneSaison) => gameScoreParMatch(t) * (0.7 + pct(t)) + avis[id]!;
  const mvp = meilleur(eligibles, valeurMvp);
  // Défenseur : interceptions, contres et sens tactique (la box score mesure mal la défense), bilan de l'équipe.
  const defenseur = meilleur(
    eligibles,
    (id, t) =>
      1.5 * parMatch(t, 'interceptions') + 1.5 * parMatch(t, 'contres') + 0.08 * (tactiqueDe(ctx, id) - 70) + 2 * pct(t) + 0.5 * avis[id]!,
  );
  const recrues = new Set(ctx.recrues);
  const rookie = meilleur(
    lignes.filter(([id, t]) => recrues.has(id) && t.matchs >= 30),
    (id, t) => gameScoreParMatch(t) + 0.5 * avis[id]!,
  );
  const sixiemeHomme = meilleur(
    lignes.filter(([, t]) => t.matchs >= 41 && t.titularisations < t.matchs / 2),
    (id, t) => parMatch(t, 'points') + 0.5 * gameScoreParMatch(t) + avis[id]!,
  );
  const progression = meilleur(
    eligibles.filter(([id]) => ctx.pointsParMatchPrecedents[id] !== undefined),
    (id, t) => parMatch(t, 'points') - ctx.pointsParMatchPrecedents[id]! + avis[id]!,
  );
  const ordreAllNba = [...eligibles].sort(([a, ta], [b, tb]) => valeurMvp(b, tb) - valeurMvp(a, ta) || (a < b ? -1 : 1)).map(([id]) => id);
  const allNba = Array.from({ length: R.equipesAllNba }, (_, k) =>
    ordreAllNba.slice(k * R.joueursParEquipeAllNba, (k + 1) * R.joueursParEquipeAllNba),
  );

  const finale = Object.entries(etat.statistiquesFinale).filter(([, t]) => t.equipe === champion);
  const mvpFinale = meilleur(finale, (id, t) => gameScoreParMatch(t) + 0.1 * avis[id]!);
  return { champion, finaliste, mvp, defenseur, rookie, sixiemeHomme, progression, allNba, mvpFinale };
}
