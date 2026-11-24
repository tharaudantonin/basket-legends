# Draft, scouting et vivier — tranche 7 (24 novembre 2026)

> Statut : **implémenté et testé**. Les règles de la loterie et la propriété des choix 2027 sont **à recouper** ; le modèle des prospects, le scouting, le vivier et les choix du staff sont des **propositions** à valider par Antonin. Décisions appliquées : réponses 12 à 17 de `docs/DECISIONS_2026-11.md`.

## 1. Ce que fait la tranche 7 (volet Draft)

- Une classe de 100 prospects originaux existe dès le début de la saison. Le GM la scoute : il ne voit jamais les vraies notes, seulement les rapports de son staff (estimation et fourchette à 90 %) et le consensus de la presse. Il répartit 60 observations pour resserrer les fourchettes.
- À la fin des playoffs, la loterie « 3-2-1 » fixe les 16 premiers choix ; le bilan fixe les autres ; les échanges de choix 2027 désignent qui choisit chacun des 60 choix.
- Soirée de Draft : les staffs des 29 autres équipes choisissent selon leurs propres rapports ; le GM choisit à chacun de ses rangs, ou délègue à son staff.
- À la fin de la Draft : chaque recrue du 1er tour reçoit le contrat de l'échelle des rookies (montants provisoires, voir § 8), et une actualité annonce les premiers choix.
- Le vivier de 320 joueurs originaux hors NBA (échelle 40-67) complète la ligue vers les 840 joueurs du GDD (§ 9).
- Chaque joueur du snapshot a désormais un âge de saison, déduit sans estimation des statistiques sourcées (§ 11).

Le modèle de notes v2 (16 attributs détaillés) et le moteur v5 de la même tranche sont décrits dans `docs/NOTES_JOUEURS.md` § 8 et `docs/SIMULATION_MATCH.md` § 9.

## 2. Données et sources

| Fichier | Contenu | Statut | Source |
|---|---|---|---|
| `data/draft/loterie-2027-2029.json` | Catégories, boules, plancher, limites, ordre après la loterie | `a-recouper` | NBA Communications, communiqué du 28/05/2026 (primaire) ; NBA.com, « 2027 NBA Draft Lottery: Odds, history and how it works », 03/11/2026 (primaire) |
| `data/draft/historique-loterie.json` | Rang du choix propre de chaque équipe aux loteries 2025 et 2026 | relevé | NBA.com, résultat 2025 et page explicative 2026 (primaires) |
| `data/draft/choix-2027.json` | Propriété des choix 2027 (échanges, protections, meilleur/moins bon de deux choix, conditions) | `a-recouper` | RealGM, pages de synthèse 2027 et détaillée (secondaires) |
| `data/draft/echelle-rookies.json` | Échelle des rookies 2026 à 120 %, 4 saisons par rang | `derive` pour l'évolution | Hoops Rumors, échelles 2026 et 2025 (secondaires) |
| `data/draft/modele-draft.json` | Génération des prospects, scouting, choix du staff | `proposition` | Choix du modèle, aucune cible sourcée |
| `data/vivier/2026-27.json` | 320 joueurs générés et leurs paramètres | `proposition` | Choix du modèle |
| `data/noms/banques.json` | Banques complétées pour la génération (§ 10) | — | Listes écrites pour le jeu |

