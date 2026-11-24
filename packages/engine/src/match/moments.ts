// Tranche 3 : les moments marquants d'un match, détectés dans le journal et le box score.
//
// Ils serviront aux animations spéciales (chantier visuel), aux actualités (tranche 4) et au choix du « match de la
// semaine » (`interetDuMatch`). Les seuils sont des choix de présentation, pas des règles NBA : ils sont rassemblés ici.
import type { BoxScore, Camp, Evenement, ResultatMatch } from './types';

export const SEUILS_MOMENTS = {
  points: [30, 40, 50],
  rebonds: 20,
  passes: 15,
  contres: 6,
  interceptions: 6,
  troisReussis: 8,
  adresseParfaiteTirs: 10,
  remontee: [15, 20],
  ecartLarge: 30,
  serie: 15,
  dernieresSecondes: 100, // dixièmes : un panier décisif dans les 10 dernières secondes
} as const;

export type GenreMoment =
  | 'points'
  | 'triple_double'
  | 'rebonds'
  | 'passes'
  | 'contres'
  | 'interceptions'
  | 'trois_points'
  | 'adresse_parfaite'
  | 'buzzer_vainqueur'
  | 'panier_decisif'
  | 'prolongations'
  | 'remontee'
  | 'ecart_large'
  | 'serie';

