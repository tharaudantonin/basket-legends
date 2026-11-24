// Tranche 5 : la lecture du mode interactif, sans hasard ni interface.
//
// Le match interactif est un match simulé avec les décisions du coach (simulation.ts, `EntreeMatch.decisions`) : à chaque
// nouvelle décision, l'écran rejoue tout le match depuis le coup d'envoi (quelques millisecondes). Le journal avant
// l'arrêt où la décision est prise ne change pas, donc l'affichage reprend exactement où il était. Ce module dit où
// en est la lecture : la prochaine ligne de commentaire à montrer, ou l'arrêt de jeu où s'arrêter pour laisser décider.
import type { LigneCommentaire } from './commentaire';
import type { ArretDeJeu, DecisionMatch, Evenement } from './types';

/** Où en est la lecture : le nombre d'événements du journal déjà montrés et le dernier arrêt de jeu passé. */
export interface Lecture {
  curseur: number;
  dernierArret: number;
}

export type PasDeLecture =
  /** Montrer les lignes jusqu'à ce curseur. */
  | { genre: 'ligne'; lecture: Lecture }
  /** S'arrêter à cet arrêt de jeu : le coach peut décider. */
  | { genre: 'arret'; arret: ArretDeJeu; lecture: Lecture }
  | { genre: 'fin'; lecture: Lecture };

/**
 * Le pas suivant de la lecture. `sArreter` dit, pour chaque arrêt de jeu rencontré, s'il faut y laisser la main au coach
 * (pause demandée, début de période, temps-mort…) ; sinon la lecture le passe.
 */
export function pasSuivant(
  lignes: readonly LigneCommentaire[],
  arrets: readonly ArretDeJeu[],
  lecture: Lecture,
  sArreter: (a: ArretDeJeu) => boolean,
): PasDeLecture {
  const ligne = lignes.find((l) => l.indice >= lecture.curseur);
  const arret = arrets.find((a) => a.numero > lecture.dernierArret);
  if (arret && (!ligne || arret.indice <= ligne.indice) && sArreter(arret))
    return { genre: 'arret', arret, lecture: { curseur: arret.indice, dernierArret: arret.numero } };
  if (!ligne) {
    const dernier = arrets.at(-1)?.numero ?? lecture.dernierArret;
    return { genre: 'fin', lecture: { curseur: Number.MAX_SAFE_INTEGER, dernierArret: dernier } };
  }
  const passes = arrets.filter((a) => a.numero > lecture.dernierArret && a.indice <= ligne.indice);
  return {
    genre: 'ligne',
    lecture: { curseur: ligne.indice + 1, dernierArret: passes.at(-1)?.numero ?? lecture.dernierArret },
  };
}

/** Les événements écrits entre l'arrêt de jeu précédent et celui-ci (pour décider d'une pause automatique). */
export function evenementsAvantLArret(evenements: readonly Evenement[], arrets: readonly ArretDeJeu[], arret: ArretDeJeu): Evenement[] {
  const precedent = arrets.filter((a) => a.numero < arret.numero).at(-1);
  return evenements.slice(precedent?.indice ?? 0, arret.indice);
}

/** Ajoute une décision : plusieurs changements de plan d'une équipe au même arrêt n'en font qu'un. */
export function ajouterDecision(decisions: readonly DecisionMatch[], d: DecisionMatch): DecisionMatch[] {
  if (d.genre === 'plan') {
    const i = decisions.findIndex((x) => x.genre === 'plan' && x.arret === d.arret && x.equipe === d.equipe);
    const existante = decisions[i];
    if (existante?.genre === 'plan') {
      const copie = decisions.slice();
      copie[i] = { ...existante, plan: { ...existante.plan, ...d.plan } };
      return copie;
    }
  }
  return [...decisions, d];
}

/** Annule les décisions prises à un arrêt (et, par sécurité, celles d'après) : le match reprend comme avant. */
export function annulerDecisions(decisions: readonly DecisionMatch[], arret: number): DecisionMatch[] {
  return decisions.filter((d) => d.arret < arret);
}
