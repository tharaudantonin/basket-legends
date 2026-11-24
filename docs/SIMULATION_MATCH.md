# Simulation de match — tranches 1 à 3 (24 novembre 2026)

> Statut : **implémenté et testé** pour les modes rapide et commenté. Modèle **calibré** (tranche 2, recalibré en tranche 3) sur les moyennes de la saison régulière 2025-2026, avec les notes du modèle v1 (`docs/NOTES_JOUEURS.md`).

## 1. Ce que fait la tranche 1

Parcours jouable : choisir une franchise → voir l'effectif → choisir un adversaire, le lieu et une graine → simuler un match rapide → lire le box score. Le moteur tourne dans un Web Worker (`apps/web/src/moteur.worker.ts`).

Critères de sortie (`docs/AUDIT_2026-11.md` § 7) :
- box score identique à graine égale : testé (`packages/engine/tests/match.test.ts`), et dans le navigateur par Playwright (`apps/web/parcours/`, même empreinte que les tests Node) ;
- totaux cohérents sur 300 matchs : FGM ≤ FGA, 3PM ≤ 3PA ≤ FGA, LF réussis ≤ tentés, points = 2 × (FGM − 3PM) + 3 × 3PM + LF, rebonds = offensifs + défensifs, somme des points des joueurs = score, temps de jeu total = 5 × durée du match, somme des +/− = 5 × écart, contres ≤ tirs manqués adverses, interceptions ≤ pertes adverses, pas d'égalité finale, exclus à 6 fautes qui ne reviennent pas.

## 2. Architecture

| Élément | Fichier | Rôle |
|---|---|---|
| Règles NBA de la saison | `data/regles/nba-2026-27.json` | Chaque valeur avec unité, définition et section du NBA Official Rulebook 2026-27. Statut `validated` (24/11/2026). |
| Réglages du modèle | `data/moteur/match-v2.json` | Probabilités de base, sensibilités, fatigue, rotation. Statut `calibre`. |
| Cibles de calibration | `data/statistiques/2025-26/ligue.json` | Moyennes de la ligue 2025-26 par équipe et par match (Basketball-Reference). |
| Schémas | `packages/data/src/schemas.ts` | `schemaRegles`, `schemaReglagesMatch` ; contrôlés par `npm run verifier`. |
| Passage données → moteur | `packages/data/src/match.ts` | `valeursDesRegles`, `reglagesDuMoteur`, `equipeDuMatch`. |
| Contrats du moteur | `packages/engine/src/match/types.ts` | Entrée, journal d'événements, box score. |
| Composition | `packages/engine/src/match/composition.ts` | Cinq de départ et ordre de rotation choisis par le staff. |
| Simulation | `packages/engine/src/match/simulation.ts` | Possession par possession ; écrit le journal. |
| Box score | `packages/engine/src/match/boxscore.ts` | Déduit **uniquement** du journal (temps de jeu et +/− compris). |
| Empreinte | `packages/engine/src/match/empreinte.ts` | 16 caractères hexadécimaux (deux FNV-1a). |
| Mesure | `tools/sonde-match.ts` | `npm run sonde [n]` : moyennes sur n matchs, comparées aux cibles et à leurs fourchettes. |

