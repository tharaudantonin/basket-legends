# Marché — tranche 9 (25 novembre 2026)

> Statut : **implémenté et testé**. Échanges, free agency par journées, IA des GM, staff, délégations, composition par le GM, économie pluriannuelle. Décisions appliquées : réponses 24 à 45 de `docs/DECISIONS_2026-11.md` (« Tout en (a) »). Les règles de la CBA sont **sourcées** (Hoops Rumors, NBA.com, RealGM, NBC Sports, Yardbarker ; sources secondaires à recouper avec le texte de la CBA avant publication) ; les modèles `data/modeles/marche-v1.json` et `staff-v1.json` sont des **propositions** à valider par Antonin.

## 1. Ce que fait la tranche 9

- **Échanges** entre équipes, toute la saison régulière jusqu'à la date limite et pendant l'intersaison : légalité selon la CBA, avis de l'IA avec ses raisons, contre-proposition (« Qu'est-ce qu'il vous faudrait ? »), choix de Draft échangeables sur sept ans.
- **Free agency par journées** : options, offres qualificatives, droits de Bird, agents libres restreints et droit de s'aligner, offres concurrentes de l'IA, réponses typées des agents, camp.
- **IA des GM** : stratégie (prétendant, playoffs, transition, reconstruction), personnalité (patience, aversion pour la taxe), achats, délestages sous la taxe, propositions au GM du joueur.
- **Staff** de chaque franchise (entraîneur, développement, recrutement, médical) aux effets bornés et de moyenne nulle ; l'entraîneur fixe le plan de jeu de son équipe.
- **Délégations** (« je décide », « le staff propose », « le staff décide ») pour la Draft, les agents libres, les prolongations, les échanges, la rotation ; **composition** (cinq de départ et rotation) par le GM.
- **Économie pluriannuelle** : plafond 2027-28 estimé, croissance ensuite bornée par le lissage, aprons et exceptions indexés, argent mort et étalement sur plusieurs saisons.
- **Écrans** (fonctionnels et sobres, réponse 20) : Bureau, Free agency / Joueurs libres, Échanges, Staff et composition, Transactions.

Code : `packages/league/src/marche/` (`valeur`, `plafond`, `operations`, `echanges`, `ia`, `agents`, `staff`, `personnalite`, `mesures`, `gm`) ; intersaison en phases dans `packages/league/src/carriere/intersaison.ts`. Écrans : `apps/web/src/ecrans/Marche.tsx`.

## 2. Données (migration `tools/migrations/2026-11-25-tranche9-marche.ts`)

| Fichier | Contenu | Sources |
|---|---|---|
| `data/cba/nba-2026-27.json` (nouveaux paramètres) | Correspondance des salaires : 200 % + 250 000 $ ou + marge (7,5 M$ en 2023-24 indexée : 9,096 M$ en 2026-27), 125 % + 250 000 $, 100 % au-delà d'un apron ; agrégation interdite au-delà du second apron ; Bird 3 saisons, Early Bird 2 ; durées 5 / 4 ans ; hausses 8 % / 5 % ; Early Bird 175 %, Non-Bird 120 % ; offre qualificative (135 % ou minimum + 200 000 $ ; rookies 140 % à 160 %) ; deux jours pour s'aligner ; ballottage 48 h ; étalement 2 × saisons + 1 ; choix sur 7 ans, règle Stepien, gel à 7 ans ; 3 mois ou 15 décembre après une signature ; lissage 10 % ; estimation 2027-28 (176 M$, taxe 213 M$). | Hoops Rumors (glossaire 2024-2026), NBA.com (primaire : free agency, deux jours), RealGM (lissage), NBC Sports (estimation 2027-28), Yardbarker (trois mois) |
| `data/ligue/transactions-2026-27.json` | Dates 2026-27 (négociations 30/06, signatures 06/07, contrats garantis 10/01, date limite 11/02/2027, ballottage pour la phase finale 01/03) ; volumes 2025-26 : 58 échanges (Draft 2025 → date limite), 212 signatures standard. | NBA.com (primaire), Basketball-Reference (comptage automatique) |
| `data/draft/choix-2028.json` à `choix-2033.json` | Propriété des choix : échanges, protections, droits d'échange de rang, dettes reportées (« si le choix n'a pas déjà été transmis » : champ `cas`), choix confisqués (Clippers 2029-2033, Indiana 2029), choix gelés (BOS, MIN, PHX 2032 ; CLE 2033). Les montages les plus complexes sont simplifiés et notés dans `ecarts`. | RealGM, pages de synthèse (secondaire, à recouper) |
| `data/contrats/2026-27.json` (`saisonsAvecEquipe`) | Horloge de Bird au début de 2026-27 : saisons avec l'équipe sans en changer comme agent libre (un échange ne la remet pas à zéro). 495 relevées (équipes 2024-25 et 2025-26, échanges de 2025 et 2026 de Basketball-Reference ; rookies : saisons depuis leur Draft), 28 approximées (joueurs sans statistique en 2025-26). Relevés bruts dans `basket-legends-prive/anciennete-2026-27/`. | Basketball-Reference |
| `data/modeles/marche-v1.json` | Modèle du marché (§ 3 à 6), statut **proposition**. | Salaire de marché calé sur les contrats 2026-27 ; le reste : choix du modèle |
| `data/modeles/staff-v1.json` | Modèle du staff (§ 7), statut **proposition**. | Choix du modèle |

