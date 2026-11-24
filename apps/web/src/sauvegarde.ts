// Tranche 4 : les sauvegardes, dans IndexedDB (API du navigateur, sans dépendance). Une seule partie pour l'instant,
// rangée sous la clé « principale ». Le format est versionné et validé à la lecture (packages/league/src/sauvegarde.ts).
import { creerSauvegarde, lireSauvegarde, type EtatSaison, type Sauvegarde } from '@basket-legends/league';
import { fichierReglages, fichierRegles } from './donnees';

const BASE = 'basket-legends';
const MAGASIN = 'parties';
const CLE = 'principale';

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const req = indexedDB.open(BASE, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(MAGASIN)) req.result.createObjectStore(MAGASIN);
    };
    req.onsuccess = () => resoudre(req.result);
    req.onerror = () => rejeter(req.error ?? new Error('IndexedDB indisponible.'));
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (magasin: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await ouvrir();
  try {
    return await new Promise<T>((resoudre, rejeter) => {
      const req = action(db.transaction(MAGASIN, mode).objectStore(MAGASIN));
      req.onsuccess = () => resoudre(req.result);
      req.onerror = () => rejeter(req.error ?? new Error('Échec de la sauvegarde.'));
    });
  } finally {
    db.close();
  }
}

/** Les versions des données de la partie : une partie ne se rejoue à l'identique qu'avec les mêmes. */
const versions = () => ({ regles: fichierRegles.datasetId, moteur: fichierReglages.datasetId, notes: 'notes-v2' });

export async function enregistrer(etat: EtatSaison, precedente?: Sauvegarde): Promise<Sauvegarde> {
  const s = creerSauvegarde(etat, versions(), new Date().toISOString(), precedente?.creeLe);
  await transaction('readwrite', (m) => m.put(s, CLE));
  return s;
}

/** La partie enregistrée, ou undefined. Une sauvegarde illisible lève une erreur explicite. */
export async function charger(): Promise<Sauvegarde | undefined> {
  const brut = await transaction<unknown>('readonly', (m) => m.get(CLE));
  return brut === undefined ? undefined : lireSauvegarde(brut);
}

export async function effacer(): Promise<void> {
  await transaction('readwrite', (m) => m.delete(CLE));
}
