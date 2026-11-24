// Tranche 1 : le box score, déduit du seul journal d'événements (aucune statistique n'est tenue à part par le moteur).
// Le temps de jeu et le +/- se reconstruisent en suivant le cinq de chaque début de période et les remplacements.
import type { BoxEquipe, BoxScore, Camp, EquipeDuMatch, Evenement, LigneJoueur, LigneStatistique } from './types';

const ligneVide = (): LigneStatistique => ({
  dixiemes: 0,
  points: 0,
  tirsReussis: 0,
  tirsTentes: 0,
  troisReussis: 0,
  troisTentes: 0,
  lancersReussis: 0,
  lancersTentes: 0,
  rebondsOffensifs: 0,
  rebondsDefensifs: 0,
  rebonds: 0,
  passes: 0,
  interceptions: 0,
  contres: 0,
  pertes: 0,
  fautes: 0,
  plusMoins: 0,
});

const CLES = Object.keys(ligneVide()) as (keyof LigneStatistique)[];

export function construireBoxScore(
  evenements: readonly Evenement[],
  equipes: [EquipeDuMatch, EquipeDuMatch],
  titulaires: [string[], string[]],
  periodesReglementaires: number,
): BoxScore {
  const lignes = equipes.map(
    (eq, c) =>
      new Map<string, LigneJoueur>(
        eq.joueurs.map((j) => [
          j.id,
          {
            id: j.id,
            nom: j.nom,
            numero: j.numero,
            poste: j.poste,
            titulaire: titulaires[c]?.includes(j.id) ?? false,
            exclu: false,
            ...ligneVide(),
          },
        ]),
      ),
  ) as [Map<string, LigneJoueur>, Map<string, LigneJoueur>];
  const l = (c: Camp, id: string): LigneJoueur => {
    const x = lignes[c].get(id);
    if (!x) throw new Error(`Joueur inconnu dans le journal : ${id}`);
    return x;
  };
  let surTerrain: [string[], string[]] = [[...titulaires[0]], [...titulaires[1]]];
  let periode = 0;
  let dernier = 0;
  const parPeriode: [number[], number[]] = [[], []];
  let precedent: [number, number] = [0, 0];

  const marquer = (c: Camp, points: number): void => {
    for (const id of surTerrain[c]) l(c, id).plusMoins += points;
    for (const id of surTerrain[c === 0 ? 1 : 0]) l(c === 0 ? 1 : 0, id).plusMoins -= points;
  };

  for (const ev of evenements) {
    // Temps de jeu : le temps écoulé depuis l'événement précédent de la même période revient aux joueurs présents.
    if (ev.type === 'debut_periode') {
      periode = ev.periode;
      dernier = ev.restant;
      surTerrain = [[...ev.cinq[0]], [...ev.cinq[1]]];
      continue;
    }
    if (ev.periode === periode) {
      const ecoule = dernier - ev.restant;
      if (ecoule > 0) for (const c of [0, 1] as const) for (const id of surTerrain[c]) l(c, id).dixiemes += ecoule;
      dernier = ev.restant;
    }
    switch (ev.type) {
      case 'tir': {
        const x = l(ev.equipe, ev.joueur);
        x.tirsTentes += 1;
        if (ev.tir === 'troisPoints') x.troisTentes += 1;
        if (ev.reussi) {
          x.tirsReussis += 1;
          if (ev.tir === 'troisPoints') x.troisReussis += 1;
          x.points += ev.points;
          marquer(ev.equipe, ev.points);
        }
        if (ev.passe) l(ev.equipe, ev.passe).passes += 1;
        if (ev.contre) l(ev.equipe === 0 ? 1 : 0, ev.contre).contres += 1;
        break;
      }
      case 'lancer_franc': {
        const x = l(ev.equipe, ev.joueur);
        x.lancersTentes += 1;
        if (ev.reussi) {
          x.lancersReussis += 1;
          x.points += ev.points;
          marquer(ev.equipe, ev.points);
        }
        break;
      }
      case 'rebond': {
        const x = l(ev.equipe, ev.joueur);
        if (ev.offensif) x.rebondsOffensifs += 1;
        else x.rebondsDefensifs += 1;
        x.rebonds += 1;
        break;
      }
      case 'perte_de_balle':
        l(ev.equipe, ev.joueur).pertes += 1;
        if (ev.interception) l(ev.equipe === 0 ? 1 : 0, ev.interception).interceptions += 1;
        break;
      case 'faute':
        l(ev.equipe, ev.joueur).fautes += 1;
        break;
      case 'exclusion':
        l(ev.equipe, ev.joueur).exclu = true;
        break;
      case 'remplacement':
        surTerrain[ev.equipe] = surTerrain[ev.equipe].map((id) => (id === ev.sortant ? ev.entrant : id));
        break;
      case 'fin_periode':
        for (const c of [0, 1] as const) parPeriode[c].push(ev.score[c] - precedent[c]);
        precedent = [ev.score[0], ev.score[1]];
        break;
      case 'entre_deux':
      case 'rebond_equipe':
        // Rebond d'équipe : comme dans les statistiques officielles, il n'est crédité à aucun joueur.
        break;
    }
  }

  const boxEquipe = (c: Camp): BoxEquipe => {
    const joueurs = [...lignes[c].values()];
    const totaux = ligneVide();
    for (const j of joueurs) for (const k of CLES) totaux[k] += j[k];
    // Le +/- d'équipe est l'écart final.
    totaux.plusMoins = precedent[c] - precedent[c === 0 ? 1 : 0];
    return { id: equipes[c].id, nom: equipes[c].nom, points: precedent[c], parPeriode: parPeriode[c], joueurs, totaux };
  };
  return {
    equipes: [boxEquipe(0), boxEquipe(1)],
    periodes: periode,
    prolongations: Math.max(0, parPeriode[0].length - periodesReglementaires),
  };
}
