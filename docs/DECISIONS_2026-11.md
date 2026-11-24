# Décisions validées — novembre 2026

Ce document consigne les décisions d'Antonin prises à l'occasion de l'audit de novembre 2026 (`docs/AUDIT_2026-11.md`). Elles priment sur tout document plus ancien du dépôt.

## Décisions du 23 novembre 2026

| N° | Domaine | Décision |
|---|---|---|
| 1 | Rugby Legends | Lecture et copie autorisées, avec traçabilité (fichier et commit d'origine, adaptations). Ni modification, ni push, ni PR, ni dépendance d'exécution vers le dépôt Rugby Legends. |
| 2 | Snapshot | Effectifs 2026-2027 de `data/rosters/2026-27/` (arrêtés au 17 novembre 2026) ; statistiques de la saison 2025-2026 terminée (saison régulière, Play-In et playoffs séparés) pour calibrer les notes ; la carrière démarre en 2026-2027. |
| 3 | Échelle des notes | Échelle « NBA » : un joueur de rotation autour de 70-75, les superstars au-delà de 90. L'échelle « 50 = moyenne » est abandonnée. |
| 4 | Joueurs | Joueurs reconnaissables avec noms fictifs : le mirror individuel (initiales, gabarit, poste, statistiques) est conservé. |
| 5 | Diffusion | Tests privés et locaux aujourd'hui, publication publique visée un jour. Ce qui bloquerait une publication est regroupé dans une porte de publication (`docs/AUDIT_2026-11.md` § 3.4), sans bloquer le développement privé. |
| 6 | Plateforme | Jeu web, comme Rugby Legends ; la persistance suit Rugby Legends sauf argument fort documenté. |
| 7 | Mode interactif | Présent dans la V1, avec un maximum d'éléments premium. |
| 8 | Direction artistique | Les décisions consignées pour les 30 franchises (palettes, territoires, logos choisis, règles de maillots) ne se rediscutent pas. Seuls les écarts entre un asset et une décision validée sont signalés. |
| 9 | Noms de franchises | Washington Capitals et Denver Summit sont remplacés ; Houston Commanders et Atlanta Eagles sont conservés. Les identifiants de données (`washington`, `denver`) et les palettes ne changent pas. |

## Réponses du 24 novembre 2026 aux questions de l'audit

| N° | Question (`docs/AUDIT_2026-11.md` § 9) | Réponse | Conséquence |
|---|---|---|---|
| 1 | Dossier local | (a) Claude clone le dépôt | Fait le 24/11/2026 dans `C:\Users\thara\Projets\basket-legends`. |
| 2 | Notes NBA 2K | (a) Formule maison, 2K comme banc d'essai privé | Modèle de notes v1 versionné, calibré sur les statistiques 2025-2026 et recalé par quantiles. Les notes 2K restent hors du dépôt et hors du jeu ; elles ne servent qu'à mesurer l'écart. Les notes actuelles des effectifs sont provisoires. |
| 3 | Noms de Washington et Denver | **Washington Monuments** et **Denver Peaks** | Noms mis à jour dans le registre et la documentation. Réserve consignée : « Denver Peak » figurait parmi les noms envisagés puis écartés lors du choix du nom de Denver Summit FC (club NWSL) ; à vérifier lors de la revue juridique. |
| 4 | Langue du code | (a) Français, comme Rugby Legends | Identifiants, commentaires et messages en français ; les noms de champs déjà établis dans `data/` sont conservés. |
| 5 | Vrais noms des joueurs | (a) Sortis vers un dossier privé hors du dépôt | Dossier `C:\Users\thara\Projets\basket-legends-prive\` ; migration en tranche 0 ; empreintes des vrais noms dans le dépôt pour empêcher leur tirage. |
| 6 | Architecture | (a) Entièrement dans le navigateur, IndexedDB | Pas de serveur, ni PostgreSQL, ni Prisma. `docs/TDD.md` mis à jour. |
| 7 | Échelle sous la NBA | (a) 40-67 | G League, prospects et joueurs libres générés entre 40 et 67. |
| 8 | Statistiques 2025-2026 | (a) Claude les relève | Relevé sourcé (NBA.com ou Basketball-Reference), dans le respect de leurs conditions d'utilisation, à la tranche 2. |
| 9 | Homonymes de clubs disparus | (a) Gardés, signalés dans la porte de publication | Boston Beacons, New York Skyliners, Indianapolis Racers, Los Angeles Stars et Miami Tropics restent ; revue juridique avant publication, Los Angeles Stars et Miami Tropics en priorité. |
| 10 | Doublon du n° 7 à Chicago | (a) Gardé provisoirement | Comme le n° 9 de Toronto, à corriger quand le bon numéro sera connu. |

## Suites

- Tranche 0, faite le 24/11/2026 : socle npm workspaces (`apps/web`, `packages/data`, `packages/engine`), CI GitHub Actions, ESLint, Prettier, Vitest ; effectifs et assets rangés sous les identifiants de `data/franchises.json` ; joueurs renommés `j0001` à `j0523` avec un nom fictif aux mêmes initiales (proposé, à relire) ; vrais noms, notes 2K et effectifs d'origine sortis vers `basket-legends-prive` ; empreintes des vrais noms dans `data/noms/empreintes.json` ; schémas Zod et `npm run verifier`.
- Tranche 1 : choisir une franchise, voir l'effectif, simuler un match rapide déterministe, afficher le box score.
