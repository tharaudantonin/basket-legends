# Franchise Mirror & Data Parity

## Objectif
Chaque franchise fictive doit conserver l'héritage historique, le palmarès, les couleurs de référence, les statistiques collectives et le style de jeu du club réel analogue. La fidélité concerne les données sportives et l'histoire, pas la copie des marques et actifs graphiques.

## Héritage historique
Collecter par club : fondation, déménagements, saisons, titres, finales, titres de conférence/division, bilans saison par saison, records, numéros retirés et rivalités. Chaque valeur doit conserver sa source, la date de consultation, le périmètre et un statut de vérification.

## Couleurs
Les couleurs historiques des clubs de référence ont servi de point de départ. Les 30 palettes de `data/franchises.json` sont des créations originales validées ; ce ne sont pas des codes officiels des clubs de référence.

## Profil collectif
Pour chaque saison de référence, recueillir :
- pace / possessions par match ;
- points marqués/encaissés ;
- offensive rating et defensive rating ;
- FG%, 3P%, FT%, eFG% et TS% ;
- volume et fréquence des tirs à trois points ;
- répartition des tirs si disponible ;
- rebonds offensifs/défensifs ;
- passes, AST/TO et turnover rate ;
- interceptions, contres, fautes et fréquence des lancers.

Utiliser la dernière saison complète, complétée si utile par une moyenne pluriannuelle lissée. Les pondérations seront versionnées et validées par simulations.

## Effectif joueur par joueur
Chaque joueur réel de l'effectif de référence doit avoir une contrepartie fictive, selon `docs/PLAYER_MIRROR.md`. Les données physiques et statistiques doivent être sourcées. Les attributs 1–100 résultent d'un modèle explicite.

## Snapshot
Snapshot validé le 23 novembre 2026 : effectifs **2026-2027** arrêtés au **17 novembre 2026** ; profils statistiques et héritage calibrés sur la saison terminée **2025-2026** ; la carrière démarre en **2026-2027**. Toute mise à jour des données de référence crée une nouvelle version ; elle ne modifie pas rétroactivement une carrière existante.

## Contrôle qualité
- Conserver la définition, l'unité, la saison et la source de chaque valeur.
- Ne pas mélanger statistiques par match, totales, par 36 minutes et par 100 possessions.
- Vérifier les agrégations joueurs/équipe et signaler les absences/blessures pertinentes.
- Distinguer valeur mesurée, estimation et champ inconnu.
- Vérifier le style de jeu sur un échantillon de simulations saisonnières.

À partir de la première saison de carrière, les résultats sont générés par le moteur et peuvent diverger de l'histoire réelle.
