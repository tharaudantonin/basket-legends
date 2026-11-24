# Simulation de match — tranches 1 à 5 et 7 (24 novembre 2026)

> Statut : **implémenté et testé** pour les trois présentations : rapide, commentée et interactive (tranche 5, § 8). Modèle **calibré** (tranche 2, recalibré en tranches 3 et 5) sur les moyennes de la saison régulière 2025-2026, avec les notes du modèle v1 (`docs/NOTES_JOUEURS.md`). Les effets des plans de jeu et du défenseur direct sont des choix du modèle, mesurés mais sans cible sourcée.

## 1. Ce que fait la tranche 1

Parcours jouable : choisir une franchise → voir l'effectif → choisir un adversaire, le lieu et une graine → simuler un match rapide → lire le box score. Le moteur tourne dans un Web Worker (`apps/web/src/moteur.worker.ts`).

Critères de sortie (`docs/AUDIT_2026-11.md` § 7) :
- box score identique à graine égale : testé (`packages/engine/tests/match.test.ts`), et dans le navigateur par Playwright (`apps/web/parcours/`, même empreinte que les tests Node) ;
- totaux cohérents sur 300 matchs : FGM ≤ FGA, 3PM ≤ 3PA ≤ FGA, LF réussis ≤ tentés, points = 2 × (FGM − 3PM) + 3 × 3PM + LF, rebonds = offensifs + défensifs, somme des points des joueurs = score, temps de jeu total = 5 × durée du match, somme des +/− = 5 × écart, contres ≤ tirs manqués adverses, interceptions ≤ pertes adverses, pas d'égalité finale, exclus à 6 fautes qui ne reviennent pas.

## 2. Architecture

| Élément | Fichier | Rôle |
|---|---|---|
| Règles NBA de la saison | `data/regles/nba-2026-27.json` | Chaque valeur avec unité, définition et section du NBA Official Rulebook 2026-27. Statut `validated` (24/11/2026). |
| Réglages du modèle | `data/moteur/match-v5.json` | Probabilités de base, sensibilités, fatigue, rotation, plans de jeu, défenseur direct, préférence de zone (tranche 7). Statut `calibre` (plan par défaut). |
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

Boston Beacons (domicile) – New York Skyliners, graine 2026 : empreinte `0a6f4ed165d89e1e` depuis la tranche 7 (attributs détaillés, moteur v5 ; `9834f1859a6a8fe8` en tranche 5 avec le défenseur direct et la réussite de base recalée ; `ad47660b78b2fb88` en tranche 4 avec l'endurance, les blessures et l'usage recalé ; `f69b9934b578d77d` en tranche 3 avec les temps-morts et fins de match ; `a87497bc0d7ba6d3` en tranche 2, `1edb4029b0bb24a2` en tranche 1). Le mode commenté, le mode rapide et le mode interactif sans décision donnent la même empreinte : testé dans Node (`packages/engine/tests/presentation.test.ts`) et dans le navigateur (`apps/web/parcours/`). Toute modification du moteur, des règles, des réglages ou des effectifs qui change cette empreinte doit être voulue et notée ici.

## 6. Mode commenté, moments marquants, fiche joueur (tranche 3)

- **Même résultat :** le mode commenté ne simule rien de plus. Il lit le journal du match déjà simulé ; `boxScoreAuMoment` rejoue le journal jusqu'à une ligne (statistiques en direct) et, à la fin, redonne exactement le box score du mode rapide. Le rythme d'affichage (×1, ×4, ×16, aller à la fin) ne dépend que de l'écran.
- **Commentaire :** une ligne par action (panier avec passe, tir manqué avec contre et rebond, série de lancers, perte ou interception, faute, exclusion, temps-mort, changements groupés, début et fin de période). Les tournures varient selon la position de l'événement dans le journal, sans hasard. Moments forts mis en avant : panier au buzzer, panier qui donne l'avantage ou égalise dans la dernière minute, exclusion, temps-mort de fin de match, fins de période.
- **Moments marquants :** 30, 40 et 50 points, triple-double, 20 rebonds, 15 passes, 6 contres ou interceptions, 8 tirs à trois points, adresse parfaite sur 10 tirs ; victoire au buzzer, panier décisif dans les 10 dernières secondes, prolongations, remontée de 15 points ou plus, écart de 30 points, série de 15 points. Seuils de présentation, rassemblés dans `SEUILS_MOMENTS`. `interetDuMatch` servira au « match de la semaine » (tranche 4).
- **Fiche joueur :** notes du modèle v1 et leur calcul, moyennes sourcées 2025-26 par compétition (saison régulière, Play-In, playoffs ; 2024-25 pour les absents), avec le lien vers la source ; depuis un box score, le graphique d'adresse du match (demi-terrain schématique et réussite par zone). La mise en forme définitive viendra avec le chantier visuel.

