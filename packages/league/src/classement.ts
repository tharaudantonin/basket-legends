// Tranche 4 : bilans et classements, avec les critères de départage de la NBA (data/ligue/saison-2026-27.json).
//
// Procédure : les titres de division sont départagés d'abord. Puis, dans chaque conférence, les équipes sont rangées
// au pourcentage de victoires ; un groupe d'ex aequo est départagé critère par critère (liste « deux équipes » ou
// « plusieurs équipes » selon sa taille). Dès qu'un critère sépare le groupe, chaque sous-groupe encore à égalité
// reprend les critères depuis le début. Si aucun ne sépare, un tirage déterministe (graine de la saison) décide.
import type { Bilan, CritereDepartage, ResumeMatch, StructureLigue } from './types';

const vide = (equipe: string): Bilan => ({
  equipe,
  victoires: 0,
  defaites: 0,
  domicile: [0, 0],
  exterieur: [0, 0],
  division: [0, 0],
  conference: [0, 0],
  contre: {},
  pointsPour: 0,
  pointsContre: 0,
  serie: 0,
  dixDerniers: [0, 0],
});

export interface Appartenance {
  conference: string;
  division: string;
}

export function appartenances(S: StructureLigue): Record<string, Appartenance> {
  const r: Record<string, Appartenance> = {};
  for (const c of S.conferences) for (const d of c.divisions) for (const f of d.franchises) r[f] = { conference: c.id, division: d.id };
  return r;
}

export const pourcentage = (v: number, d: number): number => (v + d ? v / (v + d) : 0);
export const pctBilan = (b: Bilan): number => pourcentage(b.victoires, b.defaites);

/** Les bilans de saison régulière, à partir des matchs joués (dans l'ordre). */
export function calculerBilans(S: StructureLigue, matchs: readonly ResumeMatch[]): Record<string, Bilan> {
  const A = appartenances(S);
  const bilans: Record<string, Bilan> = {};
  for (const f of Object.keys(A)) bilans[f] = vide(f);
  const derniers: Record<string, boolean[]> = {};
  for (const m of matchs) {
    if (m.nature !== 'reguliere') continue;
    const gagneDomicile = m.score[0] > m.score[1];
    for (const [moi, lui, gagne, aDomicile, pour, contre] of [
      [m.domicile, m.exterieur, gagneDomicile, true, m.score[0], m.score[1]],
      [m.exterieur, m.domicile, !gagneDomicile, false, m.score[1], m.score[0]],
    ] as const) {
      const b = bilans[moi]!;
      const i = gagne ? 0 : 1;
      if (gagne) b.victoires++;
      else b.defaites++;
      (aDomicile ? b.domicile : b.exterieur)[i]++;
      if (A[moi]!.division === A[lui]!.division) b.division[i]++;
      if (A[moi]!.conference === A[lui]!.conference) b.conference[i]++;
      (b.contre[lui] ??= [0, 0])[i]++;
      b.pointsPour += pour;
      b.pointsContre += contre;
      b.serie = gagne ? Math.max(0, b.serie) + 1 : Math.min(0, b.serie) - 1;
      const l = (derniers[moi] ??= []);
      l.push(gagne);
      if (l.length > 10) l.shift();
      b.dixDerniers = [l.filter(Boolean).length, l.filter((x) => !x).length];
    }
  }
  return bilans;
}

