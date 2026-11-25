// Tranche 10 (réponse 48) : la G League — 30 équipes affiliées, une par franchise (data/ligue/g-league-2026-27.json),
// saison simulée en accéléré : bilans et statistiques agrégées, sans match possession par possession.
//
// Effectif d'une équipe affiliée : les two-way de la franchise, les joueurs sous contrat standard qu'elle y assigne
// (absents de ses matchs NBA tant qu'ils y sont), et des joueurs hors NBA rattachés pour la saison (les meilleurs en
// développement, puis les jeunes libres) ; ils restent libres de signer avec n'importe quelle franchise.
// Format : Tip-Off Tournament (14 matchs en quatre régions), Winter Showcase (huit qualifiés, élimination directe),
// saison régulière de 36 matchs par conférence, playoffs (huit par conférence, finale au meilleur des trois).
// Un match : probabilité de victoire logistique selon l'écart de force (moyenne pondérée des meilleures notes), score
// tiré, minutes et statistiques réparties selon la note et le poste. Les joueurs qui y jouent assez progressent un
// peu plus à l'intersaison (borné, comme l'effet de l'entraîneur du développement).
import { ajouterJours, joursEntre } from '../calendrier';
import type { Univers } from '../carriere/types';
import type { ContexteLigue, EtatSaison } from '../types';
import { clubDe, decalerDate, donneesClub, etatClub, hasardDuClub, modeleClub, nomEquipe, publier } from './commun';
import type { LigneGLeague, MatchGLeague, SaisonGLeague } from './types';

/** Les joueurs de l'équipe affiliée d'une franchise. */
export function effectifGLeague(u: Univers, equipe: string): string[] {
  const C = u.club;
  const twoWay = (u.effectifs[equipe] ?? []).filter((j) => u.contrats[j]?.type === 'two-way');
  const assignes = Object.entries(C?.assignes ?? {})
    .filter(([j, e]) => e === equipe && u.effectifs[equipe]?.includes(j))
    .map(([j]) => j);
  const affilies = Object.entries(C?.affilies ?? {})
    .filter(([j, e]) => e === equipe && u.horsNba[j] && u.joueurs[j])
    .map(([j]) => j);
  return [...twoWay, ...assignes, ...affilies];
}

function force(ctx: ContexteLigue, u: Univers, equipe: string): number {
  const P = modeleClub(ctx).gLeague.forceTop;
  const notes = effectifGLeague(u, equipe)
    .map((j) => u.joueurs[j]?.note ?? 40)
    .sort((a, b) => b - a);
  let s = 0;
  let p = 0;
  P.forEach((w, i) => {
    s += w * (notes[i] ?? 40);
    p += w;
  });
  return s / p;
}

/** Un joueur sous contrat standard peut-il être assigné en G League ? (ancienneté, effectif NBA suffisant). */
export function peutEtreAssigne(ctx: ContexteLigue, etat: EtatSaison, equipe: string, joueur: string): boolean {
  const u = etat.univers!;
  const c = u.contrats[joueur];
  if (!u.effectifs[equipe]?.includes(joueur) || c?.type !== 'standard' || c.dixJours) return false;
  if ((c.anciennete ?? 0) > modeleClub(ctx).gLeague.assignationAncienneteMax) return false;
  const restants = (u.effectifs[equipe] ?? []).filter((j) => j !== joueur && !u.club?.assignes[j] && u.contrats[j]?.type === 'standard');
  return restants.length >= ctx.regles.joueursSurLeTerrain + 3;
}

/** Assigne (ou rappelle) un joueur sous contrat standard. */
export function assignerEnGLeague(ctx: ContexteLigue, etat: EtatSaison, equipe: string, joueur: string, assigner: boolean): string {
  const u = etat.univers!;
  const C = clubDe(u);
  const nom = u.joueurs[joueur]?.nom ?? joueur;
  if (!assigner) {
    if (C.assignes[joueur] !== equipe) throw new Error('Ce joueur n’est pas assigné en G League.');
    delete C.assignes[joueur];
    return `${nom} est rappelé en NBA.`;
  }
  if (!peutEtreAssigne(ctx, etat, equipe, joueur))
    throw new Error(
      `Assignation impossible : contrat standard, ${modeleClub(ctx).gLeague.assignationAncienneteMax} saisons d’ancienneté au plus, et au moins ${ctx.regles.joueursSurLeTerrain + 3} joueurs restants.`,
    );
  C.assignes[joueur] = equipe;
  return `${nom} part jouer en G League.`;
}

