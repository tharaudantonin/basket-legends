# Game Design Document — Basket Legends

## Concept
Basket Legends est un jeu web de management basketball au long cours. Le joueur incarne le **General Manager** d'une franchise professionnelle. Il construit l'effectif, négocie les contrats, pilote les finances, supervise le recrutement et fixe les orientations sportives. Le Head Coach peut recevoir une autonomie importante sur les décisions de terrain.

## Décisions de conception validées

| Domaine | Décision |
|---|---|
| Support | Jeu web, desktop-first |
| Univers | 30 franchises fictives dans les villes des franchises NBA de référence |
| Identités | Noms choisis, logos/wordmarks/maillots originaux |
| Référence des franchises | Héritage, couleurs, palmarès et profils statistiques des clubs réels analogues |
| Joueurs | Contreparties fictives individuelles des joueurs réels de référence |
| Noms des joueurs | Fictifs, avec les mêmes initiales que les joueurs de référence |
| Données joueurs | Âge au snapshot, taille, poids, poste, statistiques et attributs dérivés |
| Rôle | General Manager |
| Délégation | Responsabilités délégables au Head Coach et au staff |
| Effectifs initiaux | Environ 840 joueurs (répartition indicative : 450 NBA, 180 développement, 210 libres/prospects) |
| Matchs | Rapide, commenté possession par possession, interactif |
| Carrière | Longue, générative et sans limite prédéfinie |
| Développement | V1 complète et jouable, enrichie ensuite |

## Création de carrière
1. Paramètres de partie : difficulté, rythme, niveau de détail et sauvegarde.
2. Choix d'une franchise parmi les 30.
3. Configuration de la délégation : recrutement, rotations, tactiques, développement, staff et communication.
4. Chargement/génération de l'univers : effectifs, staff, contrats, finances et historique.
5. Présentation et lancement.

## Boucle de saison
Intersaison, pré-saison, saison régulière, Play-In éventuel et playoffs. Le calendrier de référence proposé comprend 82 matchs par équipe, avec règles et formats versionnés par saison.

- Intersaison : bilan, objectifs du propriétaire, Draft, scouting, free agency, échanges, contrats et recrutement du staff.
- Saison : rotations, tactiques, entraînements, blessures, fatigue, vestiaire, standings, médias et objectifs.
- Clôture : récompenses, bilans, progression/régression, retraites, expirations contractuelles et génération de la saison suivante.

La carrière continue après un licenciement : le joueur peut rejoindre une autre franchise.

## Joueurs et effectifs
Chaque joueur de départ est associé à un joueur réel précis de l'effectif de référence. La correspondance source reste dans les données internes ; le jeu affiche le nom fictif conservant les initiales. Les fiches comprennent date de naissance, âge au snapshot, taille, poids, poste principal/secondaire, numéro initial éventuel, statistiques saisonnières et avancées disponibles, attributs 1–100, profil physique, traits visuels documentés, personnalité, potentiel et état médical.

Les attributs non directement mesurés (vision, placement, discipline, qualité d'écran, etc.) sont estimés par un modèle explicite, versionné et assorti d'un niveau de confiance. Les champs inconnus restent inconnus, jamais inventés. Les joueurs générés après le lancement sont entièrement originaux.

## Systèmes majeurs
- Gestion : propriétaire, GM, Head Coach, staff, confiance, objectifs, budget, revenus, dépenses et masse salariale.
- Recrutement : Draft, prospects, scouting, workouts, free agency, échanges et contrats.
- Coach : systèmes offensifs/défensifs, tempo, spacing, sélection des tirs, transition, rebond, matchups, rotations et minutes.
- Monde vivant : IA GM/coach/scouting/développement/médical/médias, transactions, blessures, rumeurs, records et archives.

## Match Center
Un moteur de possession commun aux trois présentations :
1. Rapide : résultat, box score, moments clés et rapport.
2. Commenté : chronologie possession par possession et statistiques en direct.
3. Interactif : simulation suspendue aux substitutions, temps morts, changements tactiques, rythme et consignes.

## Héritage des franchises
Au démarrage, l'historique réel documenté (fondation, titres, saisons, bilans, records, rivalités) constitue l'archive initiale. Le profil collectif est calibré sur une saison réelle terminée et, si possible, une moyenne pluriannuelle. Dès le premier match de la carrière, les résultats futurs émergent du moteur et peuvent diverger de l'histoire réelle.

## Direction artistique
Simulation sportive premium, réaliste et contemporaine. Les logos sont des emblèmes sportifs modernes (animaux stylisés, mascottes, monogrammes, écussons, symboles territoriaux), pas des logos de marques commerciales. Ils sont originaux et ne copient pas les actifs NBA ou des clubs réels.

## Critères d'acceptation V1
30 franchises autonomes, effectifs initiaux appariés, environ 840 joueurs, ligue de développement, contrats/finances/staff, Draft/free agency/transferts, calendrier/playoffs, trois modes de match, IA autonome, statistiques cohérentes, sauvegardes et carrières multi-saisons.
