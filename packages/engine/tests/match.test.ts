import { describe, expect, it } from 'vitest';
import { simulerMatch, type Evenement, type ResultatMatch } from '../src';
import { entree, equipes, regles, reglages } from './outils';

// Un lot varié de matchs : chaque franchise reçoit et se déplace.
const lot: ResultatMatch[] = Array.from({ length: 300 }, (_, g) => {
  const a = equipes[g % 30]!;
  const b = equipes[(g * 7 + 1 + Math.floor(g / 30)) % 30]!;
  return simulerMatch({ graine: 1000 + g, domicile: a, exterieur: a.id === b.id ? equipes[(g + 1) % 30]! : b, regles, reglages });
});

const dureeTotale = (r: ResultatMatch): number =>
  (regles.periodesReglementaires * regles.dureePeriodeSecondes + r.boxScore.prolongations * regles.dureeProlongationSecondes) * 10;

describe('match rapide déterministe', () => {
  it('redonne exactement le même match pour la même graine', () => {
    const a = simulerMatch(entree(42, 'boston', 'new-york'));
    const b = simulerMatch(entree(42, 'boston', 'new-york'));
    expect(b.evenements).toEqual(a.evenements);
    expect(b.boxScore).toEqual(a.boxScore);
    expect(b.empreinte).toBe(a.empreinte);
  });

  it('donne un autre match pour une autre graine', () => {
    expect(simulerMatch(entree(43, 'boston', 'new-york')).empreinte).not.toBe(simulerMatch(entree(42, 'boston', 'new-york')).empreinte);
  });

  it("garde l'empreinte du match de référence (Boston Beacons – New York Skyliners, graine 2026)", () => {
    // Si ce test échoue, le moteur, les règles, les réglages ou les effectifs ont changé : vérifier que c'est voulu,
    // puis mettre à jour l'empreinte en le notant dans docs/SIMULATION_MATCH.md.
    const r = simulerMatch(entree(2026, 'boston', 'new-york'));
    expect(r.empreinte).toBe('ad47660b78b2fb88');
  });

  it('ne modifie pas les équipes reçues', () => {
    const e = entree(7, 'denver', 'washington');
    const avant = structuredClone(e);
    simulerMatch(e);
    expect(e).toEqual(avant);
  });

  it('joue 300 matchs en moins de 3 secondes', () => {
    const debut = performance.now();
    for (let g = 0; g < 300; g++) simulerMatch(entree(g, 'boston', 'lakers'));
    expect(performance.now() - debut).toBeLessThan(3000);
  });
});

