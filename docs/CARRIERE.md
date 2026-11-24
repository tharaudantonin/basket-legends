# Carrière multi-saisons — tranche 8 (24 novembre 2026)

> Statut : **implémenté et testé**. À la fin d'une saison (Draft comprise), « Passer à la saison suivante » fait vieillir et progresser les 840 joueurs environ, décide des retraites et des contrats, accueille la classe de Draft, tire un éventuel changement de franchise et lance la saison suivante, qui se joue comme la première. Les paramètres du modèle sont des **propositions à valider** (`data/modeles/carriere-v1.json`, statut `proposition`) ; les noms des villes d'accueil sont des **propositions** (`data/ligue/villes-d-accueil.json`).

## 1. Ce que fait la tranche 8

Critère de sortie (`docs/AUDIT_2026-11.md` § 7) : « distribution des notes stable sur 20 saisons ». Il est testé (`packages/league/tests/carriere.test.ts`, 20 saisons accélérées, graine 2026) et mesurable à la demande (`npm run carriere`, § 8).

- **Univers de la carrière** (`packages/league/src/carriere/types.ts`) : tous les joueurs (NBA, hors NBA, recrues), effectifs, contrats, situation salariale publiée, identité des franchises, retraités, historique de la loterie, points par match de la saison passée (pour la loterie et l'actualité), taxes payées (récidive). La première saison lit l'univers des données de référence (`universInitial`, `packages/data/src/carriere.ts`) ; à partir de la deuxième, l'univers est dans l'état de la partie (`EtatSaison.univers`) et la sauvegarde IndexedDB le contient.
- **Contexte d'une saison** (`contexteDeLaSaison`) : les équipes sont recomposées depuis l'univers (même composition par le staff qu'en saison 1), les dates de la structure sont décalées d'un nombre entier de semaines (même jour de la semaine que 2026-27), la CBA est reconduite (§ 6).
- **Intersaison** (`passerALaSaisonSuivante`, `packages/league/src/carriere/intersaison.ts`) : § 3.
- **Archives** (`EtatSaison.archives`) : pour chaque saison jouée, champion, finaliste, palmarès, bilans des 30 équipes, noms des franchises cette saison-là, statistiques de chaque joueur (équipe, matchs, minutes, points, rebonds, passes), premier choix de la Draft, retraités, changement de franchise.
- **Interface** : bouton « Passer à la saison suivante » dans l'écran de saison quand la saison et la Draft sont terminées ; onglet **Histoire** (saisons jouées, changements de franchise, grands retraités) ; la fiche joueur montre sa carrière dans la partie (une ligne par saison) et l'évolution de sa note ; masse salariale, contrats, Draft et vivier lisent l'univers de la saison affichée (`apps/web/src/vue.ts`). Écran fonctionnel et sobre (réponse 20) ; la mise en forme viendra avec le chantier visuel.
- **Actualités** de l'intersaison (genre `intersaison`) : changement de franchise, retraites notables, plus fortes progressions de l'été, mouvements de la franchise du joueur.

## 2. Progression et vieillissement (`progression.ts`)

Une saison plus tard, chaque joueur a un an de plus et une nouvelle note ; l'historique de ses notes s'allonge d'une ligne.

- **Courbe d'âge** (joueurs du snapshot et joueurs générés après le pic) : évolution moyenne de la note selon l'âge de la saison écoulée, +2,2 à 19 ans, +1,0 à 23, +0,1 à 26, −0,2 à 27, −1,5 à 30, −2,8 à 33, −3,4 à 36, −3,0 à 38 (interpolation linéaire entre ces âges) ; plus un écart propre à chaque joueur et chaque saison (écart-type 2,4 à 19 ans, 2,0 à 27, 1,8 à 31, 2,0 à 35).
- **Joueurs générés au potentiel connu** (prospects, vivier) avant 27 ans : ils comblent chaque saison une part de l'écart entre leur note et leur potentiel (20 % à 19 ans, 18 % à 22, 14 % à 25, 10 % à 26), plus le même écart propre. Un joueur qui a atteint son potentiel ne progresse plus en moyenne ; un potentiel n'est jamais sous la note atteinte.
- **Haut de l'échelle** : au-delà de 88, une progression est multipliée par (99 − note) ÷ (99 − 88) ; un déclin ne l'est pas.
- **Attributs détaillés** : chacun suit l'évolution de la note, plus un profil d'âge et un écart propre (écart-type 1,2), recentrés pour que leur moyenne suive la note. Profils : les qualités athlétiques (vitesse, contre, interception, défense extérieure, rebond offensif) perdent 0,8 point par an de plus que la note après 27 ans (au plus 6) ; la lecture du jeu et l'adresse (QI offensif et défensif, passe, lancers francs, tir à trois points, mi-distance) gagnent 0,5 point par an de plus après 24 ans (au plus 4). Les familles suivent la moyenne de leurs attributs ; l'endurance perd 1 point par an après 30 ans. Toutes les valeurs restent entre 25 et 99.

**Sources et part de choix.** La forme de la courbe suit Vaci et al. (2019, *Behavior Research Methods* 51(4)) : pic « around 27 or 28 years old » (p. 1549), déclin dont « the rate … slows down in older age » (p. 1550). Les montants en points de note, les écarts, la compression, le rattrapage du potentiel et les profils par attribut sont des **choix du modèle**, calés pour la stabilité (§ 8) ; Vaci et al. ne donnent pas de profil par compétence.

## 3. Intersaison (`intersaison.ts`)

Dans l'ordre, tout déterministe (graine de la saison, tirée de la précédente) :

1. **Progression** de tous les joueurs déjà dans l'univers (§ 2).
2. **Retraites** (§ 4).
3. **Draft** : les joueurs draftés arrivent avec l'âge de la saison à venir (sans progression cette année-là) ; les prospects non draftés passent hors NBA, en développement.
4. **Contrats et effectifs**, équipe par équipe dans l'ordre de la Draft (pire bilan d'abord) :
   - les contrats échus (standard sans salaire pour la saison à venir, tous les two-way) sortent de l'effectif ;
   - les choix de 1er tour signent le contrat de l'échelle des rookies (deux saisons garanties, deux options de l'équipe ; `docs/DRAFT.md` § 8) ;
   - **prolongation automatique** d'une saison, au même salaire (au moins le minimum de son ancienneté), des joueurs échus, les meilleurs d'abord, tant que l'équipe a moins de 14 contrats standard ; ni au-delà de 38 ans, ni sous 62 ; un two-way reste two-way (24 ans au plus) ;
   - les choix de 2e tour signent un two-way s'il reste une place, sinon passent hors NBA ;
   - l'équipe complète à 14 contrats standard avec les meilleurs joueurs hors NBA (un an au minimum), puis ses places two-way avec les meilleurs jeunes (24 ans au plus) ;
   - au-delà du maximum de contrats standard de la CBA, l'équipe coupe le moins bon (hors recrues) ; son salaire de la saison reste à sa charge (argent mort) ;
   - les joueurs non prolongés deviennent libres (hors NBA, sans contrat).
