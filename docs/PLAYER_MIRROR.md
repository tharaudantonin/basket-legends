# Player Mirror — correspondance individuelle des joueurs

## Principe
Chaque joueur initial de Basket Legends correspond à un joueur réel précis de l'effectif de référence. Le personnage du jeu porte un nom fictif conservant les initiales du joueur réel. Exemple de convention fourni : **Jayson Tatum → Jason Tatam (JT)**.

La correspondance source est conservée dans les données internes pour assurer la traçabilité. Le jeu affiche le nom fictif.

## Informations à reprendre ou dériver
- Initiales conservées dans le nom fictif.
- Date de naissance et âge calculé au snapshot choisi.
- Taille, poids, poste principal et postes secondaires.
- Numéro initial éventuel.
- Statistiques saisonnières : matchs, titularisations, minutes, points, rebonds, passes, interceptions, contres, pertes de balle, fautes, tirs réussis/tentés, trois points et lancers francs.
- Statistiques avancées disponibles : usage, efficacité, eFG%, TS%, AST%, TOV%, rebond offensif/défensif, on/off, etc., avec définitions.
- Attributs normalisés sur 100 : tir, finition, dribble, création, vision, défense extérieure/intérieure, rebond, vitesse, accélération, détente, force, endurance, décision, placement et discipline.
- Traits visuels documentés : silhouette, morphologie, coiffure, pilosité et autres caractéristiques utiles à la création du personnage.

## Conversion en attributs
Les statistiques brutes ne mesurent pas directement toutes les qualités de jeu. Un modèle versionné doit :
1. normaliser par poste et rôle ;
2. pondérer volume, efficacité, minutes et contexte ;
3. comparer les distributions de ligue ;
4. convertir en échelle 1–100 ;
5. attribuer une confiance par champ ;
6. séparer donnée mesurée et estimation de scouting.

Un nombre de contres ne suffit pas à mesurer la qualité défensive ; un taux de passes ne mesure pas à lui seul la vision du jeu. Les attributs subjectifs doivent rester des estimations explicites.

## Apparence des personnages
La direction demandée est de conserver une forte cohérence visuelle avec le joueur de référence (morphologie et traits physiques documentés) tout en créant des illustrations ou modèles propres à Basket Legends. Aucun portrait photographique, scan facial, tatouage reproduit ou asset tiers ne doit être intégré sans provenance et autorisation appropriées. La revue des droits à l'image/personnalité et des droits applicables est requise avant diffusion publique ou commerciale si la ressemblance demeure identifiable.

## Snapshot proposé
Fin de saison **2025-2026**, date de référence technique **30 juin 2026** (snapshot validé). La carrière débute à l'intersaison 2026 et progresse vers la saison **2026-2027**. L'âge initial est calculé au 30 juin 2026. Les effectifs, statistiques, contrats et appartenances sont gelés dans une version de données identifiée. L'âge est calculé à cette date. Les effectifs, statistiques, contrats et appartenances sont gelés dans une version de données identifiée. En carrière, les joueurs progressent, vieillissent, se blessent, changent d'équipe et prennent leur retraite.

## Schéma de données indicatif
```ts
interface PlayerReferenceMapping {
  fictionalPlayerId: string;
  sourcePlayerId: string;
  referenceFranchiseId: string;
  sourceSeason: string;
  snapshotDate: string;
  realPlayerInitials: string;
  fictionalDisplayName: string;
  birthDate?: string;
  ageAtSnapshot?: number;
  heightCm?: number;
  weightKg?: number;
  primaryPosition?: string;
  secondaryPositions?: string[];
  seasonStats: Record<string, number | string | null>;
  advancedStats: Record<string, number | string | null>;
  attributes: Record<string, number>;
  attributeModelVersion: string;
  visualReferenceNotes?: string;
  sourceIds: string[];
  confidenceByField: Record<string, "high" | "medium" | "low" | "unverified">;
  rightsReviewStatus: "not-reviewed" | "review-required" | "cleared" | "redesign-required";
}
```

## Validation
Un joueur est prêt à intégrer lorsque sa source, son équipe, ses mensurations, son poste, ses statistiques, son nom fictif, ses attributs, ses références visuelles et son niveau de confiance sont renseignés. Les champs manquants sont inconnus, jamais estimés silencieusement.
