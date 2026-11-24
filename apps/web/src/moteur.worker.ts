// Tranche 1 : le moteur tourne dans un Web Worker pour ne jamais bloquer l'écran (docs/TDD.md).
import { simulerMatch, type EntreeMatch, type ResultatMatch } from '@basket-legends/engine';

export type MessageVersMoteur = { id: number; entree: EntreeMatch };
export type ReponseDuMoteur = { id: number; resultat: ResultatMatch } | { id: number; erreur: string };

self.onmessage = (e: MessageEvent<MessageVersMoteur>) => {
  const { id, entree } = e.data;
  try {
    self.postMessage({ id, resultat: simulerMatch(entree) } satisfies ReponseDuMoteur);
  } catch (err) {
    self.postMessage({ id, erreur: err instanceof Error ? err.message : String(err) } satisfies ReponseDuMoteur);
  }
};
