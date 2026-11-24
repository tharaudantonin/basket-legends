// Tranche 4 : le contexte de ligue construit à partir des vraies données du dépôt, pour les tests.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  contexteDeLaLigue,
  reglagesDuMoteur,
  schemaEffectif,
  schemaReglagesMatch,
  schemaRegles,
  schemaSaisonLigue,
  schemaStatistiquesJoueurs,
  valeursDesRegles,
} from '@basket-legends/data';
import type { ContexteLigue } from '../src';

const racine = join(import.meta.dirname, '../../..');
const json = (chemin: string): unknown => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));

export function chargerContexte(): ContexteLigue {
  const effectifs = readdirSync(join(racine, 'data/rosters/2026-27'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => schemaEffectif.parse(json(`data/rosters/2026-27/${f}`)));
  return contexteDeLaLigue(
    schemaSaisonLigue.parse(json('data/ligue/saison-2026-27.json')),
    effectifs,
    valeursDesRegles(schemaRegles.parse(json('data/regles/nba-2026-27.json'))),
    reglagesDuMoteur(schemaReglagesMatch.parse(json('data/moteur/match-v4.json'))),
    schemaStatistiquesJoueurs.parse(json('data/statistiques/2025-26/joueurs.json')),
  );
}