5. **Hors NBA** : un joueur en développement devient libre après 26 ans.
6. **Ligue** : historique de la loterie (rang des choix du 1er tour), recrues, points par match de la saison passée, taxes payées (récidive : 3 des 4 dernières saisons, § 5).
7. **Changement de franchise** (§ 7).

**Règle provisoire** jusqu'à la free agency et l'IA de GM (tranche 9) : prolongations et signatures sont automatiques, pour toutes les équipes, y compris celle du joueur ; les options (joueur, équipe) sont toutes exercées. 14 contrats standard est la taille la plus fréquente au snapshot (16 équipes sur 30) ; le snapshot en compte 435, la saison 2 et les suivantes 420.

## 4. Retraites

Retraite certaine après 41 ans. Sinon, probabilité = base + par an × (âge − âge de début) + par point × max(0, seuil − note), bornée à 0-1, avec l'âge et la note de la saison à venir :

| Joueur | Dès | Base | Par an | Par point sous le seuil | Seuil |
|---|---|---|---|---|---|
| Dans un effectif NBA à la fin de la saison | 33 ans | 0,05 | 0,08 | 0,02 | 72 |
| Hors NBA | 25 ans | 0,15 | 0,08 | 0,06 | 62 |

Un joueur dont le contrat se termine reste compté « NBA » pour cette décision : le compter « sans contrat » faisait partir trop tôt les vétérans et rajeunissait la ligue. Le retraité garde son nom, son âge, sa saison de départ, sa meilleure note et sa dernière équipe (`Univers.retraites`).