// --- Calendrier. ---

function doubleTour(equipes: readonly string[], dans: MatchGLeague[], phase: MatchGLeague['phase']): void {
  for (let i = 0; i < equipes.length; i++)
    for (let j = i + 1; j < equipes.length; j++) {
      dans.push({ date: '', phase, domicile: equipes[i]!, exterieur: equipes[j]! });
      dans.push({ date: '', phase, domicile: equipes[j]!, exterieur: equipes[i]! });
    }
}

/** Ajoute à chaque équipe `n` matchs contre ses voisines (cycle), pour atteindre le nombre de matchs du format. */
function voisins(equipes: readonly string[], n: number, dans: MatchGLeague[], phase: MatchGLeague['phase']): void {
  const k = equipes.length;
  for (let d = 1; d <= n / 2; d++)
    for (let i = 0; i < k; i++) {
      const [a, b] = [equipes[i]!, equipes[(i + d) % k]!];
      dans.push({ date: '', phase, domicile: (i + d) % 2 ? a : b, exterieur: (i + d) % 2 ? b : a });
    }
}

function dater(matchs: MatchGLeague[], debut: string, fin: string, h: ReturnType<typeof hasardDuClub>): MatchGLeague[] {
  for (let i = matchs.length - 1; i > 0; i--) {
    const j = h.entier(0, i);
    [matchs[i], matchs[j]] = [matchs[j]!, matchs[i]!];
  }
  const jours = Math.max(1, joursEntre(debut, fin));
  matchs.forEach((m, k) => (m.date = ajouterJours(debut, Math.floor((k * (jours + 1)) / matchs.length))));
  return matchs;
}

/** Le format de la saison de G League, décalé sur la saison jouée. */
function format(ctx: ContexteLigue, saison: string) {
  const G = donneesClub(ctx)!.gLeague;
  const d = (x: string) => decalerDate(x, G.saison, saison);
  return {
    ...G,
    tipOff: { ...G.tipOff, debut: d(G.tipOff.debut), fin: d(G.tipOff.fin) },
    showcase: { ...G.showcase, debut: d(G.showcase.debut), fin: d(G.showcase.fin) },
    saisonReguliere: { ...G.saisonReguliere, debut: d(G.saisonReguliere.debut), fin: d(G.saisonReguliere.fin) },
    playoffs: { ...G.playoffs, debut: d(G.playoffs.debut) },
  };
}

/** Les quatre régions du Tip-Off (chaque conférence coupée en deux, dans l'ordre de ses divisions). */
function regions(ctx: ContexteLigue): string[][] {
  const r: string[][] = [];
  for (const c of ctx.structure.conferences) {
    const equipes = c.divisions.flatMap((d) => d.franchises);
    const moitie = Math.ceil(equipes.length / 2);
    r.push(equipes.slice(0, moitie), equipes.slice(moitie));
  }
  return r;
}

/**
 * Début de la saison de G League (au début de la saison régulière NBA) : joueurs hors NBA rattachés aux équipes
 * affiliées, assignations des jeunes par l'IA, calendrier du Tip-Off et de la saison régulière.
 */
