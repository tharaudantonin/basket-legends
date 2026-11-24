# Player Mirror — correspondance individuelle et données joueurs

## 1. Objectif et principes

Chaque joueur initial de Basket Legends est une contrepartie fictive d'un joueur réel précisément identifié dans le périmètre de référence. Le mapping est conservé dans les données internes pour la traçabilité ; l'interface affiche le nom fictif validé, jamais le nom source par défaut.

Le nom fictif conserve les initiales du joueur de référence (exemple de convention : un joueur aux initiales J. T. reçoit un nom comme « Julian Thackeray », JT). Cette règle ne justifie ni la copie d'une identité, ni la reproduction d'une apparence identifiable. Les doublons d'initiales sont autorisés, mais les noms fictifs complets et les identifiants internes doivent être uniques.

Règles non négociables :
- aucun vrai nom de joueur dans le dépôt une fois la migration de la tranche 0 faite : la table de correspondance (vrai nom → nom fictif) est gardée dans `C:\Users\thara\Projets\basket-legends-prive\`, hors du dépôt, et seules les empreintes des vrais noms entrent dans le dépôt pour empêcher leur tirage (décision du 24 novembre 2026) ;
- aucune statistique, mensuration, date ou affiliation ne doit être inventée ;
- une donnée inconnue reste `null` avec un statut explicite ;
- une donnée mesurée, une donnée calculée et une estimation de scouting sont trois catégories distinctes ;
- chaque valeur importée conserve sa source, sa saison/période, sa définition, son unité et sa date de collecte ;
- les données de référence sont immuables dans une version publiée ; les carrières créent leurs propres états évolutifs ;
- les droits, conditions d'utilisation, données personnelles et droits de la personnalité doivent être examinés avant toute diffusion commerciale.

## 2. Snapshot de départ

**Snapshot validé le 23 novembre 2026 :** effectifs de la saison 2026-2027 tels que fournis dans `data/rosters/2026-27/`, arrêtés au 17 novembre 2026. La carrière démarre en 2026-2027.

Le snapshot administratif (franchise, statut, droits, contrats) est un instantané de fin de journée au 17 novembre 2026, au fuseau de référence NBA (Eastern Time). Une transaction annoncée après cette date ne doit pas être intégrée rétroactivement.

Les statistiques servant à calibrer les notes sont celles de la saison 2025-2026 terminée, séparées par type de compétition :
- saison régulière ;
- Play-In, si applicable ;
- playoffs ;
- Summer League et compétitions annexes, uniquement si elles sont utiles et explicitement identifiées.

Les statistiques saisonnières couvrent la compétition concernée. Le snapshot du 17 novembre 2026 fixe l'état administratif du joueur (franchise, statut, contrat et droits), tandis que les statistiques décrivent sa saison 2025-2026 achevée. Une recrue sans saison 2025-2026 en NBA n'a pas de statistiques NBA de calibration : sa note est marquée « estimé ».

Toute mise à jour ultérieure crée une nouvelle version de données. Elle ne modifie jamais les données de départ d'une carrière déjà créée.

## 3. Périmètre des populations

La cible initiale d'environ 840 joueurs demeure **indicative**, et non une contrainte de recensement qui autoriserait à inventer des profils.

| Population | Cible de travail actuelle | Règle de constitution |
|---|---:|---|
| Effectifs NBA | Environ 450 | Recensement réel des joueurs et droits rattachés aux 30 franchises au cutoff ; distinguer contrats standard, two-way, joueurs libres et droits de Draft |
| Développement / G League | Environ 180 | Joueurs réellement identifiés et affiliations documentées ; vérifier le périmètre des équipes affiliées et les mouvements |
| Joueurs libres / prospects | Environ 210 | Séparer joueurs réels libres, prospects réels identifiés et joueurs générés originaux |
| **Total indicatif** | **Environ 840** | Le total final dépend du recensement, des doublons inter-populations et des statuts au cutoff |

Un joueur ne doit apparaître qu'une fois dans le référentiel maître. Ses affiliations et statuts sont historisés dans une table de relations datées ; un two-way player ou un joueur ayant changé d'équipe ne devient pas plusieurs joueurs.

Les joueurs générés pour les saisons futures sont entièrement originaux et ne sont pas artificiellement associés à une personne réelle.

## 4. Modèle d'identité et de rattachement

Chaque joueur doit disposer de :
- un identifiant interne stable et immuable ;
- un ou plusieurs identifiants de source (NBA person ID, identifiant de fournisseur statistique, slug de référence) ;
- un nom source conservé uniquement dans la couche de mapping interne ;
- un nom d'affichage fictif et ses initiales ;
- une franchise de référence et un historique d'affiliations daté ;
- un statut au snapshot : contrat standard, two-way, droits de Draft, free agent, waived, G League, prospect, retraité ou autre statut documenté ;
- une date de naissance et un âge calculé au snapshot ;
- une provenance et un niveau de confiance pour chaque champ important.

Ne jamais déduire l'équipe du joueur depuis une page de statistiques saisonnières sans vérifier son historique de transactions : une ligne statistique peut agréger plusieurs équipes.

## 5. Données physiques et sportives

### Identité physique
Champs à collecter lorsqu'ils sont publiés et sourcés :
- date de naissance ;
- taille en centimètres (conserver aussi la valeur source et son unité) ;
- poids en kilogrammes ;
- poste source et classification de jeu principale/secondaire ;
- main dominante, envergure, détente ou autres mensurations uniquement si une source fiable les documente.

La taille et le poids publiés peuvent être anciens ou arrondis. Conserver la date et la nature de la mesure ; ne pas présenter une donnée de roster comme une mesure biométrique récente.

### Statistiques de saison
Conserver d'abord les **totaux bruts**, puis calculer les moyennes et ratios à partir des totaux et des minutes. Champs fondamentaux :
- matchs joués (G), titularisations (GS), minutes (MP) ;
- points (PTS), rebonds offensifs/défensifs/totaux (OREB/DREB/REB), passes (AST) ;
- interceptions (STL), contres (BLK), pertes de balle (TOV), fautes personnelles (PF) ;
- tirs réussis/tentés (FGM/FGA), tirs à trois points (3PM/3PA), lancers francs (FTM/FTA) ;
- plus/minus (+/-), si disponible et correctement défini.

Les données doivent distinguer totaux, par match, par 36 minutes et par 100 possessions. Ces vues ne sont jamais interchangeables. Les statistiques avancées (TS%, eFG%, USG%, AST%, TOV%, ORB%, DRB%, PER, BPM, WS, etc.) conservent le fournisseur et la définition utilisés. Ne pas mélanger sans le signaler des métriques NBA.com, Basketball-Reference ou calculées en interne.

Les statistiques de playoffs ne doivent jamais être additionnées aux statistiques de saison régulière dans le même enregistrement. Les statistiques par équipe et les agrégats de saison doivent conserver la distinction entre lignes d'équipe et total de saison.

### Préférence d'unités d'affichage

Le référentiel conserve les mensurations sources et leurs unités d'origine, ainsi que les valeurs métriques converties. L'interface doit proposer un réglage utilisateur global :
- **Métrique** : taille en centimètres (cm), poids en kilogrammes (kg) ;
- **Impérial** : taille en pieds/pouces (ft/in), poids en livres (lb).

La préférence ne modifie jamais les données stockées : elle ne fait que choisir leur représentation. Les conversions doivent utiliser les facteurs exacts (1 in = 2,54 cm ; 1 lb = 0,45359237 kg) et l'arrondi n'intervient qu'à l'affichage. Les valeurs source restent accessibles pour audit et réversibilité.

### Effectifs reçus et validés

- Philadelphia Founders (référence : Philadelphia 76ers) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026.
- Fichier de données : `data/rosters/2026-27/philadelphia.json`.
- Milwaukee Stags (référence : Milwaukee Bucks) : 18 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 ; pays de Kamari Whitlock (j0299) corrigé en `USA` à la demande de l'utilisateur le même jour.
- Fichier de données : `data/rosters/2026-27/milwaukee.json`.
- Chicago Horses (référence : Chicago Bulls) : 18 joueurs fournis par l'utilisateur et validés le 17 novembre 2026.
- Fichier de données : `data/rosters/2026-27/chicago.json`.
- Cleveland Sentinels (référence : Cleveland Cavaliers) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026.
- Fichier de données : `data/rosters/2026-27/cleveland.json`.
- Boston Beacons (référence : Boston Celtics) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026.
- Fichier de données : `data/rosters/2026-27/boston.json`.
- Los Angeles Beachers (référence : LA Clippers) : 18 joueurs fournis par l'utilisateur et validés le 17 novembre 2026.
- Fichier de données : `data/rosters/2026-27/clippers.json`.
- Memphis Rhythm (référence : Memphis Grizzlies) : 18 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027 ; poids de Jace Weldon (j0264) fourni en kg (93 kg).
- Fichier de données : `data/rosters/2026-27/memphis.json`.
- Atlanta Eagles (référence : Atlanta Hawks) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/atlanta.json`.
- Miami Tropics (référence : Miami Heat) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/miami.json`.
- Charlotte Bees (référence : Charlotte Hornets) : 18 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/charlotte.json`.
- Utah Desert Raptors (référence : Utah Jazz) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/utah.json`.
- Sacramento Diggers (référence : Sacramento Kings) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/sacramento.json`.
- New York Skyliners (référence : New York Knicks) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/new-york.json`.
- Los Angeles Stars (référence : Los Angeles Lakers) : 18 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/lakers.json`.
- Orlando Comets (référence : Orlando Magic) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/orlando.json`.
- Dallas Outriders (référence : Dallas Mavericks) : 18 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/dallas.json`.
- Brooklyn Bridges (référence : Brooklyn Nets) : 18 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/brooklyn.json`.
- Denver Peaks, anciennement Denver Summit (référence : Denver Nuggets) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/denver.json`.
- Houston Commanders (référence : Houston Rockets) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/houston.json`.
- San Antonio Knights (référence : San Antonio Spurs) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/san-antonio.json`.
- Phoenix Scorpions (référence : Phoenix Suns) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/phoenix.json`.
- Oklahoma City Storm Riders (référence : Oklahoma City Thunder) : 18 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/oklahoma-city.json`.
- Minnesota Borealis (référence : Minnesota Timberwolves) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/minnesota.json`.
- Portland Timberbears (référence : Portland Trail Blazers) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/portland.json`.
- San Francisco Golden Seals (référence : Golden State Warriors) : 18 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/golden-state.json`.
- Toronto Bears (référence : Toronto Raptors) : 17 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027 ; le numéro 9 est volontairement partagé par RJ Benning (j0474) et Kenyon McGrath Jr. (j0482) à titre provisoire.
- Fichier de données : `data/rosters/2026-27/toronto.json`.
- Washington Monuments, anciennement Washington Capitals (référence : Washington Wizards) : 18 joueurs fournis par l'utilisateur et validés le 17 novembre 2026 pour la saison 2026-2027.
- Fichier de données : `data/rosters/2026-27/washington.json`.
- Le statut « validé par l'utilisateur » ne vaut pas certification indépendante du statut contractuel ou de l'affiliation NBA au snapshot. Les identifiants NBA, contrats, statuts two-way et statistiques restent à vérifier séparément.
- Chicago Horses : le numéro 7 est partagé provisoirement par Brandon Halsey (j0078) et Omar Ralston (j0083) (décision du 24 novembre 2026), comme le numéro 9 de Toronto.
- Les noms fictifs et les commentaires de scouting ne sont pas encore renseignés. Des notes et attributs provisoires ont été ajoutés le 18 novembre 2026 ; ils seront remplacés par le modèle de notes v1 (décision du 24 novembre 2026, § 6).
- Depuis la tranche 0 (24 novembre 2026), chaque effectif est rangé sous l'identifiant canonique de sa franchise (`data/rosters/2026-27/<id>.json`) et chaque joueur a un identifiant stable sans nom réel (`j0001` à `j0523`). Les vrais noms et les notes NBA 2K sont gardés hors du dépôt.

## 6. Attributs de jeu (échelle 1–100)

Les statistiques réelles ne sont pas des attributs de jeu. Un modèle versionné transforme les preuves disponibles en évaluations sportives, en séparant :
1. **Production observée** : volume, efficacité, fréquence et contexte statistique.
2. **Compétence estimée** : qualité technique ou tactique non directement mesurée.
3. **Attribut physique** : vitesse, accélération, détente, force, endurance, mobilité, uniquement selon des preuves disponibles ou une estimation clairement étiquetée.
4. **Potentiel** : projection de développement, distincte du niveau actuel et assortie d'une incertitude.
5. **Traits / personnalité** : uniquement s'ils ont une justification documentée ou sont générés pour le jeu ; ne pas transformer une réputation médiatique en fait établi.

Familles d'attributs proposées :
- Tir : tir près du cercle, finition, mi-distance, trois points, lancers francs, tir en mouvement, tir après dribble.
- Création : dribble, protection de balle, passe, vision, création sur pick-and-roll, création individuelle.
- Jeu intérieur : jeu au poste, toucher, jeu dos au panier, rebond offensif, écrans.
- Défense : défense sur porteur, défense sans ballon, défense extérieure, défense intérieure, contestation, interception, contre, rebond défensif.
- Physique : vitesse, accélération, détente, force, endurance, agilité, équilibre.
- Mental / décision : lecture, prise de décision, discipline tactique, constance, sang-froid, effort.
- Spécialisation : attributs de rôle supplémentaires uniquement si le moteur les utilise réellement.

Le modèle doit documenter pour chaque attribut : définition opérationnelle, indicateurs d'entrée, pondérations, normalisation par rôle/poste, traitement des petits échantillons, version de formule, date de calibration et intervalle/niveau de confiance. Les valeurs ne doivent pas être déduites d'une simple moyenne de points ou d'un classement médiatique.

**Échelle « NBA » (décisions des 23 et 24 novembre 2026) :** un joueur NBA de rotation se situe autour de 70-75 ; les superstars au-delà de 90 ; les joueurs hors NBA (G League, prospects, joueurs libres générés) entre 40 et 67. Cette échelle est une convention de jeu, calibrée par simulation, et non une conversion universelle des statistiques.

**Méthode retenue (décision du 24 novembre 2026) :** une formule maison, écrite et refaisable, à partir des statistiques 2025-2026 sourcées, puis un recalage par quantiles sur l'échelle ci-dessus, puis d'éventuelles corrections manuelles marquées « corrigé par Antonin ». Les notes de NBA 2K ne servent que de banc d'essai privé, hors du dépôt : elles ne sont jamais stockées dans le dépôt ni livrées dans le jeu. Critère d'acceptation du modèle v1 : corrélation de Spearman d'au moins 0,85 avec la référence privée, aucune valeur recopiée telle quelle hors correction manuelle sourcée, moins de 10 % de corrections.

Les évaluations défensives, de vision, de placement, de discipline, de qualité d'écran et de lecture nécessitent des données de tracking/vidéo ou une estimation de scouting explicitement étiquetée. Si la preuve manque, utiliser une valeur provisoire avec faible confiance ou laisser le champ non renseigné jusqu'à validation.

## 7. Provenance et confiance

Pour chaque champ importé ou dérivé, enregistrer :
- `sourceId`, URL et organisme ;
- identifiant joueur chez la source ;
- saison, période et type de compétition ;
- date de consultation et date de publication si connue ;
- valeur brute, unité et définition ;
- transformation appliquée, formule et version ;
- statut : `verified`, `derived`, `estimated`, `missing`, `conflicting` ou `unverified` ;
- confiance : `high`, `medium`, `low` ou `unverified`.

Une source officielle est prioritaire pour les statistiques et transactions, mais elle n'est pas automatiquement suffisante pour les données contractuelles détaillées, les blessures historiques ou les attributs subjectifs. Les conflits entre sources doivent être consignés et arbitrés, jamais écrasés silencieusement.

## 8. Contrôles qualité obligatoires

- unicité de l'identifiant interne et du mapping source ;
- absence de doublon joueur entre NBA, G League, free agents et prospects ;
- cohérence de l'affiliation au snapshot du 17 novembre 2026 avec le journal des transactions ;
- âge calculé à partir de la date de naissance et du snapshot, jamais saisi manuellement ;
- conversions d'unités reproductibles ;
- `FGM <= FGA`, `3PM <= 3PA`, `3PM <= FGM`, `3PA <= FGA`, `FTM <= FTA` ;
- minutes, matchs et titularisations cohérents ; `GS <= G` ;
- totaux cohérents avec les lignes par match à l'arrondi près ;
- séparation saison régulière / Play-In / playoffs ;
- champs manquants et contradictions explicitement signalés ;
- attributs compris entre 1 et 100 et associés à une version de modèle ;
- statistiques agrégées multi-équipes vérifiées par rapport aux lignes par équipe.

## 9. Apparence et droits

Les illustrations et modèles 3D doivent être originaux. Ne pas intégrer de portrait photographique, scan facial, tatouage reproduit, signature, voix ou asset tiers sans provenance et autorisation appropriées. La ressemblance identifiable d'un joueur réel peut soulever des questions de droits de la personnalité, de publicité, de marques et de conditions d'utilisation des bases de données. Une revue juridique est requise avant toute diffusion publique ou commerciale.

## 10. Schéma logique indicatif

```ts
type DataStatus = "verified" | "derived" | "estimated" | "missing" | "conflicting" | "unverified";
type Confidence = "high" | "medium" | "low" | "unverified";
type CompetitionType = "regular-season" | "play-in" | "playoffs" | "summer-league";