Scripts : `tools/migrations/2026-11-24-tranche7-draft.ts`, `…-echelle-rookies.ts`, `…-banques.ts`, `…-vivier.ts`, `…-ages.ts`. `npm run verifier` contrôle ces fichiers (schémas Zod, franchises connues, nombre d'attributions par règle, 40-67 pour les prospects et le vivier, échelle croissante, noms jamais réels ni repris) et signale les statuts « à recouper » et « proposition ».

## 3. Loterie 3-2-1 (`packages/league/src/draft/loterie.ts`)

**Sourcé :** 16 équipes ; 2 boules pour chacun des trois pires bilans, 3 pour les 7 autres équipes non qualifiées, 2 pour les 9e et 10e du Play-In, 1 pour les perdants des matchs 7-8 (37 boules) ; les 16 premiers choix sont tirés ; les trois pires bilans ne choisissent pas après le 12e rang ; le choix propre d'une équipe ne peut pas être n° 1 deux Drafts de suite, ni dans le top 5 trois Drafts de suite ; choix 17 à 30 au bilan inverse des 14 autres équipes ; 2e tour au bilan inverse des 30 équipes.

**Non précisé par les sources lues, choix du modèle (statut « à recouper ») :**
- tirage séquentiel : chaque choix est tiré au prorata des boules des équipes pas encore tirées ;
- plancher : quand il reste autant de reléguées que de rangs jusqu'à leur plancher, la plus mal classée prend le rang ;
- limites : une équipe interdite pour un rang est écartée de ce tirage (compté comme tirage refait) ;
- égalités de bilan : départagées par un tirage déterministe.

La table officielle des probabilités (PDF de la NBA) n'a pas pu être lue : Antonin la fournit (réponse 13). Le critère de sortie de la tranche (« probabilités conformes à la source ») reste donc **ouvert** : `probabilitesDeLaLoterie` (simulation) servira à comparer le mécanisme à la table dès qu'elle sera relevée.

L'historique 2025-2026 alimente les limites dès 2027 : Washington (n° 1 en 2026) ne peut pas être n° 1 ; Utah (5e en 2025, 2e en 2026) ne peut pas être dans le top 5. San Antonio (2025) et Miami (2026), listés deux fois sans précision, sont laissés de côté. Pendant la carrière, l'historique devra s'allonger à chaque Draft (tranche 8, carrière multi-saisons).

Simplification : la loterie est tirée à la fin de la saison (après la Finale) ; la vraie loterie a lieu en mai, pendant les playoffs. Le résultat est le même, seul le moment de l'annonce diffère.

## 4. Propriété des choix 2027 (`proprietes.ts`)

Chaque règle désigne des choix (choix propre d'une équipe, éventuellement seulement dans une plage de rangs, ou choix déjà attribué à un détenteur provisoire « @… »), les range du plus favorable au moins favorable et les attribue selon leur nombre ; une protection renvoie le choix à son équipe (ou à un autre bénéficiaire) hors de la plage prévue ; une condition peut porter sur le rang d'un choix de 1er tour. Le code refuse un choix désigné deux fois et un détenteur provisoire jamais résolu.

Le fichier suit la page de synthèse RealGM. Six écarts avec la page détaillée sont listés dans `ecarts` (SAS 1er tour, BOS/ORL, MEM et ATL 2e tour, droit d'échange LAC/TOR, pages 2028-2033 tronquées). **À recouper ligne à ligne** (porte de publication : source secondaire). Les choix 2028 à 2033 sont reportés aux échanges (tranche 9).

## 5. Prospects (`prospects.ts`, `modele-draft.json` bloc `classe`)

Chaque prospect a un talent latent (gaussien) ; les 100 talents sont triés, le meilleur porte l'identifiant `p<année>-001`.
- **Note actuelle** = 50 + 5 × talent + 1,5 × (âge − 19) + bruit (écart-type 2), bornée à 40-67.
- **Potentiel** = note + marge, marge = 14 + 7 × talent + part propre (écart-type 4) − 3 × (âge − 19), au plus 97.
- **Âge** 19 à 22 (40 %, 25 %, 20 %, 15 %) ; **origine** université 65 %, international 25 %, G League 10 % ; pays tiré selon l'origine ; poste, taille par poste, poids par IMC moyen 24,2.
- **Attributs détaillés** : note + profil du groupe de poste + écart propre (écart-type 6), bornés à 25-85 ; les familles en sont les moyennes.
- **Nom** tiré dans les banques du pays : jamais un nom réel interdit (empreintes), jamais un nom du snapshot ou du vivier, jamais deux fois le même (200 essais, sinon erreur).

Tous ces nombres sont des choix du modèle à valider.

## 6. Scouting à notes incertaines (`scouting.ts`)

Chaque équipe voit chaque valeur (note, potentiel, 16 attributs) avec une erreur qui lui est propre, fixée par la graine (`scouting:<équipe>:<prospect>:<valeur>`). Observer resserre la même erreur : écart-type initial (note 6, potentiel 9, attributs 8) ÷ √(1 + observations). La fourchette affichée vaut ±1,645 écart-type (90 %). Le staff fait 1 observation par prospect sans consigne ; le GM en répartit 60 par saison, au plus 12 par prospect. Le consensus de la presse est une équipe fictive à 3 observations. Deux équipes peuvent donc se tromper différemment sur le même joueur, et un GM qui observe davantage se trompe moins, sans jamais connaître la vraie valeur.

Limite : les vraies notes sont dans l'état de la partie (sauvegarde IndexedDB) ; l'interface ne les affiche jamais, mais un joueur qui inspecte son navigateur peut les lire.

## 7. Choix du staff (`draft.ts`, bloc `choixIa`)

Valeur d'un prospect pour une équipe, selon ses propres rapports : 0,45 × note estimée + 0,55 × potentiel estimé − 0,8 × (âge − 19) + 1,5 si son groupe de poste est sous-représenté dans l'effectif, plus un petit écart propre au staff (±0,25). Le staff du GM utilise les observations du GM.

## 8. Soirée de Draft et contrats des rookies

`avancerDraft` fait les choix jusqu'au prochain choix du GM (non délégué) ou jusqu'à la fin ; le Web Worker l'exécute (`draft-avancer`). À la fin, `recruesDeLaDraft` donne à chaque choix du 1er tour les quatre salaires de l'échelle (deux saisons garanties, deux options de l'équipe), en proportion du plafond : montant de l'échelle 2026 × plafond ÷ 164 961 000 $. La relation est observée sur 2025 et 2026 (+6,67 %, exactement la hausse du plafond) et reste à recouper avec l'article VIII de la CBA 2023. **Montants provisoires :** le dépôt n'a que la CBA 2026-27 ; le plafond 2026-27 sert tant que celui de 2027-28 n'est pas relevé (`plafond.provisoire`). Les recrues du 2e tour n'ont pas de salaire fixé. Les recrues ne rejoignent pas encore les effectifs : cela vient avec la carrière multi-saisons (tranche 8) et les signatures (tranche 9).

## 9. Vivier de joueurs générés (`data/vivier/2026-27.json`)

320 joueurs originaux (`g0001` à `g0320`), sans franchise avant la free agency (tranche 9) et la G League (tranche 10) :
- **160 en développement** (profil G League) : 20 à 26 ans, note = 55 + 4,5 × talent + 0,8 × (âge − 23) + bruit, marge de potentiel 6 + 4 × talent − 1,5 × (âge − 23) ; note moyenne 55,5 ;
- **160 libres** (agents libres, championnats étrangers) : 24 à 33 ans, note = 57 + 4,5 × talent + 0,3 × (âge − 27) + bruit, marge 1 + 2 × talent ; note moyenne 57,0.

Toutes les notes sont entre 40 et 67 (décision du 24/11/2026). Les paramètres sont recopiés dans le fichier (bloc `modele`) ; graine 2026. Le GDD vise environ 840 joueurs (450 NBA, 180 en développement, 210 libres ou prospects) : 523 + 320 = 843.

## 10. Banques de noms

Les banques de la tranche 0 servaient au renommage du snapshot ; certaines cultures n'avaient qu'un prénom et un nom (chinois, japonais, turc). 745 prénoms et noms courants ont été ajoutés (choix du modèle) ; 29 noms de famille ont été écartés parce que leur empreinte correspond à un nom de famille réel interdit. `culturesParPaysGeneration` donne aux joueurs générés de Grèce, du Nigeria et du Cameroun des noms de leur pays (le snapshot rangeait leurs noms dans la banque commune d'Afrique de l'Ouest). Le filtre des noms réels tourne aussi dans le navigateur, grâce à un SHA-256 pur et synchrone (`packages/data/src/sha256.ts`, testé contre `node:crypto`).

## 11. Âge de saison des joueurs du snapshot

`seasonAge` : âge au 1er février 2027, convention de Basketball-Reference pour la saison 2026-27. Il se déduit exactement de l'âge 2025-26 relevé (au 1er février 2026) + 1, ou de l'âge 2024-25 + 2 pour les 8 joueurs absents en 2025-26. 449 joueurs ont un âge ; 74 (53 recrues de la Draft 2026, 21 joueurs sans match NBA) gardent `null` : aucune date de naissance n'est relevée et l'âge n'est jamais estimé. `docs/PLAYER_MIRROR.md` demande une date de naissance : elle reste à relever (tranche 8, vieillissement).

## 12. Interface

Onglet **Draft** de l'écran de saison : classe triée par consensus ou par rapports du staff, fourchettes de note et de potentiel, observations (+/−) dans la limite du budget ; après la saison, résultat de la loterie (catégorie, boules, rang au bilan), ordre des 60 choix (« via » pour les choix échangés), soirée de Draft (bouton « Choisir » au tour du GM, case « Mon staff choisit pour moi »), salaires de 1re saison. Onglet **Hors NBA** : le vivier, filtrable par statut. Écran fonctionnel et sobre ; la mise en forme définitive viendra avec le chantier visuel (réponse 20).

## 13. Tests

- `packages/league/tests/draft.test.ts` : loterie (déterminisme, contrôle des catégories, plancher sur 400 tirages, probabilités du n° 1 par catégorie sur 3 000 tirages, limites et historique réel) ; propriété des choix 2027 (60 choix attribués sur 50 ordres différents, protection, meilleur de deux choix) ; classe (déterminisme, 40-67, potentiel ≥ note, noms) ; scouting (fourchette qui se resserre, erreur propre à chaque équipe, couverture d'environ 90 %, budget) ; saison complète puis loterie, 60 choix, arrêt au choix du GM, délégation déterministe, recrues et contrats ; échelle des rookies.
- `packages/data/tests/noms-generes.test.ts` : SHA-256 contre `node:crypto`, banques suffisantes pour chaque pays, refus des noms interdits.
- `apps/web/parcours/draft.spec.ts` : scouter, lire la loterie et l'ordre des choix, faire la Draft, voir le vivier.

## 14. À valider ou à relever

1. Table officielle des probabilités de la loterie 3-2-1 (réponse 13) ; recouper le mécanisme du tirage.
2. `choix-2027.json` : recouper les règles et les six écarts avec une source primaire ou une seconde source.
3. `modele-draft.json` et le vivier : moyennes, écarts, âges, origines, poids du choix du staff.
4. Incohérence à arbitrer : un prospect est noté entre 40 et 67 (décision du 24/11/2026), alors que le modèle de notes donne 73 au 1er choix 2026 (note a priori par rang de draft, `docs/NOTES_JOUEURS.md` § 3). Un n° 1 généré entrera donc dans la ligue nettement sous le n° 1 réel de 2026.
5. Plafond 2027-28 (contrats des rookies provisoires) et dates de naissance (74 âges inconnus).
