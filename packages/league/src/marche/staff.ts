// Tranche 9 (réponses 18, 39 et 40) : le staff de chaque franchise — entraîneur principal, entraîneur du développement,
// directeur du recrutement, responsable médical — et ses effets, bornés et de moyenne nulle :
// - recruteur : précision du scouting de la Draft (écart-type des rapports multiplié par un facteur) ;
// - responsable médical : durée des blessures ;
// - entraîneur du développement : progression des joueurs jeunes (points de note par saison) ;
// - entraîneur principal : le plan de jeu de son équipe (rythme, défense, part du tir à trois points).
// Le staff est original et généré (banques de noms du jeu, compétences tirées) ; tout est déterministe.
import { creerHasard, type Hasard, type PlanDeJeu } from '@basket-legends/engine';
import { gaussien, tirerNom } from '../draft/prospects';
import type { GenerateurDeNoms } from '../draft/types';
import type { Competence, MembreStaff, ModeleStaff, Poste, StaffEquipe } from './types';

const PAYS_STAFF = ['USA', 'USA', 'USA', 'Canada', 'France', 'Serbia', 'Spain', 'Australia'];

function tirerMembre(M: ModeleStaff, h: Hasard, noms: GenerateurDeNoms, pris: Set<string>, poste: Poste, id: string): MembreStaff {
  const def = M.postes.find((p) => p.id === poste)!;
  const pays = h.choisir(PAYS_STAFF);
  const { prenom, nom } = tirerNom(h, noms, noms.parPays[pays] ? pays : 'USA', pris);
  const [min, max] = M.competence.bornes;
  const competences: Partial<Record<Competence, number>> = {};
  for (const c of def.competences)
    competences[c] = Math.round(Math.min(max, Math.max(min, gaussien(h, M.competence.moyenne, M.competence.ecartType))));
  const m: MembreStaff = { id, nom: `${prenom} ${nom}`, age: h.entier(M.ages[0], M.ages[1]), poste, competences };
  if (poste === 'entraineur') {
    const tirer = <T extends string>(t: Record<T, number>): T => h.pondere(Object.keys(t) as T[], (k) => t[k]);
    m.preferences = {
      rythme: tirer(M.preferences.rythme),
      defense: tirer(M.preferences.defense),
      troisPoints: tirer(M.preferences.troisPoints),
    };
  }
  return m;
}

/**
 * Les préférences de `n` entraîneurs en proportions exactes du modèle (arrondies), mélangées : la ligue garde le même
 * mélange de plans d'une partie à l'autre, donc la même calibration (réponse 39 : effet moyen nul).
 */
export function preferencesReparties(M: ModeleStaff, n: number, h: Hasard): NonNullable<MembreStaff['preferences']>[] {
  const repartir = <T extends string>(t: Record<T, number>): T[] => {
    const cles = Object.keys(t) as T[];
    const liste: T[] = [];
    let cumul = 0;
    for (const k of cles) {
      cumul += t[k];
      while (liste.length < Math.round(cumul * n)) liste.push(k);
    }
    while (liste.length < n) liste.push(cles[0]!);
    for (let i = liste.length - 1; i > 0; i--) {
      const j = h.entier(0, i);
      [liste[i], liste[j]] = [liste[j]!, liste[i]!];
    }
    return liste;
  };
  const r = repartir(M.preferences.rythme);
  const d = repartir(M.preferences.defense);
  const t = repartir(M.preferences.troisPoints);
  return Array.from({ length: n }, (_, i) => ({ rythme: r[i]!, defense: d[i]!, troisPoints: t[i]! }));
}

/** Le staff des équipes et le staff libre, tirés pour une partie. */
export function genererStaff(
  M: ModeleStaff,
  noms: GenerateurDeNoms,
  equipes: readonly string[],
  graine: number,
  nomsPris: readonly string[] = [],
): { staff: Record<string, StaffEquipe>; libres: MembreStaff[] } {
  const h = creerHasard(graine, 'staff');
  const pris = new Set(nomsPris);
  let n = 0;
  const id = () => `s${String(++n).padStart(4, '0')}`;
  const staff: Record<string, StaffEquipe> = {};
  const triees = [...equipes].sort();
  const preferences = preferencesReparties(M, triees.length, creerHasard(graine, 'staff-preferences'));
  triees.forEach((e, i) => {
    staff[e] = Object.fromEntries(M.postes.map((p) => [p.id, tirerMembre(M, h, noms, pris, p.id, id())])) as StaffEquipe;
    staff[e].entraineur.preferences = preferences[i];
  });
  const libres: MembreStaff[] = [];
  for (const p of M.postes) for (let k = 0; k < M.libresParPoste; k++) libres.push(tirerMembre(M, h, noms, pris, p.id, id()));
  return { staff, libres };
}

/** Écart d'une compétence à la référence, ramené entre -1 et 1. */
function ecart(M: ModeleStaff, x: number | undefined): number {
  if (x === undefined) return 0;
  return Math.max(-1, Math.min(1, (x - M.competence.reference) / M.competence.etendue));
}

/** Facteur d'un effet borné [min, max] : 1 à la compétence de référence ; meilleure compétence → vers `mieux`. */
function facteur([min, max]: [number, number], e: number): number {
  return e >= 0 ? 1 - e * (1 - min) : 1 + -e * (max - 1);
}

/** Facteur de l'écart-type des rapports de scouting (le meilleur recruteur se trompe moins). */
export const facteurScouting = (M: ModeleStaff, s: StaffEquipe | undefined): number =>
  facteur(M.effets.scouting, ecart(M, s?.recruteur.competences.scouting));

/** Facteur de la durée des blessures (le meilleur médical les raccourcit). */
export const facteurBlessures = (M: ModeleStaff, s: StaffEquipe | undefined): number =>
  facteur(M.effets.blessures, ecart(M, s?.medical.competences.medical));

/** Points de note ajoutés à la progression d'un joueur jeune (négatif avec un staff faible). */
export function bonusProgression(M: ModeleStaff, s: StaffEquipe | undefined, age: number): number {
  if (age > M.effets.progression.ageMax) return 0;
  return M.effets.progression.max * ecart(M, s?.developpement.competences.developpement);
}

/** Le plan de jeu qu'applique l'entraîneur principal (réponse 40). */
export const planDuStaff = (s: StaffEquipe | undefined): Partial<PlanDeJeu> | undefined => s?.entraineur.preferences;

/** Note globale d'un membre du staff (moyenne de ses compétences). */
export const noteDuStaff = (m: MembreStaff): number => {
  const v = Object.values(m.competences);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
};
