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

## Réponses du 24 novembre 2026 après la tranche 1

| N° | Question | Réponse | Conséquence |
|---|---|---|---|
| 1 | Prochaine tranche | (a) Tranche 2 comme prévu | Relevé sourcé des statistiques 2025-2026, modèle de notes v1, calibration du moteur (`npm run sonde`). |
| 2 | Vérification des règles NBA | (a) Au début de la tranche 2 | `data/regles/nba-2026-27.json` vérifié ligne à ligne contre l'édition 2026-27 du Rulebook, puis statut `validated`. |
| 3 | Visuels | (b) Pas de kit UI provisoire : **tous les visuels d'un coup** | Un seul chantier visuel (Phase 1 du ROADMAP), qui comprend aussi les visuels des améliorations ci-dessous (boutique, rétro, animations, cérémonies). L'interface reste fonctionnelle et sobre d'ici là. |
| 4 | Cinq de départ | (b) Automatique jusqu'au module de management | Le staff compose l'équipe (`composition.ts`) jusqu'à ce module. |

**Principe de travail (24/11/2026) :** ne pas se disperser. Peu de chantiers, chacun regroupant un maximum de travail, pour limiter le coût (en tokens) de chaque relance. Les améliorations sont rangées dans les tranches existantes, pas dans des chantiers à part.

## Améliorations validées le 24 novembre 2026

Toutes les améliorations proposées après la tranche 1 sont validées, ainsi que les propositions d'Antonin (marquées « A »). Chacune est rangée dans une tranche de `docs/AUDIT_2026-11.md` § 7.

| Domaine | Amélioration | Tranche |
|---|---|---|
| Moteur | Fins de match tactiques (fautes volontaires, gestion du chronomètre, tir au buzzer), temps-morts | T3 |
| Moteur | Plans de jeu (rythme, défense de zone ou individuelle, part du tir à trois points), qualité de tir selon le défenseur direct | T5 |
| Moteur | Courbe de fatigue propre à chaque joueur, blessures en match | T4 |
| GM | Plafond salarial réel (CBA, paramètres sourcés) | T6 |
| GM | Scouting avec notes incertaines (la vraie note d'un prospect n'est jamais affichée) | T7 |
| GM | Délégations au coach et au staff | T8 |
| GM | Confiance du propriétaire, chimie du vestiaire | T10 |
| Présentation | Actualités générées depuis le journal d'événements | T4 |
| Présentation | Fiche joueur avec graphique d'adresse, match de la semaine commenté | T3 (données) et chantier visuel |
| Qualité | Parcours testés avec Playwright (dès la tranche 2), sauvegardes IndexedDB (T4), revue d'accessibilité (T11) | T2, T4, T11 |
| A — Boutique de points | Points gagnés en jouant, sans argent réel (réponse 5). Cosmétiques : parquets vintage, paniers, ballons vintage, maillots rétro pour chaque franchise, affichages des scores | T11 (logique) et chantier visuel (assets) |
| A — Changement de franchise | Déménagement, nouveau nom, nouveaux maillots. Très rare : en moyenne un changement toutes les 8 saisons dans toute la ligue, vers une liste fermée de villes (réponses 6 à 8) | T9 |
| A — Animations spéciales | Matchs marquants et performances individuelles | T3 (détection depuis le journal) et chantier visuel |
| A — All-Star Game | Jouable, Est contre Ouest, vote simulé (réponse 9) | T4 |
| A — Cérémonie de fin de saison | Récompenses individuelles et d'équipe, animées | T4 (palmarès) et chantier visuel |

Précisions du 24/11/2026 :

| N° | Question | Réponse | Conséquence |
|---|---|---|---|
| 5 | Points de la boutique | (a) Gagnés uniquement en jouant | Victoires, trophées, défis ; aucun achat en argent réel. |
| 6 | Fréquence des changements de franchise | (a) Pour toute la ligue | En moyenne un changement toutes les 8 saisons dans la ligue ; l'IA choisit la franchise concernée. Tirage déterministe (graine de la carrière). |
| 7 | Villes d'accueil | (a) Liste fermée de villes sans équipe NBA | Liste à constituer et sourcer (ex. Seattle, Las Vegas, Kansas City) ; chaque ville reçoit une identité originale dans le chantier visuel. La franchise garde son histoire (palmarès, records). |
| 8 | Franchise de l'utilisateur | (a) Seulement s'il le demande | Elle ne déménage jamais sans son accord ; le propriétaire peut le proposer. |
| 9 | All-Star Game | (a) Est contre Ouest, vote simulé | Sélection par vote simulé, puis match joué avec le même moteur. |

## Réponse du 24 novembre 2026 après la tranche 2

| N° | Question | Réponse | Conséquence |
|---|---|---|---|
| 10 | Paramètres du modèle de notes v1 | Validés tels quels | `data/modeles/notes-v1.json` passe au statut `valide` (poids, ancrages, notes a priori : `docs/NOTES_JOUEURS.md` § 3). Les saisons écourtées par blessure restent une limite connue, corrigeable à la main (« corrigé par Antonin ») ou en v2. |

