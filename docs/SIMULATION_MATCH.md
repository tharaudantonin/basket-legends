# Simulation de match — tranches 1 et 2 (24 novembre 2026)

> Statut : **implémenté et testé** pour le match rapide. Modèle **calibré** (tranche 2) sur les moyennes de la saison régulière 2025-2026, avec les notes du modèle v1 (`docs/NOTES_JOUEURS.md`).

## 1. Ce que fait la tranche 1

Parcours jouable : choisir une franchise → voir l'effectif → choisir un adversaire, le lieu et une graine → simuler un match rapide → lire le box score. Le moteur tourne dans un Web Worker (`apps/web/src/moteur.worker.ts`).

Critères de sortie (`docs/AUDIT_2026-11.md` § 7) :
- box score identique à graine égale : testé (`packages/engine/tests/match.test.ts`), et dans le navigateur par Playwright (`apps/web/parcours/`, même empreinte que les tests Node) ;
- totaux cohérents sur 300 matchs : FGM ≤ FGA, 3PM ≤ 3PA ≤ FGA, LF réussis ≤ tentés, points = 2 × (FGM − 3PM) + 3 × 3PM + LF, rebonds = offensifs + défensifs, somme des points des joueurs = score, temps de jeu total = 5 × durée du match, somme des +/− = 5 × écart, contres ≤ tirs manqués adverses, interceptions ≤ pertes adverses, pas d'égalité finale, exclus à 6 fautes qui ne reviennent pas.

## 2. Architecture

| Élément | Fichier | Rôle |
|---|---|---|
| Règles NBA de la saison | `data/regles/nba-2026-27.json` | Chaque valeur avec unité, définition et section du NBA Official Rulebook 2026-27. Statut `validated` (24/11/2026). |
| Réglages du modèle | `data/moteur/match-v1.json` | Probabilités de base, sensibilités, fatigue, rotation. Statut `calibre`. |
| Cibles de calibration | `data/statistiques/2025-26/ligue.json` | Moyennes de la ligue 2025-26 par équipe et par match (Basketball-Reference). |
| Schémas | `packages/data/src/schemas.ts` | `schemaRegles`, `schemaReglagesMatch` ; contrôlés par `npm run verifier`. |
| Passage données → moteur | `packages/data/src/match.ts` | `valeursDesRegles`, `reglagesDuMoteur`, `equipeDuMatch`. |
| Contrats du moteur | `packages/engine/src/match/types.ts` | Entrée, journal d'événements, box score. |
| Composition | `packages/engine/src/match/composition.ts` | Cinq de départ et ordre de rotation choisis par le staff. |
| Simulation | `packages/engine/src/match/simulation.ts` | Possession par possession ; écrit le journal. |
| Box score | `packages/engine/src/match/boxscore.ts` | Déduit **uniquement** du journal (temps de jeu et +/− compris). |
| Empreinte | `packages/engine/src/match/empreinte.ts` | 16 caractères hexadécimaux (deux FNV-1a). |
| Mesure | `tools/sonde-match.ts` | `npm run sonde [n]` : moyennes sur n matchs, comparées aux cibles et à leurs fourchettes. |