Validations du 25/11/2026 (réponse 26) : `notes-v2.json`, `modele-draft.json`, `vivier/2026-27.json`, `carriere-v1.json` et les noms des villes d'accueil passent au statut `valide` (`tools/migrations/2026-11-25-tranche9-validations.ts`, idempotente).

## 3. Valeur des joueurs et des choix (`valeur.ts`)

- **Salaire de marché** = part du plafond selon la note, calée sur les **moyennes des contrats 2026-27 des vétérans** (328 contrats hors échelle des rookies) : 2,2 % à 62, 4,1 % à 71, 7,1 % à 75, 16,5 % à 79, 24,5 % à 83, 30 % à 89, 35 % à 92 (lissé pour rester croissant), borné par le minimum et le maximum de l'ancienneté. Les médianes, d'abord retenues, sont plus basses en bas d'échelle (salaires asymétriques) : la masse salariale de la ligue s'érodait (0 à 2 équipes à la taxe après quelques saisons).
- **Valeur d'une saison** = salaire de marché × prime des stars (+6 % par point au-delà de 80 : le maximum empêche de les payer à leur valeur).
- **Valeur d'un joueur** sur 3 saisons : valeur − salaire sous contrat, puis 50 % de l'écart après le contrat (droits de Bird), actualisés à 0,85 par an ; la note suit l'évolution moyenne du modèle de carrière.
- **Force d'une équipe** = moyenne pondérée de ses neuf meilleures notes (1 ; 0,95 ; … ; 0,25). Un point de force vaut 12 M$ par saison (choix du modèle).
- **Valeur d'un choix** selon le rang attendu (de 30 M$ au 1er choix à 0,3 M$ au 60e), actualisée de 10 % par an et ramenée vers le milieu du tour de 20 % par an (incertitude).

## 4. Échanges (`echanges.ts`)

**Légalité** (`verifierEchange`) : échanges ouverts (intersaison, ou saison régulière avant la date limite) ; joueurs sous contrat avec l'équipe qui les cède ; délai après la signature d'un agent libre ; salaires reçus au plus le maximum autorisé selon la **masse après l'échange** (sous le plafond + 250 000 $ : libre ; entre le plafond et le premier apron : le plus grand de min(200 % + 250 000 $, + marge) et 125 % + 250 000 $ ; au-delà : 100 %) ; pas d'agrégation au-delà du second apron ; plafond strict ; 15 contrats standard et 3 two-way au plus ; choix détenus, dans les sept Drafts échangeables, non gelés, règle Stepien. Chaque refus est expliqué.

**Avis de l'IA** (`evaluerEchange`) : utilité = poids du présent × 12 M$ × écart de force + poids de l'avenir × (0,5 + patience) × écart de valeur future + ½ × écart de valeur de la saison − aversion × écart de taxe de luxe. L'équipe accepte si l'utilité dépasse 5 % de ce qu'elle cède. Raisons affichées (« Nous reconstruisons : nous voulons des jeunes et des choix », « La taxe de luxe nous coûterait… », montant manquant). Un GM qui a refusé trois propositions du joueur dans la saison ne discute plus.

**Contre-proposition** (`ceQuIlFaudrait`) : ajoute, pour le joueur, l'actif qui améliore le plus l'utilité du partenaire tout en gardant l'échange légal, jusqu'à six fois.

**Rejeu à l'identique** : un échange en saison note l'effectif des deux équipes (et les numéros de maillot) à partir du match suivant (`EtatSaison.compositions`) ; un match déjà joué se rejoue avec l'effectif qu'il avait (testé : 797 matchs rejoués, aucune différence).