## Réponse du 24 novembre 2026 après la tranche 4

| N° | Question | Réponse | Conséquence |
|---|---|---|---|
| 11 | Indice d'endurance ajouté au modèle de notes | Validé tel quel | `data/modeles/notes-v1.json` : endurance = minutes par match (1) et part de titularisations (0,3), recalée sur les ancrages des attributs (`docs/NOTES_JOUEURS.md` § 7). |

## Suites

- Tranche 0, faite le 24/11/2026 : socle npm workspaces (`apps/web`, `packages/data`, `packages/engine`), CI GitHub Actions, ESLint, Prettier, Vitest ; effectifs et assets rangés sous les identifiants de `data/franchises.json` ; joueurs renommés `j0001` à `j0523` avec un nom fictif aux mêmes initiales (proposé, à relire) ; vrais noms, notes 2K et effectifs d'origine sortis vers `basket-legends-prive` ; empreintes des vrais noms dans `data/noms/empreintes.json` ; schémas Zod et `npm run verifier`.
- Tranche 1, faite le 24/11/2026 : choisir une franchise, voir l'effectif, simuler un match rapide déterministe, afficher le box score (`docs/SIMULATION_MATCH.md`). Aucune nouvelle décision : les règles NBA sont au statut `review_required` et les réglages du moteur `provisoire-non-calibre`.
- Tranche 2, faite le 24/11/2026, en un seul chantier : règles 2026-27 vérifiées contre le Rulebook (statut `validated`, sections précises, règle d'horloge après faute défensive ajoutée) ; statistiques 2025-2026 relevées sur Basketball-Reference et NBA.com, saison régulière, Play-In et playoffs séparés (`data/statistiques/2025-26/`, `docs/SOURCES.md` § 9) ; modèle de notes v1 appliqué aux 523 joueurs (`docs/NOTES_JOUEURS.md`, paramètres validés, réponse 10) ; moteur calibré sur 1 000 matchs, 19 mesures sourcées dans leurs fourchettes (`docs/SIMULATION_MATCH.md` § 3) ; trois parcours Playwright dans la CI. Point restant à arbitrer : traitement des saisons écourtées par blessure (`docs/NOTES_JOUEURS.md` § 6).
- Tranche 3, faite le 24/11/2026, en un seul chantier : mode commenté possession par possession (même journal, même box score, même empreinte qu'en mode rapide) ; temps-morts réglementaires et obligatoires, fins de période et fins de match tactiques (fautes volontaires, gestion du chronomètre, dernier tir, tir au buzzer) ; position de chaque tir et fiche joueur avec graphique d'adresse et statistiques sourcées ; détection des moments marquants et intérêt d'un match. Moteur recalibré (`data/moteur/match-v2.json`), 19 mesures dans leurs fourchettes ; cinq parcours Playwright. Détail : `docs/SIMULATION_MATCH.md` §§ 3 et 6. Aucune nouvelle décision.
- Tranche 4, faite le 24/11/2026, en un seul chantier : saison de 82 matchs (calendrier NBA, classements et départages NBA, Play-In, playoffs), saison complète en 3 à 4 secondes ; paquet `packages/league` ; All-Star Game Est-Ouest au vote simulé ; palmarès de fin de saison ; actualités générées et match de la semaine ; endurance propre à chaque joueur et blessures en match ; sauvegardes versionnées dans IndexedDB ; usage des tirs recalé sur la distribution des marqueurs 2025-26. Détail : `docs/SAISON.md`. L'indice d'endurance ajouté au modèle de notes est validé (réponse 11). Sources secondaires à recouper avant publication : format des playoffs, règle des 65 matchs.
- Tranche 5, faite le 24/11/2026, en un seul chantier : mode interactif V1 sur le même moteur — décisions du coach aux arrêts de jeu (plan de jeu, temps-morts, changements, délégation au staff), reprise déterministe testée (même graine et mêmes décisions, même match ; le match avant une décision ne change pas), matchs interactifs en saison, repris après rechargement ; plans de jeu (rythme, défense de zone ou individuelle, part du tir à trois points) et qualité de tir selon le défenseur direct. Réglages `data/moteur/match-v4.json`, 19 mesures dans leurs fourchettes. Détail : `docs/SIMULATION_MATCH.md` § 8. À valider : les effets des plans de jeu (choix du modèle, non sourcés).
- Tranche 6, faite le 24/11/2026, en un seul chantier : paramètres de la CBA 2026-27 sourcés (`data/cba/nba-2026-27.json`) ; contrats des 523 joueurs relevés et rattachés hors du dépôt (`data/contrats/2026-27.json`) ; masse salariale, niveau, taxe de luxe (les 30 taxes publiées retrouvées au dollar près), exceptions, contrôle des signatures et des effectifs ; joueurs two-way exclus de la phase finale ; onglet « Masse salariale ». Détail : `docs/CONTRATS.md`. À recouper avant publication : barèmes secondaires avec le texte de la CBA.
