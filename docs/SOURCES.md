# Sources et méthode — Basket Legends

## 1. Snapshot de référence

Snapshot validé le 23 novembre 2026 : **effectifs 2026-2027 arrêtés au 17 novembre 2026** (`data/rosters/2026-27/`) ; **statistiques de la saison 2025-2026 terminée** pour calibrer les notes ; la carrière démarre en 2026-2027.

Le snapshot administratif (franchise, statut, droits, contrats et transactions) est arrêté au 17 novembre 2026 en Eastern Time. Les statistiques sont collectées séparément pour la saison régulière, le Play-In et les playoffs. Une statistique de saison complète ne doit pas être confondue avec l'état administratif du joueur au snapshot.

## 2. Hiérarchie des sources

1. **NBA.com / NBA Stats** : statistiques officielles, profils, rosters historiques lorsqu'ils sont disponibles, transactions et définitions des indicateurs.
2. **NBA / NBPA** : CBA, règles contractuelles et documents officiels.
3. **Guides médias et sites officiels des franchises** : mensurations, bios, affiliations et informations historiques.
4. **Bases statistiques reconnues** (Basketball-Reference, etc.) : recoupement, historique, agrégats, transactions et métriques avancées ; conserver le nom du fournisseur et sa définition.
5. **Presse sportive fiable** : contexte, blessures, mouvements et informations non disponibles dans les sources primaires.
6. Wikipédia : index de recherche uniquement, jamais source finale unique pour une donnée intégrée.

## 3. Références de départ

- NBA Stats — statistiques traditionnelles 2025-2026 : https://www.nba.com/stats/players/traditional?Season=2025-26&SeasonType=Regular%20Season
- NBA Stats — glossaire et définitions : https://www.nba.com/stats/help/glossary
- NBA.com — joueurs et rosters, avec filtre historique : https://www.nba.com/players
- NBA.com — transactions : https://www.nba.com/players/transactions
- NBA.com — suivi des transactions de l'intersaison 2026 : https://www.nba.com/news/2026-offseason-trade-tracker
- NBPA — CBA en vigueur : https://www.nbpa.com/cba
- Basketball-Reference — statistiques 2025-2026 par match : https://www.basketball-reference.com/leagues/NBA_2026_per_game.html
- Basketball-Reference — statistiques 2025-2026 totales : https://www.basketball-reference.com/leagues/NBA_2026_totals.html
- Basketball-Reference — statistiques 2025-2026 avancées : https://www.basketball-reference.com/leagues/NBA_2026_advanced.html
- Basketball-Reference — transactions 2025-2026 : https://www.basketball-reference.com/leagues/NBA_2026_transactions.html

Les sources secondaires sont des instruments de recoupement, pas des substituts automatiques aux données officielles. Les pages dynamiques peuvent évoluer : conserver un export daté ou un relevé de la donnée collectée, lorsque les conditions d'utilisation le permettent.

## 4. Provenance obligatoire

Chaque import doit conserver au minimum :
- identifiant stable de la source et URL ;
- organisme/fournisseur et titre de la ressource ;
- date de consultation et, si disponible, date de publication ;
- saison, période, compétition et périmètre ;
- identifiant du joueur ou de la franchise chez le fournisseur ;
- nom du champ, valeur brute, unité et définition ;
- méthode de transformation et version de la formule ;
- statut de vérification et niveau de confiance ;
- conditions d'utilisation/licence à examiner.

Ne pas copier une base complète depuis un fournisseur tiers sans vérifier les conditions d'accès, de réutilisation et de redistribution. La disponibilité publique d'une page ne signifie pas que son extraction ou sa redistribution commerciale est autorisée.

## 5. Règles de cohérence

- Les totaux sont la base des agrégats ; les moyennes sont recalculées et comparées à la source.
- Les statistiques saison régulière, Play-In et playoffs restent séparées.
- Les lignes par équipe et les totaux multi-équipes restent identifiables.
- Les données officielles et les données secondaires ne sont pas fusionnées sans traçabilité.
- Les champs manquants restent inconnus.
- Les statistiques ne sont jamais converties directement en attributs de jeu sans modèle documenté.
- Toute correction crée un nouvel import/version ; elle ne modifie pas les snapshots de carrières existantes.

## 6. CBA et données contractuelles

Le CBA 2023 NBA-NBPA est la référence juridique/contractuelle de base pour la période du snapshot, sous réserve de vérifier les dispositions applicables à chaque saison et leurs mises à jour. Les montants de salary cap, tax, aprons, minimums et exceptions doivent être stockés dans une table de paramètres versionnée par saison. Les statistiques sportives et le CBA sont deux familles de sources distinctes.


## 7. Sources éditoriales complémentaires — saison 2026-2027

