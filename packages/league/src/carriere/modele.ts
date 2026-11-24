// Tranche 8 : les paramètres du modèle de carrière (data/modeles/carriere-v1.json, sans l'en-tête ni les sources).
// Ce sont des choix du modèle (statut « proposition »), calés pour que la distribution des notes reste stable sur 20
// saisons (critère de sortie de la tranche 8, `npm run carriere`) ; la forme de la courbe d'âge suit la littérature
// citée dans le fichier (pic vers 27-28 ans, déclin d'abord rapide puis plus lent).

/** Une table par âge : interpolation linéaire entre les âges connus (en deçà du premier ou au-delà du dernier : la borne). */
export type TableParAge = Record<string, number>;

export interface ModeleCarriere {
  progression: {
    /** Évolution moyenne de la note d'une saison à l'autre selon l'âge de la saison écoulée (joueurs sans potentiel connu). */
    evolution: TableParAge;
    /** Écart-type de l'évolution selon l'âge. */
    ecart: TableParAge;
    /** Joueurs au potentiel connu, avant `agePic` : part de l'écart au potentiel comblée chaque saison. */
    rattrapage: TableParAge;
    agePic: number;
    /** Décalage, par saison au-delà de `apres`, de l'évolution de certains attributs par rapport à la note. */
    profils: { attributs: string[]; apres: number; parAn: number; max: number }[];
    /** Écart propre de chaque attribut autour de l'évolution de la note. */
    ecartAttribut: number;
    /** Une progression (évolution positive) ralentit près du haut de l'échelle : × (max − note) / (max − debut) au-delà de `debut`. */
    compression: { debut: number };
    /** Endurance : évolution par saison après `apres`. */
    endurance: { apres: number; parAn: number };
    bornes: [number, number];
  };
  retraite: {
    /** Au-delà : retraite certaine. */
    ageMax: number;
    /** Probabilité de retraite d'un joueur sous contrat NBA : à partir de `age`, base + parAn × (âge − age) + parPoint × (seuil − note)⁺. */
    sousContrat: { age: number; base: number; parAn: number; parPoint: number; seuil: number };
    /** Même formule pour un joueur sans contrat NBA. */
    sansContrat: { age: number; base: number; parAn: number; parPoint: number; seuil: number };
  };
  effectifs: {
    /** Contrats standard visés par équipe à l'ouverture de la saison (le maximum vient de la CBA). */
    standardVises: number;
    /** Prolongation automatique d'un contrat échu (règle provisoire avant la free agency de la tranche 9) : durée en saisons. */
    dureeProlongation: number;
    /** Note en deçà de laquelle une équipe ne prolonge pas (elle préfère un joueur libre). */
    noteMinProlongation: number;
    /** Âge au-delà duquel une équipe ne prolonge plus. */
    ageMaxProlongation: number;
    /** Âge maximum pour un contrat two-way signé par l'IA. */
    ageMaxTwoWay: number;
    /** Âge au-delà duquel un joueur en développement devient libre. */
    ageFinDeveloppement: number;
  };
  demenagement: {
    /** Probabilité qu'une franchise change de ville à une intersaison (pour toute la ligue). */
    probabiliteParSaison: number;
    /** Saisons minimum entre deux changements de la même franchise. */
    delaiMinimum: number;
  };
}

/** La valeur d'une table par âge (âge entier ; hors table, la borne la plus proche). */
export function valeurParAge(t: TableParAge, age: number): number {
  const ages = Object.keys(t)
    .map(Number)
    .sort((a, b) => a - b);
  if (!ages.length) return 0;
  if (age <= ages[0]!) return t[String(ages[0])]!;
  if (age >= ages[ages.length - 1]!) return t[String(ages[ages.length - 1])]!;
  let i = 0;
  while (ages[i + 1]! <= age) i++;
  const [a, b] = [ages[i]!, ages[i + 1]!];
  const [va, vb] = [t[String(a)]!, t[String(b)]!];
  return va + ((vb - va) * (age - a)) / (b - a);
}
