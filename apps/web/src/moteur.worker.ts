// Tranches 1, 4 et 5 : le moteur tourne dans un Web Worker pour ne jamais bloquer l'écran (docs/TDD.md) — matchs isolés
// (rapides, commentés, interactifs) et toute la saison (calendrier, matchs, Play-In, playoffs, récompenses).
import { simulerMatch, type EntreeMatch, type OptionsSimulation, type ResultatMatch } from '@basket-legends/engine';
import {
  avancer,
  matchDuProchainPas,
  nouvelleSaison,
  rejouerMatch,
  type Cible,
  type EtatSaison,
  type ResumeMatch,
} from '@basket-legends/league';
import { contexteLigue } from './ligue';

export type MessageVersMoteur =
  | { id: number; type: 'match'; entree: EntreeMatch; options?: OptionsSimulation }
  | { id: number; type: 'saison-nouvelle'; graine: number; franchise: string }
  | { id: number; type: 'saison-avancer'; etat: EtatSaison; cible: Cible }
  | { id: number; type: 'saison-rejouer'; allStar: EtatSaison['allStar']; match: ResumeMatch; options?: OptionsSimulation }
  | { id: number; type: 'saison-prochain-match'; etat: EtatSaison };

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
    else if (m.type === 'saison-avancer') reponse = { id: m.id, etat: avancer(contexteLigue(), m.etat, m.cible) };
    else if (m.type === 'saison-prochain-match') reponse = { id: m.id, prochain: matchDuProchainPas(contexteLigue(), m.etat) ?? null };
    else reponse = { id: m.id, resultat: rejouerMatch(contexteLigue(), { allStar: m.allStar }, m.match, m.options) };
    self.postMessage(reponse);
  } catch (err) {
    self.postMessage({ id: m.id, erreur: err instanceof Error ? err.message : String(err) } satisfies ReponseDuMoteur);
  }
};
