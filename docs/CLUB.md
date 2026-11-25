# Vie du club — tranche 10 (25 novembre 2026)

> Statut : **implémenté et testé**. G League, two-way et contrats en cours de saison, propriétaire, vestiaire. Décisions appliquées : réponses 46 à 56 de `docs/DECISIONS_2026-11.md` (« toutes en (a) » ; Antonin : « un jeu de gestion sur les mêmes bases que Rugby Legends »). Les règles des contrats en saison et le format de la G League sont **sourcés** (Hoops Rumors, NBA G League, NBA Communications) ; le relevé des changements de direction est **partiel**, à recouper ; le modèle `data/modeles/club-v1.json` est une **proposition** à valider par Antonin.

## 1. Ce que fait la tranche 10

- **Propriétaire** de chaque franchise (réponses 50 et 51) : profil (exigeant, patient, ambitieux), objectif de la saison selon la force de l'équipe, confiance revue au tiers et aux deux tiers de la saison régulière puis après la finale, licenciement du GM sous le seuil du profil. Le GM du joueur licencié reçoit des **offres d'emploi** et choisit sa nouvelle franchise ; ceux de l'IA sont remplacés (un nouveau GM, une nouvelle personnalité).
- **Déménagement proposé** par le propriétaire au GM du joueur (réponse 54) : rare, à l'ouverture de l'intersaison ; le GM accepte ou refuse.
- **Vestiaire** (réponses 52 et 53) : moral de chaque joueur NBA des 30 équipes (résultats, temps de jeu face au rôle, tempérament, personnalité), moral du groupe (les meneurs comptent double), petit effet en match, demandes d'échange ; **messages à choix** pour la franchise du joueur, effets tirés au hasard, réponse par défaut après trois jours.
- **G League** (réponse 48) : 30 équipes affiliées, saison accélérée (Tip-Off, Winter Showcase, saison régulière, playoffs), statistiques estimées, progression des joueurs qui y jouent assez ; assignation et rappel des jeunes sous contrat standard.
- **Contrats en cours de saison** (réponse 49) : two-way signés en saison (limite au prorata, date limite), conversion en contrat standard, contrats de 10 jours, exception de difficulté (hardship) ; l'IA s'en sert aussi.
- **Écrans** (fonctionnels et sobres, réponse 20) : onglets **Club** (propriétaire, messages, vestiaire, contrats en saison) et **G League** ; encart des décisions (offres d'emploi, déménagement) en tête de la saison.

Code : `packages/league/src/club/` (`proprietaire`, `vestiaire`, `gleague`, `contrats`, `mesures`, `commun`, `index`) ; accroches dans `saison.ts` (forme, moral après chaque match, journée du club, fin de saison), `carriere/intersaison.ts` (moral à l'intersaison, bonus de G League, déménagement, objectifs), `marche/agents.ts` (fidélité selon le moral), `marche/ia.ts` (joueurs qui demandent à partir), `marche/echanges.ts` (personnalité du GM remplaçant), `marche/gm.ts` (actions). Moteur : `EquipeDuMatch.forme` (`packages/engine`). Écrans : `apps/web/src/ecrans/Club.tsx`.

Organisation reprise de Rugby Legends (lecture seule, réponse 44 et décision du 23/11/2026) : `rugby-legends@19dd48f:src/manager/moteur/carriere.ts` (président, objectifs, confiance, réputation, offres) et `vestiaire.ts` (moral, tempéraments, messages à choix) — réécrits pour la NBA, rien n'est importé.

## 2. Données (migration `tools/migrations/2026-11-25-tranche10-club.ts`, idempotente)

| Fichier | Contenu | Sources |
|---|---|---|
| `data/cba/nba-2026-27.json` (nouveaux paramètres) | **10 jours** : à partir du 5 janvier, 10 jours (au moins 3 matchs), salaire = minimum × 10/174, deux au plus avec la même équipe, pas à moins de 10 jours de la fin. **Hardship** : 15 contrats standard, au moins 4 blessés absents depuis 3 matchs consécutifs et pour deux semaines encore ; une exception par groupe de quatre, une de plus par blessé au-delà ; contrat de 10 jours hors des 15. **Two-way en saison** : pas après le 4 mars, limite de 50 matchs au prorata (jours restants ÷ 174), conversion jusqu'à la fin de la saison régulière, 90 matchs de two-way au total sous 15 contrats standard (paramètre relevé, pas encore appliqué). | Hoops Rumors : glossaires 10-Day Contract (01/2024) et Hardship Exception (12/2023), Active Game Limits For Two-Way Players In 2025/26 (11/2025), date limite des two-way (03/2026), effectif des Grizzlies (04/2026) |
| `data/ligue/g-league-2026-27.json` | 31 équipes dont 30 affiliées (une par franchise) ; Tip-Off de 14 matchs en 4 régions (à partir du 6/11/2026) ; Winter Showcase (8 qualifiés) ; saison de 36 matchs par conférence ; playoffs à 8 par conférence (30/03/2027), finale au meilleur des trois. Dates de fin du Tip-Off et de la saison, et dates exactes du Showcase : estimées. | NBA G League (présentation et FAQ, primaire), NBA Communications (calendrier 2025-26) |
| `data/ligue/directions.json` | Changements de direction sportive : 5 en 2024-25 (Atlanta, Denver, Sacramento, Phoenix, Toronto), au moins 3 en 2025-26 (Dallas, Chicago, Philadelphie). Sans nom de dirigeant. **Relevé partiel**, à recouper. | ESPN, Hoops Rumors, Bleacher Report, Sports Illustrated, TSN |
| `data/modeles/club-v1.json` | Modèle du club (§ 3 à 6), statut **proposition**. | Choix du jeu, transposés de Rugby Legends et réglés à la mesure |

Validations du 25/11/2026 (réponse 47) : `marche-v1.json` et `staff-v1.json` passent au statut `valide` (même migration).

## 3. Propriétaire (`proprietaire.ts`)

- **Profil** : exigeant (30 %, confiance de départ 55, seuil 30, sévérité 1,3, aucune taxe acceptée), patient (40 % ; 65 ; 20 ; 0,7 ; 10 M$ de taxe), ambitieux (30 % ; 60 ; 25 ; 1 ; 60 M$). **Hérité du miroir** : un récidiviste de la taxe au snapshot est ambitieux avec une probabilité de 0,7 ; sinon le profil est tiré. L'écran le présente comme généré.
- **Objectif** selon le rang attendu dans la ligue au début de la saison régulière (rang de la force de l'effectif ; à partir de la deuxième saison, moyenne de ce rang et de celui du bilan de la saison passée, car les notes seules prédisent mal les résultats simulés : corrélation d'environ 0,5 avec les victoires sur trois saisons mesurées) : 1-3 jouer la finale NBA ; 4-7 atteindre la finale de conférence ; 8-14 les playoffs ; 15-20 le Play-In ; 21-30 reconstruire (au moins 25 victoires, ou le Play-In).
- **Rendez-vous** au tiers et aux deux tiers de la saison régulière : écart à l'objectif en places de conférence (victoires projetées ÷ 3 pour une reconstruction) × 3 points × 0,6, × sévérité s'il est négatif ; borné à +15 / −30.
- **Bilan de fin de saison** (après la finale) : même calcul × 1,5, plus 2 places par tour de phase finale au-delà de l'objectif ; +15 pour le titre, +5 pour la finale ; −3 points par tranche de 10 M$ de taxe au-delà de la tolérance du profil (× sévérité). Objectif tenu : la confiance finit au moins à seuil + 15. Sous le seuil : **licenciement**.
- **Réputation** du GM du joueur (50 au départ) : +8 objectif tenu, −10 manqué, +12 titre, +5 finale, −10 licenciement.
- **Offres d'emploi** : les franchises qui viennent de licencier leur GM, puis les moins confiantes, dont le prestige (rang de force ramené à 100) ne dépasse pas la réputation + 15 ; trois au plus, au moins une. Tant que le GM n'a pas choisi, la Draft et l'intersaison attendent (au pilote automatique, il prend la première).
- **Déménagement** : probabilité de 3 % par saison (choix du jeu), vers une ville libre de la liste fermée et de la même conférence, après le délai minimal du modèle de carrière ; refusé, il coûte 5 points de confiance ; sans réponse au début de la saison, il est abandonné.

## 4. Vestiaire (`vestiaire.ts`)

- **Moral** (0 à 100, 65 au départ et à l'arrivée dans une nouvelle équipe) après chaque match, joueurs présents seulement : ±0,8 selon le résultat (× envie de gagner ÷ 50) ; temps de jeu selon le rôle (titulaire : −1,5 / −0,3 / +0,4 sous 12 minutes, de 12 à 26, au-delà ; rotation : −0,8 / +0,3 / +0,6 ; fin de banc : −0,1 / +0,4 / +0,6), × besoin d'un rôle ÷ 50 ; le tout × la variation du tempérament. Chaque jour, il revient de 2 % de son écart à 65 ; à l'intersaison, de moitié.
- **Rôle** : celui promis par le GM, sinon le rang par note (5 titulaires, 4 en rotation, le reste en fin de banc). **Tempérament** tiré une fois par partie : meneur 15 % (trois fois plus probable avec un mental parmi les 10 % meilleurs de la NBA, 81 et plus), calme 35 %, sanguin 20 %, discret 30 % (sensible de moitié au temps de jeu).
- **Moral du groupe** : moyenne, meneurs comptés double. **Effet en match** : 0,0001 point de réussite au tir par point d'écart avec la moyenne de la ligue (prise au premier match du jour), borné à ±0,003. L'effet moyen est nul par construction ; la forme des deux équipes est notée dans le résumé du match (rejeu à l'identique).
- **Demandes d'échange** : moral sous 30 pendant 14 jours. L'IA cède en priorité les joueurs qui le demandent ; un agent libre au moral bas tient moins à rester (fidélité × 0,5 à moral nul, × 1,3 à moral 100).
- **Messages à choix** (franchise du joueur, au plus un par jour et douze par saison) : temps de jeu réclamé, accrochage à l'entraînement, un cadre conteste, demande d'échange, un jeune s'impatiente, le groupe doute, le propriétaire s'inquiète, la taxe de luxe. Actions : promesse de temps de jeu (rompue : −15), joueurs écartés du prochain match, assignation en G League, rôle relevé, joueur mis sur le marché, demande refusée.

## 5. G League et contrats en saison (`gleague.ts`, `contrats.ts`)

- **Effectif d'une équipe affiliée** : two-way de la franchise, joueurs assignés (contrat standard, 2 saisons d'ancienneté au plus — choix du jeu, à recouper — et au moins 8 joueurs restant en NBA), joueurs hors NBA rattachés pour la saison (en développement, puis libres de 26 ans au plus, répartis en serpentin jusqu'à 12). Ils restent libres de signer ailleurs. L'IA assigne ses jeunes au-delà du 12e rang de son effectif.
- **Match** : force = moyenne pondérée des huit meilleures notes ; victoire à domicile avec la probabilité logistique de (écart + 1,5) / 6 ; score autour de 115 points ; minutes (34 à 6) et points répartis selon la note, rebonds et passes selon le poste. **Statistiques estimées**, jamais présentées comme relevées.
- **Progression** : +0,4 point à l'intersaison pour un joueur de 24 ans au plus qui a joué au moins 20 matchs de G League.
- **Contrats de 10 jours** : fin après 10 jours et au moins 3 matchs de l'équipe ; le salaire reste payé (argent mort de la saison) ; « garder jusqu'à la fin de la saison » donne un contrat standard au minimum au prorata. **Hardship** : contrats hors des 15 tant que l'équipe a droit à l'exception. **Two-way** signés en saison avec une limite au prorata ; conversion au minimum au prorata.
- **IA** : exceptions de difficulté utilisées dès qu'elles s'ouvrent (meilleur joueur hors NBA de note 55 ou plus) ; chaque dimanche, places two-way vides comblées (24 ans au plus, avant le 4 mars) et two-way à leur limite convertis s'ils valent au moins 62.

## 6. Critère de sortie (réponse 56)

`npm run carriere 10 -- --matchs --club` (environ 95 s) joue 10 saisons au pilote automatique (franchise du joueur comprise, réponse 45) et mesure : licenciements de GM par saison (fourchette 1 à 7, calée sur le relevé : 5 puis au moins 3), moral moyen (55 à 75, dérive au plus 6 points), effet moyen du moral en match (au plus 0,001 en valeur absolue). **Fourchettes choisies pour le jeu**, sauf l'ordre de grandeur des licenciements.

Résultats du 25/11/2026 (graine 2026, 10 saisons jouées en 77 s) : **critère tenu**. Licenciements de GM 2 à 6 par saison (3,6 en moyenne) ; moral moyen 66,4 à 66,9 (dérive 0,5) ; effet moyen du moral en match 2·10⁻⁵ à 3·10⁻⁵ (écart maximal entre deux équipes d'un match : 0,0028 point de réussite) ; G League complète chaque saison (773 matchs, Showcase et champion) ; 0 à 10 messages par saison pour la franchise du joueur ; 0 à 4 contrats de difficulté par saison. Calibration du moteur inchangée (`npm run sonde 1000` : 19 mesures dans leurs fourchettes ; sans forme, un match est identique au bit près) ; distribution des notes stable (critère de la tranche 8) ; critère du marché (tranche 9) tenu sur ce tirage. Un tirage intermédiaire (avant le rang attendu par le bilan) avait laissé une saison hors fourchette du marché (meilleur agent libre non signé noté 77, borne 75) : ces mesures fluctuaient déjà à la tranche 9 (une saison à 17 échanges, une masse à 0,76), à surveiller.

## 7. Limites et simplifications

1. Modèle `club-v1.json` au statut « proposition » : profils, objectifs, confiance, moral, tempéraments, effet en match, messages, G League accélérée, contrats de l'IA.
2. Relevé des changements de direction partiel (deux saisons), à recouper.
3. Pas de licenciement en cours de saison (les rendez-vous ne font que baisser ou monter la confiance) ; pas de licenciement d'entraîneur (le staff reste celui de la tranche 9).
4. G League : l'équipe indépendante (31e) n'est pas simulée ; les matchs du Showcase ne comptent pas dans la saison régulière ; deux matchs le même jour sont possibles ; pas de contrats de G League (Exhibit 10) ni d'affiliations partagées.
5. Contrats en saison : pas de contrat de 10 jours standard par l'IA (seulement l'exception de difficulté) ; la limite de 90 matchs de two-way sous 15 contrats standard n'est pas appliquée ; un contrat de difficulté n'est pas rompu dès que l'équipe ne remplit plus les conditions, il va à son terme ; les matchs de two-way comptent les matchs joués (pas les feuilles de match actives) ; ancienneté prise à 0 pour un contrat de 10 jours.
6. L'assignation est limitée à 2 saisons d'ancienneté (choix du jeu ; la règle réelle est à relever).
7. Le moral ne pèse pas encore sur l'évolution des notes ni sur les contrats offerts par l'IA (seulement la fidélité et les cibles d'échange).

## 8. Tests

`packages/league/tests/club.test.ts` (18 tests) : paramètres sourcés, profils et objectifs, niveau atteint, une saison complète (G League : 14 + 36 matchs par équipe, Showcase, champion ; bilan des 30 propriétaires ; licenciements ; moral ; rejeu à l'identique avec la forme ; sauvegarde), licenciement et offres d'emploi (Draft et intersaison bloquées), intersaison (moral, objectifs, nouvelle G League), contrats de 10 jours (salaire, fin, deux au plus, garder jusqu'à la fin), refus datés, two-way au prorata et conversion, exception de difficulté, tempéraments, fidélité, forme bornée, messages et réponse par défaut. Parcours Playwright `apps/web/parcours/club.spec.ts`.
