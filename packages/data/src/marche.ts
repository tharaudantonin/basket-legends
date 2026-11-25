// Tranche 9 : passage des fichiers du marché (modèles du marché et du staff, dates et volumes des transactions) aux
// données de la ligue. Les en-têtes, notes et sources restent dans les fichiers.
import type { DonneesMarche, ModeleMarche, ModeleStaff } from '@basket-legends/league';
import type { ModeleMarcheFichier, ModeleStaffFichier, TransactionsFichier } from './schemas';

export function donneesDuMarche(marche: ModeleMarcheFichier, staff: ModeleStaffFichier, transactions: TransactionsFichier): DonneesMarche {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { schemaVersion, datasetId, version, statut, note, valeur, ...m } = marche;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { calage, ...v } = valeur;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { schemaVersion: _a, datasetId: _b, version: _c, statut: _d, note: _e, ...s } = staff;
  return {
    modele: { ...m, valeur: v } as ModeleMarche,
    staff: s as ModeleStaff,
    saisonDeReference: transactions.saison,
    dates: transactions.dates,
    volumes: { echanges: transactions.volumes.echanges.valeur, signatures: transactions.volumes.signatures.valeur },
  };
}