Ces références sont utiles pour la découverte des joueurs, la lecture des effectifs, le contexte des transferts, les rôles probables et le recoupement éditorial. Elles ne remplacent pas les sources officielles pour les statistiques, les transactions ou les statuts contractuels.

- L'Équipe, Guide NBA 2026-2027 : https://www.lequipe.fr/collection/guide-nba-2026-2027/ — collection de présentations franchise par franchise, avec analyses d'effectifs, arrivées/départs et enjeux sportifs. La page de collection est indexée par le moteur de recherche, mais l'accès direct automatisé peut être refusé. Utiliser les articles de la collection lorsqu'ils sont accessibles.
- BeBasket, Joueurs NBA 2026-2027 : https://www.bebasket.fr/ligue/nba/joueurs — répertoire de joueurs classés par équipe ; la page consultée annonce couvrir les effectifs de camp d'entraînement et recense 660 joueurs distincts sur les 30 équipes.

**Limites d'usage :** ces deux sources décrivent la saison 2026-2027. Elles peuvent servir à vérifier les affiliations au snapshot du 17 novembre 2026 et à enrichir les notes de scouting éditoriales, mais pas à intégrer une transaction postérieure au snapshot. Les effectifs de camp d'entraînement peuvent inclure des joueurs qui ne figurent pas dans l'effectif final de saison. Toute donnée de joueur intégrée au jeu doit être recoupée avec une source primaire et porter une provenance explicite. Les commentaires, pronostics et appréciations éditoriales ne sont pas des attributs objectifs : ils peuvent inspirer une note de scouting, mais ne doivent pas être convertis automatiquement en notes de jeu.

## 8. Notes de jeux vidéo et bases tierces (décision du 24 novembre 2026)

