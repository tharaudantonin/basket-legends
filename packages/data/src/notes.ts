// Tranche 2 : le modèle de notes v1 (décisions des 23 et 24/11/2026, docs/NOTES_JOUEURS.md).
//
// Formule maison, versionnée (data/modeles/notes-v<n>.json) et refaisable : mêmes statistiques et mêmes paramètres →
// mêmes notes. Trois étapes :
// 1. Taux par minute « rétrécis » : chaque taux est mélangé à la moyenne de la ligue comme si le joueur avait joué
//    `minutesDePrior` minutes de plus à ce niveau (et `tentativesDePrior…` tirs pour les pourcentages). Un joueur qui a
//    peu joué n'est donc pas jugé sur trois matchs.
// 2. Indices : combinaisons pondérées de scores centrés-réduits (z) de ces taux, une par attribut (technique, physique,
//    mental, tactique) et une pour la note globale (impact par minute + rôle confié par le coach).
// 3. Recalage par quantiles : le rang d'un joueur parmi tous les joueurs notés sur statistiques donne sa note, par
//    interpolation linéaire entre les points d'ancrage de l'échelle « NBA » (rotation 70-75, superstars au-delà de 90).
// Les joueurs sans aucune statistique NBA reçoivent une note a priori explicite : selon leur rang de draft 2026, ou la
// note des joueurs sans statistique. Ces notes sont marquées comme telles, jamais présentées comme mesurées.
import type { ParametresNotes, StatistiquesJoueurs, TotauxSaison } from './schemas';

export type Attribut = 'technique' | 'physique' | 'mental' | 'tactique';
export const ATTRIBUTS: readonly Attribut[] = ['technique', 'physique', 'mental', 'tactique'];

/** Ce que le modèle sait d'un joueur de l'effectif. */
export interface EntreeNotes {
  id: string;
  tailleCm: number;
}

export type BaseDeLaNote = 'statistiques' | 'rang-de-draft' | 'sans-statistique';

export interface NotesJoueur {
  id: string;
  globale: number;
  technique: number;
  physique: number;
  mental: number;
  tactique: number;
  /** Tranche 4 : endurance (courbe de fatigue propre au joueur). */
  endurance: number;
  base: BaseDeLaNote;
  /** La saison de statistiques utilisée (null si aucune). */
  saisonDeReference: '2025-2026' | '2024-2025' | null;
  /** Minutes de saison régulière derrière la note (0 sans statistique). */
  minutes: number;
}

/** Les mesures brutes d'un joueur, avant centrage. */
type Mesures = Record<string, number>;

const somme = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

/** Interpolation linéaire entre points d'ancrage [quantile, note], triés par quantile. */
export function noteDuQuantile(q: number, ancrages: readonly (readonly [number, number])[]): number {
  const premier = ancrages[0]!;
  if (q <= premier[0]) return premier[1];
  for (let i = 1; i < ancrages.length; i++) {
    const [q1, n1] = ancrages[i]!;
    const [q0, n0] = ancrages[i - 1]!;
    if (q <= q1) return n0 + ((q - q0) / (q1 - q0)) * (n1 - n0);
  }
  return ancrages[ancrages.length - 1]![1];
}

/** Rang moyen (ex aequo partagés) ramené entre 0 et 1. */
function quantiles(valeurs: number[]): number[] {
  const ordre = valeurs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const q = new Array<number>(valeurs.length);
  for (let k = 0; k < ordre.length; ) {
    let fin = k;
    while (fin + 1 < ordre.length && ordre[fin + 1]![0] === ordre[k]![0]) fin++;
    const rang = (k + fin) / 2;
    for (let m = k; m <= fin; m++) q[ordre[m]![1]] = valeurs.length > 1 ? rang / (valeurs.length - 1) : 0.5;
    k = fin + 1;
  }
  return q;
}

/** La saison qui sert de base : 2025-26 si le joueur a joué, sinon 2024-25. */
export function saisonDeBase(s: StatistiquesJoueurs['joueurs'][string] | undefined): { t: TotauxSaison; saison: '2025-2026' | '2024-2025' } | undefined {
  if (s?.saisonReguliere) return { t: s.saisonReguliere, saison: '2025-2026' };
  if (s?.saison2024_25) return { t: s.saison2024_25, saison: '2024-2025' };
  return undefined;
}

