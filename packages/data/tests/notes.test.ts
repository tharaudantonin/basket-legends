// Tranche 2 : le modèle de notes v1 (packages/data/src/notes.ts).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { noteDuJoueur, notesDuDepot } from '../../../tools/calculer-notes';
import { lireSources } from '../../../tools/verifier-donnees';
import { calculerNotes, noteDuQuantile, schemaParametresNotes, schemaStatistiquesJoueurs, type EntreeNotes, type StatistiquesJoueurs } from '../src';

const racine = join(import.meta.dirname, '../../..');
const json = (chemin: string): unknown => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));
const P = schemaParametresNotes.parse(json('data/modeles/notes-v1.json'));
const stats = schemaStatistiquesJoueurs.parse(json(P.statistiques));
const effectifs = Object.values(lireSources(racine).effectifs) as {
  players: { id: string; measurements: { height: { heightCm: number } }; ratings: Record<string, unknown>; attributes: Record<string, number> }[];
}[];
const joueurs: EntreeNotes[] = effectifs.flatMap((e) => e.players.map((j) => ({ id: j.id, tailleCm: j.measurements.height.heightCm })));

describe('noteDuQuantile', () => {
  const ancrages = [
    [0, 50],
    [0.5, 70],
    [1, 90],
  ] as const;
  it('interpole linéairement entre les ancrages et borne aux extrémités', () => {
    expect(noteDuQuantile(0.25, ancrages)).toBe(60);
    expect(noteDuQuantile(0.75, ancrages)).toBe(80);
    expect(noteDuQuantile(-1, ancrages)).toBe(50);
    expect(noteDuQuantile(2, ancrages)).toBe(90);
  });
});

describe('modèle de notes v1', () => {
  const notes = calculerNotes(joueurs, stats, P);
  const parId = new Map(notes.map((n) => [n.id, n]));

  it('est refaisable : les effectifs portent exactement les notes recalculées', () => {
    const recalcul = notesDuDepot(racine);
    for (const e of effectifs) {
      for (const j of e.players) {
        if (j.ratings.correction === 'corrigé par Antonin') continue;
        const attendu = noteDuJoueur(recalcul.get(j.id)!, P.version);
        expect(j.ratings).toEqual(attendu.ratings);
        expect(j.attributes).toEqual(attendu.attributes);
      }
    }
  });

  it("ne dépend pas de l'ordre des joueurs", () => {
    const inverse = calculerNotes([...joueurs].reverse(), stats, P);
    expect(new Map(inverse.map((n) => [n.id, n]))).toEqual(parId);
  });

  it("respecte l'échelle « NBA » : superstars au-delà de 90, rotation autour de 70-75", () => {
    const globales = notes.filter((n) => n.base === 'statistiques').map((n) => n.globale);
    const tries = [...globales].sort((a, b) => b - a);
    expect(tries.filter((x) => x >= 90).length).toBeGreaterThanOrEqual(3);
    expect(tries.filter((x) => x >= 90).length).toBeLessThanOrEqual(12);
    // Les 300 premiers (dix joueurs de rotation par équipe) : médiane dans la fourchette 70-75.
    const rotation = tries.slice(0, 300);
    expect(rotation[150]).toBeGreaterThanOrEqual(70);
    expect(rotation[150]).toBeLessThanOrEqual(75);
    for (const n of notes) expect(n.globale).toBeGreaterThanOrEqual(P.bornes.min);
  });

  it('note les joueurs sans statistique a priori, sous les joueurs NBA confirmés', () => {
    const recrues = notes.filter((n) => n.base === 'rang-de-draft');
    const premierChoix = recrues.find((n) => stats.joueurs[n.id]?.draft2026?.choix === 1)!;
    const dernier = recrues.reduce((m, n) => ((stats.joueurs[n.id]?.draft2026?.choix ?? 0) > (stats.joueurs[m.id]?.draft2026?.choix ?? 0) ? n : m));
    expect(premierChoix.globale).toBeGreaterThan(dernier.globale);
    for (const n of notes.filter((x) => x.base !== 'statistiques')) {
      expect(n.globale).toBeLessThanOrEqual(75);
      expect(n.saisonDeReference).toBeNull();
    }
    for (const n of notes.filter((x) => x.base === 'sans-statistique')) expect(n.globale).toBe(P.sansStatistique.nonDrafte);
  });

  it('récompense une meilleure production à minutes égales', () => {
    const id = notes.find((n) => n.base === 'statistiques' && n.globale > 62 && n.globale < 75)!.id;
    const copie: StatistiquesJoueurs = structuredClone(stats);
    const t = copie.joueurs[id]!.saisonReguliere ?? copie.joueurs[id]!.saison2024_25!;
    t.points += 400;
    t.tirsReussis += 200;
    t.passes += 150;
    const apres = calculerNotes(joueurs, copie, P).find((n) => n.id === id)!;
    expect(apres.globale).toBeGreaterThan(parId.get(id)!.globale);
    expect(apres.technique).toBeGreaterThanOrEqual(parId.get(id)!.technique);
  });

  it('se sert de la saison 2024-25 pour un joueur absent toute la saison 2025-26', () => {
    const absents = Object.entries(stats.joueurs).filter(([, s]) => s.saison2024_25 && !s.saisonReguliere);
    expect(absents.length).toBeGreaterThan(0);
    for (const [id] of absents) expect(parId.get(id)?.saisonDeReference).toBe('2024-2025');
  });
});
