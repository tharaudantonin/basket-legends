import { describe, expect, it } from 'vitest';
import { composerEquipe, groupeDuPoste, type JoueurDuMatch } from '../src';
import { equipes } from './outils';

const joueur = (id: string, poste: string, note: number): JoueurDuMatch => ({
  id,
  nom: id,
  numero: '0',
  poste,
  groupe: groupeDuPoste(poste),
  note,
  technique: note,
  physique: note,
  mental: note,
  tactique: note,
  tailleCm: 200,
});

describe('composition par le staff', () => {
  it('range les postes source dans trois groupes', () => {
    expect(['G', 'G-F', 'F-G', 'F', 'F-C', 'C-F', 'C'].map(groupeDuPoste)).toEqual([
      'meneur',
      'meneur',
      'ailier',
      'ailier',
      'ailier',
      'interieur',
      'interieur',
    ]);
  });

  it("aligne un intérieur, deux arrières et deux ailiers quand l'effectif le permet", () => {
    const e = composerEquipe('t', 'Test', [
      joueur('g1', 'G', 90),
      joueur('g2', 'G', 88),
      joueur('g3', 'G', 86),
      joueur('f1', 'F', 70),
      joueur('f2', 'F', 69),
      joueur('c1', 'C', 60),
      joueur('c2', 'C', 59),
    ]);
    expect(e.joueurs.slice(0, 5).map((j) => j.id)).toEqual(['c1', 'g1', 'g2', 'f1', 'f2']);
    expect(e.joueurs.slice(5).map((j) => j.id)).toEqual(['g3', 'c2']);
  });

  it('prend le meilleur joueur restant quand un poste manque', () => {
    const e = composerEquipe('t', 'Test', [
      joueur('g1', 'G', 80),
      joueur('g2', 'G', 79),
      joueur('g3', 'G', 78),
      joueur('f1', 'F', 70),
      joueur('f2', 'F', 69),
      joueur('f3', 'F', 68),
    ]);
    expect(e.joueurs.slice(0, 5).map((j) => j.id)).toEqual(['g1', 'g2', 'g3', 'f1', 'f2']);
  });

  it('compose les 30 franchises du snapshot avec un cinq complet et sans doublon', () => {
    expect(equipes).toHaveLength(30);
    for (const e of equipes) {
      expect(e.joueurs.length).toBeGreaterThanOrEqual(5);
      expect(new Set(e.joueurs.map((j) => j.id)).size).toBe(e.joueurs.length);
    }
  });
});
