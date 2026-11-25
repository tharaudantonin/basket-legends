// Tranche 9 (réponse 35) : la personnalité d'un joueur — goût pour l'argent, envie de gagner, besoin d'un rôle,
// fidélité. Ce sont des traits de personnage générés (aucune source n'existe), fixés pour une partie par sa graine et
// l'identifiant du joueur ; l'interface les présente comme générés, jamais comme relevés.
import { creerHasard } from '@basket-legends/engine';
import { gaussien } from '../draft/prospects';
import type { ModeleMarche } from './types';

export interface Personnalite {
  argent: number;
  victoire: number;
  role: number;
  fidelite: number;
}

export function personnalite(M: ModeleMarche, joueur: string, graine: number): Personnalite {
  const h = creerHasard(graine, `personnalite-${joueur}`);
  const [min, max] = M.personnalite.bornes;
  const t = () => Math.round(Math.min(max, Math.max(min, gaussien(h, M.personnalite.moyenne, M.personnalite.ecartType))));
  return { argent: t(), victoire: t(), role: t(), fidelite: t() };
}
