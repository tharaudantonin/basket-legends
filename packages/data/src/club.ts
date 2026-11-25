// Tranche 10 : passage des fichiers du club (modèle du club, format de la G League, changements de direction relevés)
// aux données de la ligue. Les en-têtes, notes et sources restent dans les fichiers.
import type { DonneesClub, ModeleClub, StructureGLeague } from '@basket-legends/league';
import type { DirectionsFichier, GLeagueFichier, ModeleClubFichier } from './schemas';

export function donneesDuClub(modele: ModeleClubFichier, gLeague: GLeagueFichier, directions: DirectionsFichier): DonneesClub {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { schemaVersion, datasetId, version, statut, note, ...m } = modele;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { schemaVersion: _a, datasetId: _b, note: _c, sources, ...g } = gLeague;
  const licenciementsReleves: Record<string, number> = {};
  for (const c of directions.changements) licenciementsReleves[c.saison] = (licenciementsReleves[c.saison] ?? 0) + 1;
  return { modele: m as ModeleClub, gLeague: g as StructureGLeague, licenciementsReleves };
}
