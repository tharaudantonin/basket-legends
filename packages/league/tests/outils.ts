// Tranche 4 : le contexte de ligue construit à partir des vraies données du dépôt, pour les tests.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  contexteDeLaLigue,
  donneesSalariales,
  lireDonneesDeDraft,
  nomsDuVivier,
  schemaVivier,
  schemaCba,
  schemaContrats,
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

export function chargerContexte(avecDraft = false): ContexteLigue {
  const effectifs = readdirSync(join(racine, 'data/rosters/2026-27'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => schemaEffectif.parse(json(`data/rosters/2026-27/${f}`)));
  return contexteDeLaLigue(
    schemaSaisonLigue.parse(json('data/ligue/saison-2026-27.json')),
    effectifs,
    valeursDesRegles(schemaRegles.parse(json('data/regles/nba-2026-27.json'))),
    reglagesDuMoteur(schemaReglagesMatch.parse(json('data/moteur/match-v5.json'))),
    schemaStatistiquesJoueurs.parse(json('data/statistiques/2025-26/joueurs.json')),
    donneesSalariales(schemaCba.parse(json('data/cba/nba-2026-27.json')), schemaContrats.parse(json('data/contrats/2026-27.json'))),
    avecDraft ? chargerDonneesDeDraft(effectifs) : undefined,
  );
}

export function chargerDonneesDeDraft(effectifs: Parameters<typeof lireDonneesDeDraft>[1]) {
  return lireDonneesDeDraft(
    {
      loterie: json('data/draft/loterie-2027-2029.json'),
      historique: json('data/draft/historique-loterie.json'),
      choix: readdirSync(join(racine, 'data/draft'))
        .filter((f) => /^choix-\d{4}\.json$/.test(f))
        .map((f) => json(`data/draft/${f}`)),
      modele: json('data/draft/modele-draft.json'),
      echelle: json('data/draft/echelle-rookies.json'),
      banques: json('data/noms/banques.json'),
      empreintes: json('data/noms/empreintes.json'),
    },
    effectifs,
    nomsDuVivier(schemaVivier.parse(json('data/vivier/2026-27.json'))),
  );
}
