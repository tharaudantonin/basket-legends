// Tranche 2 : le moteur reste calibré sur les moyennes de la saison régulière 2025-2026 (data/statistiques/2025-26/).
// `npm run sonde` contrôle 1 000 matchs avec les fourchettes de calibration ; ce test en joue 400, avec des fourchettes
// élargies de moitié pour l'écart d'échantillonnage.
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { sonder } from '../../../tools/sonde-match';

describe('calibration du moteur', () => {
  it('reproduit les moyennes de la ligue 2025-26 dans les fourchettes', () => {
    const r = sonder(join(import.meta.dirname, '../../..'), 400);
    const hors = r.mesures
      .filter((m) => m.cible !== undefined && Math.abs(m.valeur - m.cible) > 1.5 * (m.tolerance ?? 0))
      .map((m) => `${m.libelle} : ${m.valeur.toFixed(1)} pour ${m.cible!.toFixed(1)}`);
    expect(hors).toEqual([]);
  }, 30_000);
});
