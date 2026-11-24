// Tranche 1 : l'appel au moteur, côté interface (un seul Web Worker, réponses rangées par numéro de demande).
import type { EntreeMatch, ResultatMatch } from '@basket-legends/engine';
import type { MessageVersMoteur, ReponseDuMoteur } from './moteur.worker';

let worker: Worker | undefined;
let prochain = 1;
const enAttente = new Map<number, { resoudre: (r: ResultatMatch) => void; rejeter: (e: Error) => void }>();

function lancer(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./moteur.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<ReponseDuMoteur>) => {
    const attente = enAttente.get(e.data.id);
    if (!attente) return;
    enAttente.delete(e.data.id);
    if ('resultat' in e.data) attente.resoudre(e.data.resultat);
    else attente.rejeter(new Error(e.data.erreur));
  };
  return worker;
}

export function simulerDansLeMoteur(entree: EntreeMatch): Promise<ResultatMatch> {
  const id = prochain++;
  return new Promise((resoudre, rejeter) => {
    enAttente.set(id, { resoudre, rejeter });
    lancer().postMessage({ id, entree } satisfies MessageVersMoteur);
  });
}
