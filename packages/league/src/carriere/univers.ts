// Tranche 8 : le contexte d'une saison de la carrière, construit à partir de l'univers de la partie. La première saison
// joue le contexte des données de référence ; les suivantes, celui de leur univers (effectifs, contrats, identités).
// Règles du jeu, réglages du moteur, structure de la ligue et CBA : ceux des données les plus récentes, reconduits tant
// qu'aucun fichier plus récent n'existe (docs/CARRIERE.md § 6).
import { composerEquipe, groupeDuPoste, type EquipeDuMatch, type JoueurDuMatch } from '@basket-legends/engine';
import type { ContexteLigue, EtatSaison, StructureLigue } from '../types';
import { ajouterJours } from '../calendrier';
import type { ModeleCarriere } from './modele';
import type { JoueurCarriere, Univers } from './types';
import { salairesDeLUnivers } from '../marche/operations';
import { planDuStaff } from '../marche/staff';

/** Une ville d'accueil possible pour un changement de franchise (data/ligue/villes-d-accueil.json, sans les sources). */
export interface VilleDAccueil {
  id: string;
  ville: string;
  conference: string;
  /** Noms proposés pour la franchise (originaux, à valider). */
  noms: string[];
  abreviation: string;
}

/** Ce dont la carrière a besoin en plus du contexte d'une saison. */
export interface DonneesCarriere {
  modele: ModeleCarriere;
  villes: VilleDAccueil[];
  /** Identité d'origine de chaque franchise (data/franchises.json). */
  franchises: Record<string, { ville: string; nom: string; abreviation: string }>;
}

/** « 2026-2027 » → « 2027-2028 ». */
export const saisonSuivante = (saison: string): string => {
  const a = Number(saison.slice(0, 4)) + 1;
  return `${a}-${a + 1}`;
};

/** Années écoulées entre deux saisons « AAAA-AAAA ». */
export const anneesEntre = (de: string, a: string): number => Number(a.slice(0, 4)) - Number(de.slice(0, 4));

/** La structure d'une saison future : celle des données, avec les dates décalées d'un nombre entier de semaines. */
export function structureDeLaSaison(base: StructureLigue, saison: string): StructureLigue {
  const n = anneesEntre(base.saison, saison);
  if (!n) return base;
  // Décalage au plus près d'un nombre d'années, en semaines entières : mêmes jours de la semaine que la saison de référence.
  const jours = 7 * Math.round((365.2425 * n) / 7);
  return {
    ...base,
    saison,
    calendrier: {
      ...base.calendrier,
      premierJour: ajouterJours(base.calendrier.premierJour, jours),
      dernierJour: ajouterJours(base.calendrier.dernierJour, jours),
    },
  };
}

export function joueurDuMatchCarriere(j: JoueurCarriere): JoueurDuMatch {
  return {
    id: j.id,
    nom: j.nom,
    numero: j.numero,
    poste: j.poste,
    groupe: groupeDuPoste(j.poste),
    note: j.note,
    technique: j.familles.technique,
    physique: j.familles.physique,
    mental: j.familles.mental,
    tactique: j.familles.tactique,
    endurance: j.familles.endurance,
    tailleCm: j.tailleCm,
    detail: j.details,
  };
}

/** Le nom affiché d'une franchise dans un univers (après un éventuel changement de ville). */
export const nomDeFranchise = (base: ContexteLigue, u: Univers | undefined, id: string): string =>
  u?.franchises[id]?.nom ?? base.equipes[id]?.nom ?? id;

/** Tranche 9 : ce qui, dans l'état, change la composition d'une équipe (cinq du GM, délégation de la rotation). */
export type ChoixDeComposition = Pick<EtatSaison, 'franchise' | 'compositionManuelle' | 'delegations'>;

/** Range l'effectif selon l'ordre du GM (cinq de départ puis rotation) ; les joueurs absents de l'ordre suivent, rangés par le staff. */
export function composerSelonLOrdre(id: string, nom: string, joueurs: readonly JoueurDuMatch[], ordre: readonly string[]): EquipeDuMatch {
  const parId = new Map(joueurs.map((j) => [j.id, j]));
  const ranges = ordre.filter((x) => parId.has(x)).map((x) => parId.get(x)!);
  const reste = composerEquipe(
    id,
    nom,
    joueurs.filter((j) => !ordre.includes(j.id)),
  ).joueurs;
  return { id, nom, joueurs: [...ranges, ...reste], ordreDuGm: true };
}

/** Le contexte de la saison d'un univers, à partir du contexte des données de référence. */
export function contexteDeLUnivers(base: ContexteLigue, u: Univers, choix?: ChoixDeComposition): ContexteLigue {
  const manuelle = choix?.delegations?.rotation === 'gm' && choix.compositionManuelle?.length ? choix.compositionManuelle : undefined;
  const equipes: Record<string, EquipeDuMatch> = Object.fromEntries(
    Object.keys(base.equipes).map((id) => {
      const nom = nomDeFranchise(base, u, id);
      const joueurs = (u.effectifs[id] ?? []).map((j) => joueurDuMatchCarriere(u.joueurs[j]!));
      const e = manuelle && id === choix!.franchise ? composerSelonLOrdre(id, nom, joueurs, manuelle) : composerEquipe(id, nom, joueurs);
      const plan = planDuStaff(u.staff?.[id]);
      return [id, plan ? { ...e, plan } : e];
    }),
  );
  const noms = [...Object.values(u.joueurs).map((j) => j.nom), ...Object.values(u.retraites).map((r) => r.nom)];
  return {
    ...base,
    structure: structureDeLaSaison(base.structure, u.saison),
    equipes,
    recrues: u.recrues,
    pointsParMatchPrecedents: u.pointsParMatchPrecedents,
    salaires: u.plafonds
      ? salairesDeLUnivers(base.salaires.cba, u)
      : { saison: u.saison, cba: base.salaires.cba, contrats: u.contrats, equipes: u.equipes },
    ...(base.draft
      ? {
          draft: {
            ...base.draft,
            historique: u.historiqueLoterie,
            nomsPris: [...new Set([...base.draft.nomsPris, ...noms])],
            ...(u.choix ? { proprietes: u.choix, transmis: u.choixTransmis ?? {} } : {}),
          },
        }
      : {}),
    univers: u,
    base,
  };
}

/** Le contexte de la saison d'un état : celui de son univers, ou celui des données pour la première saison. */
export function contexteDeLaSaison(base: ContexteLigue, etat: Pick<EtatSaison, 'univers'> & Partial<ChoixDeComposition>): ContexteLigue {
  return etat.univers ? contexteDeLUnivers(base, etat.univers, etat as ChoixDeComposition) : base;
}