interface Player {
  id: string;
  fictionalDisplayName: string;
  fictionalInitials: string;
  playerKind: "real-mirror" | "generated";
  birthDate?: string | null;
  ageAtSnapshot?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  sourcePosition?: string | null;
  primaryPosition?: "PG" | "SG" | "SF" | "PF" | "C" | null;
  secondaryPositions?: Array<"PG" | "SG" | "SF" | "PF" | "C">;
  sourceIds: Array<{ provider: string; id: string; url?: string }>;
  referenceMapping?: {
    sourcePlayerName: string;
    referenceFranchiseId?: string;
    snapshotDate: string;
    rightsReviewStatus: "not-reviewed" | "review-required" | "cleared" | "redesign-required";
  };
}

interface PlayerSeasonStatLine {
  playerId: string;
  season: "2025-2026";
  competition: CompetitionType;
  teamId?: string | null;
  games: number | null;
  gamesStarted: number | null;
  minutes: number | null;
  points: number | null;
  reboundsOffensive: number | null;
  reboundsDefensive: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  personalFouls: number | null;
  fieldGoalsMade: number | null;
  fieldGoalsAttempted: number | null;
  threePointersMade: number | null;
  threePointersAttempted: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempted: number | null;
  plusMinus?: number | null;
  provider: string;
  sourceId: string;
  sourceDefinitionVersion?: string;
}

