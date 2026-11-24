// Tranche 4 : calendrier, classements, Play-In, playoffs, All-Star Game, récompenses, actualités et sauvegarde.
import { describe, expect, it } from 'vitest';
import {
  appartenances,
  avancer,
  calculerBilans,
  classer,
  creerSauvegarde,
  genererCalendrier,
  joursEntre,
  lireSauvegarde,
  nouvelleSaison,
  rejouerMatch,
  type EtatSaison,
  type ResumeMatch,
} from '../src';
import { chargerContexte } from './outils';

const ctx = chargerContexte();
const S = ctx.structure;
const A = appartenances(S);
const equipes = Object.keys(A);

describe('calendrier', () => {
  const cal = genererCalendrier(S, 2026);
  const matchs = cal.flatMap((j) => j.matchs);

  it('donne 82 matchs à chaque équipe, dont 41 à domicile, selon la formule NBA', () => {
    expect(matchs).toHaveLength((equipes.length * S.calendrier.matchsParEquipe) / 2);
    for (const e of equipes) {
      const siens = matchs.filter((m) => m.domicile === e || m.exterieur === e);
      expect(siens).toHaveLength(82);
      expect(siens.filter((m) => m.domicile === e)).toHaveLength(41);
      const contre = new Map<string, number>();
      for (const m of siens) {
        const a = m.domicile === e ? m.exterieur : m.domicile;
        contre.set(a, (contre.get(a) ?? 0) + 1);
      }
      for (const [a, n] of contre) {
        if (A[a]!.division === A[e]!.division) expect(n).toBe(4);
        else if (A[a]!.conference !== A[e]!.conference) expect(n).toBe(2);
      }
      const conf = [...contre].filter(([a]) => A[a]!.conference === A[e]!.conference && A[a]!.division !== A[e]!.division);
      expect(conf.filter(([, n]) => n === 4)).toHaveLength(6);
      expect(conf.filter(([, n]) => n === 3)).toHaveLength(4);
    }
  });

  it('tient dans les dates officielles, sans match double ni trois jours de suite', () => {
    expect(cal[0]!.date).toBe(S.calendrier.premierJour);
    expect(joursEntre(S.calendrier.premierJour, cal.at(-1)!.date)).toBeLessThanOrEqual(
      joursEntre(S.calendrier.premierJour, S.calendrier.dernierJour),
    );
    const parEquipe = new Map<string, string[]>();
    for (const j of cal) {
      const jour = j.matchs.flatMap((m) => [m.domicile, m.exterieur]);
      expect(new Set(jour).size).toBe(jour.length);
      for (const e of jour) parEquipe.set(e, [...(parEquipe.get(e) ?? []), j.date]);
    }
    for (const dates of parEquipe.values()) {
      for (let i = 2; i < dates.length; i++) expect(joursEntre(dates[i - 2]!, dates[i]!)).toBeGreaterThan(2);
    }
  });

  it('est déterministe', () => {
    expect(genererCalendrier(S, 2026)).toEqual(cal);
    expect(genererCalendrier(S, 2027)).not.toEqual(cal);
  });
});

describe('départages', () => {
  const resume = (id: number, domicile: string, exterieur: string, score: [number, number]): ResumeMatch => ({
    id,
    nature: 'reguliere',
    date: '2026-10-20',
    domicile,
    exterieur,
    graine: id,
    score,
    prolongations: 0,
    absents: [],
    empreinte: '',
    interet: 0,
    moments: [],
  });
  const [b, br, ny, ph, to] = S.conferences[0]!.divisions[0]!.franchises as [string, string, string, string, string];
  const [chi] = S.conferences[0]!.divisions[1]!.franchises as [string];

  it('départage deux équipes par leurs confrontations', () => {
    const matchs = [
      resume(1, b, br, [100, 90]),
      resume(2, br, b, [100, 90]),
      resume(3, b, br, [100, 90]),
      resume(4, chi, br, [80, 100]),
      resume(5, chi, b, [100, 80]),
    ];
    const c = classer(S, calculerBilans(S, matchs), 1);
    const est = c.conferences['est']!;
    expect(est.indexOf(b)).toBeLessThan(est.indexOf(br));
  });

  it('reprend depuis le début après un départage partiel, et tire au sort en dernier recours, toujours pareil', () => {
    const matchs = [resume(1, b, ny, [100, 90]), resume(2, ny, ph, [100, 90]), resume(3, ph, b, [100, 90]), resume(4, to, chi, [90, 100])];
    const bilans = calculerBilans(S, matchs);
    const c1 = classer(S, bilans, 7);
    expect(classer(S, bilans, 7)).toEqual(c1);
    // Trois équipes à 1-1 entre elles : le classement est complet et chaque équipe y figure une fois.
    expect(new Set(c1.conferences['est'])).toEqual(new Set(S.conferences[0]!.divisions.flatMap((d) => d.franchises)));
  });
});

