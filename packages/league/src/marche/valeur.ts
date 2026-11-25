// Tranche 9 : la valeur d'un joueur et d'un choix de Draft, la force d'une équipe (data/modeles/marche-v1.json).
//
// - Salaire de marché : part du plafond selon la note, calée sur les médianes des contrats 2026-27 des vétérans.
// - Valeur d'un joueur : sur un horizon de quelques saisons, l'écart entre ce qu'il vaut sur le marché (avec une prime
//   pour les stars, que le salaire maximum empêche de payer à leur valeur) et ce qu'il coûte, actualisé. Après son
//   contrat, l'équipe garde une part de cet écart (droits de Bird). La note de chaque saison suit l'évolution moyenne
//   attendue du modèle de carrière (sans l'écart propre).
// - Force d'une équipe : moyenne pondérée de ses meilleures notes (ordre de la rotation) ; c'est elle qui fait gagner.
// - Valeur d'un choix : selon le rang attendu, actualisée et ramenée vers le milieu quand la Draft est lointaine.
import type { ParametresCba, ContratJoueur } from '../cba';
import { salaireMaximum, salaireMinimum } from '../cba';
import { evolutionAttendue } from '../carriere/progression';
import type { ModeleCarriere } from '../carriere/modele';
import type { JoueurCarriere } from '../carriere/types';
import type { Ancrages, ModeleMarche } from './types';

/** Interpolation linéaire dans une table d'ancrages (bornée aux extrémités). */
export function interpoler(t: Ancrages, x: number): number {
  if (x <= t[0]![0]) return t[0]![1];
  for (let i = 1; i < t.length; i++) {
    const [x1, y1] = t[i]!;
    if (x <= x1) {
      const [x0, y0] = t[i - 1]!;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return t[t.length - 1]![1];
}

/** « 2026-27 » → « 2027-28 » (saisons courtes des contrats). */
export const saisonCourteSuivante = (s: string, n = 1): string => {
  const a = Number(s.slice(0, 4)) + n;
  return `${a}-${String((a + 1) % 100).padStart(2, '0')}`;
};

/** Le salaire de marché d'une note (dollars de la saison), borné par le minimum et le maximum de l'ancienneté. */
export function salaireDeMarche(M: ModeleMarche, P: ParametresCba, note: number, anciennete = 5): number {
  const brut = interpoler(M.valeur.salaireSelonNote, note) * P.plafondSalarial;
  return Math.round(Math.min(salaireMaximum(P, anciennete), Math.max(salaireMinimum(P, anciennete), brut)));
}

/** Ce que vaut vraiment une saison d'un joueur : le salaire de marché, plus la prime des stars. */
export function valeurDeSaison(M: ModeleMarche, P: ParametresCba, note: number): number {
  const prime = 1 + M.valeur.primeStar.parPoint * Math.max(0, note - M.valeur.primeStar.seuil);
  return interpoler(M.valeur.salaireSelonNote, note) * P.plafondSalarial * prime;
}

/** Les notes attendues d'un joueur sur `n` saisons (la saison en cours d'abord). */
export function notesProjetees(
  Mc: ModeleCarriere['progression'],
  j: Pick<JoueurCarriere, 'age' | 'note' | 'potentiel'>,
  n: number,
): number[] {
  const notes = [j.note];
  let x = { age: j.age, note: j.note, potentiel: j.potentiel };
  for (let t = 1; t < n; t++) {
    const note = Math.min(Mc.bornes[1], Math.max(Mc.bornes[0], x.note + evolutionAttendue(Mc, x)));
    x = { age: x.age + 1, note, potentiel: x.potentiel === null ? null : Math.max(x.potentiel, note) };
    notes.push(note);
  }
  return notes;
}

export interface ValeurJoueur {
  /** Écart valeur − salaire de la saison en cours. */
  present: number;
  /** Écarts des saisons suivantes de l'horizon, actualisés. */
  futur: number;
  /** Salaire de la saison en cours (0 pour un two-way). */
  salaire: number;
}

/** La valeur d'un joueur pour son équipe (dollars), à partir de la saison `saison` (courte). */
export function valeurDuJoueur(
  M: ModeleMarche,
  Mc: ModeleCarriere['progression'],
  P: ParametresCba,
  j: Pick<JoueurCarriere, 'age' | 'note' | 'potentiel'>,
  c: ContratJoueur | undefined,
  saison: string,
): ValeurJoueur {
  const H = M.valeur.horizon;
  const notes = notesProjetees(Mc, j, H);
  let present = 0;
  let futur = 0;
  let salaire = 0;
  for (let t = 0; t < H; t++) {
    const s = saisonCourteSuivante(saison, t);
    const v = valeurDeSaison(M, P, notes[t]!);
    const ligne = c?.type === 'standard' ? c.salaires.find((x) => x.saison === s) : undefined;
    const sous = c?.type === 'two-way' ? t === 0 : !!ligne;
    // Sous contrat : valeur − salaire ; ensuite, l'équipe garde une part de l'écart (droits de Bird).
    const surplus = sous
      ? v - (ligne?.montant ?? 0)
      : M.valeur.retenueApresContrat * (v - interpoler(M.valeur.salaireSelonNote, notes[t]!) * P.plafondSalarial);
    if (t === 0) {
      present = surplus;
      salaire = ligne?.montant ?? 0;
    } else futur += M.valeur.actualisation ** t * surplus;
  }
  return { present, futur, salaire };
}

/** La force d'un groupe de joueurs : moyenne pondérée des meilleures notes (ordre de la rotation). */
export function force(M: ModeleMarche, notes: readonly number[]): number {
  const tri = [...notes].sort((a, b) => b - a);
  let s = 0;
  let w = 0;
  M.force.poids.forEach((p, i) => {
    s += p * (tri[i] ?? 40);
    w += p;
  });
  return s / w;
}

/** La valeur d'un choix de Draft dans `ans` années, au rang attendu `rang` (1 à 60). */
export function valeurDuChoix(M: ModeleMarche, rang: number, ans: number): number {
  // Plus la Draft est lointaine, plus le rang attendu se rapproche du milieu de son tour.
  const milieu = rang <= 30 ? 15 : 45;
  const r = rang + (milieu - rang) * Math.min(1, M.choix.incertitudeParAn * Math.max(0, ans));
  return interpoler(M.choix.valeurParRang, r) * M.choix.actualisationParAn ** Math.max(0, ans);
}
