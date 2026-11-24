# Simulation de match — tranche 1 (24 novembre 2026)

> Statut : **implémenté et testé** pour le match rapide. Modèle **provisoire, non calibré** (la calibration est la tranche 2).

## 1. Ce que fait la tranche 1

Parcours jouable : choisir une franchise → voir l'effectif → choisir un adversaire, le lieu et une graine → simuler un match rapide → lire le box score. Le moteur tourne dans un Web Worker (`apps/web/src/moteur.worker.ts`).

Critères de sortie (`docs/AUDIT_2026-11.md` § 7) :
- box score identique à graine égale : testé (`packages/engine/tests/match.test.ts`), et vérifié dans le navigateur (même empreinte que les tests Node) ;
- totaux cohérents sur 300 matchs : FGM ≤ FGA, 3PM ≤ 3PA ≤ FGA, LF réussis ≤ tentés, points = 2 × (FGM − 3PM) + 3 × 3PM + LF, rebonds = offensifs + défensifs, somme des points des joueurs = score, temps de jeu total = 5 × durée du match, somme des +/− = 5 × écart, contres ≤ tirs manqués adverses, interceptions ≤ pertes adverses, pas d'égalité finale, exclus à 6 fautes qui ne reviennent pas.

## 2. Architecture

| Élément | Fichier | Rôle |
|---|---|---|
| Règles NBA de la saison | `data/regles/nba-2026-27.json` | Chaque valeur avec unité, définition et référence au NBA Official Rulebook. Statut `review_required`. |
| Réglages du modèle | `data/moteur/match-v0.json` | Probabilités de base, sensibilités, fatigue, rotation. Statut `provisoire-non-calibre`. |
| Schémas | `packages/data/src/schemas.ts` | `schemaRegles`, `schemaReglagesMatch` ; contrôlés par `npm run verifier`. |
| Passage données → moteur | `packages/data/src/match.ts` | `valeursDesRegles`, `reglagesDuMoteur`, `equipeDuMatch`. |
| Contrats du moteur | `packages/engine/src/match/types.ts` | Entrée, journal d'événements, box score. |
| Composition | `packages/engine/src/match/composition.ts` | Cinq de départ et ordre de rotation choisis par le staff. |
| Simulation | `packages/engine/src/match/simulation.ts` | Possession par possession ; écrit le journal. |
| Box score | `packages/engine/src/match/boxscore.ts` | Déduit **uniquement** du journal (temps de jeu et +/− compris). |
| Empreinte | `packages/engine/src/match/empreinte.ts` | 16 caractères hexadécimaux (deux FNV-1a). |
| Mesure | `tools/sonde-match.ts` | `npm run sonde [n]` : moyennes sur n matchs. |

Les deux fichiers de `data/` sont écrits par `tools/migrations/2026-11-24-tranche1.ts` (les données se modifient par script).

Le journal d'événements est le contrat commun aux trois présentations : le mode commenté (tranche 3) et le mode interactif (tranche 5) liront ce même journal.

## 3. Le modèle (provisoire)

- **Possession :** durée tirée (gaussienne bornée par l'horloge de 24 s, 14 s après rebond offensif, et par le temps restant). Puis perte de balle, faute hors tir ou tir.
- **Tir :** tireur choisi selon son usage (note effective), zone (cercle, mi-distance, trois points) selon son groupe ; réussite = base de la zone + sensibilité × (adresse − défense des cinq adverses) + avantage du terrain.
- **Fautes :** faute sur tir (lancers 2 ou 3, panier avec faute + 1), faute hors tir (lancers seulement en pénalité), fautes d'équipe par période, règle des deux dernières minutes, rang de pénalité propre aux prolongations, exclusion à 6 fautes.
- **Rebond, passe, contre, interception :** probabilités de base et pondérations par groupe (arrière, ailier, intérieur).
- **Fatigue et rotation :** fraîcheur qui baisse sur le terrain et remonte sur le banc ; remplacements à ballon mort seulement ; relais minimal avant le retour d'un titulaire ; les titulaires reposés reprennent au début de chaque période.
- **Notes lues :** `ratings.overall` et les quatre attributs des effectifs, **provisoires** jusqu'au modèle de notes v1 (tranche 2).

Mesure sur 1 000 matchs (`npm run sonde`, 24/11/2026) : 114,3 points par équipe, 48,3 % aux tirs, 38,0 tirs à trois points à 37,8 %, 21,7 lancers, 15,6 balles perdues, 18,8 fautes, 2,2 % de prolongations, 54,4 % de victoires à domicile, environ 4 ms par match. **Ces chiffres ne sont comparés à aucune statistique sourcée** : c'est l'objet de la tranche 2.

## 4. Simplifications connues (à lever)

- Pas de temps-mort, de faute offensive, de faute technique ou flagrante, de violation, de rebond d'équipe, d'entre-deux en cours de jeu.
- Après une faute hors tir sans pénalité, l'horloge repart à 14 s (le règlement : remise à 14 s seulement si elle était en dessous).
- Pas de fin de match tactique (fautes volontaires, tir au buzzer), pas de pause entre les périodes pour la récupération.
- Composition et rotation automatiques : le choix du coach par l'utilisateur arrive avec le management.
- Le taux de prolongations (2,2 %) est sans doute bas : les écarts de notes provisoires sont grands. À mesurer en tranche 2.

## 5. Match de référence

Boston Beacons (domicile) – New York Skyliners, graine 2026 : empreinte `1edb4029b0bb24a2`. Toute modification du moteur, des règles, des réglages ou des effectifs qui change cette empreinte doit être voulue et notée ici.