Résultat : environ 97 retraites par saison en mode accéléré, 119 avec les matchs joués (3 saisons mesurées). **Contrôle de vraisemblance** seulement : Foutzopoulos et al. (2024, MPRA n° 121540, tableau 1) donnent une carrière moyenne de 9,0 saisons pour les joueurs draftés de 1999 à 2006 restés au moins deux saisons ; les paramètres sont des choix du modèle.

## 5. Taxes et récidive

La récidive (taxe payée 3 des 4 dernières saisons, `data/cba/`) se calcule sur les saisons de la partie. Pour les premières saisons, `universInitial` amorce l'historique : une équipe marquée récidiviste au snapshot est comptée comme ayant payé la taxe en 2023-24, 2024-25 et 2025-26. **Approximation** : les saisons réellement payées ne sont pas relevées.

## 6. Règles reconduites

- **CBA** : le dépôt n'a que la CBA 2026-27 ; ses montants (plafond, taxe, minimums, exceptions) sont reconduits tels quels chaque saison, et l'échelle des rookies reste proportionnelle au plafond 2026-27 (`docs/DRAFT.md` § 8). À remplacer par des paramètres par saison quand ils seront relevés.
- **Structure de la saison** : conférences, divisions, format du calendrier, Play-In, playoffs, départages et récompenses de 2026-27 ; les dates sont décalées d'un nombre entier de semaines (2027-28 commence le 19 octobre 2027, un mardi comme le 20 octobre 2026).
- **Loterie** : 3-2-1 (réponse 12), paramétrable après 2029.

## 7. Changement de franchise (`demenagement.ts`, décisions 6 à 8)

- Chaque intersaison, un tirage (probabilité 1/8 = 0,125) décide s'il y a un changement dans la ligue ; mesuré : 0,1267 sur 500 chaînes, et entre 0,08 et 0,17 sur 400 tirages dans le test.
- L'IA choisit la franchise parmi celles qui n'ont pas déménagé depuis 15 saisons ; **jamais celle du joueur** (sa proposition par le propriétaire viendra avec la confiance du propriétaire, tranche 10).
- La ville vient de la liste fermée (`data/ligue/villes-d-accueil.json`), parmi celles qui n'ont pas de franchise et sont rattachées à la même conférence ; la franchise garde sa conférence, sa division, son identifiant, son palmarès et ses archives. Nouveau nom : la ville et l'un de ses deux noms proposés ; l'ancienne identité est gardée (`anciennes`).
- **11 villes** (marchés cités par la presse pour une expansion ou un déménagement) : Seattle, Las Vegas, Mexico, Kansas City, Vancouver, San José, Austin (Ouest) ; Louisville, Montréal, Virginia Beach, Saint-Louis (Est). Sources : ESPN (17/09/2024), Front Office Sports (09/07/2026), NTD (28/03/2026), Sports Illustrated (29/07/2026), toutes secondaires (`docs/SOURCES.md` § 13). Le rattachement à une conférence est un choix du jeu (géographie).
- Les noms (« Seattle Cascades », « Montréal Aurores »…) sont des **propositions** à valider par Antonin, puis à soumettre à la revue juridique (porte de publication). Les identités visuelles viendront avec le chantier visuel.

