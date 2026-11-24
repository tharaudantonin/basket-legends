// Tranche 3 : mode commenté, moments marquants et fiche joueur, tous déduits du journal.
import { describe, expect, it } from 'vitest';
import {
  adresseParTranche,
  boxScoreAuMoment,
  chrono,
  cinqAuMoment,
  commenterMatch,
  detecterMoments,
  interetDuMatch,
  scoreFinal,
  simulerMatch,
  tirsDuJoueur,
  type ResultatMatch,
} from '../src';
import { entree, equipe, equipes, regles, reglages } from './outils';

const N = regles.periodesReglementaires;
const lot: ResultatMatch[] = Array.from({ length: 200 }, (_, g) => {
  const a = equipes[g % 30]!;
  const b = equipes[(g * 13 + 2 + Math.floor(g / 30)) % 30]!;
  return simulerMatch({ graine: 9000 + g, domicile: a, exterieur: a.id === b.id ? equipes[(g + 1) % 30]! : b, regles, reglages });
});

describe('mode commenté', () => {
  it('raconte le même match que le mode rapide : rejouer tout le journal redonne le box score', () => {
    const r = simulerMatch(entree(2026, 'boston', 'new-york'));
    const eqs = [equipe('boston'), equipe('new-york')] as const;
    const rejoue = boxScoreAuMoment(r.evenements, [eqs[0], eqs[1]], r.evenements.length - 1, N);
    expect(rejoue).toEqual(r.boxScore);
  });

  it('suit le score pas à pas et finit sur le score du box score', () => {
    for (const r of lot.slice(0, 50)) {
      const lignes = commenterMatch(r, N);
      expect(lignes.at(-1)!.score).toEqual(scoreFinal(r.boxScore));
      expect(lignes.at(-1)!.texte).toMatch(/^Fin du match/);
      // Le score ne baisse jamais et les index avancent.
      for (let i = 1; i < lignes.length; i++) {
        expect(lignes[i]!.indice).toBeGreaterThan(lignes[i - 1]!.indice);
        expect(lignes[i]!.score[0]).toBeGreaterThanOrEqual(lignes[i - 1]!.score[0]);
        expect(lignes[i]!.score[1]).toBeGreaterThanOrEqual(lignes[i - 1]!.score[1]);
      }
      // Le box score en direct à chaque ligne a le score de la ligne.
      const eqs: [ReturnType<typeof equipe>, ReturnType<typeof equipe>] = [
        equipe(r.boxScore.equipes[0].id),
        equipe(r.boxScore.equipes[1].id),
      ];
      for (const l of lignes.filter((_, i) => i % 40 === 0)) {
        const b = boxScoreAuMoment(r.evenements, eqs, l.indice, N);
        expect(scoreFinal(b)).toEqual(l.score);
      }
    }
  });

  it('couvre chaque panier et chaque série de lancers du journal', () => {
    const r = lot[3]!;
    const lignes = commenterMatch(r, N);
    const paniers = r.evenements.filter((e) => e.type === 'tir' && e.reussi).length;
    expect(lignes.filter((l) => l.genre === 'panier').length).toBe(paniers);
    const lancersTentes = r.boxScore.equipes[0].totaux.lancersTentes + r.boxScore.equipes[1].totaux.lancersTentes;
    const lignesLancers = lignes.filter((l) => l.genre === 'lancers');
    const total = lignesLancers.reduce((s, l) => s + Number(/sur (\d+)/.exec(l.texte)![1]), 0);
    expect(total).toBe(lancersTentes);
  });

  it("n'affiche que des noms fictifs connus et des phrases complètes", () => {
    const r = lot[7]!;
    for (const l of commenterMatch(r, N)) {
      expect(l.texte).not.toMatch(/\bj\d{4}\b/);
      expect(l.texte).toMatch(/[.!]$/);
    }
  });

  it('formate le chronomètre', () => {
    expect(chrono(7200)).toBe('12:00');
    expect(chrono(4623)).toBe('7:42');
    expect(chrono(43)).toBe('0:04.3');
  });

  it('suit le cinq sur le terrain', () => {
    const r = lot[0]!;
    const fin = cinqAuMoment(r.evenements, r.evenements.length - 1);
    expect(fin[0]).toHaveLength(5);
    expect(fin[1]).toHaveLength(5);
  });
});

describe('moments marquants', () => {
  const tous = lot.map((r) => ({ r, m: detecterMoments(r) }));

  it('sont cohérents avec le box score', () => {
    for (const { r, m } of tous) {
      for (const x of m.filter((y) => y.genre === 'points')) {
        const j = r.boxScore.equipes[x.equipe!].joueurs.find((y) => y.id === x.joueur)!;
        expect(j.points).toBeGreaterThanOrEqual(30);
      }
      if (r.boxScore.prolongations) expect(m.some((x) => x.genre === 'prolongations')).toBe(true);
      for (const x of m.filter((y) => y.genre === 'buzzer_vainqueur')) {
        const ev = r.evenements[x.indice!]!;
        expect(ev.type === 'tir' && ev.auBuzzer && ev.reussi).toBe(true);
      }
      for (let i = 1; i < m.length; i++) expect(m[i]!.importance).toBeLessThanOrEqual(m[i - 1]!.importance);
    }
  });

  it('en trouvent dans une partie des matchs, sans en mettre partout', () => {
    const avec = tous.filter((x) => x.m.some((y) => y.importance >= 2)).length;
    expect(avec).toBeGreaterThan(20);
    expect(avec).toBeLessThan(180);
  });

  it("classent l'intérêt des matchs (match de la semaine)", () => {
    const interets = tous.map((x) => interetDuMatch(x.m, x.r.boxScore));
    expect(Math.max(...interets)).toBeGreaterThan(Math.min(...interets));
  });
});

describe('fiche joueur : graphique d’adresse', () => {
  it('compte les mêmes tirs que le box score', () => {
    for (const r of lot.slice(0, 30)) {
      for (const eq of r.boxScore.equipes) {
        for (const j of eq.joueurs) {
          const tirs = tirsDuJoueur(r.evenements, j.id);
          const tranches = adresseParTranche(tirs);
          expect(tranches.reduce((s, t) => s + t.tentes, 0)).toBe(j.tirsTentes);
          expect(tranches.reduce((s, t) => s + t.reussis, 0)).toBe(j.tirsReussis);
          expect(tranches.filter((t) => t.tranche === 'trois_coin' || t.tranche === 'trois_arc').reduce((s, t) => s + t.tentes, 0)).toBe(
            j.troisTentes,
          );
        }
      }
    }
  });
});
