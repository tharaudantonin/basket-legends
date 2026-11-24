// Tranche 7 : génération des classes de Draft et des joueurs originaux (décision du CLAUDE.md : les joueurs générés
// sont originaux ; échelle hors NBA 40-67, décision du 24/11/2026). Paramètres : data/draft/modele-draft.json (choix du
// modèle, statut « proposition »). Tout est déterministe : même graine et même année, même classe.
//
// Chaque prospect a un talent latent ; sa note actuelle monte avec le talent et l'âge, son potentiel avec le talent et
// une part propre, et baisse avec l'âge (un joueur de 22 ans est plus proche de son plafond). Ses attributs détaillés
// suivent sa note, le profil de son groupe de poste et un écart propre. Son nom est tiré dans les banques de son pays,
// jamais un nom réel interdit (empreintes), jamais deux fois le même.
import { ATTRIBUTS_DETAILLES, creerHasard, groupeDuPoste, type AttributsDetailles, type Hasard } from '@basket-legends/engine';
import type { GenerateurDeNoms, ModeleDraft, OrigineProspect, Prospect } from './types';

export function gaussien(h: Hasard, moyenne = 0, ecart = 1): number {
  const u = Math.max(h.reel(), 1e-12);
  return moyenne + ecart * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * h.reel());
}

const borner = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));
const pondere = <T extends string>(h: Hasard, table: Record<T, number>): T => h.pondere(Object.keys(table) as T[], (k) => table[k]);

/** Les familles d'attributs à partir des attributs détaillés (moyennes, comme les familles du modèle de notes). */
export function famillesDesDetails(d: AttributsDetailles, endurance: number): Prospect['familles'] {
  const moy = (...xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
  return {
    technique: moy(d.tirCercle, d.tirMiDistance, d.tirATroisPoints, d.lancersFrancs, d.passe, d.maniement),
    physique: moy(d.rebondOffensif, d.rebondDefensif, d.contre, d.vitesse, d.force),
    mental: moy(d.qiOffensif, d.qiDefensif),
    tactique: moy(d.defenseExterieure, d.defenseInterieure, d.interception),
    endurance,
  };
}

/** Tire un nom (prénom, nom) du pays, ni interdit ni déjà pris. */
export function tirerNom(h: Hasard, noms: GenerateurDeNoms, pays: string, pris: Set<string>): { prenom: string; nom: string } {
  const banque = noms.parPays[pays] ?? noms.parPays['USA'];
  if (!banque || !banque.prenoms.length || !banque.noms.length) throw new Error(`Aucune banque de noms pour « ${pays} ».`);
  for (let essai = 0; essai < 200; essai++) {
    const prenom = h.choisir(banque.prenoms);
    const nom = h.choisir(banque.noms);
    const complet = `${prenom} ${nom}`;
    if (pris.has(complet) || noms.estInterdit(prenom, nom)) continue;
    pris.add(complet);
    return { prenom, nom };
  }
  throw new Error(`Impossible de tirer un nom libre pour « ${pays} » après 200 essais.`);
}

export interface JoueurGenere {
  prenom: string;
  nom: string;
  age: number;
  poste: string;
  tailleCm: number;
  poidsKg: number;
  pays: string;
  note: number;
  potentiel: number;
  familles: Prospect['familles'];
  details: AttributsDetailles;
}

/**
 * Un joueur original. `talent` : talent latent (écart-type 1) ; `age` ; `origine` pour le pays. Utilisé pour les
 * classes de Draft et le vivier des joueurs hors NBA (tools/generer-vivier.ts).
 */
export function genererJoueur(
  h: Hasard,
  M: ModeleDraft['classe'],
  noms: GenerateurDeNoms,
  pris: Set<string>,
  talent: number,
  age: number,
  origine: OrigineProspect,
  ageDeReference = 19,
): JoueurGenere {
  const poste = pondere(h, M.postes);
  const [tMoy, tEcart] = M.tailleParPoste[poste] ?? [200, 6];
  const tailleCm = Math.round(borner(gaussien(h, tMoy, tEcart), 175, 228));
  const poidsKg = Math.round(borner(gaussien(h, (M.imcMoyen * tailleCm * tailleCm) / 10000, 6), 70, 150));
  const pays = pondere(h, M.paysParOrigine[origine]);
  const { prenom, nom } = tirerNom(h, noms, pays, pris);
  const annees = age - ageDeReference;
  const N = M.note;
  const note = Math.round(borner(N.moyenne + N.ecartTalent * talent + N.parAnnee * annees + gaussien(h, 0, N.bruit), N.min, N.max));
  const P = M.potentiel;
  const marge = Math.max(0, P.marge + P.ecartTalent * talent + gaussien(h, 0, P.ecartPropre) - P.parAnneeDAge * annees);
  const potentiel = Math.round(borner(note + marge, note, P.max));
  const D = M.details;
  const profil = D.profilParGroupe[groupeDuPoste(poste)] ?? {};
  const details = Object.fromEntries(
    ATTRIBUTS_DETAILLES.map((a) => [a, Math.round(borner(note + (profil[a] ?? 0) + gaussien(h, 0, D.ecart), D.min, D.max))]),
  ) as AttributsDetailles;
  const endurance = Math.round(borner(gaussien(h, 62, 8), D.min, D.max));
  return { prenom, nom, age, poste, tailleCm, poidsKg, pays, note, potentiel, familles: famillesDesDetails(details, endurance), details };
}

/** La classe de Draft d'une année : `taille` prospects, les meilleurs talents d'abord dans l'identifiant. */
export function genererClasse(
  M: ModeleDraft,
  noms: GenerateurDeNoms,
  graine: number,
  annee: number,
  nomsPris: Iterable<string> = [],
): Prospect[] {
  const h = creerHasard(graine, `classe-${annee}`);
  const C = M.classe;
  const pris = new Set(nomsPris);
  const talents = Array.from({ length: C.taille }, () => gaussien(h)).sort((a, b) => b - a);
  return talents.map((talent, i) => {
    const age = Number(pondere(h, C.ages));
    const origine = pondere(h, C.origines);
    const j = genererJoueur(h, C, noms, pris, talent, age, origine);
    return { id: `p${annee}-${String(i + 1).padStart(3, '0')}`, ...j, origine };
  });
}
