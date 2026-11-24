# NBA Game Rules — Basket Legends

> Statut : document de travail v0.1  
> Date de vérification des sources : 17 novembre 2026  
> Périmètre : règles sportives applicables à une simulation de match NBA

## 1. Objet et hiérarchie des règles

Ce document transforme les règles du basket NBA en exigences fonctionnelles et techniques pour Basket Legends. Il ne reproduit pas intégralement le texte du règlement officiel : il en décrit les mécanismes à implémenter, les états de jeu, les événements, les sanctions et les tests attendus.

Ordre de priorité :
1. NBA Official Rulebook en vigueur pour la saison simulée.
2. Décisions et interprétations officielles NBA publiées par les instances compétentes.
3. NBA-NBPA Collective Bargaining Agreement (CBA) pour les règles contractuelles et économiques — hors du périmètre des règles de match.
4. Trip Double pour les explications vulgarisées, jamais pour trancher une divergence avec une source officielle.

Sources :
- NBA Official Rulebook : https://official.nba.com/rulebook/
- Trip Double — catégorie NBA : https://tripdouble.com/category/nba/#regles-nba

Toute règle implémentée doit être associée à une saison d'application, une source, une date de vérification, un statut de validation et des tests. Les valeurs ne doivent pas être dispersées en constantes dans le code.

## 2. Principes de conception du moteur de règles

- Le moteur de règles est indépendant de l'interface et du moteur de présentation.
- Une règle produit des effets déterministes à partir de l'état du match et des événements.
- Le moteur conserve un journal d'événements permettant de reconstruire une séquence.
- Les règles sont paramétrées et versionnées par saison.
- Une règle non vérifiée ne doit pas être présentée comme définitivement implémentée.
- Les modes rapide, commenté et interactif utilisent exactement le même moteur réglementaire.
- Les décisions d'arbitrage sont simulées ; elles ne sont pas décidées par l'interface.

## 3. Paramètres fondamentaux du match

À formaliser et tester :
- Deux équipes, cinq joueurs par équipe sur le terrain.
- Quatre quart-temps de douze minutes.
- Prolongations de cinq minutes en cas d'égalité à la fin du temps réglementaire.
- Chronomètre de match, chronomètre de possession et gestion des arrêts.
- Score, possession, équipe en attaque, équipe en défense et sens d'attaque.
- Fautes individuelles et fautes d'équipe.
- Temps-morts, remplacements et joueurs indisponibles.
- Gestion des périodes, des pauses et des fins de match.

Les paramètres exacts doivent être confirmés contre l'édition officielle du Rulebook applicable à la saison choisie avant de marquer cette section comme validée.

Tranche 1 (24/11/2026) : les paramètres utilisés par le match rapide sont dans `data/regles/nba-2026-27.json`, chacun avec sa référence. Tranche 2 (24/11/2026) : vérifiés contre les pages du Rulebook 2026-27 (official.nba.com), section par section ; statut `validated`. Le PDF de l'édition n'a pas pu être lu : à relire en cas de doute. Ce qui est simulé et ce qui ne l'est pas encore : `docs/SIMULATION_MATCH.md` § 4.

## 4. Plan de transcription du NBA Official Rulebook

### Rule No. 1 — Court Dimensions and Equipment
Dimensions du terrain, lignes, paniers, ballon, équipements réglementaires et conséquences des anomalies d'équipement.

### Rule No. 2 — Duties of the Officials
Rôles des arbitres, responsabilités, signalements, administration du match et coordination des officiels.

### Rule No. 3 — Players, Substitutes and Coaches
Composition des équipes, joueurs autorisés, remplacements, entraîneurs, bancs et obligations des participants.

### Rule No. 4 — Definitions
Définitions officielles nécessaires à l'interprétation cohérente des événements du moteur : contrôle du ballon, tir, tentative, joueur en l'air, faute, possession, etc.

### Rule No. 5 — Scoring and Timing
Valeur des paniers, chronométrage, quart-temps, prolongations, fins de période, correction du chronomètre et situations de fin de match.

### Rule No. 6 — Putting Ball in Play — Live/Dead Ball
Entre-deux, procédure de remise en jeu, ballon vivant et ballon mort, début et reprise du jeu.

