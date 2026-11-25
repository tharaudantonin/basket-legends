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
  schemaVivier,
  schemaModeleDraft,
  schemaLoterie,
  modeleDeDraft,
  reglesDeLaLoterie,
  valeursDesRegles,
  donneesDeCarriere,
  historiqueDesChoix,
  schemaHistoriqueLoterie,
  schemaModeleCarriere,
  schemaVillesDAccueil,
  universInitial,
  donneesDuMarche,
  schemaModeleMarche,
  schemaModeleStaff,
  schemaTransactions,
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
import vivierBrut from '../../../data/vivier/2026-27.json';
import modeleDraftBrut from '../../../data/draft/modele-draft.json';
import loterieBrute from '../../../data/draft/loterie-2027-2029.json';
import historiqueBrut from '../../../data/draft/historique-loterie.json';
import modeleCarriereBrut from '../../../data/modeles/carriere-v1.json';
import villesBrutes from '../../../data/ligue/villes-d-accueil.json';
import marcheBrut from '../../../data/modeles/marche-v1.json';
import staffBrut from '../../../data/modeles/staff-v1.json';
import transactionsBrutes from '../../../data/ligue/transactions-2026-27.json';
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
/** Tranche 7 : joueurs originaux générés hors NBA (développement et libres), sans franchise avant la tranche 9. */
export const vivier = schemaVivier.parse(vivierBrut);
/** Tranche 7 : modèle de scouting (fourchettes affichées) et règles de la loterie, pour l'écran de la Draft. */
export const modeleDraft = modeleDeDraft(schemaModeleDraft.parse(modeleDraftBrut));
export const fichierLoterie = schemaLoterie.parse(loterieBrute);
export const reglesLoterie = reglesDeLaLoterie(fichierLoterie);

export const effectifs = new Map<string, Effectif>(
  Object.values(effectifsBruts).map((brut) => {
    const e = schemaEffectif.parse(brut);
    return [e.franchise.id, e];
  }),
);

/** Tranche 8 : l'univers de la première saison (snapshot et vivier) et le modèle de carrière. */
export const universDeDepart = universInitial(
  fichierLigue.saison,
  [...effectifs.values()],
  vivier,
  salaires,
  historiqueDesChoix(schemaHistoriqueLoterie.parse(historiqueBrut)),
);
export const fichierCarriere = schemaModeleCarriere.parse(modeleCarriereBrut);
export const donneesCarriere = donneesDeCarriere(fichierCarriere, schemaVillesDAccueil.parse(villesBrutes), registre, [
  ...effectifs.values(),
]);

/** Tranche 9 : modèles du marché et du staff, dates et volumes des transactions. */
export const fichierMarche = schemaModeleMarche.parse(marcheBrut);
export const fichierStaff = schemaModeleStaff.parse(staffBrut);
export const donneesMarche = donneesDuMarche(fichierMarche, fichierStaff, schemaTransactions.parse(transactionsBrutes));

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
