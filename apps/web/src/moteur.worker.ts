// Tranches 1, 4 et 5 : le moteur tourne dans un Web Worker pour ne jamais bloquer l'écran (docs/TDD.md) — matchs isolés
// (rapides, commentés, interactifs) et toute la saison (calendrier, matchs, Play-In, playoffs, récompenses). Tranche 7 :
// la soirée de Draft (choix du staff des 29 autres équipes). Tranche 8 : l'intersaison et le contexte propre à chaque saison.
import { simulerMatch, type EntreeMatch, type OptionsSimulation, type ResultatMatch } from '@basket-legends/engine';
import {
  avancer,
  avancerDraft,
  matchDuProchainPas,
  nouvelleSaison,
  passerALaSaisonSuivante,
  rejouerMatch,
  type Cible,
  type EtatSaison,
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
      etat: Pick<EtatSaison, 'allStar' | 'saison' | 'graine' | 'univers'>;
      match: ResumeMatch;
      options?: OptionsSimulation;
    }
  | { id: number; type: 'saison-prochain-match'; etat: EtatSaison }
  | { id: number; type: 'draft-avancer'; etat: EtatSaison; choixDuGm?: string }
  | { id: number; type: 'saison-suivante'; etat: EtatSaison };

export type ReponseDuMoteur =
  | { id: number; resultat: ResultatMatch }
  | { id: number; etat: EtatSaison }
  | { id: number; prochain: ResumeMatch | null }
  | { id: number; erreur: string };

self.onmessage = (e: MessageEvent<MessageVersMoteur>) => {
  const m = e.data;
  try {
    let reponse: ReponseDuMoteur;
    if (m.type === 'match') reponse = { id: m.id, resultat: simulerMatch(m.entree, m.options) };
    else if (m.type === 'saison-nouvelle') reponse = { id: m.id, etat: nouvelleSaison(contexteLigue(), m.graine, m.franchise) };
    else if (m.type === 'saison-avancer') reponse = { id: m.id, etat: avancer(contexteDe(m.etat), m.etat, m.cible) };
    else if (m.type === 'draft-avancer') reponse = { id: m.id, etat: avancerDraft(contexteDe(m.etat), m.etat, m.choixDuGm) };
    else if (m.type === 'saison-prochain-match') reponse = { id: m.id, prochain: matchDuProchainPas(contexteDe(m.etat), m.etat) ?? null };
    else if (m.type === 'saison-suivante') reponse = { id: m.id, etat: passerALaSaisonSuivante(contexteLigue(), m.etat) };
    else reponse = { id: m.id, resultat: rejouerMatch(contexteDe(m.etat), { allStar: m.etat.allStar }, m.match, m.options) };
    self.postMessage(reponse);
  } catch (err) {
    self.postMessage({ id: m.id, erreur: err instanceof Error ? err.message : String(err) } satisfies ReponseDuMoteur);
  }
};
