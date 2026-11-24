// Tranche 1 : l'empreinte d'un box score (docs/AUDIT_2026-11.md § 8, « une empreinte du box score pour chaque match de
// référence »). Deux hachages FNV-1a 32 bits de graines différentes, soit 16 caractères hexadécimaux.
import type { BoxScore } from './types';

function fnv1a(texte: string, depart: number): string {
  let h = depart >>> 0;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function empreinteBoxScore(box: BoxScore): string {
  const texte = JSON.stringify(box);
  return fnv1a(texte, 2166136261) + fnv1a(texte, 0x811c9dc5 ^ 0x5bd1e995);
}