## 5. IA des GM (`ia.ts`)

- **Stratégie** selon le rang de force : prétendant (1-6 : présent 1,6, avenir 0,6), playoffs (7-14 : 1,1 / 0,9), transition (15-22 : 0,5 / 1,1), reconstruction (23-30 : 0,3 / 1,5).
- **Personnalité** du GM : patience tirée entre 0,3 et 0,9 ; aversion pour la taxe 0,7, ou 0,4 pour une équipe récidiviste (réponse 41 : héritée du miroir au snapshot, puis de la récidive dans la partie).
- **Achat** : un prétendant vise un joueur qui le renforce chez une équipe qui vend, compose une offre qui équilibre les salaires (et les effectifs), ajoute des jeunes ou des choix tant que le vendeur n'est pas convaincu.
- **Délestage** : une équipe au-delà de la taxe cède un contrat moyen ou gros (et, s'il le faut, un choix) à une équipe qui peut l'absorber.
- **Volume** : deux tentatives par jour de saison régulière jusqu'à la date limite, vingt par journée de free agency. Mesuré (10 saisons jouées) : 21 à 41 échanges par saison, contre 58 en 2025-26 ; l'écart vient surtout des échanges d'argent ou de seconds tours seuls, que le jeu ne simule pas.
- **Propositions au GM du joueur** : quatre par saison en moyenne, dans son bureau, avec l'avis de son staff. Avec la délégation « le staff décide », la franchise du joueur échange comme une équipe de l'IA (réponse 37).

## 6. Free agency par journées (`agents.ts`)

1. **Ouverture (journée 0)** : options sur la saison qui commence (option du joueur déclinée si son salaire de marché la dépasse ; option d'équipe sur l'échelle des rookies exercée sauf si le joueur est sous le niveau NBA, 60 ; autres options selon la valeur) ; contrats échus → agents libres avec les droits de Bird de leur équipe ; agents libres restreints si le staff tend l'offre qualificative (le joueur la vaut à 90 %) ; joueurs libres hors NBA notés 60 et plus, et joueurs en développement qui ont atteint 70. Le staff renonce aux droits des joueurs qui coûteraient plus qu'ils ne rapportent (« cap hold » libéré). Le GM du joueur peut, en journée 0, renoncer à des droits et tendre ou retirer une offre qualificative.
2. **Prolongations avant le marché** : la règle validée de la tranche 8 (`carriere-v1.json`, note 62 et plus, 38 ans au plus, place dans l'effectif) est conservée pour les équipes de l'IA, mais **au salaire demandé** et seulement si le joueur accepte (fidélité + envie de gagner × force de l'équipe ≥ 50). Pour le GM du joueur : selon la délégation « prolongations » (le staff prolonge, propose dans le bureau, ou rien).
3. **Journées 1 à 10** : chaque équipe de l'IA offre la demande du jour aux joueurs qui lui rapportent le plus (valeur, gain de force selon sa stratégie, jeunes selon l'avenir, + 4 M$ pour garder son propre agent libre ; l'argent dépensé sous la **masse minimale** de la CBA ne coûte rien, l'espace inutilisé sous le plafond compte pour 20 % de son prix ; durée choisie pour maximiser la valeur, d'où des contrats courts pour les vétérans en déclin), avec un moyen de la CBA (droits de Bird, espace salarial moins les cap holds, mid-level et bi-annuelle une fois par saison, minimum). Une équipe complète peut faire de la place pour un joueur meilleur de 8 points que son moins bon (coupé, argent mort). À la fin de la journée, chaque agent choisit la meilleure offre selon sa **personnalité** (argent, victoire, rôle, fidélité ; traits de personnage générés, réponse 35) si elle atteint 98 % de sa demande ; la demande baisse de 2,5 % par journée jusqu'à 75 % ; à la dernière journée, il accepte la meilleure offre d'au moins 35 % de sa demande (la mid-level d'un vétéran), et les équipes lui offrent ce qu'elles peuvent. Un agent libre restreint qui choisit une autre équipe signe une **feuille d'offre** : son équipe peut s'aligner jusqu'à la journée suivante (bureau du GM ; staff de l'IA : s'il vaut le contrat).
4. **Réponses typées** de l'agent à une offre du GM : invalide (motif CBA), refus (moins de 75 % de la demande), contre-proposition de salaire ou de durée, « mieux ailleurs », accord de principe.
5. **Camp** : les agents libres non signés passent hors NBA ; les équipes complètent leurs contrats standard au minimum avec les joueurs les plus prometteurs (note attendue dans deux saisons), puis leurs two-way ; au-delà du maximum, le moins bon est coupé.

Contrats signés : salaire de première saison, hausse annuelle, option éventuelle sur la dernière saison ; horloge de Bird conservée si le joueur reste, remise à zéro sinon ; date de signature (délai avant de pouvoir l'échanger).

## 7. Staff (`staff.ts`, `staff-v1.json`)

Quatre postes par franchise et 6 membres libres par poste ; noms originaux tirés des banques de noms du jeu ; compétences tirées (moyenne 60, écart-type 10, bornes 35-90). Effets **bornés et de moyenne nulle** (réponse 39), selon l'écart à 60 ramené entre −1 et 1 :

| Poste | Effet |
|---|---|
| Recrutement | Écart-type des rapports de scouting de la Draft × 0,85 à 1,15 |
| Médical | Durée des blessures × 0,85 à 1,15 |
| Développement | ± 0,2 point de progression par saison pour les joueurs de 25 ans au plus (0,5 proposé, réduit à 0,2 : au-delà, le nombre de joueurs à 80+ dépassait la fourchette de stabilité de la tranche 8) |
| Entraîneur principal | Plan de jeu de l'équipe (rythme, défense, part du tir à trois points) |

**Plans des entraîneurs** (réponse 40) répartis **en proportions exactes** sur les 30 équipes (rythme : 25 % lent, 50 % normal, 25 % rapide ; défense : 90 % individuelle, 10 % zone ; trois points : 25 / 50 / 25 %), pour que la calibration ne dépende pas du tirage. **Calibration revérifiée** : `npm run sonde 2000 -- --staff` (chaque équipe joue le plan de son entraîneur) sur 5 graines : 2 entièrement dans les fourchettes, 3 avec une mesure juste au bord (victoires à domicile 58,7 et 59,4 pour 58,4 ; interceptions 8,1 pour 8,1), effet de la sonde où chaque équipe rencontre toujours les mêmes adversaires. Sur des saisons complètes (3 graines), avec et sans plans : points 116,9-117,6 contre 116,9-117,3, interceptions et pertes identiques à 0,2 près : l'effet moyen se perd dans le bruit. Le GM change d'entraîneur (ou d'un autre membre) depuis le staff libre ; l'ancien rejoint le staff libre. Les salaires du staff ne sont pas encore gérés (finances : tranche 10).

## 8. Délégations et composition

Niveaux par domaine : « je décide », « le staff propose », « le staff décide » (sauf rotation : pas de « propose »). Par défaut : Draft « je décide », agents libres, prolongations et échanges « le staff propose », rotation « le staff décide ». Au pilote automatique (outils, tests, réponse 45), le staff décide de tout. Composition (réponse 38) : « Composer moi-même » fige l'ordre (cinq titulaires puis rotation) ; il s'applique dès le prochain match et se rejoue à l'identique ; un nouveau joueur s'ajoute en fin d'ordre.

## 9. Économie pluriannuelle (`plafond.ts`, `operations.ts`)

- Plafond et seuil de taxe 2027-28 : estimation de la NBA (176 M$, 213 M$) ; ensuite, croissance tirée chaque saison autour de 6,7 % (celle de l'estimation, choix du jeu), entre 0 et 10 % (lissage).
- Aprons : même croissance que le plafond (Hoops Rumors). Exceptions, minimums, maximums (25-30-35 % du plafond), masse minimale, two-way, marge d'échange : indexés sur le plafond (choix du jeu : la CBA les indexe, montants futurs non relevés).
- Argent mort par saison (`Univers.argentMort`) : coupe (salaires restants, ou étalés sur 2 × saisons + 1, la saison en cours restant sur son calendrier si la coupe a lieu en saison), joueurs coupés pour faire de la place.
- Ballottage : à la coupe, l'équipe au plus mauvais bilan qui a la place et l'espace (ou un contrat minimum) et qui veut le joueur reprend son contrat. Le délai de 48 heures est ramené à l'instant de la coupe.

## 10. Critère de sortie : 10 saisons au pilote automatique (réponses 43 et 45)

`npm run carriere 10 -- --matchs --marche` (environ 70 s) mesure chaque saison : contrats standard par équipe (13-15), équipes à la taxe (1-18 ; 16 au snapshot), masse moyenne rapportée au seuil de taxe (0,80-1,05 ; 0,99 au snapshot), au-delà du second apron (0-6), corrélation salaire-note des vétérans (≥ 0,5), meilleur joueur laissé libre (< 75), joueurs à 85+ dans une même équipe (≤ 4), Gini des forces (≤ 0,06), échanges (20-100) et signatures (80-320) de la saison écoulée. **Fourchettes choisies pour le jeu, non sourcées**, sauf la cible de volume (58 échanges, 212 signatures en 2025-26).

Résultats du 25/11/2026 (graine 2026, 10 saisons jouées) : effectifs 14-15 ; équipes à la taxe 16 → 3 à 9 ; **masse moyenne / seuil de taxe 0,99 → 0,76 à 0,91** (une saison à 0,76, sous la borne de 0,80) ; second apron 0 à 5 ; corrélation salaire-note 0,78-0,86 ; meilleur libre 71-73 (vétérans de 32-33 ans) ; 85+ au plus 4 ; Gini 0,012-0,023 ; signatures 128-181 ; échanges 17-45. Stabilité des notes de la tranche 8 avec les matchs : toutes les saisons dans leurs fourchettes ; 20 saisons accélérées : dans leurs fourchettes pour les graines 2026 (test), 7 et 99. **Dérive à signaler** : la masse salariale de la ligue baisse d'environ 12 % par rapport au seuil de taxe pendant les quatre premières saisons, puis se stabilise ; le snapshot (16 équipes taxées) est peut-être un point haut, mais c'est un point à valider.

Le test (`packages/league/tests/marche.test.ts`) joue 10 saisons accélérées et vérifie les mesures de structure (sans les volumes, qui demandent les matchs).

**Robot exploiteur** (test) : pour chacune des 29 autres équipes, le GM offre ses joueurs les moins bons, ses contrats les plus chers pour leur note, puis ajoute ses seconds tours, en équilibrant les salaires pour que l'échange soit légal, contre leur meilleur joueur : aucune de ces offres (plus de 20 légales) n'est acceptée.

## 11. Tests et parcours

`packages/league/tests/marche.test.ts` (21 tests) : paramètres de la CBA (marge, correspondance, plafond 2027-28, lissage, indexation) ; droits de Bird, maximums, offres qualificatives, horloge relevée ; choix 2028-2033 résolus sans détenteur provisoire, choix confisqués retirés, dette de Denver, choix gelés ; échange légal exécuté (horloge gardée, journal), refus motivés (salaires, Stepien, gel, date limite), rejeu après échange ; robot exploiteur ; contre-proposition légale et acceptée ; free agency (ouverture, réaction d'agent, intersaison complète conforme à la CBA et déterministe) ; saison avec marché (date limite, rejeu de tous les matchs) ; staff (effets bornés, préférences réparties, plans dans le contexte) ; critère de sortie ; sauvegarde en intersaison. Parcours Playwright : `apps/web/parcours/marche.spec.ts` (échange, contre-proposition, composition du GM, délégation, journal) ; `draft.spec.ts` passe désormais par la free agency.

## 12. Limites et points à valider

1. Modèles `marche-v1.json` et `staff-v1.json` (statut « proposition ») : valeur, stratégies, personnalité des GM, agents libres (fidélité, masse minimale et espace inutilisé, dernière journée), volumes de l'IA, effets du staff, répartition des plans, fourchettes du critère de sortie (dont la borne de 20 échanges, la taxe à 1-18 et la masse à 0,80-1,05).
2. Niveau de la masse salariale : baisse de 0,99 à environ 0,85 du seuil de taxe, puis stabilité (§ 10).
3. Règles non appliquées : 105 % du salaire moyen (Early Bird), cap holds exacts (190 % / 150 % / 300 % / 250 % selon le salaire précédent ; le jeu prend 150 % pour Bird), exceptions de joueur échangé (TPE) non simultanées, délai de deux mois avant d'agréger un joueur reçu, contrats de 10 jours et two-way en saison (tranche 10), primes, prolongations en cours de contrat, sign-and-trade, argent dans les échanges, protections choisies par le GM sur ses choix.
4. Approximations : horloge de Bird des coupés-resignés et de 2023-24 non relevées ; délai de signature des agents libres de l'été 2026 non relevé (aucun joueur du snapshot n'est bloqué jusqu'au 15 décembre) ; ballottage instantané ; les membres du staff ne sont pas payés.
5. Choix 2028-2033 : montages simplifiés (BKN-PHX-NYK-WAS 2028, droit d'échange CHA-MIN 2029-2030, choix « non précisés » de 2033) ; à recouper (porte de publication).
6. Volume d'échanges inférieur au réel (environ 30 contre 58).
