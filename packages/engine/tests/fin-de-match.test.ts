// Tranche 3 : temps-morts, fins de période et de match, position des tirs (300 matchs).
import { describe, expect, it } from 'vitest';
import { simulerMatch, type Evenement, type ResultatMatch } from '../src';
import { equipes, regles, reglages } from './outils';

const lot: ResultatMatch[] = Array.from({ length: 300 }, (_, g) => {
  const a = equipes[g % 30]!;
  const b = equipes[(g * 11 + 5 + Math.floor(g / 30)) % 30]!;
  return simulerMatch({ graine: 5000 + g, domicile: a, exterieur: a.id === b.id ? equipes[(g + 1) % 30]! : b, regles, reglages });
});
const de = <T extends Evenement['type']>(r: ResultatMatch, type: T) =>
  r.evenements.filter((e): e is Extract<Evenement, { type: T }> => e.type === type);
const R = regles;

describe('temps-morts (Rule No. 5, Section VI)', () => {
  it('respectent les limites par match, au quatrième quart-temps, en fin de match et en prolongation', () => {
    for (const r of lot) {
      const tm = de(r, 'temps_mort');
      for (const c of [0, 1] as const) {
        const charges = tm.filter((t) => t.equipe === c);
        const reglementaire = charges.filter((t) => t.periode <= R.periodesReglementaires);
        expect(reglementaire.length).toBeLessThanOrEqual(R.tempsMortsParMatch);
        const quatrieme = charges.filter((t) => t.periode === R.periodesReglementaires);
        expect(quatrieme.length).toBeLessThanOrEqual(R.tempsMortsMaxQuatriemePeriode);
        expect(quatrieme.filter((t) => t.restant <= R.debutFinDeMatchTempsMortsSecondes * 10).length).toBeLessThanOrEqual(
          R.tempsMortsMaxFinDeMatch,
        );
        for (let p = R.periodesReglementaires + 1; p <= R.periodesReglementaires + r.boxScore.prolongations; p++) {
          expect(charges.filter((t) => t.periode === p).length).toBeLessThanOrEqual(R.tempsMortsParProlongation);
        }
      }
    }
  });

  it('donnent au moins deux temps-morts par quart-temps (temps-morts obligatoires)', () => {
    for (const r of lot) {
      for (let p = 1; p <= R.periodesReglementaires; p++) {
        const tm = de(r, 'temps_mort').filter((t) => t.periode === p);
        expect(tm.length).toBeGreaterThanOrEqual(2);
        // Le premier obligatoire tombe à 6:59 ou après, et il est chargé à l'équipe qui reçoit si personne n'en a pris.
        const premier = tm[0]!;
        if (premier.nature === 'obligatoire') {
          expect(premier.restant).toBeLessThanOrEqual(R.repereTempsMortObligatoire1Secondes * 10);
          expect(premier.equipe === 0 || premier.equipe === null).toBe(true);
        }
      }
    }
  });

  it('ne changent pas le chronomètre et sont pris à ballon mort, avant une possession', () => {
    for (const r of lot) {
      r.evenements.forEach((e, i) => {
        if (e.type !== 'temps_mort') return;
        const precedent = r.evenements[i - 1]!;
        // Juste après un panier, des lancers, une faute, une perte de balle non interceptée, un remplacement ou un autre temps-mort.
        expect([
          'tir',
          'lancer_franc',
          'faute',
          'perte_de_balle',
          'remplacement',
          'temps_mort',
          'exclusion',
          'rebond',
          'rebond_equipe',
        ]).toContain(precedent.type);
        expect(e.restant).toBe(precedent.restant);
      });
    }
  });
});

describe('fins de période et de match', () => {
  it('ne tire jamais avec moins que le temps minimal ni après la fin de la période', () => {
    for (const r of lot) for (const t of de(r, 'tir')) expect(t.restant).toBeGreaterThanOrEqual(0);
  });

  it('produit des tirs au buzzer, des fautes volontaires et des actions préparées, sans excès', () => {
    const buzzers = lot.flatMap((r) => de(r, 'tir').filter((t) => t.auBuzzer));
    const volontaires = lot.flatMap((r) => de(r, 'faute').filter((f) => f.volontaire));
    const preparees = lot.flatMap((r) => de(r, 'tir').filter((t) => t.preparee));
    expect(buzzers.length).toBeGreaterThan(300);
    expect(buzzers.length).toBeLessThan(300 * 8);
    expect(volontaires.length).toBeGreaterThan(20);
    expect(preparees.length).toBeGreaterThan(10);
    // Une faute volontaire n'arrive que dans les deux dernières minutes d'une fin de match, par l'équipe menée.
    for (const r of lot) {
      let score: [number, number] = [0, 0];
      for (const e of r.evenements) {
        if ('score' in e && e.type !== 'fin_periode') score = e.score;
        if (e.type === 'faute' && e.volontaire) {
          expect(e.periode).toBeGreaterThanOrEqual(R.periodesReglementaires);
          expect(e.restant).toBeLessThanOrEqual(R.finDePeriodeSecondes * 10);
          expect(score[e.equipe]).toBeLessThan(score[e.equipe === 0 ? 1 : 0]);
        }
      }
    }
  });

  it("l'équipe qui mène laisse filer la dernière possession", () => {
    let filees = 0;
    for (const r of lot) {
      const fin = r.evenements.at(-1)!;
      const dernierTir = de(r, 'tir').at(-1)!;
      if (fin.type === 'fin_periode' && dernierTir.periode === fin.periode && dernierTir.restant > R.horlogeEteinteSousSecondes * 10)
        filees++;
    }
    expect(filees).toBeGreaterThan(10);
  });
});

describe('position des tirs', () => {
  it('place chaque tir dans sa zone', () => {
    for (const r of lot) {
      for (const t of de(r, 'tir')) {
        const { distance, angle } = t.position;
        expect(Math.abs(angle)).toBeLessThanOrEqual(90);
        if (t.tir === 'cercle') expect(distance).toBeLessThanOrEqual(3);
        if (t.tir === 'miDistance') {
          expect(distance).toBeGreaterThanOrEqual(3);
          expect(distance).toBeLessThan(R.ligneATroisPointsPieds);
        }
        if (t.tir === 'troisPoints') expect(distance).toBeGreaterThanOrEqual(reglages.positions.distanceTroisDansLesCoinsPieds);
      }
    }
  });

  it('ne change pas le cours du match (générateur à part)', () => {
    const r = lot[0]!;
    const sansPosition = r.evenements.map((e) => (e.type === 'tir' ? { ...e, position: undefined } : e));
    const autre = simulerMatch({
      graine: r.graine,
      domicile: equipes[0]!,
      exterieur: equipes.find((e) => e.id === r.boxScore.equipes[1].id)!,
      regles,
      reglages: { ...reglages, positions: { ...reglages.positions, partTroisDansLesCoins: 0.9 } },
    });
    expect(autre.evenements.map((e) => (e.type === 'tir' ? { ...e, position: undefined } : e))).toEqual(sansPosition);
  });
});
