# Contrats et CBA — tranche 6 (24 novembre 2026)

> Statut : **implémenté et testé**. Paramètres de la CBA 2026-27 sourcés ; contrats des 523 joueurs relevés ; masse salariale, taxe de luxe, exceptions, contrôle des signatures et des effectifs. Critère de sortie (`docs/AUDIT_2026-11.md` § 7, « contrôles du cap passent ») : les 30 équipes passent les contrôles, et la taxe calculée retrouve au dollar près la taxe publiée de chaque équipe.

## 1. Données

| Fichier | Contenu | Sources |
|---|---|---|
| `data/cba/nba-2026-27.json` | Plafond, seuil de taxe, aprons, masse minimale, trois mid-levels (communiqué NBA du 30/06/2026) ; exception bi-annuelle ; maximums par ancienneté (25, 30, 35 % du plafond, vérifié par `npm run verifier`) ; barème des minimums ; minimum imputé d'un vétéran signé un an ; contrats two-way (salaire, 50 matchs, pas de phase finale) ; 15 contrats standard et 3 two-way ; barème de la taxe de luxe. | Primaire : NBA Communications. Secondaires : Hoops Rumors, SalarySwish (à recouper avec le texte de la CBA avant publication). |
| `data/contrats/2026-27.json` | Pour chaque joueur (`j0001`…) : type (standard, two-way, non relevé), salaires par saison avec option du joueur ou de l'équipe, montant garanti, ancienneté, draft. Pour chaque équipe : masse publiée, taxe publiée, récidiviste, plafond strict déjà déclenché, et « autres charges » (masse publiée moins la somme des contrats de l'effectif). | Basketball-Reference (contrats), Hoops Rumors (two-way, mis à jour le 21/11/2026), NBA.com (première saison, draft), SalarySwish (situation des équipes), relevés le 24/11/2026. |

Relevés faits dans le navigateur, page par page ; les fichiers bruts (vrais noms) sont dans `basket-legends-prive/contrats-2026-27/` ; la transcription est contrôlée par sommes de contrôle contre la page. `tools/migrations/2026-11-24-tranche6-contrats.ts` les rattache aux identifiants du jeu et écrit les deux fichiers (aucun nom réel dans le dépôt).

**Bilan :** 435 contrats standard, 88 two-way, aucun joueur sans contrat. Les 5 joueurs absents des deux sources (j0095, j0216, j0441, j0491, j0521) ont été corrigés le 24/11/2026 d'après les informations d'Antonin, salaires saison par saison recoupés sur les pages d'équipe de SalarySwish (bloc `CORRECTIONS` de la migration). 18 lignes de Basketball-Reference ne concernent aucun joueur du jeu (joueurs libérés : leur coût est dans les « autres charges » de l'équipe qui paie).

**Règles de rattachement :**
- un joueur libéré puis signé par sa franchise a deux lignes chez Basketball-Reference, qui y répète les salaires de l'ancien contrat ; on retient pour 2026-27 le montant garanti de la ligne de sa franchise (5 joueurs) ; la durée au-delà n'est pas relevée ;
- un joueur listé à la fois en standard (Basketball-Reference) et en two-way (Hoops Rumors) : two-way retenu quand SalarySwish le confirme (j0293 ; sinon son équipe aurait 16 contrats standard) ;
- ancienneté = saisons depuis la première saison NBA (NBA.com) : approximation des années d'expérience de la CBA, qui ne comptent que les saisons passées dans un effectif.

## 2. Le module `packages/league/src/cba.ts`

- **Masse salariale** = salaires 2026-27 des contrats standard de l'effectif + autres charges ; les two-way ne comptent pas. Elle redonne exactement la masse publiée de chaque équipe ; les contrats individuels en expliquent au moins 70 % (Memphis, avec beaucoup d'argent mort, est la plus basse).
- **Niveau salarial :** sous le plafond, au-dessus du plafond, de la taxe, du premier ou du second apron.
- **Taxe de luxe :** barème par tranches de 6,064 M$ (5 M$ indexés sur le plafond depuis 2024-25), taux 1,00 / 1,25 / 3,50 / 4,75 puis + 0,50 par tranche ; barème récidiviste 3,00 / 3,25 / 5,50 / 6,75. Testé contre les 30 taxes publiées (`packages/league/tests/cba.test.ts`).
- **Moyens de signer :** espace salarial et mid-level « espace » sous le plafond ; mid-level non contribuable et exception bi-annuelle sous le premier apron (elles le rendent strict) ; mid-level contribuable sous le second apron ; minimum toujours. Le montant de chaque exception est réduit pour ne pas franchir l'apron ou le plafond strict déjà déclenché. L'usage déjà fait des exceptions pendant l'intersaison n'est pas relevé : la liste donne des droits, pas des soldes.
- **Contrôle d'une signature** (`verifierSignature`) : place dans l'effectif (15 standard, 3 two-way), minimum et maximum de l'ancienneté, moyen auquel l'équipe a droit et son montant, minimum exact, minimum imputé d'un vétéran signé un an, plafond strict.
- **Contrôle d'une équipe** (`controlerEquipe`) : effectifs, plafond strict ; avertissements pour les contrats non relevés et une masse sous le minimum.

## 3. Dans la saison

- Les joueurs two-way ne jouent ni le Play-In ni les playoffs, ni plus de 50 matchs de saison régulière (matchs joués, faute de relevé des feuilles de match actives) ; ils sont notés absents du match, ce qui suffit à le rejouer à l'identique.
- En fin de saison, une actualité annonce les équipes qui paient la taxe de luxe et les montants (masse de fin de saison régulière ; aucune transaction n'est encore possible en cours de saison).

## 4. Interface

- Effectif : salaire 2026-27 ou contrat two-way de chaque joueur ; fiche du joueur : contrat (salaires, options, garanti, ancienneté, draft, minimum et maximum d'un nouveau contrat).
- Saison, onglet « Masse salariale » : situation de sa franchise et repères de la CBA avec la marge sur chacun, contrats par saison, autres charges, moyens de signer, contrôle d'une signature (pédagogique tant qu'il n'y a pas de joueur libre), masses des 30 équipes avec la taxe estimée et le plafond strict.
- Parcours Playwright : `apps/web/parcours/salaires.spec.ts`.

## 5. Anomalies et simplifications

- **Minnesota** est déclarée au plafond strict du premier apron par SalarySwish alors que sa masse publiée (214,9 M$) le dépasse : la source compte sans doute la masse « apron » autrement que le cap hit. La situation publiée est admise telle quelle (avertissement) ; toute hausse au-delà est refusée.
- La masse « apron » est assimilée au cap hit (SalarySwish montre de petits écarts entre les deux pour certaines équipes).
- Les autres charges de Miami (− 0,7 M$), Oklahoma City, Orlando, New Orleans et Brooklyn sont légèrement négatives : écarts entre salaire et montant imputé (minimums de vétérans) ou mise à jour d'une source entre deux relevés.
- Pas encore : échelle des rookies et droits de Bird (Draft en tranche 7, free agency en tranche 8), échanges et correspondance des salaires (tranche 8), options exercées et fin des contrats (tranches 8-9), primes, contrats de 10 jours, exception pour joueur blessé, prolongations, étalement des salaires libérés.
- Les estimations de la NBA pour 2027-28 et au-delà (plafond 174 M$, etc., relevées chez SalarySwish) ne sont pas encore intégrées : elles serviront au passage à la saison suivante.