describe('cohérence du box score (300 matchs)', () => {
  it('a des lignes de joueur cohérentes', () => {
    for (const r of lot) {
      for (const e of r.boxScore.equipes) {
        for (const j of e.joueurs) {
          expect(j.tirsReussis).toBeLessThanOrEqual(j.tirsTentes);
          expect(j.troisReussis).toBeLessThanOrEqual(j.troisTentes);
          expect(j.troisReussis).toBeLessThanOrEqual(j.tirsReussis);
          expect(j.troisTentes).toBeLessThanOrEqual(j.tirsTentes);
          expect(j.lancersReussis).toBeLessThanOrEqual(j.lancersTentes);
          expect(j.points).toBe(
            regles.valeurPanierInterieur * (j.tirsReussis - j.troisReussis) +
              regles.valeurPanierATroisPoints * j.troisReussis +
              regles.valeurLancerFranc * j.lancersReussis,
          );
          expect(j.rebonds).toBe(j.rebondsOffensifs + j.rebondsDefensifs);
          expect(j.fautes).toBeLessThanOrEqual(regles.fautesPersonnellesExclusion);
          expect(j.exclu).toBe(j.fautes === regles.fautesPersonnellesExclusion);
          expect(j.dixiemes).toBeGreaterThanOrEqual(0);
          expect(j.dixiemes).toBeLessThanOrEqual(dureeTotale(r));
        }
      }
    }
  });

  it("a des totaux d'équipe cohérents avec le score et le temps de jeu", () => {
    for (const r of lot) {
      const [a, b] = r.boxScore.equipes;
      const fin = r.evenements.filter((e): e is Extract<Evenement, { type: 'fin_periode' }> => e.type === 'fin_periode').at(-1)!;
      expect([a.points, b.points]).toEqual(fin.score);
      expect(a.points).not.toBe(b.points);
      for (const e of r.boxScore.equipes) {
        expect(e.joueurs.reduce((s, j) => s + j.points, 0)).toBe(e.points);
        expect(e.parPeriode.reduce((s, p) => s + p, 0)).toBe(e.points);
        expect(e.parPeriode).toHaveLength(regles.periodesReglementaires + r.boxScore.prolongations);
        expect(e.totaux.dixiemes).toBe(regles.joueursSurLeTerrain * dureeTotale(r));
        // Chaque point compte pour les cinq joueurs présents : la somme des +/- vaut cinq fois l'écart.
        expect(e.joueurs.reduce((s, j) => s + j.plusMoins, 0)).toBe(regles.joueursSurLeTerrain * e.totaux.plusMoins);
      }
      expect(a.totaux.plusMoins).toBe(a.points - b.points);
      // Un contre est un tir manqué de l'adversaire ; une interception, une perte de balle de l'adversaire.
      expect(a.totaux.contres).toBeLessThanOrEqual(b.totaux.tirsTentes - b.totaux.tirsReussis);
      expect(a.totaux.interceptions).toBeLessThanOrEqual(b.totaux.pertes);
    }
  });

  it('a un journal cohérent : chronomètre décroissant, cinq joueurs, exclus qui ne reviennent pas', () => {
    const anomalies: string[] = [];
    const signaler = (r: ResultatMatch, texte: string) => anomalies.push(`graine ${r.graine} : ${texte}`);
    for (const r of lot) {
      let periode = 0;
      let restant = Infinity;
      const surTerrain: [Set<string>, Set<string>] = [new Set(), new Set()];
      const exclus = new Set<string>();
      for (const ev of r.evenements) {
        if (ev.type === 'debut_periode') {
          if (ev.periode !== periode + 1) signaler(r, `période ${ev.periode} après ${periode}`);
          periode = ev.periode;
          restant = ev.restant;
          surTerrain[0] = new Set(ev.cinq[0]);
          surTerrain[1] = new Set(ev.cinq[1]);
          for (const s of surTerrain) for (const id of s) if (exclus.has(id)) signaler(r, `${id} exclu, aligné en période ${periode}`);
          continue;
        }
        if (ev.periode !== periode) continue; // remplacements de la pause, avant le cinq de la période suivante
        if (ev.restant > restant || ev.restant < 0) signaler(r, `chronomètre ${ev.restant} après ${restant}`);
        restant = ev.restant;
        if (ev.type === 'remplacement') {
          if (!surTerrain[ev.equipe].has(ev.sortant)) signaler(r, `${ev.sortant} sort sans être sur le terrain`);
          if (surTerrain[ev.equipe].has(ev.entrant)) signaler(r, `${ev.entrant} entre en étant déjà sur le terrain`);
          if (exclus.has(ev.entrant)) signaler(r, `${ev.entrant} revient après son exclusion`);
          surTerrain[ev.equipe].delete(ev.sortant);
          surTerrain[ev.equipe].add(ev.entrant);
        }
        if (ev.type === 'exclusion') exclus.add(ev.joueur);
        for (const s of surTerrain) if (s.size !== regles.joueursSurLeTerrain) signaler(r, `${s.size} joueurs sur le terrain`);
      }
    }
    expect(anomalies).toEqual([]);
  });

  it('joue les prolongations avec la durée des règles', () => {
    const avecProlongation = lot.filter((r) => r.boxScore.prolongations > 0);
    expect(avecProlongation.length).toBeGreaterThan(0);
    for (const r of avecProlongation) expect(r.boxScore.periodes).toBe(regles.periodesReglementaires + r.boxScore.prolongations);
  });

  it('lit la durée des périodes dans les règles, pas dans le code', () => {
    const e = entree(5, 'miami', 'utah');
    const r = simulerMatch({ ...e, regles: { ...regles, dureePeriodeSecondes: 600 } });
    const temps = r.boxScore.equipes[0].totaux.dixiemes / regles.joueursSurLeTerrain / 10;
    expect(temps).toBe(regles.periodesReglementaires * 600 + r.boxScore.prolongations * regles.dureeProlongationSecondes);
  });
});