## 8. Calibration et stabilité (`mesures.ts`, `npm run carriere`)

Mesures sur les joueurs sous contrat standard NBA, comparées à la saison 2026-27 ; fourchettes tolérées (**choisies pour le jeu, non sourcées**) : moyenne ±1,5 ; 10e, 50e et 90e centiles ±2,5 ; joueurs à 80 ou plus ±30 % ; joueurs à 90 ou plus ±5 ; âge moyen ±1,5 ; population totale ±10 %.

`npm run carriere [saisons] [-- --matchs] [-- --graine=n]` : sans `--matchs`, chaque saison est « accélérée » (`terminerSansMatchs` : aucun match, ordre de la Draft selon la force des effectifs, choix du staff) ; 20 saisons en 4 secondes environ. Avec `--matchs`, chaque saison est jouée par le moteur (environ 4,8 s par saison). Le mode accéléré ne sert qu'à la calibration.

Résultats du 24/11/2026 (20 saisons accélérées) :

| Graine | Résultat |
|---|---|
| 2026 (test) | Toutes les saisons dans leurs fourchettes. Départ : moyenne 72,3, centiles 64 / 72 / 81, 65 joueurs à 80+, 8 à 90+, âge moyen 26,4, population 843. Saison 20 : 73,4, 65 / 73 / 81, 67, 6, 26,5, 898. Deux changements de franchise. |
| 7, 99 | Toutes les saisons dans leurs fourchettes. |
| 42 | 10e centile à 67 deux saisons (+3) ; 8 changements de franchise en 20 saisons (tirage extrême, la fréquence moyenne est vérifiée à part). |
| 1 | Moyenne jusqu'à 74,1 (+1,8) et 88 joueurs à 80+ (+35 %) entre 2037 et 2043, 10e centile à 67, 1 seul joueur à 90+ une saison. |

Avec les matchs joués (3 saisons, graine 2026) : stable. **Limite** : la stabilité est démontrée pour la graine du test et vérifiée sur cinq graines ; deux graines sur cinq sortent ponctuellement d'une fourchette, sans dérive continue. Une ligue un peu plus forte ou plus faible selon les générations reste plausible ; resserrer davantage demanderait un rappel vers la moyenne qui n'a pas de fondement sourcé.

## 9. Tests

`packages/league/tests/carriere.test.ts` (16 tests) : progression déterministe, un an de plus, historique des notes ; jeunes en progrès et vétérans en déclin en moyenne ; rattrapage du potentiel ; athlétisme qui décline avant la lecture du jeu ; bornes ; retraites (aucune avant l'âge, certaine après 41 ans, plus probable hors NBA) ; intersaison (refusée avant la fin de la Draft, saison 2027-28 et archive, calendrier décalé au même jour de la semaine, nouvelle classe 2028, déterminisme, effectifs conformes à la CBA sans doublon ni contrat hors NBA, retraités retirés, classe de Draft arrivée, sauvegarde relue à l'identique, saison suivante jouable) ; changement de franchise (jamais celle du joueur, ville unique, même conférence ; fréquence) ; critère de sortie sur 20 saisons. Parcours Playwright `apps/web/parcours/draft.spec.ts` : après la Draft, passer à 2027-28, lire l'onglet Histoire et la masse salariale 2027-28, jouer un jour.

## 10. À valider ou à relever

1. Paramètres du modèle de carrière (`carriere-v1.json`) : courbe, écarts, rattrapage, profils, retraites, effectifs.
2. Fourchettes de stabilité du § 8.
3. Noms des 11 villes d'accueil, et rattachement de chaque ville à une conférence.
4. Règle provisoire des contrats (§ 3), remplacée par la free agency et l'IA de GM en tranche 9.
5. CBA des saisons suivantes (§ 6) et saisons réellement payées pour la récidive (§ 5).
6. Âge maximal de 41 ans : choix du modèle.
