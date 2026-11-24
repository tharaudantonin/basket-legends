import { describe, expect, it } from 'vitest';
import { creerHasard, reprendreHasard } from '../src';

const tirages = (n: number, graine: number, sel: string) => {
  const h = creerHasard(graine, sel);
  return Array.from({ length: n }, () => h.reel());
};

describe('hasard déterministe', () => {
  it('donne la même suite pour la même graine et le même sel', () => {
    expect(tirages(50, 42, 'match')).toEqual(tirages(50, 42, 'match'));
  });

  it('donne une autre suite pour un autre sel', () => {
    expect(tirages(10, 42, 'match')).not.toEqual(tirages(10, 42, 'calendrier'));
  });

  it("reprend au même point à partir de l'état enregistré", () => {
    const h = creerHasard(7, 'possessions');
    for (let i = 0; i < 100; i++) h.reel();
    const repris = reprendreHasard(h.etat());
    expect(Array.from({ length: 20 }, () => repris.reel())).toEqual(Array.from({ length: 20 }, () => h.reel()));
  });

  it('reste dans les bornes', () => {
    const h = creerHasard(1);
    for (let i = 0; i < 1000; i++) {
      const x = h.entier(3, 8);
      expect(x).toBeGreaterThanOrEqual(3);
      expect(x).toBeLessThanOrEqual(8);
    }
  });
});
