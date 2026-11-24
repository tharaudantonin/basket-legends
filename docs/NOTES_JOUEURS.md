# Notes des joueurs — modèle v1 (tranche 2, 24 novembre 2026)

> Statut : **implémenté et testé**. Paramètres **validés par Antonin le 24/11/2026** (`data/modeles/notes-v1.json`, statut `valide`).

## 1. Ce que demandent les décisions

- Échelle « NBA » : un joueur de rotation autour de 70-75, les superstars au-delà de 90 ; hors NBA entre 40 et 67 (décisions des 23 et 24/11/2026).
- Formule maison, versionnée et refaisable, à partir des statistiques 2025-2026 sourcées, recalée par quantiles. Corrections manuelles marquées « corrigé par Antonin ».
- Aucune note NBA 2K dans le jeu ni dans le dépôt : elles ne servent que de banc d'essai privé.

## 2. Les données

| Fichier | Contenu |
|---|---|
| `data/statistiques/2025-26/joueurs.json` | Totaux par joueur (`j0001`…) : saison régulière 2025-26 (441 joueurs), Play-In 2026 (86), playoffs 2026 (207), saison régulière 2024-25 pour les 8 joueurs absents toute la saison 2025-26, rang de draft 2026 (53 recrues). Sources, date de consultation, unité et définition de chaque champ dans le fichier. |
| `data/statistiques/2025-26/ligue.json` | Moyennes de la ligue par équipe et par match (cibles de la calibration du moteur). |
| `data/modeles/notes-v1.json` | Paramètres du modèle. |

Le relevé (24/11/2026) est décrit dans `docs/SOURCES.md` § 9. Les relevés bruts, qui contiennent les vrais noms ou les identifiants du fournisseur, sont dans `basket-legends-prive/statistiques-2025-26/` ; `tools/migrations/2026-11-24-tranche2-statistiques.ts` les rattache aux identifiants du jeu et refuse toute ligne incohérente (points recalculés, tirs réussis ≤ tentés…).

## 3. Le modèle (`packages/data/src/notes.ts`)

1. **Saison de base :** la saison régulière 2025-26 ; à défaut, la saison régulière 2024-25 (joueur absent toute la saison). Le Play-In et les playoffs sont relevés mais pas utilisés par la v1.
2. **Taux rétrécis :** chaque taux par 36 minutes est mélangé à la moyenne de la ligue comme si le joueur avait joué 400 minutes de plus à ce niveau ; les pourcentages le sont avec 150 tirs (TS%), 100 tirs à trois points et 50 lancers de plus.
3. **Indices :** sommes pondérées de scores centrés-réduits, calculés sur les joueurs d'au moins 500 minutes.

| Indice | Composantes (poids) |
|---|---|
| Note globale | Game Score de Hollinger par 36 min (1), minutes par match (0,8), part de titularisations (0,3) |
| Technique | TS% (1), points (0,6), % à 3 pts (0,4), % aux lancers (0,4), tirs à 3 pts tentés (0,3) |
| Physique | rebonds offensifs (0,6) et défensifs (0,6), contres (0,5), lancers tentés (0,3), taille (0,4) |
| Mental | usage (0,6), passes par perte (0,5), % aux lancers (0,3), minutes par match (0,5) |
| Tactique | passes (0,7), interceptions (0,7), contres (0,3), rebonds défensifs (0,3), fautes (−0,3), pertes (−0,3) |

4. **Recalage par quantiles :** le rang du joueur parmi les 449 joueurs notés sur statistiques donne sa note, par interpolation entre les ancrages (quantile → note) : globale 0 → 58, 0,10 → 63, 0,25 → 67, 0,50 → 72, 0,75 → 76, 0,90 → 81, 0,97 → 87, 0,99 → 91, 1 → 96 ; attributs 0 → 50, 0,10 → 58, 0,25 → 64, 0,50 → 70, 0,75 → 76, 0,90 → 82, 0,97 → 88, 1 → 95.
5. **Sans statistique NBA :** note a priori, la même pour les quatre attributs. Recrue draftée : selon le rang (1er choix 73, 5e 70, 14e 67, 30e 64, 60e 60). Ni statistique ni draft : 58. Ces notes portent `ratings.status = "a-priori"` et un astérisque dans l'interface.

`npm run notes` réécrit `ratings` et `attributes` des effectifs (et rien d'autre). Une note dont `ratings.correction` vaut « corrigé par Antonin » est gardée telle quelle.

## 4. Résultat (24/11/2026)

- 523 joueurs : 449 notés sur statistiques (441 sur 2025-26, 8 sur 2024-25), 53 par rang de draft, 21 sans statistique.
- 8 joueurs à 90 ou plus ; médiane des 300 premiers (dix joueurs de rotation par équipe) dans la fourchette 70-75 ; 150e joueur 75, 300e 69, 400e 65, minimum 58.
- Banc d'essai privé (hors dépôt, `basket-legends-prive/banc-essai-2k.py`) : corrélation de rang de Spearman 0,887 sur 288 joueurs. Seul cet agrégat est consigné ici.

## 5. Tests

`packages/data/tests/notes.test.ts` : interpolation des ancrages ; notes refaisables (les effectifs portent exactement les notes recalculées) ; indépendance à l'ordre des joueurs ; échelle « NBA » ; recrues notées a priori sous 75, 1er choix au-dessus du dernier ; meilleure production → meilleure note ; saison 2024-25 pour les absents. `npm run verifier` refuse une note d'une source inconnue et signale le statut « proposition ».

## 6. Limites connues (à arbitrer)

- **Saisons écourtées :** un joueur revenu de blessure en fin de saison (16 matchs) est jugé surtout sur ses minutes par match et un échantillon rétréci ; sa note peut être nettement sous sa valeur. Correction manuelle possible (« corrigé par Antonin ») ou, en v2, mélange avec la saison 2024-25.
- **Recrues :** la note a priori ne dépend que du rang de draft ; les statistiques universitaires ne sont pas relevées.
- **Blessures longues :** les 8 joueurs notés sur 2024-25 le sont sans tenir compte de la blessure ni de l'âge.
- **Défense :** la box score mesure mal la défense ; l'attribut tactique la reflète seulement par les interceptions, les contres et les rebonds.
- **Play-In et playoffs :** relevés et séparés, mais non utilisés par la v1.