### Rule No. 7 — Shot Clock
Durée de possession, démarrage, arrêt, remise à zéro et réinitialisation partielle. Chaque situation doit être modélisée explicitement, sans règle générique approximative.

### Rule No. 8 — Out-of-Bounds and Throw-In
Sorties, joueur ou ballon hors limites, remises en jeu, emplacement, délais et violations associées.

### Rule No. 9 — Free Throws and Penalties
Situations donnant droit à des lancers francs, ordre des joueurs, violations pendant les lancers, nombre de tentatives et administration des pénalités.

### Rule No. 10 — Violations and Penalties
Marcher, reprise de dribble, trois secondes, cinq secondes, huit secondes, retour en zone arrière, interférences et autres violations prévues par le règlement NBA.

### Rule No. 11 — Basket Interference — Goaltending
Interférence avec le ballon, goaltending offensif ou défensif, ballon au-dessus du cercle et attribution des points ou de la possession.

### Rule No. 12 — Fouls and Penalties
Fautes personnelles, offensives, défensives, techniques, flagrantes, doubles, fautes d'équipe, pénalités, disqualifications et situations particulières.

### Rule No. 13 — Instant Replay
Situations révisables, procédure, autorité arbitrale, conséquences de la révision et impact sur le chronomètre ou la possession.

### Rule No. 14 — Coach's Challenge
Conditions d'utilisation, nombre de challenges, délais, décisions révisables, conséquences d'une contestation réussie ou échouée et évolution selon la saison.

## 5. Systèmes transversaux à spécifier

- Gestion des fautes d'équipe et des pénalités par période.
- Bonus et lancers francs associés.
- Disqualification après six fautes personnelles, sous réserve des dispositions particulières du règlement.
- Temps-morts : attribution, durée, disponibilité et restrictions temporelles.
- Remplacements : fenêtres autorisées et procédure.
- Situations de fin de période et de fin de match.
- Règles de possession alternée / entre-deux selon les cas.
- Arbitrage vidéo et Coach's Challenge.
- Gestion des erreurs de table et corrections officielles.

## 6. Traduction en événements du moteur

Le moteur devra au minimum représenter les événements suivants :
- period_started, period_ended
- possession_started, possession_ended
- shot_attempted, shot_made, shot_missed
- free_throw_awarded, free_throw_attempted, free_throw_made, free_throw_missed
- rebound_offensive, rebound_defensive
- turnover
- foul_personal, foul_offensive, foul_technical, foul_flagrant
- violation
- substitution
- timeout_called
- shot_clock_reset
- review_started, review_completed
- coach_challenge_called, coach_challenge_resolved
- score_corrected

La liste est indicative et sera normalisée dans le schéma d'événements du moteur de simulation.

## 7. Exigences de qualité et tests

Chaque règle doit disposer :
- d'une description fonctionnelle ;
- de ses conditions de déclenchement ;
- de ses effets sur le score, la possession et les chronomètres ;
- des exceptions pertinentes ;
- de sa référence réglementaire ;
- de sa saison d'application ;
- de tests unitaires et de scénarios limites.

Les tests doivent notamment couvrir les fins de quart-temps, les dernières secondes de possession, les remises en jeu, les fautes simultanées, les lancers francs, les réinitialisations du shot clock, les prolongations et les révisions vidéo.

## 8. Statut de validation

Aucune section de ce document n'est considérée comme intégralement validée par sa seule présence dans le plan. Chaque chapitre recevra un statut :
- not_started
- researching
- drafted
- review_required
- validated
- implemented
- tested

Le passage à validated exige une vérification contre le Rulebook officiel applicable à la saison ciblée. Le passage à tested exige des tests automatisés exécutés et réussis.

## 9. Documents liés

- docs/GDD.md — vision et fonctionnalités du jeu.
- docs/TDD.md — architecture technique.
- docs/ROADMAP.md — étapes de développement.
- docs/03-basketball-rules/NBA_CBA_AND_SALARY_CAP.md — règles économiques et contractuelles, à créer.
- docs/04-simulation/SIMULATION_ENGINE.md — architecture du moteur de simulation, à créer.
- docs/04-simulation/POSSESSION_SYSTEM.md — modélisation des possessions, à créer.