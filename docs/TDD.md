# Technical Design Document — Basket Legends

## Architecture
Monolithe modulaire pour la V1. Contrats TypeScript explicites entre interface, gestion et moteur sportif ; extraction en services séparés seulement si nécessaire.

## Stack
- Frontend : React + TypeScript + Tailwind CSS.
- Backend : Node.js + TypeScript.
- Base : PostgreSQL ; ORM Prisma.
- Validation : Zod.
- Tests : Vitest et Playwright.
- Requêtes frontend : TanStack Query.
- Monorepo : pnpm workspaces ou Turborepo.

## Structure cible
```text
apps/web/
apps/server/
packages/shared-types/
packages/simulation-engine/
packages/game-rules/
packages/basketball-data/
packages/player-reference-mapping/
packages/player-generation/
packages/ai-manager/
packages/ai-coach/
packages/ai-scouting/
packages/player-development/
packages/medical-engine/
packages/contracts-engine/
packages/financial-engine/
packages/calendar-engine/
packages/statistics-engine/
packages/career-engine/
prisma/
docs/
data/
tests/
```

## Modules métier
- Simulation de match indépendante de React et reproductible.
- Règles de basket versionnées par saison.
- Référentiel des franchises, joueurs, saisons et sources.
- Mapping joueur réel vers personnage fictif avec provenance, stats, confiance et statut de revue.
- Génération de prospects futurs originaux.
- Modules séparés pour contrats, finance, calendrier, statistiques, développement et IA.
- Cycle de carrière, snapshots et sauvegardes.

## Données principales
`User`, `Career`, `Season`, `League`, `Franchise`, `FranchiseIdentity`, `FranchiseHistory`, `FranchiseSeasonProfile`, `FranchiseSource`, `Player`, `PlayerReferenceMapping`, `PlayerAttributes`, `PlayerSeasonStats`, `PlayerAppearanceProfile`, `PlayerPersonality`, `PlayerContract`, `PlayerInjury`, `StaffMember`, `TeamRoster`, `Tactics`, `Game`, `GameEvent`, `Possession`, `TeamStats`, `Transaction`, `DraftProspect`, `DraftPick`, `FinanceEntry`, `LeagueStanding`, `Award`, `NewsItem`, `SaveSnapshot`, `RandomState`.

Chaque donnée importée conserve source, saison, unité, définition, date de consultation et confiance. Les données immuables de référence sont séparées des données propres aux carrières.

## Simulation et sauvegardes
Chaque partie conserve une graine aléatoire et l'état du générateur. Le moteur reçoit état de match, effectifs actifs, fatigue/blessures, tactiques et règlement ; il renvoie événements, box score et état final. Les trois modes consomment le même flux.

Sauvegardes automatiques et manuelles, snapshots, restauration, transactions pour signatures/échanges/draft/fin de saison et journal des décisions IA.

## Tests
- Distribution des statistiques sur des milliers de matchs.
- Non-régression sur des saisons complètes.
- Agrégations joueurs/équipes.
- Unicité des correspondances de joueurs et contrôle des doublons de noms.
- Sauvegarde/restauration et parcours de carrière.
