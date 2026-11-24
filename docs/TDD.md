# Technical Design Document — Basket Legends

> Mis à jour le 24 novembre 2026 (décision 6a, `docs/DECISIONS_2026-11.md`). Remplace l'architecture serveur (Node.js, PostgreSQL, Prisma) de la version précédente.

## Architecture
Jeu web qui tourne entièrement dans le navigateur, sur le modèle de Rugby Legends : aucun serveur, aucune base de données. Le moteur de simulation est une bibliothèque TypeScript pure, indépendante de l'interface, exécutée dans un Web Worker pour ne pas bloquer l'écran. Contrats TypeScript explicites entre interface, gestion de ligue et moteur sportif. Un serveur ne sera envisagé que pour un besoin nouveau (multi-appareils, jeu en ligne), après arbitrage.

## Stack
- Application : Vite + React + TypeScript.
- Validation des données : Zod.
- Tests : Vitest ; Playwright pour les parcours de bout en bout.
- Persistance : IndexedDB, sauvegardes versionnées avec copies de secours (méthode de Rugby Legends, `src/sauvegarde/stockage.ts` et `src/manager/sauvegarde/`).
- Monorepo : pnpm workspaces.
- Qualité : ESLint et Prettier, intégration continue GitHub Actions (typecheck, tests, vérification des données).

Toute nouvelle dépendance est proposée avec sa raison avant d'être ajoutée.

## Structure cible
```text
apps/web/            écrans, thèmes, sauvegardes IndexedDB
packages/engine/     moteur pur : possessions, règles versionnées par saison, hasard déterministe
packages/league/     saison, calendrier, CBA, Draft, IA de GM, progression, carrière
packages/data/       schémas Zod, chargement, vérificateur des données
data/                données de référence immuables et versionnées
tools/               calibration, migrations, imports privés
docs/
```

Le découpage plus fin (contrats, finances, scouting, médical…) se fait en modules à l'intérieur de `packages/league`, pas en packages séparés, tant qu'aucun besoin ne l'impose.

## Conventions
- Identifiants, commentaires et messages en français ; les noms de champs déjà établis dans `data/` sont conservés.
- Hasard déterministe uniquement : générateur à graine (repris de Rugby Legends, `src/moteur/hasard.ts`) avec un état sérialisable ; jamais `Math.random`.
- Aucune valeur de règle NBA en dur : paramètres versionnés par saison, chacun avec sa source.
- Code repris de Rugby Legends : en-tête « Repris de rugby-legends@<commit>:<fichier> ; adaptations : … ».

## Modules métier
- Simulation de match indépendante de React et reproductible.
- Règles de basket versionnées par saison.
- Référentiel des franchises, joueurs, saisons et sources.
- Correspondance joueur réel → personnage fictif : seuls les noms fictifs et les empreintes des vrais noms sont dans le dépôt ; la table de correspondance reste dans le dossier privé hors du dépôt.
- Génération de joueurs et de prospects originaux (échelle 40-67 hors NBA).
- Contrats, finances, calendrier, statistiques, développement et IA.
- Cycle de carrière, sauvegardes et migrations.

## Données principales
`Career`, `Season`, `League`, `Franchise`, `FranchiseIdentity`, `FranchiseHistory`, `FranchiseSeasonProfile`, `FranchiseSource`, `Player`, `PlayerAttributes`, `PlayerSeasonStats`, `PlayerAppearanceProfile`, `PlayerPersonality`, `PlayerContract`, `PlayerInjury`, `StaffMember`, `TeamRoster`, `Tactics`, `Game`, `GameEvent`, `Possession`, `TeamStats`, `Transaction`, `DraftProspect`, `DraftPick`, `FinanceEntry`, `LeagueStanding`, `Award`, `NewsItem`, `SaveSnapshot`, `RandomState`.

Ces entités sont des types TypeScript et des schémas Zod, pas des tables. Chaque donnée importée conserve source, saison, unité, définition, date de consultation et confiance. Les données immuables de référence sont séparées des données propres aux carrières : une partie garde sa propre copie de l'univers au moment de sa création.

## Simulation et sauvegardes
Chaque partie conserve une graine et l'état du générateur. Le moteur reçoit l'état du match, les effectifs actifs, la fatigue et les blessures, les tactiques et le règlement de la saison ; il renvoie les événements, le box score et l'état final. Les trois présentations (rapide, commentée, interactive) consomment le même flux d'événements.

Mode interactif : l'état du match et l'état du générateur sont sérialisables à chaque possession. Une décision du joueur (temps mort, remplacement, schéma, rythme) est une entrée journalisée ; une reprise rejoue la même graine avec les mêmes décisions et donne le même résultat.

Sauvegardes : emplacements dans IndexedDB, enveloppe versionnée (numéro de format, date, contenu), migrations numérotées d'un format au suivant, copie de secours avant toute donnée illisible ou venue d'une version plus récente, export et import d'un fichier.

## Performance (objectifs à mesurer)
- Un match en mode rapide : quelques millisecondes.
- Une saison régulière complète (1 230 matchs) : moins de 10 secondes dans un Web Worker.

## Tests
- Empreinte du box score : même graine et mêmes décisions donnent le même résultat.
- Distribution des statistiques sur des milliers de matchs, comparée à des fourchettes sourcées de la saison 2025-2026.
- Non-régression sur des saisons complètes.
- Agrégations joueurs/équipes (FGM ≤ FGA, 3PM ≤ FGM, etc.).
- Unicité des noms fictifs et absence de vrai nom (empreintes).
- Sauvegarde, migration, restauration et parcours de carrière.
