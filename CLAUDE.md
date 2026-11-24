# CLAUDE.md — Instructions de travail pour Basket Legends

## Mission
Construire Basket Legends, un jeu web de management basketball profond, jouable sur ordinateur, avec une carrière longue et un moteur de simulation déterministe/reproductible. Lire les documents de `docs/` avant toute modification importante.

## Source de vérité
- `docs/DECISIONS_2026-11.md` : décisions validées par Antonin les 23 et 24 novembre 2026. Elles priment sur tout document plus ancien.
- `docs/AUDIT_2026-11.md` : état réel des dépôts au 23 novembre 2026, constats et feuille de route en tranches.
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
- Trois présentations de match : rapide, commentée possession par possession et interactive. Elles utilisent le même moteur. Le mode interactif fait partie de la V1.
- Environ 840 joueurs au départ, répartition indicative à préciser.
- L'effectif initial est un mapping individuel joueur réel -> personnage fictif, pas une génération de simples archétypes. Le nom fictif conserve les initiales du joueur source ; poste, âge au snapshot, taille, poids, statistiques et attributs sont documentés.
- Les données inconnues ne doivent jamais être inventées. Chaque valeur importée doit conserver source, saison, unité, définition et date de collecte.
- Les attributs subjectifs sont estimés par un modèle explicite, versionné et testable ; ils ne sont pas assimilés directement aux statistiques brutes.
- Les joueurs générés dans les saisons futures sont originaux.

## Snapshot de référence (décision du 23/11/2026)
- **Effectifs :** saison 2026-2027, tels que fournis dans `data/rosters/2026-27/` (arrêtés au 17 novembre 2026).
- **Statistiques de calibration :** saison 2025-2026 terminée, en séparant saison régulière, Play-In et playoffs.
- **Début de carrière :** saison 2026-2027.

## Notes des joueurs (décisions des 23 et 24/11/2026)
- **Échelle « NBA » :** un joueur NBA de rotation se situe autour de 70-75, les superstars au-delà de 90. Les joueurs hors NBA (G League, prospects, joueurs libres générés) se situent entre 40 et 67.
- **Méthode :** les notes sont produites par une formule maison, versionnée et refaisable, à partir des statistiques 2025-2026 sourcées, puis recalées sur l'échelle par quantiles. Les corrections manuelles sont marquées « corrigé par Antonin ».
- **NBA 2K :** les notes de NBA 2K ne servent que de banc d'essai privé, hors du dépôt. Aucune note 2K ne doit entrer dans le jeu ni dans le dépôt. Les valeurs actuelles (`ratings`, `attributes`, `notes.nba2k27` des effectifs) sont provisoires et seront remplacées par le modèle v1.

## Noms réels des joueurs (décision du 24/11/2026)
- Aucun vrai nom de joueur dans le dépôt une fois la migration de la tranche 0 faite. La table de correspondance (vrai nom → nom fictif) et les données de référence privées vont dans `C:\Users\thara\Projets\basket-legends-prive\`, hors du dépôt.
- Jusqu'à cette migration, le champ `sourceName` des effectifs reste en place ; ne pas en ajouter de nouveaux.
- Les empreintes des vrais noms servent à empêcher le jeu de tirer un nom réel (méthode de Rugby Legends).

## Franchise mirror
Chaque franchise fictive hérite de son club analogue : palmarès, records, bilans historiques, couleurs de référence et profil statistique collectif. Les résultats des saisons jouées sont ensuite déterminés par la simulation.

## Direction artistique — contraintes
- Logos de franchises sportives modernes, pas de logos commerciaux.
- Les décisions déjà consignées (palettes, territoires, logos choisis, règles de maillots) ne se rediscutent pas. Seuls les écarts entre un asset et une décision validée sont à signaler.
- Boston Beacons : palette validée (#0F4B3A, #F2EFE5, #B69A62, #1D2523). Logo à simplifier en emblème vintage historique, phare minimal/roundel. Maillots inspirés de la coupe Washington.
- Washington Monuments (anciennement Washington Capitals, renommé le 24/11/2026) : concept original autour d'un monument abstrait et d'une étoile ; palette définitive : Capital Navy #0B2D5B, Capitol Red #C43D45, Federal White #F4F3EF, Monument Silver #AEB7C2. Sur l'Icon navy, étoiles blanches sur les deux côtés.
- Denver Peaks (anciennement Denver Summit, renommé le 24/11/2026) : palette inchangée.
- Les identifiants de données `washington` et `denver` ne changent pas.
- Règle universelle des maillots : chaque col doit être une seule couleur unie. Aucun col bicolore, mélange, dégradé ou liseré multicolore.
- Ne pas copier les identités des équipes réelles.

## Architecture cible (décision du 24/11/2026)
Jeu web qui tourne entièrement dans le navigateur, comme Rugby Legends : Vite + React + TypeScript ; Zod ; Vitest (Playwright pour les parcours) ; sauvegardes versionnées dans IndexedDB ; moteur de simulation pur, indépendant de l'interface, exécuté dans un Web Worker ; monorepo léger en pnpm workspaces (`apps/web`, `packages/engine`, `packages/league`, `packages/data`). Pas de serveur, ni de PostgreSQL, ni de Prisma, sauf nouvel arbitrage.

## Conventions de code (décision du 24/11/2026)
- Identifiants, commentaires et messages en français, comme Rugby Legends.
- Les noms de champs déjà établis dans les fichiers de `data/` sont conservés.
- Hasard déterministe uniquement (générateur à graine, état sérialisable) ; jamais `Math.random`.
- Aucune valeur de règle NBA en dur dans le code : paramètres versionnés par saison, chacun avec sa source.
- Les fichiers de données se modifient par script, jamais à la main.

## Réutilisation de Rugby Legends (décision du 23/11/2026)
- Lecture du dépôt Rugby Legends autorisée.
- Copie de code autorisée, avec traçabilité dans un en-tête : « Repris de rugby-legends@<commit>:<fichier> ; adaptations : … ».
- Interdit : modifier, synchroniser, déplacer ou supprimer des fichiers dans le dépôt Rugby Legends ; y pousser un commit ou y ouvrir une PR ; créer une dépendance d'exécution vers lui.

## Règles Git
- Ce dépôt et ce projet sont exclusivement Basket Legends.
- Avant chaque opération Git, vérifier le dépôt courant, la branche et les fichiers modifiés.
- Ne jamais supprimer un document de référence sans validation explicite de l'utilisateur.

## Porte de publication
Le développement est privé et local. Tout ce qui bloquerait une publication publique est listé dans `docs/AUDIT_2026-11.md` § 3.4 et doit être réglé avant toute diffusion (revue juridique des noms et du mirror individuel, absence de notes de bases tierces, conditions d'utilisation des sources).

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

## Prochaine tâche
Tranche 0 de `docs/AUDIT_2026-11.md` § 7 : socle du monorepo et CI, migration des identifiants de franchise vers ceux de `data/franchises.json`, noms fictifs et sortie des vrais noms vers le dossier privé, schémas Zod. Puis tranche 1 : choisir une franchise, voir l'effectif, simuler un match rapide déterministe, afficher le box score.