/** Calcule les notes de tous les joueurs donnés. Fonction pure : l'ordre des joueurs n'influe pas sur le résultat. */
export function calculerNotes(joueurs: readonly EntreeNotes[], stats: StatistiquesJoueurs, P: ParametresNotes): NotesJoueur[] {
  const avecStats = joueurs
    .map((j) => ({ j, base: saisonDeBase(stats.joueurs[j.id]) }))
    .filter((x): x is { j: EntreeNotes; base: NonNullable<typeof x.base> } => x.base !== undefined)
    .sort((a, b) => (a.j.id < b.j.id ? -1 : 1));

  // Moyennes de la ligue, pondérées par les minutes (somme des totaux / somme des minutes) sur les joueurs notés.
  const T = avecStats.map((x) => x.base.t);
  const minutesTotales = somme(T.map((t) => t.minutes));
  const parMinute = (cle: keyof TotauxSaison) => somme(T.map((t) => Number(t[cle]))) / minutesTotales;
  const tentativesTs = (t: TotauxSaison) => t.tirsTentes + 0.44 * t.lancersTentes;
  const ligue = {
    ts: somme(T.map((t) => t.points)) / (2 * somme(T.map(tentativesTs))),
    trois: somme(T.map((t) => t.troisReussis)) / somme(T.map((t) => t.troisTentes)),
    lancers: somme(T.map((t) => t.lancersReussis)) / somme(T.map((t) => t.lancersTentes)),
  };
  const R = P.retrecissement;

  // 1. Mesures brutes rétrécies.
  const mesures: Mesures[] = avecStats.map(({ j, base: { t } }) => {
    const m = t.minutes;
    const taux = (cle: keyof TotauxSaison) => ((Number(t[cle]) + parMinute(cle) * R.minutesDePrior) / (m + R.minutesDePrior)) * 36;
    const ts = (t.points + ligue.ts * 2 * R.tentativesDePriorTirs) / (2 * (tentativesTs(t) + R.tentativesDePriorTirs));
    const trois = (t.troisReussis + ligue.trois * R.tentativesDePriorTrois) / (t.troisTentes + R.tentativesDePriorTrois);
    const lancers = (t.lancersReussis + ligue.lancers * R.tentativesDePriorLancers) / (t.lancersTentes + R.tentativesDePriorLancers);
    const passes = taux('passes');
    const pertes = taux('pertes');
    // Game Score de Hollinger, par 36 minutes (rétréci par ses composantes).
    const gameScore =
      taux('points') +
      0.4 * taux('tirsReussis') -
      0.7 * taux('tirsTentes') -
      0.4 * (taux('lancersTentes') - taux('lancersReussis')) +
      0.7 * taux('rebondsOffensifs') +
      0.3 * taux('rebondsDefensifs') +
      taux('interceptions') +
      0.7 * passes +
      0.7 * taux('contres') -
      0.4 * taux('fautes') -
      pertes;
    return {
      ts,
      trois,
      lancers,
      points: taux('points'),
      troisTentes: taux('troisTentes'),
      lancersTentes: taux('lancersTentes'),
      rebondsOffensifs: taux('rebondsOffensifs'),
      rebondsDefensifs: taux('rebondsDefensifs'),
      passes,
      pertes,
      interceptions: taux('interceptions'),
      contres: taux('contres'),
      fautes: taux('fautes'),
      usage: taux('tirsTentes') + 0.44 * taux('lancersTentes') + pertes,
      passesSurPertes: (passes + 1) / (pertes + 1),
      gameScore,
      minutesParMatch: t.matchs ? m / t.matchs : 0,
      partTitulaire: t.matchs ? (t.titularisations ?? 0) / t.matchs : 0,
      taille: j.tailleCm,
    };
  });

  // 2. Centrage-réduction sur les joueurs qui ont joué au moins `minutesPourLaReference` minutes.
  const reference = mesures.filter((_, i) => avecStats[i]!.base.t.minutes >= R.minutesPourLaReference);
  const moyEt = new Map<string, [number, number]>();
  for (const cle of Object.keys(mesures[0] ?? {})) {
    const xs = reference.map((x) => x[cle]!);
    const moy = somme(xs) / xs.length;
    const et = Math.sqrt(somme(xs.map((x) => (x - moy) ** 2)) / xs.length) || 1;
    moyEt.set(cle, [moy, et]);
  }
  const z = (x: Mesures, cle: string): number => {
    const me = moyEt.get(cle);
    if (!me) throw new Error(`Paramètre de notes inconnu : « ${cle} »`);
    return (x[cle]! - me[0]) / me[1];
  };
  const indice = (x: Mesures, poids: Record<string, number>) => somme(Object.entries(poids).map(([cle, w]) => w * z(x, cle)));

  const indices = {
    globale: mesures.map((x) => indice(x, P.poids.globale)),
    technique: mesures.map((x) => indice(x, P.poids.technique)),
    physique: mesures.map((x) => indice(x, P.poids.physique)),
    mental: mesures.map((x) => indice(x, P.poids.mental)),
    tactique: mesures.map((x) => indice(x, P.poids.tactique)),
    endurance: mesures.map((x) => indice(x, P.poids.endurance)),
  };

  // 3. Recalage par quantiles.
  const arrondi = (x: number) => Math.round(Math.min(P.bornes.max, Math.max(P.bornes.min, x)));
  const qs = Object.fromEntries(Object.entries(indices).map(([k, v]) => [k, quantiles(v)])) as Record<keyof typeof indices, number[]>;
  const resultat = new Map<string, NotesJoueur>();
  avecStats.forEach(({ j, base }, i) => {
    resultat.set(j.id, {
      id: j.id,
      globale: arrondi(noteDuQuantile(qs.globale[i]!, P.ancrages.globale)),
      technique: arrondi(noteDuQuantile(qs.technique[i]!, P.ancrages.attributs)),
      physique: arrondi(noteDuQuantile(qs.physique[i]!, P.ancrages.attributs)),
      mental: arrondi(noteDuQuantile(qs.mental[i]!, P.ancrages.attributs)),
      tactique: arrondi(noteDuQuantile(qs.tactique[i]!, P.ancrages.attributs)),
      endurance: arrondi(noteDuQuantile(qs.endurance[i]!, P.ancrages.attributs)),
      base: 'statistiques',
      saisonDeReference: base.saison,
      minutes: base.t.minutes,
    });
  });

  // Joueurs sans statistique NBA : note a priori (rang de draft, sinon note des joueurs sans statistique).
  for (const j of joueurs) {
    if (resultat.has(j.id)) continue;
    const choix = stats.joueurs[j.id]?.draft2026?.choix;
    const note = arrondi(choix !== undefined ? noteDuQuantile(choix, P.sansStatistique.parRangDeDraft) : P.sansStatistique.nonDrafte);
    resultat.set(j.id, {
      id: j.id,
      globale: note,
      technique: note,
      physique: note,
      mental: note,
      tactique: note,
      endurance: note,
      base: choix !== undefined ? 'rang-de-draft' : 'sans-statistique',
      saisonDeReference: null,
      minutes: 0,
    });
  }
  return joueurs.map((j) => resultat.get(j.id)!);
}
