// Tranche 1 : chargement des vraies données de référence pour les tests du moteur.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { equipeDuMatch, reglagesDuMoteur, schemaEffectif, schemaReglagesMatch, schemaRegles, valeursDesRegles } from '@basket-legends/data';
import type { EntreeMatch, EquipeDuMatch } from '../src';

const racine = join(import.meta.dirname, '../../..');
const json = (chemin: string): unknown => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));

export const regles = valeursDesRegles(schemaRegles.parse(json('data/regles/nba-2026-27.json')));
export const reglages = reglagesDuMoteur(schemaReglagesMatch.parse(json('data/moteur/match-v1.json')));
export const equipes: EquipeDuMatch[] = readdirSync(join(racine, 'data/rosters/2026-27'))
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => equipeDuMatch(schemaEffectif.parse(json(`data/rosters/2026-27/${f}`))));

export const equipe = (id: string): EquipeDuMatch => {
  const e = equipes.find((x) => x.id === id);
  if (!e) throw new Error(`Équipe inconnue : ${id}`);
  return e;
};

export const entree = (graine: number, domicile: string, exterieur: string): EntreeMatch => ({
  graine,
  domicile: equipe(domicile),
  exterieur: equipe(exterieur),
  regles,
  reglages,
});
