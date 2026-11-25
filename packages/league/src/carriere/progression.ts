// Tranche 8 : progression et vieillissement d'un joueur d'une saison à l'autre.
//
// L'évolution de la note suit une courbe d'âge (montée jusqu'au pic, déclin d'abord rapide puis plus lent) avec un écart
// propre à chaque joueur et à chaque saison. Un joueur généré (prospect, vivier) au potentiel connu comble, avant le
// pic, une part de l'écart entre sa note et son potentiel (au lieu de suivre la courbe). Les 16 attributs suivent la note, chacun avec un petit écart
// propre ; les qualités athlétiques déclinent plus tôt, l'adresse et la lecture du jeu plus tard (profils du modèle).
// Les familles suivent la moyenne de leurs attributs ; l'endurance baisse après un âge donné. Tout est déterministe.
import { ATTRIBUTS_DETAILLES, creerHasard, type AttributsDetailles } from '@basket-legends/engine';
import { gaussien } from '../draft/prospects';
import { valeurParAge, type ModeleCarriere } from './modele';
import type { Familles, JoueurCarriere } from './types';

const FAMILLES: Record<Exclude<keyof Familles, 'endurance'>, (keyof AttributsDetailles)[]> = {
  technique: ['tirCercle', 'tirMiDistance', 'tirATroisPoints', 'lancersFrancs', 'passe', 'maniement'],
  physique: ['rebondOffensif', 'rebondDefensif', 'contre', 'vitesse', 'force'],
  mental: ['qiOffensif', 'qiDefensif'],
  tactique: ['defenseExterieure', 'defenseInterieure', 'interception'],
};

const borner = (x: number, [min, max]: readonly [number, number]): number => Math.min(max, Math.max(min, x));
const moyenne = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

/** L'évolution moyenne attendue de la note d'un joueur (avant l'écart propre). */
export function evolutionAttendue(M: ModeleCarriere['progression'], j: Pick<JoueurCarriere, 'age' | 'note' | 'potentiel'>): number {
  const courbe = valeurParAge(M.evolution, j.age);
  if (j.potentiel === null || j.age >= M.agePic) return courbe;
  // Le potentiel connu fixe le plafond : avant le pic, le joueur comble une part de l'écart (rien s'il l'a atteint).
  return valeurParAge(M.rattrapage, j.age) * (j.potentiel - j.note);
}

/** Le décalage d'un attribut par rapport à la note pour un âge (profils du modèle). */
function decalage(M: ModeleCarriere['progression'], attribut: string, age: number): number {
  let d = 0;
  for (const p of M.profils) {
    if (!p.attributs.includes(attribut) || age <= p.apres) continue;
    d += Math.sign(p.parAn) * Math.min(Math.abs(p.parAn) * (age - p.apres), p.max);
  }
  return d;
}

/**
 * Le joueur une saison plus tard : âge + 1, note, attributs et familles. `graine` et `saison` rendent le tirage
 * reproductible ; la nouvelle saison est ajoutée à l'historique des notes.
 */
export function vieillir(
  M: ModeleCarriere['progression'],
  j: JoueurCarriere,
  graine: number,
  nouvelleSaison: string,
  /** Tranche 9 : points ajoutés par l'entraîneur du développement de son équipe (0 : référence). */
  bonus = 0,
): JoueurCarriere {
  const h = creerHasard(graine, `progression-${nouvelleSaison}-${j.id}`);
  const brut = evolutionAttendue(M, j) + gaussien(h, 0, valeurParAge(M.ecart, j.age)) + bonus;
  const [, max] = M.bornes;
  const delta = brut > 0 && j.note > M.compression.debut ? (brut * (max - j.note)) / (max - M.compression.debut) : brut;
  const note = Math.round(borner(j.note + delta, M.bornes));
  const reel = note - j.note;
  // Écarts des attributs : profil d'âge + écart propre, recentrés pour que leur moyenne suive la note.
  const bruts = ATTRIBUTS_DETAILLES.map((a) => decalage(M, a, j.age) + gaussien(h, 0, M.ecartAttribut));
  const centre = moyenne(bruts);
  const details = Object.fromEntries(
    ATTRIBUTS_DETAILLES.map((a, i) => [a, Math.round(borner(j.details[a] + reel + bruts[i]! - centre, M.bornes))]),
  ) as AttributsDetailles;
  const familles = { ...j.familles };
  for (const [f, attrs] of Object.entries(FAMILLES) as [keyof typeof FAMILLES, (keyof AttributsDetailles)[]][])
    familles[f] = Math.round(borner(j.familles[f] + moyenne(attrs.map((a) => details[a] - j.details[a])), M.bornes));
  if (j.age >= M.endurance.apres) familles.endurance = Math.round(borner(j.familles.endurance + M.endurance.parAn, M.bornes));
  return {
    ...j,
    age: j.age + 1,
    note,
    // Un potentiel n'est jamais sous la note atteinte.
    potentiel: j.potentiel === null ? null : Math.max(j.potentiel, note),
    details,
    familles,
    notes: [...j.notes, { saison: nouvelleSaison, note }],
  };
}
