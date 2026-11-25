// Tranche 8 : changement de franchise (décisions du 24/11/2026, réponses 6 à 8). Très rare : en moyenne un changement
// toutes les 8 saisons pour toute la ligue, vers une liste fermée de villes sans équipe NBA (data/ligue/villes-d-accueil.json,
// chaque ville sourcée). L'IA choisit la franchise ; celle du joueur ne déménage jamais sans son accord (tranche 10 : son
// propriétaire peut le lui proposer, club/proprietaire.ts). La franchise garde son histoire (palmarès, records), sa conférence et sa
// division ; une ville n'accueille qu'une franchise. Tirage déterministe (graine de la saison).
import { creerHasard } from '@basket-legends/engine';
import type { StructureLigue } from '../types';
import type { IdentiteFranchise, Univers } from './types';
import type { DonneesCarriere } from './univers';

export function demenager(
  C: DonneesCarriere,
  u: Univers,
  franchiseDuJoueur: string,
  graine: number,
  saison: string,
  structure: StructureLigue,
): { franchise: string; de: string; vers: string } | undefined {
  const h = creerHasard(graine, `demenagement-${saison}`);
  if (h.reel() >= C.modele.demenagement.probabiliteParSaison) return undefined;
  const prises = new Set(Object.values(u.franchises).map((f) => f.ville));
  const annee = Number(saison.slice(0, 4));
  const conferenceDe: Record<string, string> = {};
  for (const c of structure.conferences) for (const d of c.divisions) for (const f of d.franchises) conferenceDe[f] = c.id;
  const candidates = Object.keys(C.franchises)
    .filter((f) => f !== franchiseDuJoueur)
    .filter((f) => {
      const depuis = u.franchises[f]?.depuis;
      return !depuis || annee - Number(depuis.slice(0, 4)) >= C.modele.demenagement.delaiMinimum;
    })
    .filter((f) => C.villes.some((v) => !prises.has(v.ville) && v.conference === conferenceDe[f]))
    .sort();
  if (!candidates.length) return undefined;
  const franchise = h.choisir(candidates);
  const villes = C.villes.filter((v) => !prises.has(v.ville) && v.conference === conferenceDe[franchise]);
  const ville = h.choisir(villes);
  const nom = `${ville.ville} ${h.choisir(ville.noms)}`;
  const actuelle: IdentiteFranchise = u.franchises[franchise] ?? { ...C.franchises[franchise]! };
  u.franchises[franchise] = {
    ville: ville.ville,
    nom,
    abreviation: ville.abreviation,
    depuis: saison,
    anciennes: [...(actuelle.anciennes ?? []), { ville: actuelle.ville, nom: actuelle.nom, jusqua: saison }],
  };
  return { franchise, de: actuelle.nom, vers: nom };
}