interface PlayerAttributeSet {
  playerId: string;
  modelVersion: string;
  evaluatedAt: string;
  attributes: Record<string, number>;
  confidenceByAttribute: Record<string, Confidence>;
  evidenceSourceIds: string[];
}

interface PlayerRosterStatus {
  playerId: string;
  franchiseId?: string | null;
  status: "standard-contract" | "two-way" | "draft-rights" | "free-agent" | "waived" | "g-league" | "prospect" | "retired" | "other";
  validFrom: string;
  validTo?: string | null;
  snapshotVersion: string;
  sourceId: string;
}
```

Ce schéma est un contrat logique de départ, pas encore le schéma Prisma définitif. Les contrats financiers, options, garanties, exceptions et cap hits seront détaillés dans un modèle contractuel distinct, fondé sur le CBA et les règles de chaque saison.

## 11. Critères de validation d'une fiche

Une fiche n'est pas « complète » parce qu'elle possède un nombre dans chaque champ. Elle est intégrable lorsque :
- l'identité source et le mapping fictif sont traçables ;
- le statut et l'affiliation au snapshot sont vérifiés ;
- les données physiques et statistiques disponibles sont sourcées ;
- les données absentes sont explicitement marquées ;
- les attributs estimés sont produits par un modèle versionné et documenté ;
- les contrôles qualité passent ;
- le statut de revue des droits est renseigné.

Les joueurs qui ne remplissent pas ces critères restent en file de validation et ne doivent pas être présentés comme des fiches vérifiées.


## 12. Effectifs soumis et approuvés pour 2026-2027

Les effectifs 2026-2027 fournis par l'utilisateur et approuvés franchise par franchise sont enregistrés dans `data/rosters/2026-27/` : 523 joueurs, 17 ou 18 par franchise. Cette approbation valide la transcription dans Basket Legends, mais ne constitue pas une vérification officielle des affiliations NBA, contrats ou statuts. Les champs `ratings`, `attributes` et `notes` sont remplis depuis le 18 novembre 2026 avec des valeurs provisoires, alignées pour la plupart sur NBA 2K27 ; ils seront remplacés par le modèle v1 et les notes 2K seront sorties du dépôt (tranche 0). Les mensurations conservent leurs valeurs impériales sources et leurs conversions métriques ; l'interface peut afficher cm/kg ou pieds-pouces/livres sans modifier les données de référence.

