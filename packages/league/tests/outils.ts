// Tranche 4 : le contexte de ligue construit à partir des vraies données du dépôt, pour les tests.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  contexteDeLaLigue,
  donneesDeCarriere,
  historiqueDesChoix,
  schemaHistoriqueLoterie,
  schemaModeleCarriere,
  schemaRegistre,
  schemaVillesDAccueil,
  universInitial,
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

/** Le contexte de la saison 2026-27 ; `avecDraft` : avec la Draft ; `avecCarriere` : avec l'univers initial et le modèle de carrière (Draft comprise). */
export function chargerContexte(avecDraft = false, avecCarriere = false): ContexteLigue {
  const effectifs = readdirSync(join(racine, 'data/rosters/2026-27'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => schemaEffectif.parse(json(`data/rosters/2026-27/${f}`)));
  const salaires = donneesSalariales(
    schemaCba.parse(json('data/cba/nba-2026-27.json')),
    schemaContrats.parse(json('data/contrats/2026-27.json')),
  );
  const carriere = avecCarriere
    ? {
        univers: universInitial(
          '2026-2027',
          effectifs,
          schemaVivier.parse(json('data/vivier/2026-27.json')),
          salaires,
          historiqueDesChoix(schemaHistoriqueLoterie.parse(json('data/draft/historique-loterie.json'))),
        ),
        donnees: donneesDeCarriere(
          schemaModeleCarriere.parse(json('data/modeles/carriere-v1.json')),
          schemaVillesDAccueil.parse(json('data/ligue/villes-d-accueil.json')),
          schemaRegistre.parse(json('data/franchises.json')),
          effectifs,
        ),
      }
    : undefined;
  return contexteDeLaLigue(
    schemaSaisonLigue.parse(json('data/ligue/saison-2026-27.json')),
    effectifs,
    valeursDesRegles(schemaRegles.parse(json('data/regles/nba-2026-27.json'))),
    reglagesDuMoteur(schemaReglagesMatch.parse(json('data/moteur/match-v5.json'))),
    schemaStatistiquesJoueurs.parse(json('data/statistiques/2025-26/joueurs.json')),
    salaires,
    avecDraft || avecCarriere ? chargerDonneesDeDraft(effectifs) : undefined,
    carriere,
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
