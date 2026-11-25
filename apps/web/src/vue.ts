// Tranche 8 : la ligue telle qu'elle est dans la saison affichée. La première saison montre l'univers des données de
// référence ; les suivantes, l'univers de la partie (effectifs, contrats, identités après un changement de ville,
// retraités). L'application l'active à chaque changement de sauvegarde ; les écrans le lisent par ces fonctions.
import { salairesDeLUnivers, type DonneesSalariales, type JoueurCarriere, type Univers } from '@basket-legends/league';
import { effectifs, salaires, universDeDepart } from './donnees';

let actif: Univers = universDeDepart;

export function activerUnivers(u: Univers | undefined): void {
  actif = u ?? universDeDepart;
}

export const universActif = (): Univers => actif;
export const estPremiereSaison = (): boolean => actif === universDeDepart;

/** CBA de la saison (celle des données, reconduite) et contrats de l'univers. */
export const salairesActifs = (): DonneesSalariales =>
  estPremiereSaison()
    ? salaires
    : actif.plafonds
      ? salairesDeLUnivers(salaires.cba, actif)
      : { saison: actif.saison, cba: salaires.cba, contrats: actif.contrats, equipes: actif.equipes };

export function nomEquipe(id: string): string {
  if (id === 'all-star-est') return 'Étoiles de l’Est';
  if (id === 'all-star-ouest') return 'Étoiles de l’Ouest';
  return actif.franchises[id]?.nom ?? effectifs.get(id)?.franchise.fictionalName ?? id;
}

export const abreviationEquipe = (id: string): string =>
  actif.franchises[id]?.abreviation ?? effectifs.get(id)?.franchise.referenceAbbreviation ?? id;

/** Le surnom (nom sans la ville), pour les tableaux serrés. */
export function surnomEquipe(id: string): string {
  const ville = actif.franchises[id]?.ville;
  const nom = nomEquipe(id);
  if (ville && nom.startsWith(`${ville} `)) return nom.slice(ville.length + 1);
  return nom.split(' ').slice(1).join(' ') || nom;
}

export const nomJoueur = (id: string | undefined): string => (id ? (actif.joueurs[id]?.nom ?? actif.retraites[id]?.nom ?? id) : '—');
export const joueurActif = (id: string): JoueurCarriere | undefined => actif.joueurs[id];
export const joueursDeLEquipe = (equipe: string): string[] => actif.effectifs[equipe] ?? [];
export const equipesActives = (): string[] => Object.keys(actif.effectifs);

export function equipeDuJoueur(joueur: string): string | undefined {
  for (const [e, js] of Object.entries(actif.effectifs)) if (js.includes(joueur)) return e;
  return undefined;
}
