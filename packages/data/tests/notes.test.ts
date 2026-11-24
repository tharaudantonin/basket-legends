// Tranches 2 et 7 : le modèle de notes (v1, puis v2 avec les attributs détaillés) (packages/data/src/notes.ts).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ATTRIBUTS_DETAILLES } from '@basket-legends/engine';
import { noteDuJoueur, notesDuDepot } from '../../../tools/calculer-notes';
import { lireSources } from '../../../tools/verifier-donnees';
import { calculerNotes, noteDuQuantile, schemaParametresNotes, schemaStatistiquesJoueurs, type EntreeNotes, type StatistiquesJoueurs } from '../src';

const racine = join(import.meta.dirname, '../../..');
const json = (chemin: string): unknown => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));
const P = schemaParametresNotes.parse(json('data/modeles/notes-v2.json'));
const stats = schemaStatistiquesJoueurs.parse(json(P.statistiques));
const effectifs = Object.values(lireSources(racine).effectifs) as {
  players: { id: string; measurements: { height: { heightCm: number }; weight: { weightKg: number } }; ratings: Record<string, unknown>; attributes: Record<string, number> }[];
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

describe('modèle de notes v2', () => {
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

describe('fiche joueur : statistiques sourcées', () => {
  it('recalcule les moyennes à partir des totaux, compétitions séparées', async () => {
    const { moyennesDuJoueur } = await import('../src');
    const [id, s] = Object.entries(stats.joueurs).find(([, x]) => x.saisonReguliere && x.playoffs && x.playIn)!;
    const m = moyennesDuJoueur(stats, id);
    expect(m.map((x) => x.competition)).toEqual(['saisonReguliere', 'playIn', 'playoffs']);
    const r = s.saisonReguliere!;
    expect(m[0]!.points).toBeCloseTo(r.points / r.matchs, 10);
    expect(m[0]!.source.url).toBe(stats.sources.saisonReguliere.url);
    expect(m[1]!.titularisations).toBeNull();
    // Recrue sans statistique NBA : aucune ligne, rien d'inventé.
    const recrue = Object.entries(stats.joueurs).find(([, x]) => x.draft2026 && !x.saisonReguliere)![0];
    expect(moyennesDuJoueur(stats, recrue)).toEqual([]);
  });
});

describe('modèle de notes v2 : attributs détaillés (tranche 7)', () => {
  const v1 = schemaParametresNotes.parse(json('data/modeles/notes-v1.json'));
  const entrees = effectifs.flatMap((e) =>
    e.players.map((j) => ({ id: j.id, tailleCm: j.measurements.height.heightCm, poidsKg: j.measurements.weight.weightKg })),
  );
  const notesV2 = calculerNotes(entrees, stats, P);

  it('garde exactement la note globale et les familles validées du v1', () => {
    const notesV1 = calculerNotes(entrees, stats, v1);
    for (let i = 0; i < notesV1.length; i++) {
      const { details, ...sansDetails } = notesV2[i]!;
      expect(details).toBeDefined();
      expect(sansDetails).toEqual(notesV1[i]);
    }
  });

  it('donne 16 attributs détaillés sur l’échelle des attributs', () => {
    for (const n of notesV2) {
      expect(Object.keys(n.details!)).toEqual([...ATTRIBUTS_DETAILLES]);
      for (const v of Object.values(n.details!)) expect(v).toBeGreaterThanOrEqual(P.bornes.min);
    }
  });

  it('classe les lancers francs comme le pourcentage aux lancers mesuré', () => {
    // Deux joueurs avec beaucoup de lancers : le meilleur pourcentage donne la meilleure note.
    const avecLancers = notesV2
      .map((n) => ({ n, t: stats.joueurs[n.id]?.saisonReguliere }))
      .filter((x) => x.t && x.t.lancersTentes >= 300)
      .sort((a, b) => a.t!.lancersReussis / a.t!.lancersTentes - b.t!.lancersReussis / b.t!.lancersTentes);
    expect(avecLancers.length).toBeGreaterThan(10);
    expect(avecLancers.at(-1)!.n.details!.lancersFrancs).toBeGreaterThan(avecLancers[0]!.n.details!.lancersFrancs);
  });

  it('chaque attribut détaillé a un niveau de confiance', () => {
    expect(Object.keys(P.confianceDetails ?? {}).sort()).toEqual([...ATTRIBUTS_DETAILLES].sort());
  });
});
