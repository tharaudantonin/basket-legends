// Tranche 1 : la composition d'équipe faite par le staff (aucune donnée de titulaires n'existe dans le snapshot :
// le cinq de départ est un choix du jeu, pas une donnée importée).
//
// Règle : on remplit d'abord le poste d'intérieur, puis deux postes d'arrière, puis deux postes d'ailier, chacun avec le
// meilleur joueur éligible (note, puis identifiant pour départager). Un poste sans candidat éligible prend le meilleur
// joueur restant. Le banc suit, du meilleur au moins bon : c'est l'ordre de rotation.
import type { EquipeDuMatch, Groupe, JoueurDuMatch } from './types';

/** Le groupe d'un poste source : la première lettre décide (G-F est un arrière, F-C un ailier, C-F un intérieur). */
export function groupeDuPoste(poste: string): Groupe {
  if (poste.startsWith('G')) return 'meneur';
  if (poste.startsWith('C')) return 'interieur';
  return 'ailier';
}

// Les postes source admis pour chaque place du cinq.
const ELIGIBLES: Record<Groupe, readonly string[]> = {
  interieur: ['C', 'C-F', 'F-C'],
  meneur: ['G', 'G-F', 'F-G'],
  ailier: ['F', 'G-F', 'F-G', 'F-C', 'C-F'],
};
const PLACES: readonly Groupe[] = ['interieur', 'meneur', 'meneur', 'ailier', 'ailier'];

const ordre = (a: JoueurDuMatch, b: JoueurDuMatch): number => b.note - a.note || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Range les joueurs : cinq de départ, puis banc dans l'ordre de rotation. */
export function composerEquipe(id: string, nom: string, joueurs: readonly JoueurDuMatch[]): EquipeDuMatch {
  const restants = [...joueurs].sort(ordre);
  const cinq: JoueurDuMatch[] = [];
  for (const place of PLACES) {
    const i = restants.findIndex((j) => ELIGIBLES[place].includes(j.poste));
    const pris = restants.splice(i >= 0 ? i : 0, 1)[0];
    if (pris) cinq.push(pris);
  }
  return { id, nom, joueurs: [...cinq, ...restants] };
}
