# CLAUDE.md — Instructions de travail pour Basket Legends

## Mission
Construire Basket Legends, un jeu web de management basketball profond, jouable sur ordinateur, avec une carrière longue et un moteur de simulation déterministe/reproductible. Lire les documents de `docs/` avant toute modification importante.

## Source de vérité
- `docs/GDD.md` : règles de conception et périmètre produit.
- `docs/TDD.md` : architecture technique.
- `docs/03-basketball-rules/GAME_RULES.md` : règles sportives NBA et exigences de simulation.
- `docs/ART_BIBLE.md` : direction artistique.
- `docs/FRANCHISE_BIBLE.md` : noms et univers des franchises.
- `data/franchises.json` : source canonique des 30 franchises et de leurs palettes (`primary`, `secondary`, `accent`, `neutral`). `data/franchises.csv` est un miroir ; ne jamais utiliser un code HEX d'un dossier Markdown en cas de divergence.
- `docs/PLAYER_MIRROR.md` : contrat logique, données et correspondance individuelle des joueurs.
- `docs/SOURCES.md` et `data/sources.json` : hiérarchie des sources, provenance et version du snapshot.
- `docs/DATA_PARITY.md` : héritage historique et profils statistiques des franchises.
- `docs/IDENTITY_CONCEPTS.md` : décisions graphiques et état des assets.
En cas de contradiction, les décisions les plus récentes et explicitement validées par l'utilisateur priment. Documenter les changements dans les fichiers correspondants.

## Décisions produit non négociables
- Le joueur incarne le General Manager.
- 30 franchises fictives, implantées dans les villes des franchises NBA de référence.
- Les noms et identités sont originaux ; aucune utilisation des logos, marques, mascottes ou uniformes NBA.
- La carrière est multi-saisons et générative.
- Trois présentations de match : rapide, commentée possession par possession et interactive. Elles utilisent le même moteur.
- Environ 840 joueurs au départ, répartition indicative à préciser.
- L'effectif initial est un mapping individuel joueur réel -> personnage fictif, pas une génération de simples archétypes. Le nom fictif conserve les initiales du joueur source ; poste, âge au snapshot, taille, poids, statistiques et attributs sont documentés.
- Les données inconnues ne doivent jamais être inventées. Chaque valeur importée doit conserver source, saison, unité, définition et date de collecte.
- Les attributs subjectifs 1-100 sont estimés par un modèle explicite, versionné et testable ; ils ne sont pas assimilés directement aux statistiques brutes.
- Les joueurs générés dans les saisons futures sont originaux.

## Franchise mirror
Chaque franchise fictive hérite de son club analogue : palmarès, records, bilans historiques, couleurs de référence et profil statistique collectif. Les résultats des saisons jouées sont ensuite déterminés par la simulation.
Snapshot de référence : saison 2025-2026, arrêté au 30 juin 2026. La carrière commence à l'intersaison 2026 et conduit à la saison 2026-2027.

## Direction artistique — contraintes
- Logos de franchises sportives modernes, pas de logos commerciaux.
- Boston Beacons : palette validée (#0F4B3A, #F2EFE5, #B69A62, #1D2523). Logo à simplifier en emblème vintage historique, phare minimal/roundel. Maillots inspirés de la coupe Washington.
- Washington Capitals : concept original autour d'un monument abstrait et d'une étoile ; palette définitive : Capital Navy #0B2D5B, Capitol Red #C43D45, Federal White #F4F3EF, Monument Silver #AEB7C2. Sur l'Icon navy, étoiles blanches sur les deux côtés.
- Règle universelle des maillots : chaque col doit être une seule couleur unie. Aucun col bicolore, mélange, dégradé ou liseré multicolore.
- Ne pas copier les identités des équipes réelles. Washington Capitals est un nom utilisé par une franchise NHL : conserver le risque dans la documentation et ne pas publier/commercialiser sans revue juridique.

## Architecture cible
React + TypeScript + Tailwind ; Node.js + TypeScript ; PostgreSQL + Prisma ; Zod ; Vitest + Playwright ; monolithe modulaire ; pnpm workspaces/Turborepo. Le moteur de simulation est indépendant de l'interface et tourne côté serveur.

## Isolation stricte du dépôt
- Ce dépôt et ce projet sont exclusivement Basket Legends.
- Ne jamais modifier, synchroniser, déplacer, supprimer ou réutiliser des fichiers dans le dépôt Rugby Legends.
- Ne jamais ouvrir une PR ou pousser un commit vers Rugby Legends depuis ce projet.
- Toute réutilisation de logique issue de Rugby Legends doit être spécifiée et réimplémentée/adaptée dans ce dépôt, sans dépendance implicite ni modification de l'autre dépôt.
- Avant chaque opération Git, vérifier le dépôt courant, la branche et les fichiers modifiés.
- Ne jamais supprimer un document de référence sans validation explicite de l'utilisateur.

## Méthode de développement
1. Avant de coder, examiner l'arborescence et les documents existants.
2. Construire par petites étapes verticales, testées.
3. Ne pas créer de microservices prématurément.
4. Ne pas ajouter de dépendance sans justification.
5. Écrire/mettre à jour tests et documentation avec chaque fonctionnalité.
6. Préserver les identifiants et formats de données déjà établis.
7. Ne pas écraser les décisions validées par une préférence personnelle.
8. Distinguer clairement implémenté, maquette, concept et proposition.
9. Ne jamais déclarer une fonctionnalité terminée sans test ou vérification pertinente.

## Première tâche recommandée
Initialiser le monorepo TypeScript et l'application web minimale, avec un dashboard de GM desktop-first, navigation latérale et écran de sélection de franchise alimenté par `data/franchises.json`. Avant d'implémenter la simulation, définir les contrats de données partagés et le modèle de carrière.
