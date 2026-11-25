// Tranche 4 : le contexte de la ligue, construit dans le Web Worker seulement (il charge les statistiques 2025-26,
// trop lourdes pour l'écran principal). Tranche 7 : avec les données de la Draft. Tranche 8 : avec l'univers de départ
// et le modèle de carrière ; chaque saison suivante a son propre contexte (contexteDeLaSaison), mis en cache.
import { contexteDeLaLigue, lireDonneesDeDraft, nomsDuVivier, schemaStatistiquesJoueurs } from '@basket-legends/data';
import { contexteDeLaSaison, type ContexteLigue, type EtatSaison } from '@basket-legends/league';
import statsBrutes from '../../../data/statistiques/2025-26/joueurs.json';
import loterieBrute from '../../../data/draft/loterie-2027-2029.json';
import historiqueBrut from '../../../data/draft/historique-loterie.json';
import modeleDraftBrut from '../../../data/draft/modele-draft.json';
import echelleBrute from '../../../data/draft/echelle-rookies.json';
import banquesBrutes from '../../../data/noms/banques.json';
import empreintesBrutes from '../../../data/noms/empreintes.json';
import {
  donneesCarriere,
  donneesClub,
  donneesMarche,
  effectifs,
  fichierLigue,
  reglages,
  regles,
  salaires,
  universDeDepart,
  vivier,
} from './donnees';

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
      nomsDuVivier(vivier),
    ),
    { univers: universDeDepart, donnees: donneesCarriere, marche: donneesMarche, club: donneesClub },
  );
  return contexte;
}

const cache = new Map<string, ContexteLigue>();

/** Tranche 8 : le contexte de la saison d'un état (son univers, ou celui des données pour la première saison). */
export function contexteDe(
  etat: Pick<EtatSaison, 'saison' | 'graine' | 'univers'> & Partial<Pick<EtatSaison, 'franchise' | 'compositionManuelle' | 'delegations'>>,
): ContexteLigue {
  if (!etat.univers) return contexteLigue();
  // Tranche 9 : le contexte change avec chaque transaction (version de l'univers) et avec la composition du GM.
  const cle = `${etat.saison}:${etat.graine}:${etat.univers.version ?? 0}:${etat.delegations?.rotation ?? ''}:${etat.compositionManuelle?.join(',') ?? ''}`;
  let ctx = cache.get(cle);
  if (!ctx) {
    ctx = contexteDeLaSaison(contexteLigue(), etat);
    cache.clear();
    cache.set(cle, ctx);
  }
  return ctx;
}