Les règles et les réglages sont écrits par `tools/migrations/2026-11-24-tranche2-parametres.ts`, puis complétés par `tools/migrations/2026-11-24-tranche3-parametres.ts` (les données se modifient par script ; `match-v2.json` remplace `match-v1.json`, gardé dans l'historique Git).

| Tranche 3 | Fichier | Rôle |
|---|---|---|
| Commentaire | `packages/engine/src/match/commentaire.ts` | Lignes du mode commenté, déduites du journal (aucun hasard). |
| Moments marquants | `packages/engine/src/match/moments.ts` | Performances et matchs marquants ; intérêt d'un match (« match de la semaine »). |
| Fiche joueur | `packages/engine/src/match/fiche.ts`, `packages/data/src/fiche.ts` | Tirs et adresse par zone d'un match ; box score en direct ; moyennes sourcées 2025-26. |
| Écrans | `apps/web/src/ecrans/Commente.tsx`, `FicheJoueur.tsx` | Mode commenté (lecture, vitesse, aller à la fin), fiche joueur avec graphique d'adresse. |

Le journal d'événements est le contrat commun aux trois présentations : le mode commenté (tranche 3) et le mode interactif (tranche 5) liront ce même journal.

## 3. Le modèle et sa calibration

- **Possession :** durée tirée (gaussienne bornée par l'horloge de 24 s, 14 s après rebond offensif, et par le temps restant). Puis perte de balle, faute hors tir ou tir. Après une faute défensive hors tir sans lancers, l'horloge garde sa valeur ou remonte à 14 s (Rule No. 7, Section IV, 5.1).
- **Tir :** tireur choisi selon son usage (note effective), zone (cercle, mi-distance, trois points) selon son groupe ; réussite = base de la zone + sensibilité × (adresse − défense des cinq adverses) + avantage du terrain.
- **Fautes :** faute sur tir (lancers 2 ou 3, panier avec faute + 1), faute hors tir (lancers seulement en pénalité), fautes d'équipe par période, règle des deux dernières minutes, rang de pénalité propre aux prolongations, exclusion à 6 fautes.
- **Rebond, passe, contre, interception :** probabilités de base et pondérations par groupe (arrière, ailier, intérieur). Une part des rebonds (11,8 %) est un rebond d'équipe, crédité à aucun joueur, comme dans les statistiques officielles (événement `rebond_equipe`).
- **Fatigue et rotation :** fraîcheur qui baisse sur le terrain et remonte sur le banc ; remplacements à ballon mort seulement ; relais minimal avant le retour d'un titulaire ; les titulaires reposés reprennent au début de chaque période.
- **Notes lues :** `ratings.overall` et les quatre attributs des effectifs, calculés par le modèle de notes v1.

**Tranche 3 : temps-morts et fins de match.**
- **Temps-morts (Rule No. 5, Section VI) :** 7 par équipe, 4 au plus dans le 4e quart-temps, 2 au plus après 3:00 du 4e, 2 par prolongation. Deux temps-morts obligatoires par quart-temps : à 6:59 si personne n'en a pris (chargé à l'équipe qui reçoit), puis à 2:59 si aucun autre n'a été pris (chargé à l'autre équipe). Durées : 2:45 et 1:15. Le coach en demande un après une série adverse de 8 points (hors deux dernières minutes) et avant la dernière action, à égalité ou mené de 3 points au plus (action préparée : petit bonus de réussite). Pendant un temps-mort, tous les joueurs récupèrent un peu (1,5 point de fraîcheur par minute) et le staff peut changer qui il veut.
- **Fins de période :** à 24 s ou moins, l'horloge des tirs s'éteint après un changement de possession (Rule No. 7, Section II, 9) ; l'équipe garde le ballon pour le dernier tir, lâché à 2,5 s au plus de la fin, ou laisse filer le temps si elle mène en fin de match. Il faut 0,3 s au chronomètre pour tirer (Comments on the Rules, L) ; une nouvelle possession tente sa chance dès 1 s ; sous 2 s, le tir est pressé (malus).
- **Fins de match tactiques (4e quart-temps et prolongations, deux dernières minutes) :** l'équipe menée de 1 à 8 points fait faute volontairement sur le meilleur tireur de lancers quand le temps restant est sous 8 s par point de retard (45 s au plus) ; l'équipe qui mène consomme 85 % de l'horloge ; celle qui est menée de 4 points ou plus joue vite ; menée de 3 points dans les 24 dernières secondes, elle tente à trois points (85 %).
- **Position des tirs :** distance au panier et angle, tirés par un générateur à part (ils ne changent pas le match). Tranches de mi-distance et part des tirs à trois points pris dans les coins reprises des moyennes 2025-26 ; ligne à 23'9" et zone restreinte de 4' (Rule No. 1). La distance des coins (22') est un réglage : le Rulebook en ligne ne la donne pas en texte.

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

Recalibrage de la tranche 3 (24/11/2026, `match-v2.json`) : de nouveau les 19 mesures dans leurs fourchettes (115,7 points, 89,2 tirs, 47,2 %, 55,6 % à domicile…), environ 2,3 ms par match ; minutes du joueur le plus utilisé 35,3, du 8e 16,1. Les chiffres du tableau sont ceux de la tranche 2.

Les 19 mesures sont dans leurs fourchettes ; environ 4 ms par match. `packages/engine/tests/calibration.test.ts` rejoue 400 matchs à chaque `npm test` (fourchettes élargies de moitié). Non sourcés et non calibrés : taux de prolongations (1,6 %), minutes du joueur le plus utilisé (32,2), du 8e joueur (18,1).

## 4. Simplifications connues (à lever)

- Pas de faute offensive, de faute technique ou flagrante, de violation, d'entre-deux en cours de jeu, de faute « loin du ballon » des deux dernières minutes (Rule No. 12-B, Section X).
- Le chronomètre ne compte que le temps de jeu : son arrêt après un panier dans la dernière minute des trois premiers quart-temps et les deux dernières minutes du 4e (Rule No. 5, Section V, 2) n'a pas d'effet sur le modèle.
- Les temps-morts réglementaires non pris ne passent pas en prolongation (deux par prolongation, sans report). Le ballon avancé après un temps-mort en fin de match est représenté par le bonus de l'action préparée.
- Pas de pause entre les périodes pour la récupération.
- Composition et rotation automatiques : le choix du coach par l'utilisateur arrive avec le management.
- Le taux de prolongations (1,5 %) reste sans doute bas, même avec les fins de match tactiques : à reprendre avec la fatigue propre à chaque joueur (tranche 4), après avoir relevé une cible sourcée.

## 5. Match de référence

Boston Beacons (domicile) – New York Skyliners, graine 2026 : empreinte `f69b9934b578d77d` depuis la tranche 3 (temps-morts, fins de match, recalibrage ; `a87497bc0d7ba6d3` en tranche 2, `1edb4029b0bb24a2` en tranche 1). Le mode commenté et le mode rapide donnent la même empreinte : testé dans Node (`packages/engine/tests/presentation.test.ts`) et dans le navigateur (`apps/web/parcours/`). Toute modification du moteur, des règles, des réglages ou des effectifs qui change cette empreinte doit être voulue et notée ici.

## 6. Mode commenté, moments marquants, fiche joueur (tranche 3)

- **Même résultat :** le mode commenté ne simule rien de plus. Il lit le journal du match déjà simulé ; `boxScoreAuMoment` rejoue le journal jusqu'à une ligne (statistiques en direct) et, à la fin, redonne exactement le box score du mode rapide. Le rythme d'affichage (×1, ×4, ×16, aller à la fin) ne dépend que de l'écran.
- **Commentaire :** une ligne par action (panier avec passe, tir manqué avec contre et rebond, série de lancers, perte ou interception, faute, exclusion, temps-mort, changements groupés, début et fin de période). Les tournures varient selon la position de l'événement dans le journal, sans hasard. Moments forts mis en avant : panier au buzzer, panier qui donne l'avantage ou égalise dans la dernière minute, exclusion, temps-mort de fin de match, fins de période.
- **Moments marquants :** 30, 40 et 50 points, triple-double, 20 rebonds, 15 passes, 6 contres ou interceptions, 8 tirs à trois points, adresse parfaite sur 10 tirs ; victoire au buzzer, panier décisif dans les 10 dernières secondes, prolongations, remontée de 15 points ou plus, écart de 30 points, série de 15 points. Seuils de présentation, rassemblés dans `SEUILS_MOMENTS`. `interetDuMatch` servira au « match de la semaine » (tranche 4).
- **Fiche joueur :** notes du modèle v1 et leur calcul, moyennes sourcées 2025-26 par compétition (saison régulière, Play-In, playoffs ; 2024-25 pour les absents), avec le lien vers la source ; depuis un box score, le graphique d'adresse du match (demi-terrain schématique et réussite par zone). La mise en forme définitive viendra avec le chantier visuel.