Les notes de NBA 2K (relevées par exemple sur 2KRatings) ne sont pas une source de données du jeu. Elles servent uniquement de banc d'essai privé pour mesurer l'écart du modèle de notes de Basket Legends : elles sont conservées hors du dépôt, dans `C:\Users\thara\Projets\basket-legends-prive\`, et ne sont jamais livrées dans le jeu. Les valeurs `notes.nba2k27` encore présentes dans les effectifs seront retirées du dépôt à la tranche 0.

Les statistiques 2025-2026 de calibration sont relevées sur NBA.com ou Basketball-Reference, dans le respect de leurs conditions d'utilisation, avec la provenance exigée au § 4.

## 9. Relevé des statistiques 2025-2026 (24 novembre 2026)

Fait le 24/11/2026 dans le navigateur, page par page (pas d'extraction automatisée en masse), pour un usage privé de calibration :

| Compétition | Fournisseur | Page | Joueurs de l'effectif |
|---|---|---|---|
| Saison régulière 2025-26 | Basketball-Reference | https://www.basketball-reference.com/leagues/NBA_2026_totals.html | 441 |
| Play-In 2026 | NBA.com / NBA Stats | https://www.nba.com/stats/players/traditional?Season=2025-26&SeasonType=PlayIn&PerMode=Totals | 86 |
| Playoffs 2026 | Basketball-Reference | https://www.basketball-reference.com/playoffs/NBA_2026_totals.html | 207 |
| Saison régulière 2024-25 (joueurs absents en 2025-26) | Basketball-Reference | https://www.basketball-reference.com/leagues/NBA_2025_totals.html | 8 |
| Draft 2026 | Basketball-Reference | https://www.basketball-reference.com/draft/NBA_2026.html | 53 |
| Moyennes de la ligue | Basketball-Reference | https://www.basketball-reference.com/leagues/NBA_2026.html et `NBA_2026_standings.html` | — |

Basketball-Reference ne publie pas de totaux séparés du Play-In : ils viennent de NBA.com. Le rattachement aux identifiants du jeu se fait par le nom réel normalisé, hors du dépôt ; chaque transcription a été contrôlée par une somme de contrôle sur toutes les colonnes. Résultat dans `data/statistiques/2025-26/` (sources, date, unité et définition de chaque champ) ; détail et usage : `docs/NOTES_JOUEURS.md`. Les conditions de réutilisation de Basketball-Reference et de NBA.com restent à examiner avant toute publication (porte de publication).

Règlement : `data/regles/nba-2026-27.json` vérifié le 24/11/2026 contre les pages des règles 3, 5, 6, 7, 9 et 12 de https://official.nba.com/rulebook/ (édition 2026-27) et la page « 2026-27 Points of Emphasis ».

## 10. Structure de la saison 2026-27 (24 novembre 2026)

`data/ligue/saison-2026-27.json` : chaque bloc porte sa source, sa date de consultation et son niveau. Primaires (NBA.com) : alignement des divisions (https://www.nba.com/standings?Season=2025-26), dates et 82 matchs (https://www.nba.com/news/2026-27-nba-regular-season-schedule), formule du calendrier (https://www.nba.com/news/5-schedule-takeaways-2023-24-schedule), Play-In (https://www.nba.com/news/nba-play-in-tournament), départages (page des classements), vote du All-Star Game (https://pr.nba.com/2026-nba-all-star-game-starters-voting-results). Secondaires, à recouper avec une source officielle avant publication : format des playoffs (Sports Illustrated, Ticketmaster) et règle des 65 matchs (Yahoo Sports, Hoops Rumors). Détail : `docs/SAISON.md` § 2.

## 11. CBA et contrats 2026-27 (24 novembre 2026)

Relevés le 24/11/2026 dans le navigateur, page par page, pour un usage privé ; détail et règles de rattachement : `docs/CONTRATS.md`.

| Données | Fournisseur | Page | Niveau |
|---|---|---|---|
| Plafond, taxe, aprons, masse minimale, mid-levels 2026-27 | NBA Communications | https://pr.nba.com/2026-27-salary-cap/ | primaire |
| Salaires maximum 2026/27 | Hoops Rumors | https://www.hoopsrumors.com/2026/06/nba-maximum-salaries-for-2026-27.html | secondaire |
| Salaires minimum 2026/27, minimum imputé des vétérans | Hoops Rumors | https://www.hoopsrumors.com/2026/07/nba-minimum-salaries-for-2026-27.html | secondaire |
| Exception bi-annuelle | Hoops Rumors | https://www.hoopsrumors.com/2026/07/values-of-2026-27-mid-level-bi-annual-exceptions.html | secondaire |
| Contrats two-way (liste au 21/11/2026, règles) | Hoops Rumors | https://www.hoopsrumors.com/2026/07/2026-27-nba-two-way-contract-tracker.html | secondaire |
| Barème de la taxe de luxe, récidivistes, taxe par équipe | SalarySwish | https://www.salaryswish.com/luxury-tax/2027 | secondaire |
| Masse et plafond strict de chaque équipe ; historique des plafonds | SalarySwish | https://www.salaryswish.com/ et https://www.salaryswish.com/salary-cap/2027 | secondaire |
| Contrats des joueurs (salaires, options, garanti) | Basketball-Reference | https://www.basketball-reference.com/contracts/players.html | secondaire |
| Première saison NBA et draft des joueurs | NBA.com | https://www.nba.com/players | primaire |

Le texte de la CBA 2023 (https://www.nbpa.com/cba) n'a pas été relu pour cette tranche : les barèmes secondaires sont à recouper avec lui avant publication, comme les conditions de réutilisation de chaque fournisseur (porte de publication).

## 12. Draft (24 novembre 2026)

Relevés pour la tranche 7 ; détail, statuts et écarts : `docs/DRAFT.md` § 2.

| Données | Fournisseur | Page | Niveau |
|---|---|---|---|
| Loterie 3-2-1 (Drafts 2027-2029) | NBA Communications | https://pr.nba.com/nba-board-of-governors-approves-new-draft-lottery-system-to-address-tanking/ (28/05/2026) | primaire |
| Fonctionnement de la loterie 2027, résultats 2026 | NBA.com | https://www.nba.com/news/nba-draft-lottery-explainer (03/11/2026) | primaire |
| Résultat de la loterie 2025 | NBA.com | https://www.nba.com/news/2025-nba-draft-lottery-result | primaire |
| Propriété des choix 2027 | RealGM | https://basketball.realgm.com/nba/draft/future_drafts/summary/2027 et https://basketball.realgm.com/nba/draft/future_drafts/detailed | secondaire |
| Échelle des rookies 2026 (120 %) | Hoops Rumors | https://www.hoopsrumors.com/2026/07/rookie-scale-salaries-for-2026-nba-first-round-picks.html | secondaire |
| Dates de naissance des 74 joueurs sans statistiques (effectifs 2026-27) | Basketball-Reference | https://www.basketball-reference.com/teams/<ÉQUIPE>/2027.html (30 pages, relevé brut hors du dépôt) | secondaire |
| Échelle des rookies 2025 (recoupement de la croissance) | Hoops Rumors | https://www.hoopsrumors.com/2025/07/rookie-scale-salaries-for-2025-nba-first-round-picks.html | secondaire |

Non relevé : la table officielle des probabilités de la loterie 3-2-1 (PDF de la NBA, lecture automatique refusée) ; Antonin la fournit (réponse 13). Les âges de saison (`seasonAge`) viennent du relevé du § 9 (convention de Basketball-Reference, âge au 1er février) ou des dates de naissance ci-dessus. Le modèle des prospects, le scouting et le vivier ne reposent sur aucune source : ce sont des choix du modèle.
