// Tranches 1, 4 et 5 : le moteur tourne dans un Web Worker pour ne jamais bloquer l'écran (docs/TDD.md) — matchs isolés
// (rapides, commentés, interactifs) et toute la saison (calendrier, matchs, Play-In, playoffs, récompenses). Tranche 7 :
// la soirée de Draft (choix du staff des 29 autres équipes). Tranche 8 : l'intersaison et le contexte propre à chaque saison.
// Tranche 9 : nouvelle partie avec le marché, actions du GM (échanges, free agency, staff, composition, délégations).
import { simulerMatch, type EntreeMatch, type OptionsSimulation, type ResultatMatch } from '@basket-legends/engine';
import {
  actionDuGm,
  avancer,
  avancerDraft,
  matchDuProchainPas,
  nouvellePartie,
  ouvrirIntersaison,
  rejouerMatch,
  type ActionDuGm,
  type Cible,
  type EtatPourRejouer,
  type EtatSaison,
  type ReponseDuGm,
  type ResumeMatch,
} from '@basket-legends/league';
import { contexteDe, contexteLigue } from './ligue';

export type MessageVersMoteur =
  | { id: number; type: 'match'; entree: EntreeMatch; options?: OptionsSimulation }
  | { id: number; type: 'saison-nouvelle'; graine: number; franchise: string }
  | { id: number; type: 'saison-avancer'; etat: EtatSaison; cible: Cible }
  | {
      id: number;
      type: 'saison-rejouer';
      etat: EtatPourRejouer & Pick<EtatSaison, 'saison' | 'graine' | 'univers' | 'franchise' | 'compositionManuelle' | 'delegations'>;
      match: ResumeMatch;
      options?: OptionsSimulation;
    }
  | { id: number; type: 'saison-prochain-match'; etat: EtatSaison }
  | { id: number; type: 'draft-avancer'; etat: EtatSaison; choixDuGm?: string }
  | { id: number; type: 'saison-suivante'; etat: EtatSaison }
  | { id: number; type: 'gm'; etat: EtatSaison; action: ActionDuGm };

export type ReponseDuMoteur =
  | { id: number; resultat: ResultatMatch }
  | { id: number; etat: EtatSaison }
  | { id: number; prochain: ResumeMatch | null }
  | { id: number; gm: ReponseDuGm }
  | { id: number; erreur: string };

self.onmessage = (e: MessageEvent<MessageVersMoteur>) => {
  const m = e.data;
  try {
    let reponse: ReponseDuMoteur;
    if (m.type === 'match') reponse = { id: m.id, resultat: simulerMatch(m.entree, m.options) };
    else if (m.type === 'saison-nouvelle') reponse = { id: m.id, etat: nouvellePartie(contexteLigue(), m.graine, m.franchise) };
    else if (m.type === 'gm') reponse = { id: m.id, gm: actionDuGm(contexteLigue(), m.etat, m.action) };
    else if (m.type === 'saison-avancer') reponse = { id: m.id, etat: avancer(contexteDe(m.etat), m.etat, m.cible) };
    else if (m.type === 'draft-avancer') reponse = { id: m.id, etat: avancerDraft(contexteDe(m.etat), m.etat, m.choixDuGm) };
    else if (m.type === 'saison-prochain-match') reponse = { id: m.id, prochain: matchDuProchainPas(contexteDe(m.etat), m.etat) ?? null };
    else if (m.type === 'saison-suivante') reponse = { id: m.id, etat: ouvrirIntersaison(contexteLigue(), m.etat) };
    else reponse = { id: m.id, resultat: rejouerMatch(contexteDe(m.etat), m.etat, m.match, m.options) };
    self.postMessage(reponse);
  } catch (err) {
    self.postMessage({ id: m.id, erreur: err instanceof Error ? err.message : String(err) } satisfies ReponseDuMoteur);
  }
};