describe('une saison complète', () => {
  const debut = performance.now();
  const fin = avancer(ctx, nouvelleSaison(ctx, 2026, 'boston'), 'fin');
  const duree = performance.now() - debut;
  const reguliere = fin.matchs.filter((m) => m.nature === 'reguliere');

  it('se joue en moins de 10 secondes', () => {
    expect(fin.phase).toBe('terminee');
    expect(duree).toBeLessThan(10_000);
  });

  it('joue les 82 matchs de chaque équipe et des statistiques cohérentes avec les scores', () => {
    expect(reguliere).toHaveLength(1230);
    const bilans = calculerBilans(S, fin.matchs);
    for (const e of equipes) expect(bilans[e]!.victoires + bilans[e]!.defaites).toBe(82);
    const points = Object.values(fin.statistiques).reduce((s, t) => s + t.points, 0);
    expect(points).toBe(reguliere.reduce((s, m) => s + m.score[0] + m.score[1], 0));
    for (const t of Object.values(fin.statistiques)) expect(t.matchs).toBeLessThanOrEqual(82);
  });

  it('répartit les points comme en 2025-26 (meilleur marqueur vers 33,5 points, 10e vers 26)', () => {
    const ppm = Object.values(fin.statistiques)
      .filter((t) => t.matchs >= 58)
      .map((t) => t.points / t.matchs)
      .sort((a, b) => b - a);
    expect(ppm[0]).toBeGreaterThan(28);
    expect(ppm[0]).toBeLessThan(38);
    expect(ppm[9]).toBeGreaterThan(22);
    expect(ppm[9]).toBeLessThan(30);
  });

  it('tient compte des blessures : des joueurs manquent des matchs', () => {
    expect(reguliere.filter((m) => m.absents.length > 0).length).toBeGreaterThan(50);
  });

  it('organise le Play-In puis des playoffs à 16 équipes jusqu’au champion', () => {
    expect(fin.playIn).toHaveLength(2);
    for (const p of fin.playIn!) {
      expect(p.equipes).toHaveLength(4);
      expect(p.septieme).toBe(p.equipes.slice(0, 2).find((e) => e === p.septieme));
      expect(p.huitieme).toBeDefined();
    }
    const premierTour = fin.series!.filter((s) => s.tour === 1);
    expect(premierTour).toHaveLength(8);
    expect(new Set(premierTour.flatMap((s) => [s.haut, s.bas])).size).toBe(16);
    for (const s of fin.series!) {
      expect(Math.max(...s.victoires)).toBe(S.playoffs.victoiresPourGagnerUneSerie);
      expect(s.matchs.length).toBe(s.victoires[0] + s.victoires[1]);
    }
    const finale = fin.series!.find((s) => s.conference === null)!;
    expect(fin.palmares!.champion).toBe(finale.vainqueur);
    expect(fin.series!.filter((s) => s.conference !== null)).toHaveLength(14);
  });

  it('respecte le format 2-2-1-1-1 des séries', () => {
    for (const s of fin.series!) {
      s.matchs.forEach((id, n) => {
        const m = fin.matchs.find((x) => x.id === id)!;
        expect(m.domicile).toBe(S.playoffs.receveurParMatch[n] === 'haut' ? s.haut : s.bas);
      });
    }
  });

  it('élit des All-Stars et décerne des récompenses selon la règle des 65 matchs', () => {
    for (const c of S.conferences) {
      expect(fin.allStar!.titulaires[c.id]).toHaveLength(S.allStar.titulairesParConference);
      expect(fin.allStar!.remplacants[c.id]).toHaveLength(S.allStar.remplacantsParConference);
      for (const j of [...fin.allStar!.titulaires[c.id]!, ...fin.allStar!.remplacants[c.id]!])
        expect(A[fin.statistiques[j]!.equipe]!.conference).toBe(c.id);
    }
    const P = fin.palmares!;
    for (const id of [P.mvp, P.defenseur, P.progression, ...P.allNba.flat()])
      expect(fin.statistiques[id!]!.matchsEligibles).toBeGreaterThanOrEqual(S.recompenses.matchsMinimum);
    expect(P.allNba.flat()).toHaveLength(15);
    expect(new Set(P.allNba.flat()).size).toBe(15);
    expect(ctx.recrues).toContain(P.rookie);
    expect(fin.statistiquesFinale[P.mvpFinale!]!.equipe).toBe(P.champion);
  });

  it('rejoue chaque match à l’identique (mode commenté, match de la semaine, All-Star Game)', () => {
    const echantillon = [
      ...fin.matchs.filter((m) => m.absents.length).slice(0, 5),
      ...fin.matchs.filter((m) => m.nature !== 'reguliere').slice(0, 5),
    ];
    for (const m of echantillon) expect(rejouerMatch(ctx, fin, m).empreinte).toBe(m.empreinte);
    const semaine = fin.actualites.filter((a) => a.genre === 'match-de-la-semaine');
    expect(semaine.length).toBeGreaterThan(20);
  });

  it('publie des actualités datées, avec les moments marquants et le palmarès', () => {
    expect(fin.actualites.some((a) => a.genre === 'moment')).toBe(true);
    expect(fin.actualites.some((a) => a.genre === 'palmares')).toBe(true);
    expect(fin.actualites.some((a) => a.genre === 'all-star')).toBe(true);
    const dates = fin.actualites.map((a) => a.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('est déterministe et indépendante du découpage en étapes', () => {
    let etat: EtatSaison = nouvelleSaison(ctx, 2026, 'boston');
    etat = avancer(ctx, etat, 'semaine');
    etat = avancer(ctx, etat, 'all-star');
    etat = avancer(ctx, etat, 'fin-reguliere');
    etat = avancer(ctx, etat, 'fin');
    expect(etat.palmares).toEqual(fin.palmares);
    expect(etat.matchs.map((m) => m.empreinte)).toEqual(fin.matchs.map((m) => m.empreinte));
  }, 30_000);

  it('se sauvegarde et se relit sans perte (format versionné)', () => {
    const s = creerSauvegarde(fin, { regles: 'nba-2026-27', moteur: 'match-v3', notes: 'notes-v1' }, '2026-11-24T12:00:00Z');
    const relue = lireSauvegarde(JSON.parse(JSON.stringify(s)));
    expect(relue.etat).toEqual(fin);
    expect(() => lireSauvegarde({ ...s, schemaVersion: 99 })).toThrow(/Sauvegarde illisible/);
  });
});