Les règles et les réglages sont écrits par `tools/migrations/2026-11-24-tranche2-parametres.ts` (les données se modifient par script ; la version 1 remplace `match-v0.json`, gardé dans l'historique Git).

Le journal d'événements est le contrat commun aux trois présentations : le mode commenté (tranche 3) et le mode interactif (tranche 5) liront ce même journal.

## 3. Le modèle et sa calibration

- **Possession :** durée tirée (gaussienne bornée par l'horloge de 24 s, 14 s après rebond offensif, et par le temps restant). Puis perte de balle, faute hors tir ou tir. Après une faute défensive hors tir sans lancers, l'horloge garde sa valeur ou remonte à 14 s (Rule No. 7, Section IV, 5.1).
- **Tir :** tireur choisi selon son usage (note effective), zone (cercle, mi-distance, trois points) selon son groupe ; réussite = base de la zone + sensibilité × (adresse − défense des cinq adverses) + avantage du terrain.
- **Fautes :** faute sur tir (lancers 2 ou 3, panier avec faute + 1), faute hors tir (lancers seulement en pénalité), fautes d'équipe par période, règle des deux dernières minutes, rang de pénalité propre aux prolongations, exclusion à 6 fautes.
- **Rebond, passe, contre, interception :** probabilités de base et pondérations par groupe (arrière, ailier, intérieur). Une part des rebonds (11,8 %) est un rebond d'équipe, crédité à aucun joueur, comme dans les statistiques officielles (événement `rebond_equipe`).
- **Fatigue et rotation :** fraîcheur qui baisse sur le terrain et remonte sur le banc ; remplacements à ballon mort seulement ; relais minimal avant le retour d'un titulaire ; les titulaires reposés reprennent au début de chaque période.
- **Notes lues :** `ratings.overall` et les quatre attributs des effectifs, calculés par le modèle de notes v1.

**Calibration (24/11/2026).** Les réglages ont été ajustés par itérations automatiques (durée des possessions, répartition et réussite par zone, fautes, rebonds, passes, interceptions, contres), puis vérifiés sur 1 000 matchs. Fourchettes : ±3 % de la cible pour les volumes, ±1 point pour les pourcentages, ±3 points pour les victoires à domicile ; ce sont des tolérances de calibration, pas des valeurs sourcées. Correspondance des zones : « cercle » = tirs à moins de 3 pieds ; « mi-distance » = de 3 pieds à la ligne à trois points.

| Mesure (par équipe et par match) | Moteur | Cible 2025-26 |
|---|---|---|
| Points | 116,4 | 115,6 |
| Tirs tentés / % | 89,2 / 47,5 % | 89,1 / 47,1 % |
| Tirs à 3 pts tentés / % | 37,0 / 36,2 % | 37,0 / 36,0 % |
| Lancers tentés / % | 23,2 / 78,4 % | 23,5 / 78,3 % |
| Rebonds offensifs / défensifs | 11,3 / 32,3 | 11,4 / 32,4 |
| Passes décisives | 26,8 | 26,7 |
| Interceptions / contres | 8,3 / 4,7 | 8,4 / 4,8 |
| Balles perdues / fautes | 14,7 / 20,1 | 14,5 / 19,9 |
| Part / réussite près du cercle | 23,2 % / 70,6 % | 23,1 % / 70,3 % |
| Part / réussite à mi-distance | 35,3 % / 45,5 % | 35,3 % / 45,0 % |
| Victoires à domicile | 56,7 % | 55,4 % |

Les 19 mesures sont dans leurs fourchettes ; environ 4 ms par match. `packages/engine/tests/calibration.test.ts` rejoue 400 matchs à chaque `npm test` (fourchettes élargies de moitié). Non sourcés et non calibrés : taux de prolongations (1,6 %), minutes du joueur le plus utilisé (32,2), du 8e joueur (18,1).

## 4. Simplifications connues (à lever)

- Pas de temps-mort, de faute offensive, de faute technique ou flagrante, de violation, d'entre-deux en cours de jeu.
- Pas de fin de match tactique (fautes volontaires, tir au buzzer), pas de pause entre les périodes pour la récupération.
- Composition et rotation automatiques : le choix du coach par l'utilisateur arrive avec le management.
- Le taux de prolongations (1,6 %) est sans doute bas, et les meilleurs joueurs jouent environ 32 minutes : à reprendre avec les fins de match tactiques (tranche 3) et la fatigue propre à chaque joueur (tranche 4), après avoir relevé une cible sourcée.

## 5. Match de référence

Boston Beacons (domicile) – New York Skyliners, graine 2026 : empreinte `a87497bc0d7ba6d3` depuis la tranche 2 (notes v1, réglages calibrés, règle d'horloge, rebonds d'équipe ; `1edb4029b0bb24a2` en tranche 1). Toute modification du moteur, des règles, des réglages ou des effectifs qui change cette empreinte doit être voulue et notée ici.
