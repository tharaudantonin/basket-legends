# Sources et méthode — Basket Legends

## 1. Snapshot de référence

Snapshot de départ validé : **saison 2025-2026, arrêté au 30 juin 2026**. La carrière commence à l'intersaison 2026 et se poursuit vers 2026-2027.

Le snapshot administratif (franchise, statut, droits, contrats et transactions) doit être arrêté à un horodatage explicite en Eastern Time. Les statistiques sont collectées séparément pour la saison régulière, le Play-In et les playoffs. Une statistique de saison complète ne doit pas être confondue avec l'état administratif du joueur au 30 juin.

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
