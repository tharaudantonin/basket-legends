// Tranches 1, 4 et 5 : l'appel au moteur, côté interface (un seul Web Worker, réponses rangées par numéro de demande).
import type { EntreeMatch, OptionsSimulation, ResultatMatch } from '@basket-legends/engine';
import type { Cible, EtatSaison, ResumeMatch } from '@basket-legends/league';
import type { MessageVersMoteur, ReponseDuMoteur } from './moteur.worker';

let worker: Worker | undefined;
let prochain = 1;
const enAttente = new Map<number, { resoudre: (r: ReponseDuMoteur) => void; rejeter: (e: Error) => void }>();

function lancer(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./moteur.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<ReponseDuMoteur>) => {
    const attente = enAttente.get(e.data.id);
    if (!attente) return;
    enAttente.delete(e.data.id);
    if ('erreur' in e.data) attente.rejeter(new Error(e.data.erreur));
    else attente.resoudre(e.data);
  };
  return worker;
}

type SansId<T> = T extends unknown ? Omit<T, 'id'> : never;

function demander(message: SansId<MessageVersMoteur>): Promise<ReponseDuMoteur> {
  const id = prochain++;
  return new Promise((resoudre, rejeter) => {
    enAttente.set(id, { resoudre, rejeter });
    lancer().postMessage({ ...message, id } as MessageVersMoteur);
  });
}

const resultat = (r: ReponseDuMoteur): ResultatMatch => {
  if (!('resultat' in r)) throw new Error('Réponse inattendue du moteur.');
  return r.resultat;
};
const etat = (r: ReponseDuMoteur): EtatSaison => {
  if (!('etat' in r)) throw new Error('Réponse inattendue du moteur.');
  return r.etat;
};

export const simulerDansLeMoteur = async (entree: EntreeMatch, options?: OptionsSimulation): Promise<ResultatMatch> =>
  resultat(await demander({ type: 'match', entree, ...(options ? { options } : {}) }));
export const nouvelleSaisonDansLeMoteur = async (graine: number, franchise: string): Promise<EtatSaison> =>
  etat(await demander({ type: 'saison-nouvelle', graine, franchise }));
export const avancerDansLeMoteur = async (e: EtatSaison, cible: Cible): Promise<EtatSaison> =>
  etat(await demander({ type: 'saison-avancer', etat: e, cible }));
export const rejouerDansLeMoteur = async (e: EtatSaison, match: ResumeMatch, options?: OptionsSimulation): Promise<ResultatMatch> =>
  resultat(await demander({ type: 'saison-rejouer', allStar: e.allStar, match, ...(options ? { options } : {}) }));
/** Tranche 5 : le match de la franchise du joueur au prochain jour de saison, s'il y en a un. */
export const prochainMatchDansLeMoteur = async (e: EtatSaison): Promise<ResumeMatch | undefined> => {
  const r = await demander({ type: 'saison-prochain-match', etat: e });
  if (!('prochain' in r)) throw new Error('Réponse inattendue du moteur.');
  return r.prochain ?? undefined;
};
/** Tranche 7 : fait les choix de la Draft jusqu'au prochain choix du GM (ou jusqu'à la fin s'il délègue). */
export const avancerDraftDansLeMoteur = async (e: EtatSaison, choixDuGm?: string): Promise<EtatSaison> =>
  etat(await demander({ type: 'draft-avancer', etat: e, ...(choixDuGm ? { choixDuGm } : {}) }));