export function nouvelleSaisonGLeague(ctx: ContexteLigue, etat: EtatSaison): void {
  const u = etat.univers!;
  const C = clubDe(u);
  const M = modeleClub(ctx).gLeague;
  const F = format(ctx, etat.saison);
  const h = hasardDuClub(etat, `g-league-${etat.saison}`);
  const equipes = Object.keys(ctx.equipes).sort();
  // Assignations de l'IA : ses jeunes au-delà d'un rang de son effectif.
  for (const e of equipes) {
    if (e === etat.franchise) continue;
    const parNote = (u.effectifs[e] ?? [])
      .filter((j) => u.contrats[j]?.type === 'standard')
      .sort((a, b) => (u.joueurs[b]?.note ?? 0) - (u.joueurs[a]?.note ?? 0) || (a < b ? -1 : 1));
    for (const j of parNote.slice(M.rangAssignationIa - 1)) if (peutEtreAssigne(ctx, etat, e, j)) C.assignes[j] = e;
  }
  // Joueurs hors NBA rattachés : les meilleurs en développement, puis les jeunes libres, répartis en serpentin.
  C.affilies = {};
  const candidats = Object.keys(u.horsNba)
    .filter((j) => u.joueurs[j] && (u.horsNba[j] === 'developpement' || u.joueurs[j]!.age <= 26))
    .sort(
      (a, b) =>
        (u.horsNba[a] === u.horsNba[b] ? 0 : u.horsNba[a] === 'developpement' ? -1 : 1) ||
        u.joueurs[b]!.note - u.joueurs[a]!.note ||
        (a < b ? -1 : 1),
    );
  const ordre = equipes.slice();
  for (let i = ordre.length - 1; i > 0; i--) {
    const j = h.entier(0, i);
    [ordre[i], ordre[j]] = [ordre[j]!, ordre[i]!];
  }
  let k = 0;
  for (let tour = 0; tour < M.effectif && k < candidats.length; tour++) {
    const sens = tour % 2 ? [...ordre].reverse() : ordre;
    for (const e of sens) {
      if (effectifGLeague(u, e).length >= M.effectif) continue;
      const j = candidats[k++];
      if (!j) break;
      C.affilies[j] = e;
    }
  }
  // Calendrier : Tip-Off (14 matchs par région), saison régulière (36 matchs par conférence).
  const tipOff: MatchGLeague[] = [];
  for (const r of regions(ctx)) {
    doubleTour(r, tipOff, 'tip-off');
    const manquants = F.tipOff.matchs - 2 * (r.length - 1);
    if (manquants > 0) voisins(r, manquants, tipOff, 'tip-off');
  }
  const reguliere: MatchGLeague[] = [];
  for (const c of ctx.structure.conferences) {
    const eqs = c.divisions.flatMap((d) => d.franchises);
    doubleTour(eqs, reguliere, 'reguliere');
    const manquants = F.saisonReguliere.matchs - 2 * (eqs.length - 1);
    if (manquants > 0) voisins(eqs, manquants, reguliere, 'reguliere');
  }
  const matchs = [
    ...dater(tipOff, F.tipOff.debut, F.tipOff.fin, h),
    ...dater(reguliere, F.saisonReguliere.debut, F.saisonReguliere.fin, h),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  etatClub(etat).gLeague = { matchs, prochain: 0, statistiques: {} };
}

// --- Matchs. ---

function jouer(ctx: ContexteLigue, etat: EtatSaison, G: SaisonGLeague, m: MatchGLeague, index: number): void {
  const u = etat.univers!;
  const M = modeleClub(ctx).gLeague;
  const h = hasardDuClub(etat, `g-league-match-${etat.saison}-${index}`);
  const fD = force(ctx, u, m.domicile) + M.avantageDomicile;
  const fE = force(ctx, u, m.exterieur);
  const p = 1 / (1 + Math.exp(-(fD - fE) / M.echelle));
  const domicileGagne = h.reel() < p;
  const total = 2 * M.pointsMoyens + Math.round((h.reel() - 0.5) * M.ecartPoints * 2);
  const marge = 1 + Math.floor(h.reel() * M.ecartPoints * 1.5);
  const gagnant = Math.round((total + marge) / 2);
  const perdant = gagnant - marge;
  m.score = domicileGagne ? [gagnant, perdant] : [perdant, gagnant];
  [m.domicile, m.exterieur].forEach((e, i) => repartir(ctx, u, G, e, m.score![i]!));
}

/** Minutes et statistiques d'une équipe sur un match, selon la note et le poste. */
function repartir(ctx: ContexteLigue, u: Univers, G: SaisonGLeague, equipe: string, points: number): void {
  const M = modeleClub(ctx).gLeague;
  const joueurs = effectifGLeague(u, equipe)
    .filter((j) => u.joueurs[j])
    .sort((a, b) => u.joueurs[b]!.note - u.joueurs[a]!.note || (a < b ? -1 : 1))
    .slice(0, M.minutes.length);
  const minutes = joueurs.map((_, i) => M.minutes[i]!);
  const poids = joueurs.map((j, i) => minutes[i]! * Math.max(1, u.joueurs[j]!.note - 30));
  const total = poids.reduce((s, x) => s + x, 0) || 1;
  const groupe = (poste: string) => (poste.includes('C') ? 'C' : poste.includes('F') ? 'F' : 'G');
  const rebonds = { C: 1.6, F: 1.2, G: 0.7 };
  const passes = { C: 0.6, F: 0.9, G: 1.6 };
  const sR = joueurs.reduce((s, j, i) => s + minutes[i]! * rebonds[groupe(u.joueurs[j]!.poste)], 0) || 1;
  const sP = joueurs.reduce((s, j, i) => s + minutes[i]! * passes[groupe(u.joueurs[j]!.poste)], 0) || 1;
  joueurs.forEach((j, i) => {
    const l: LigneGLeague = (G.statistiques[j] ??= { equipe, matchs: 0, minutes: 0, points: 0, rebonds: 0, passes: 0 });
    const g = groupe(u.joueurs[j]!.poste);
    l.equipe = equipe;
    l.matchs++;
    l.minutes += minutes[i]!;
    l.points += (points * poids[i]!) / total;
    l.rebonds += (44 * minutes[i]! * rebonds[g]) / sR;
    l.passes += (24 * minutes[i]! * passes[g]) / sP;
  });
}

/** Bilans (victoires, défaites) d'une phase de la saison de G League. */
export function bilansGLeague(G: SaisonGLeague, phase: MatchGLeague['phase']): Record<string, [number, number, number]> {
  const b: Record<string, [number, number, number]> = {};
  for (const m of G.matchs) {
    if (m.phase !== phase || !m.score) continue;
    const [d, e] = m.score;
    const bd = (b[m.domicile] ??= [0, 0, 0]);
    const be = (b[m.exterieur] ??= [0, 0, 0]);
    bd[d > e ? 0 : 1]++;
    be[e > d ? 0 : 1]++;
    bd[2] += d - e;
    be[2] += e - d;
  }
  return b;
}

const classerBilans = (equipes: string[], b: Record<string, [number, number, number]>): string[] =>
  equipes.slice().sort((x, y) => {
    const [vx, dx, px] = b[x] ?? [0, 0, 0];
    const [vy, dy, py] = b[y] ?? [0, 0, 0];
    return vy / Math.max(1, vy + dy) - vx / Math.max(1, vx + dx) || py - px || (x < y ? -1 : 1);
  });

/** Ajoute les tours suivants (Showcase, playoffs) quand la phase précédente est terminée. */
function etapesSuivantes(ctx: ContexteLigue, etat: EtatSaison, G: SaisonGLeague): void {
  const F = format(ctx, etat.saison);
  const fini = (phase: MatchGLeague['phase'], tour?: number) =>
    G.matchs.filter((m) => m.phase === phase && (tour === undefined || m.tour === tour)).every((m) => m.score);
  const existe = (phase: MatchGLeague['phase'], tour: number) => G.matchs.some((m) => m.phase === phase && m.tour === tour);
  const vainqueurs = (phase: MatchGLeague['phase'], tour: number) =>
    G.matchs.filter((m) => m.phase === phase && m.tour === tour).map((m) => (m.score![0] > m.score![1] ? m.domicile : m.exterieur));
  const ajouter = (phase: MatchGLeague['phase'], tour: number, date: string, paires: [string, string][]) =>
    paires.forEach(([a, b]) => G.matchs.push({ date, phase, tour, domicile: a, exterieur: b }));
  // Winter Showcase : premiers de région et meilleurs suivants, élimination directe.
  if (fini('tip-off') && !existe('showcase', 1)) {
    const b = bilansGLeague(G, 'tip-off');
    const premiers = regions(ctx).map((r) => classerBilans(r, b)[0]!);
    const autres = classerBilans(
      Object.keys(b).filter((e) => !premiers.includes(e)),
      b,
    ).slice(0, F.showcase.qualifies - premiers.length);
    const s = classerBilans([...premiers, ...autres], b);
    const n = s.length;
    ajouter(
      'showcase',
      1,
      F.showcase.debut,
      Array.from({ length: n / 2 }, (_, i) => [s[i]!, s[n - 1 - i]!]),
    );
  }
  const dernierTour = (phase: MatchGLeague['phase']) => Math.max(0, ...G.matchs.filter((m) => m.phase === phase).map((m) => m.tour ?? 0));
  const tS = dernierTour('showcase');
  if (tS && fini('showcase', tS) && !G.vainqueurShowcase) {
    const v = vainqueurs('showcase', tS);
    if (v.length === 1) G.vainqueurShowcase = v[0];
    else
      ajouter(
        'showcase',
        tS + 1,
        ajouterJours(F.showcase.debut, tS),
        Array.from({ length: v.length / 2 }, (_, i) => [v[2 * i]!, v[2 * i + 1]!]),
      );
  }
  // Playoffs : huit par conférence, matchs secs, puis finale au meilleur des trois.
  if (fini('reguliere') && G.matchs.some((m) => m.phase === 'reguliere') && !existe('playoffs', 1)) {
    const b = bilansGLeague(G, 'reguliere');
    const paires: [string, string][] = [];
    for (const c of ctx.structure.conferences) {
      const s = classerBilans(
        c.divisions.flatMap((d) => d.franchises),
        b,
      ).slice(0, F.playoffs.parConference);
      for (const [x, y] of [
        [0, 7],
        [3, 4],
        [2, 5],
        [1, 6],
      ] as const)
        if (s[x] && s[y]) paires.push([s[x], s[y]]);
    }
    ajouter('playoffs', 1, F.playoffs.debut, paires);
  }
  const tP = dernierTour('playoffs');
  // La finale (au meilleur des trois) ne se prolonge pas : son vainqueur est désigné dans jouerGLeague.
  const finale = G.matchs.some((m) => m.phase === 'playoffs' && m.tour === tP && m.finale);
  if (tP && !finale && fini('playoffs', tP) && !G.champion) {
    const v = vainqueurs('playoffs', tP);
    const date = ajouterJours(F.playoffs.debut, 2 * tP);
    if (v.length === 2) {
      // Finale au meilleur des trois : les trois matchs sont posés, le troisième n'est joué que s'il le faut.
      for (let k = 0; k < 2 * F.playoffs.finaleVictoires - 1; k++)
        G.matchs.push({
          date: ajouterJours(date, k),
          phase: 'playoffs',
          tour: tP + 1,
          finale: true,
          domicile: k % 2 ? v[1]! : v[0]!,
          exterieur: k % 2 ? v[0]! : v[1]!,
        });
    } else if (v.length > 2)
      ajouter(
        'playoffs',
        tP + 1,
        date,
        Array.from({ length: v.length / 2 }, (_, i) => [v[2 * i]!, v[2 * i + 1]!]),
      );
  }
}

/** Le vainqueur d'une finale au meilleur des trois (ou undefined si elle n'est pas finie). */
function vainqueurFinale(G: SaisonGLeague, tour: number, victoires: number): string | undefined {
  const c: Record<string, number> = {};
  for (const m of G.matchs.filter((x) => x.phase === 'playoffs' && x.tour === tour && x.score)) {
    const v = m.score![0] > m.score![1] ? m.domicile : m.exterieur;
    c[v] = (c[v] ?? 0) + 1;
    if (c[v]! >= victoires) return v;
  }
  return undefined;
}

/** Joue les matchs de G League jusqu'à une date (comprise). */
export function jouerGLeague(ctx: ContexteLigue, etat: EtatSaison, jusqua: string): void {
  const G = etat.club?.gLeague;
  if (!G || G.champion) return;
  const F = format(ctx, etat.saison);
  const u = etat.univers!;
  for (let garde = 0; garde < 2000; garde++) {
    etapesSuivantes(ctx, etat, G);
    const a = G.matchs
      .map((m, i) => ({ m, i }))
      .filter((x) => !x.m.score && x.m.date <= jusqua)
      .sort((x, y) => (x.m.date < y.m.date ? -1 : x.m.date > y.m.date ? 1 : x.i - y.i));
    if (!a.length) break;
    let champion: string | undefined;
    for (const { m, i } of a) {
      jouer(ctx, etat, G, m, i);
      if (m.finale && (champion = vainqueurFinale(G, m.tour!, F.playoffs.finaleVictoires))) break;
    }
    if (champion) {
      G.champion = champion;
      // Le match de la finale devenu inutile disparaît.
      G.matchs = G.matchs.filter((m) => !(m.finale && !m.score));
      publier(etat, {
        date: etat.date,
        genre: 'g-league',
        importance: champion === etat.franchise ? 3 : 1,
        equipes: [champion],
        titre: `G League : l’équipe affiliée de ${nomEquipe(ctx, u, champion)} championne`,
        texte: `L’équipe de développement de ${nomEquipe(ctx, u, champion)} remporte la finale de G League.`,
      });
      break;
    }
  }
  G.prochain = G.matchs.findIndex((m) => !m.score);
}

/** Bonus de progression à l'intersaison d'un joueur qui a assez joué en G League (borné, jeunes seulement). */
export function bonusGLeague(ctx: ContexteLigue, etat: EtatSaison, joueur: string, age: number): number {
  const P = donneesClub(ctx)?.modele.gLeague.progression;
  const l = etat.club?.gLeague?.statistiques[joueur];
  if (!P || !l) return 0;
  return l.matchs >= P.matchsMin && age <= P.ageMax ? P.bonus : 0;
}
