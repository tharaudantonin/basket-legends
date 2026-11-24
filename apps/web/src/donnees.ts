// Tranche 1 : les données de référence lues par le jeu, validées par les schémas Zod au chargement.
import {
  donneesSalariales,
  equipeDuMatch,
  reglagesDuMoteur,
  schemaCba,
  schemaContrats,
  schemaEffectif,
  schemaReglagesMatch,
  schemaRegistre,
  schemaRegles,
  schemaSaisonLigue,
  valeursDesRegles,
  type Effectif,
  type Franchise,
} from '@basket-legends/data';
import type { EquipeDuMatch, ReglagesMatch, ReglesMatch } from '@basket-legends/engine';
import registreBrut from '../../../data/franchises.json';
import reglesBrutes from '../../../data/regles/nba-2026-27.json';
import reglagesBruts from '../../../data/moteur/match-v5.json';
import ligueBrute from '../../../data/ligue/saison-2026-27.json';
import cbaBrute from '../../../data/cba/nba-2026-27.json';
import contratsBruts from '../../../data/contrats/2026-27.json';
import { structureDeLaLigue } from '@basket-legends/data';

const effectifsBruts = import.meta.glob<unknown>('../../../data/rosters/2026-27/*.json', { eager: true, import: 'default' });

export const registre = schemaRegistre.parse(registreBrut);
export const franchises: Franchise[] = registre.franchises;
export const fichierRegles = schemaRegles.parse(reglesBrutes);
export const fichierReglages = schemaReglagesMatch.parse(reglagesBruts);
export const regles: ReglesMatch = valeursDesRegles(fichierRegles);
export const reglages: ReglagesMatch = reglagesDuMoteur(fichierReglages);
export const fichierLigue = schemaSaisonLigue.parse(ligueBrute);
/** Tranche 4 : la structure de la saison (conférences, calendrier, Play-In, playoffs…). */
export const structure = structureDeLaLigue(fichierLigue);
/** Tranche 6 : paramètres de la CBA 2026-27 (avec leurs sources) et contrats des joueurs. */
export const fichierCba = schemaCba.parse(cbaBrute);
export const salaires = donneesSalariales(fichierCba, schemaContrats.parse(contratsBruts));

export const effectifs = new Map<string, Effectif>(
  Object.values(effectifsBruts).map((brut) => {
    const e = schemaEffectif.parse(brut);
    return [e.franchise.id, e];
  }),
);

export function effectifDe(id: string): Effectif {
  const e = effectifs.get(id);
  if (!e) throw new Error(`Aucun effectif pour la franchise « ${id} ».`);
  return e;
}

/** La franchise d'un joueur du snapshot. */
export function franchiseDuJoueur(joueur: string): string {
  for (const [id, e] of effectifs) if (e.players.some((j) => j.id === joueur)) return id;
  throw new Error(`Joueur inconnu : ${joueur}`);
}

/** Palette d'une équipe, y compris les sélections du All-Star Game (couleurs neutres). */
export function paletteDe(id: string): Franchise['palette'] {
  return (
    franchises.find((f) => f.id === id)?.palette ?? { primary: '#2B3A4A', secondary: '#F4F3EF', accent: '#C9A227', neutral: '#1D2523' }
  );
}

export function franchiseDe(id: string): Franchise {
  const f = franchises.find((x) => x.id === id);
  if (!f) throw new Error(`Franchise inconnue : ${id}`);
  return f;
}

export function equipeDe(id: string): EquipeDuMatch {
  return equipeDuMatch(effectifDe(id));
}
