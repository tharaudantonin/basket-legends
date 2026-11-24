// Tranche 4 : le contexte de la ligue, construit dans le Web Worker seulement (il charge les statistiques 2025-26,
// trop lourdes pour l'écran principal). Tranche 7 : avec les données de la Draft.
import { contexteDeLaLigue, lireDonneesDeDraft, schemaStatistiquesJoueurs } from '@basket-legends/data';
import type { ContexteLigue } from '@basket-legends/league';
import statsBrutes from '../../../data/statistiques/2025-26/joueurs.json';
import loterieBrute from '../../../data/draft/loterie-2027-2029.json';
import historiqueBrut from '../../../data/draft/historique-loterie.json';
import modeleDraftBrut from '../../../data/draft/modele-draft.json';
import echelleBrute from '../../../data/draft/echelle-rookies.json';
import banquesBrutes from '../../../data/noms/banques.json';
import empreintesBrutes from '../../../data/noms/empreintes.json';
import { effectifs, fichierLigue, reglages, regles, salaires } from './donnees';

// Tranche 7 : propriété des choix de chaque Draft relevée (data/draft/choix-<année>.json).
const choixBruts = import.meta.glob<unknown>('../../../data/draft/choix-*.json', { eager: true, import: 'default' });

let contexte: ContexteLigue | undefined;

export function contexteLigue(): ContexteLigue {
  contexte ??= contexteDeLaLigue(
    fichierLigue,
    [...effectifs.values()],
    regles,
    reglages,
    schemaStatistiquesJoueurs.parse(statsBrutes),
    salaires,
    lireDonneesDeDraft(
      {
        loterie: loterieBrute,
        historique: historiqueBrut,
        choix: Object.values(choixBruts),
        modele: modeleDraftBrut,
        echelle: echelleBrute,
        banques: banquesBrutes,
        empreintes: empreintesBrutes,
      },
      [...effectifs.values()],
    ),
  );
  return contexte;
}