## 7. Endurance, blessures et répartition des tirs (tranche 4)

- **Endurance :** chaque joueur a un indice d'endurance (modèle de notes, `docs/NOTES_JOUEURS.md`) ; sa perte de fraîcheur sur le terrain varie de ± 30 % autour de la valeur du modèle (`fatigue.effetEndurance`). Le joueur le plus utilisé joue environ 37 minutes, le 8e environ 15.
- **Blessures en match :** événement `blessure` (probabilité par minute jouée, durée d'absence tirée), le joueur sort au prochain arrêt de jeu ; la saison (`docs/SAISON.md`) le rend indisponible pour les matchs suivants. Paramètres du modèle, non sourcés.
- **Répartition des tirs entre joueurs :** l'échelle d'usage passe de 14 à 35 pour retrouver la distribution réelle des marqueurs 2025-26 (sur une saison simulée : 1er 32,7, 5e 27,4, 10e 25,7, 30e 20,4 points par match, pour 33,5 / 28,3 / 26,0 / 20,1 dans les statistiques relevées). Les moyennes d'équipe ne servaient pas à mesurer cette concentration : c'est désormais testé sur une saison complète (`packages/league/tests/saison.test.ts`).
- Les 19 mesures d'équipe restent dans leurs fourchettes (`npm run sonde`, 24/11/2026) ; taux de prolongations 1,5 %.

## 8. Mode interactif, plans de jeu et défenseur direct (tranche 5)

**Principe : rejouer depuis le coup d'envoi.** Les décisions du coach sont une entrée du moteur (`EntreeMatch.decisions`), chacune datée par le numéro d'un *arrêt de jeu* : l'avant-match (n° 0), chaque début de période, chaque ballon mort avant une possession (environ 110 par match). À chaque décision, l'écran rejoue tout le match avec la même graine et toutes les décisions (moins de 3 ms) : le journal écrit avant l'arrêt ne dépend pas des décisions prises à cet arrêt, donc l'affichage reprend exactement où il en était, et la suite tient compte de la décision. C'est la méthode « rejouer depuis le coup d'envoi avec les décisions » de Rugby Legends (`docs/AUDIT_2026-11.md` § 5), sans copie de code.
- **État à chaque arrêt** (`simulerMatch(entree, { arrets: true })`, type `ArretDeJeu`) : score, chronomètre, possession, cinq sur le terrain, fraîcheur et fautes de chaque joueur, temps-morts restants, plans des deux équipes, et l'état du générateur (`hasard`, sérialisable). Sans cette option, rien ne change (même journal, même empreinte).
- **Décisions** (`DecisionMatch`) : changement de plan de jeu ; temps-mort (pas en début de période, un par arrêt, selon les règles de la Rule No. 5, Section VI ; en fin de match, il prépare l'action comme celui du staff) ; changement de joueur (à un ballon mort il est écrit au journal ; entre deux périodes, il apparaît dans le cinq de la période ; jamais avant le coup d'envoi : le cinq de départ reste celui du staff, décision du 24/11/2026). Une décision impossible (joueur absent, blessé ou exclu, valeur inconnue, temps-mort épuisé…) est ignorée et signalée (`decisionsRejetees`) : elle ne change rien au match.
- **Délégation au staff** (dans le plan de jeu) : quand le coach gère les changements, le staff ne fait plus que les changements forcés (blessure, exclusion) ; quand il gère les temps-morts, le staff ne prend plus que les temps-morts obligatoires.
- **Lecture** (`packages/engine/src/match/interactif.ts`) : le match se déroule ligne à ligne comme en mode commenté ; la lecture s'arrête à l'arrêt de jeu suivant si le coach l'a demandé, entre les périodes, après un temps-mort (options), ou quand un de ses joueurs sort sur blessure ou exclusion. « Aller à la fin du match » finit le match avec les décisions déjà prises.
- **En saison** (`docs/SAISON.md` § 6) : le match du jour de sa franchise se joue en interactif ; le match en cours (décisions et arrêt atteint) est enregistré à chaque décision et se reprend au même point après rechargement ; à la fin, la saison joue ce jour avec les décisions, et le résumé du match les garde pour le revivre.

**Plans de jeu** (`data/moteur/match-v4.json`, repris tels quels dans `match-v5.json`, bloc `plans` ; choix du modèle, non sourcés) :
- rythme lent / normal / rapide : durée moyenne des possessions × 1,15 / 1 / 0,85 ; pertes de balle − 0,4 / 0 / + 0,8 point ; fatigue × 0,95 / 1 / 1,08 ;
- tirs à trois points moins / comme d'habitude / plus : poids des tirs à trois points × 0,75 / 1 / 1,3 ;
- défense de zone : l'adversaire tire moins près du cercle (× 0,85), un peu plus à mi-distance (× 1,05) et à trois points (× 1,12) ; réussite adverse − 2,5 points près du cercle, + 1,2 point à trois points ; rebond offensif adverse + 2,5 points ; pertes adverses − 0,4 point ; pas de défenseur direct.

**Défenseur direct** (bloc `defenseurDirect`) : en défense individuelle, les attaquants, du plus dangereux au moins dangereux, reçoivent le meilleur défenseur libre de leur groupe (arrière, ailier, intérieur), à défaut le meilleur défenseur libre. L'opposition à un tir vaut pour moitié la défense des cinq et pour moitié celle du défenseur direct (0,6 × tactique + 0,4 × physique, moins la fatigue), plus 0,15 point par centimètre d'écart de taille près du cercle. Le défenseur direct est écrit dans l'événement `tir` (`defenseur`). Comme le meilleur défenseur part sur le meilleur attaquant, l'adresse baissait un peu : la réussite de base est recalée (mi-distance 0,417, trois points 0,324).

**Calibration (24/11/2026, 1 000 matchs, plan par défaut) :** les 19 mesures restent dans leurs fourchettes (116,2 points, 89,4 tirs à 47,2 %, 37,0 tirs à trois points à 36,2 %, 45,0 % à mi-distance, 56,4 % de victoires à domicile) ; 2,7 ms par match ; prolongations 1,7 %.

**Effets mesurés** (`npm run sonde 1000 -- --plans` : l'équipe A applique le plan, B garde le plan par défaut ; moyennes par match) :

| Plan de A | Tirs A | 3 pts A | Pertes A | 3 pts B | % 3 pts B | % cercle B | Rebonds off. B | Points A – B | Victoires A |
|---|---|---|---|---|---|---|---|---|---|
| Par défaut | 89,1 | 36,9 | 14,4 | 37,1 | 36,0 | 23,5 | 11,9 | 116,0 – 116,3 | 49,6 % |
| Rythme lent | 84,2 | 34,8 | 13,1 | 34,5 | 35,9 | 23,5 | 11,0 | 108,5 – 108,5 | 49,4 % |
| Rythme rapide | 94,5 | 39,3 | 16,5 | 39,4 | 35,8 | 23,5 | 12,7 | 122,8 – 124,5 | 47,2 % |
| Moins de 3 pts | 88,6 | 31,0 | 14,4 | 36,9 | 35,6 | 23,5 | 11,9 | 115,8 – 116,2 | 48,4 % |
| Plus de 3 pts | 89,7 | 42,9 | 14,5 | 36,7 | 36,0 | 23,8 | 11,8 | 115,4 – 115,9 | 49,5 % |
| Défense de zone | 88,5 | 36,8 | 14,3 | 40,5 | 37,1 | 19,9 | 13,3 | 114,8 – 116,6 | 45,2 % |

En moyenne sur toute la ligue, aucun plan ne fait gagner plus que le plan par défaut : c'est voulu, un plan se choisit contre un adversaire (zone contre une équipe forte près du cercle et faible de loin, rythme lent pour une équipe moins profonde…). Ces effets sont validés par Antonin (24/11/2026, réponse 21 de `docs/DECISIONS_2026-11.md`).

**Tests :** `packages/engine/tests/interactif.test.ts` (arrêts sans effet sur le match ; même graine et mêmes décisions, même match ; journal et générateur inchangés avant l'arrêt d'une décision ; décision après décision = tout rejouer ; temps-morts, changements, décisions impossibles, délégation ; effets des plans ; défenseur direct ; lecture) et `packages/league/tests/interactif.test.ts` (le match interactif est celui que la saison enregistre ; reprise après sauvegarde ; sauvegardes de la tranche 4 lisibles) ; parcours Playwright `apps/web/parcours/interactif.spec.ts`.

**Simplifications :** l'équipe dirigée par le staff garde le plan par défaut et ne s'adapte pas ; pas de décision pendant le jeu (le coach n'agit qu'aux arrêts, comme pour les changements réels) ; pas de schémas offensifs nommés ni de prise à deux ; un seul plan de zone ; le cinq de départ reste celui du staff ; le match interactif hors saison n'est pas sauvegardé.

## 9. Attributs détaillés et moteur v5 (tranche 7)

Le moteur lit les 16 attributs détaillés du modèle de notes v2 (`docs/NOTES_JOUEURS.md` § 8) au lieu des quatre familles :

| Action | Attribut lu |
|---|---|
| Choix de la zone de tir | préférence = exp((attribut de la zone − 70) / 20) multiplie le poids de chaque zone (`tirs.preferenceZoneEchelle`) |
| Réussite du tir | tir près du cercle, à mi-distance ou à 3 pts |
| Opposition au tir | défense intérieure (près du cercle) ou extérieure (mi-distance, 3 pts) des cinq et du défenseur direct |
| Lancers francs | lancers francs ; en fin de match, la faute volontaire vise le meilleur tireur de lancers |
| Rebond | rebond offensif ou défensif |
| Perte de balle | (maniement + QI offensif) / 2 |
| Interception | interception |
| Passe décisive | passe |
| Contre | contre |
| Faute | 110 − QI défensif |

`data/moteur/match-v5.json` (écrit par `tools/migrations/2026-11-24-tranche7-moteur.ts`) remplace `match-v4.json` (gardé dans l'historique Git) : échelle de préférence 20 ; réussite de base près du cercle 0,653, à mi-distance 0,427, à 3 pts 0,346 ; répartition de base 0,235 / 0,356 / 0,409 ; rebond offensif de base 0,266 ; pertes de base 0,121 ; contres × 1,045 ; lancers de base 0,788. Les plans de jeu validés (réponse 21) sont repris sans changement.

**Calibration (24/11/2026, `npm run sonde 1000`) :** les 19 mesures sont dans leurs fourchettes, 0 hors fourchette : 116,7 points (cible 115,6), 89,3 tirs à 47,4 % (89,1 / 47,1 %), 36,9 tirs à 3 pts à 36,2 % (37,0 / 36,0 %), 23,7 lancers à 78,7 % (23,5 / 78,3 %), rebonds 11,3 / 32,7 (11,4 / 32,4), 26,9 passes (26,7), 8,2 interceptions et 4,9 contres (8,4 / 4,8), 14,4 pertes et 20,1 fautes (14,5 / 19,9), près du cercle 23,6 % des tirs à 70,5 % (23,1 / 70,3 %), mi-distance 35,0 % à 45,0 % (35,3 / 45,0 %), 57,2 % de victoires à domicile (55,4 %). 2,97 ms par match ; non sourcés : prolongations 1,8 %, joueur le plus utilisé 37,1 minutes, 8e joueur 15,2.

Empreinte du match de référence : `0a6f4ed165d89e1e` (§ 5), mise à jour dans les tests et les parcours.
