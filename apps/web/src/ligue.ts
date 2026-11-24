// Tranche 4 : le contexte de la ligue, construit dans le Web Worker seulement (il charge les statistiques 2025-26,
// trop lourdes pour l'écran principal).
import { contexteDeLaLigue, schemaStatistiquesJoueurs } from '@basket-legends/data';
import type { ContexteLigue } from '@basket-legends/league';
import statsBrutes from '../../../data/statistiques/2025-26/joueurs.json';
import { effectifs, fichierLigue, reglages, regles, salaires } from './donnees';

let contexte: ContexteLigue | undefined;

export function contexteLigue(): ContexteLigue {
  contexte ??= contexteDeLaLigue(
    fichierLigue,
    [...effectifs.values()],
    regles,
    reglages,
    schemaStatistiquesJoueurs.parse(statsBrutes),
    salaires,
  );
  return contexte;
}