export interface Moment {
  genre: GenreMoment;
  /** 1 notable, 2 marquant, 3 exceptionnel. */
  importance: 1 | 2 | 3;
  equipe: Camp | null;
  joueur?: string;
  /** Index de l'événement concerné dans le journal, s'il y en a un. */
  indice?: number;
  texte: string;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Les moments marquants d'un match, du plus important au moins important. */
export function detecterMoments(resultat: ResultatMatch): Moment[] {
  const { evenements: E, boxScore: B } = resultat;
  const S = SEUILS_MOMENTS;
  const moments: Moment[] = [];
  const vainqueur: Camp = B.equipes[0].points > B.equipes[1].points ? 0 : 1;

  // Performances individuelles (box score).
  for (const c of [0, 1] as const) {
    for (const j of B.equipes[c].joueurs) {
      const base = { equipe: c, joueur: j.id };
      if (j.points >= S.points[0]) {
        const importance = j.points >= S.points[2] ? 3 : j.points >= S.points[1] ? 2 : 1;
        moments.push({ ...base, genre: 'points', importance, texte: `${j.nom} marque ${j.points} points.` });
      }
      const doubles = [j.points, j.rebonds, j.passes, j.interceptions, j.contres].filter((x) => x >= 10).length;
      if (doubles >= 3)
        moments.push({
          ...base,
          genre: 'triple_double',
          importance: 2,
          texte: `Triple-double de ${j.nom} (${j.points} pts, ${j.rebonds} rbds, ${j.passes} pds).`,
        });
      if (j.rebonds >= S.rebonds) moments.push({ ...base, genre: 'rebonds', importance: 2, texte: `${j.nom} prend ${j.rebonds} rebonds.` });
      if (j.passes >= S.passes)
        moments.push({ ...base, genre: 'passes', importance: 2, texte: `${j.nom} distribue ${j.passes} passes décisives.` });
      if (j.contres >= S.contres)
        moments.push({ ...base, genre: 'contres', importance: 2, texte: `${j.nom} réussit ${j.contres} contres.` });
      if (j.interceptions >= S.interceptions)
        moments.push({ ...base, genre: 'interceptions', importance: 2, texte: `${j.nom} intercepte ${j.interceptions} ballons.` });
      if (j.troisReussis >= S.troisReussis)
        moments.push({ ...base, genre: 'trois_points', importance: 2, texte: `${j.nom} réussit ${j.troisReussis} tirs à trois points.` });
      if (j.tirsTentes >= S.adresseParfaiteTirs && j.tirsReussis === j.tirsTentes)
        moments.push({ ...base, genre: 'adresse_parfaite', importance: 2, texte: `${j.nom} ne manque aucun de ses ${j.tirsTentes} tirs.` });
    }
  }

  // Le match (journal).
  let score: [number, number] = [0, 0];
  const plusGrosRetard: [number, number] = [0, 0];
  let serie = { camp: 0 as Camp, points: 0, meilleure: [0, 0] as [number, number] };
  let dernierBasculement: { indice: number; ev: Extract<Evenement, { type: 'tir' }> } | undefined;
  const periodeFinale = B.periodes;
  for (let i = 0; i < E.length; i++) {
    const ev = E[i]!;
    if (ev.type !== 'tir' && ev.type !== 'lancer_franc') continue;
    if (!ev.reussi) continue;
    const avant = score;
    score = ev.score;
    for (const c of [0, 1] as const) plusGrosRetard[c] = Math.max(plusGrosRetard[c], score[c === 0 ? 1 : 0] - score[c]);
    if (serie.camp === ev.equipe) serie.points += ev.points;
    else serie = { ...serie, camp: ev.equipe, points: ev.points };
    serie.meilleure[ev.equipe] = Math.max(serie.meilleure[ev.equipe], serie.points);
    // Le vainqueur prend l'avantage pour de bon : son dernier passage de « pas devant » à « devant ».
    if (
      ev.type === 'tir' &&
      ev.equipe === vainqueur &&
      avant[vainqueur] <= avant[vainqueur === 0 ? 1 : 0] &&
      score[vainqueur] > score[vainqueur === 0 ? 1 : 0]
    )
      dernierBasculement = { indice: i, ev };
  }
  if (dernierBasculement && dernierBasculement.ev.periode === periodeFinale && dernierBasculement.ev.restant <= S.dernieresSecondes) {
    const { ev, indice } = dernierBasculement;
    const joueur = B.equipes[ev.equipe].joueurs.find((j) => j.id === ev.joueur)?.nom ?? ev.joueur;
    if (ev.auBuzzer)
      moments.push({
        genre: 'buzzer_vainqueur',
        importance: 3,
        equipe: ev.equipe,
        joueur: ev.joueur,
        indice,
        texte: `${joueur} donne la victoire au buzzer !`,
      });
    else
      moments.push({
        genre: 'panier_decisif',
        importance: 2,
        equipe: ev.equipe,
        joueur: ev.joueur,
        indice,
        texte: `${joueur} donne l'avantage à ${(ev.restant / 10).toFixed(1)} s de la fin.`,
      });
  }
  if (B.prolongations) {
    moments.push({
      genre: 'prolongations',
      importance: B.prolongations >= 2 ? 3 : 2,
      equipe: null,
      texte: B.prolongations === 1 ? 'Match décidé en prolongation.' : `Match décidé après ${B.prolongations} prolongations.`,
    });
  }
  const retard = plusGrosRetard[vainqueur];
  if (retard >= S.remontee[0])
    moments.push({
      genre: 'remontee',
      importance: retard >= S.remontee[1] ? 3 : 2,
      equipe: vainqueur,
      texte: `${B.equipes[vainqueur].nom} gagne après avoir été mené de ${pluriel(retard, 'point')}.`,
    });
  const ecart = Math.abs(B.equipes[0].points - B.equipes[1].points);
  if (ecart >= S.ecartLarge)
    moments.push({
      genre: 'ecart_large',
      importance: 1,
      equipe: vainqueur,
      texte: `${B.equipes[vainqueur].nom} l'emporte de ${ecart} points.`,
    });
  for (const c of [0, 1] as const) {
    if (serie.meilleure[c] >= S.serie)
      moments.push({
        genre: 'serie',
        importance: 1,
        equipe: c,
        texte: `${B.equipes[c].nom} enchaîne une série de ${serie.meilleure[c]} points sans réponse.`,
      });
  }
  return moments.sort((a, b) => b.importance - a.importance);
}

/** L'intérêt d'un match pour le choix du « match de la semaine » : moments marquants et suspense. */
export function interetDuMatch(moments: readonly Moment[], b: BoxScore): number {
  const ecart = Math.abs(b.equipes[0].points - b.equipes[1].points);
  return moments.reduce((s, m) => s + m.importance * 2, 0) + Math.max(0, 10 - ecart);
}