/** Tirage déterministe pour un départage impossible : hachage de la graine et de l'équipe. */
function tirage(graine: number, equipe: string): number {
  let h = (2166136261 ^ graine) >>> 0;
  for (const c of `tirage:${equipe}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

interface ContexteDepartage {
  S: StructureLigue;
  A: Record<string, Appartenance>;
  bilans: Record<string, Bilan>;
  vainqueursDivision: Set<string>;
  /** Équipes « qualifiables » (dix meilleurs bilans, ex aequo compris) par conférence. */
  qualifiables: Record<string, Set<string>>;
  graine: number;
}

function bilanContre(b: Bilan, adversaires: Iterable<string>): number {
  let v = 0;
  let d = 0;
  for (const a of adversaires) {
    const r = b.contre[a];
    if (r) {
      v += r[0];
      d += r[1];
    }
  }
  return pourcentage(v, d);
}

/** La valeur d'un critère pour une équipe d'un groupe d'ex aequo (plus grand = mieux), ou null s'il ne s'applique pas. */
function valeurCritere(c: CritereDepartage, equipe: string, groupe: readonly string[], X: ContexteDepartage): number | null {
  const b = X.bilans[equipe]!;
  const moi = X.A[equipe]!;
  switch (c) {
    case 'confrontations':
      return bilanContre(
        b,
        groupe.filter((g) => g !== equipe),
      );
    case 'vainqueur-division':
      return X.vainqueursDivision.has(equipe) ? 1 : 0;
    case 'bilan-division':
      if (!groupe.every((g) => X.A[g]!.division === moi.division)) return null;
      return pourcentage(b.division[0], b.division[1]);
    case 'bilan-conference':
      return pourcentage(b.conference[0], b.conference[1]);
    case 'bilan-qualifiables-conference':
      return bilanContre(
        b,
        [...(X.qualifiables[moi.conference] ?? [])].filter((t) => t !== equipe),
      );
    case 'bilan-qualifiables-autre-conference': {
      const autre = X.S.conferences.find((x) => x.id !== moi.conference)?.id ?? '';
      return bilanContre(b, X.qualifiables[autre] ?? []);
    }
    case 'difference-points':
      return b.pointsPour - b.pointsContre;
  }
}

function departager(groupe: string[], X: ContexteDepartage, criteresExclus: ReadonlySet<CritereDepartage> = new Set()): string[] {
  if (groupe.length <= 1) return groupe;
  const criteres = (groupe.length === 2 ? X.S.departages.deuxEquipes : X.S.departages.plusieursEquipes).filter(
    (c) => !criteresExclus.has(c),
  );
  for (const c of criteres) {
    const valeurs = groupe.map((e) => [e, valeurCritere(c, e, groupe, X)] as const);
    if (valeurs.some(([, v]) => v === null)) continue;
    const distinctes = [...new Set(valeurs.map(([, v]) => v as number))].sort((a, b) => b - a);
    if (distinctes.length < 2) continue;
    // Départage complet ou partiel : chaque sous-groupe encore à égalité repart du premier critère.
    return distinctes.flatMap((v) =>
      departager(
        valeurs.filter(([, x]) => x === v).map(([e]) => e),
        X,
        criteresExclus,
      ),
    );
  }
  return [...groupe].sort((a, b) => tirage(X.graine, a) - tirage(X.graine, b) || (a < b ? -1 : 1));
}

/** Range des équipes au pourcentage de victoires, puis départage les ex aequo. */
function ranger(equipes: string[], X: ContexteDepartage, criteresExclus?: ReadonlySet<CritereDepartage>): string[] {
  const parPct = new Map<number, string[]>();
  for (const e of equipes) {
    const p = pctBilan(X.bilans[e]!);
    parPct.set(p, [...(parPct.get(p) ?? []), e]);
  }
  return [...parPct.keys()].sort((a, b) => b - a).flatMap((p) => departager(parPct.get(p)!, X, criteresExclus));
}

export interface Classements {
  /** Conférence → équipes du 1er au dernier. */
  conferences: Record<string, string[]>;
  /** Division → équipes du 1er au dernier. */
  divisions: Record<string, string[]>;
  vainqueursDivision: string[];
}

/** Les classements de conférence et de division (critères de départage NBA). */
export function classer(S: StructureLigue, bilans: Record<string, Bilan>, graine: number): Classements {
  const A = appartenances(S);
  const X: ContexteDepartage = { S, A, bilans, vainqueursDivision: new Set(), qualifiables: {}, graine };
  // Équipes « qualifiables » : les dix meilleurs bilans de la conférence, ex aequo compris.
  for (const c of S.conferences) {
    const equipes = c.divisions.flatMap((d) => d.franchises);
    const pcts = equipes.map((e) => pctBilan(bilans[e]!)).sort((a, b) => b - a);
    const seuil = pcts[Math.min(pcts.length, S.playIn.rangsDuPlayIn[1]) - 1] ?? 0;
    X.qualifiables[c.id] = new Set(equipes.filter((e) => pctBilan(bilans[e]!) >= seuil));
  }
  // 1. Titres de division (sans le critère « vainqueur de division », qui n'a pas encore de sens).
  const divisions: Record<string, string[]> = {};
  const sansVainqueur = new Set<CritereDepartage>(['vainqueur-division']);
  for (const c of S.conferences) {
    for (const d of c.divisions) {
      divisions[d.id] = ranger([...d.franchises], X, sansVainqueur);
      X.vainqueursDivision.add(divisions[d.id]![0]!);
    }
  }
  // 2. Conférences.
  const conferences: Record<string, string[]> = {};
  for (const c of S.conferences)
    conferences[c.id] = ranger(
      c.divisions.flatMap((d) => d.franchises),
      X,
    );
  return { conferences, divisions, vainqueursDivision: [...X.vainqueursDivision] };
}

/** Écart au premier, en matchs (« games behind »). */
export function retard(premier: Bilan, b: Bilan): number {
  return (premier.victoires - b.victoires + (b.defaites - premier.defaites)) / 2;
}
