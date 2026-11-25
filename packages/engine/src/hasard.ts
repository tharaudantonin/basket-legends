// Repris de rugby-legends@1f6f6c9:src/moteur/hasard.ts (lu sur la branche v2, commit 19dd48f).
// Adaptations : l'état du générateur est lisible et restaurable (etat, reprendreHasard), pour sauvegarder une partie
// et reprendre un match interactif exactement au même point (docs/TDD.md, « Simulation et sauvegardes ») ;
// `nouvelleGraine` reçoit l'horloge en paramètre, pour que le moteur reste une fonction pure.
//
// Le hasard contrôlé : chaque partie a une graine (un nombre). Avec la même graine et les mêmes décisions, tout se
// déroule à l'identique. Chaque usage du hasard reçoit son propre « sel » (par exemple « calendrier » ou « match-12 ») :
// relancer un tirage ne change pas les autres.

export interface Hasard {
  /** Nombre réel dans [0, 1[. */
  reel(): number;
  /** Entier entre min et max inclus. */
  entier(min: number, max: number): number;
  /** Un élément au hasard dans une liste. */
  choisir<T>(liste: readonly T[]): T;
  /** Un élément au hasard, chacun avec son poids. */
  pondere<T>(liste: readonly T[], poids: (element: T) => number): T;
  /** Vrai avec la probabilité p (entre 0 et 1). */
  chance(p: number): boolean;
  /** L'état interne du générateur, à enregistrer pour reprendre plus tard au même point. */
  etat(): number;
}

// Mélange une chaîne de caractères en un entier 32 bits (algorithme FNV-1a).
function hacher(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function construire(depart: number): Hasard {
  // Générateur « mulberry32 » : rapide, suffisant pour un jeu, et reproductible.
  let a = depart >>> 0;
  const suivant = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hasard: Hasard = {
    reel: suivant,
    entier: (min, max) => min + Math.floor(suivant() * (max - min + 1)),
    choisir: (liste) => {
      if (liste.length === 0) throw new Error('Tirage dans une liste vide.');
      return liste[Math.floor(suivant() * liste.length)] as (typeof liste)[number];
    },
    pondere: (liste, poids) => {
      // Performance (25/11/2026) : chaque poids n'est calculé qu'une fois ; mêmes valeurs, même ordre, même résultat.
      const n = liste.length;
      const p = new Array<number>(n);
      let total = 0;
      for (let i = 0; i < n; i++) total += p[i] = Math.max(0, poids(liste[i]!));
      if (total <= 0) return hasard.choisir(liste);
      let tirage = suivant() * total;
      for (let i = 0; i < n; i++) {
        tirage -= p[i]!;
        if (tirage < 0) return liste[i]!;
      }
      return liste[n - 1] as (typeof liste)[number];
    },
    chance: (p) => suivant() < p,
    etat: () => a,
  };
  return hasard;
}

/** Un générateur pour une graine et un usage (sel) donnés. */
export function creerHasard(graine: number, sel = ''): Hasard {
  return construire(hacher(`${graine}:${sel}`));
}

/** Reprend un générateur exactement à l'état enregistré par `etat()`. */
export function reprendreHasard(etat: number): Hasard {
  return construire(etat);
}

/** Une nouvelle graine, tirée de l'horloge (seule source de vrai hasard du jeu, appelée par l'interface). */
export function nouvelleGraine(maintenant: number): number {
  return (maintenant ^ 0x5bd1e995) >>> 0;
}
