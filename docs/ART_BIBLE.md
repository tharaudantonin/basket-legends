# Art Bible — Basket Legends

## Positionnement
Simulation sportive réaliste, premium et contemporaine. Interface desktop-first de management, dense mais lisible, avec une hiérarchie de données proche d'un centre de commandement sportif.

## Statut de la direction artistique
Les directions créatives des 30 franchises ont été arbitrées et validées dans les sessions de conception du 17 novembre 2026. Les dossiers individuels sont les références de production. Cette validation porte sur les concepts et spécifications ; elle ne signifie pas que les logos vectoriels, maillots rendus, terrains ou habillages d'arène sont déjà produits.

## Système d'identité des franchises
Chaque franchise reçoit :
- logo principal, logo secondaire, monogramme et wordmark ;
- palette officielle documentée en HEX ;
- typographies et motifs secondaires ;
- maillots Association, Icon, Statement et City Edition ;
- terrain, arène et éléments d'habillage UI.

Les logos doivent être des emblèmes de franchises sportives professionnelles : mascotte stylisée, symbole territorial, monogramme ou écusson. Ils doivent être originaux et ne jamais copier les logos, mascottes, wordmarks, silhouettes ou compositions des équipes réelles.

## Maillots — règles non négociables
- Chaque col est constitué d'une seule couleur unie.
- Aucun col bicolore, dégradé, liseré contrastant ou mélange de couleurs.
- Le col reste visuellement séparé des emmanchures et panneaux latéraux.
- La coupe et le langage graphique restent cohérents entre les quatre tenues d'une franchise.
- Les numéros et wordmarks doivent rester lisibles à distance et en miniature.
- Les motifs latéraux sont autorisés s'ils ne dégradent pas la lisibilité ni la règle du col.

## Palette et cohérence
- Les codes HEX sont définis dans le registre canonique `data/franchises.json`.
- Une couleur validée ne peut pas être modifiée sans arbitrage explicite.
- Les 30 palettes sont désormais transcrites et validées dans le registre canonique.
- Les contrôles de contraste, de daltonisme, de lisibilité en niveaux de gris et de différenciation des maillots Icon doivent précéder la production finale.

## Boston Beacons
Palette validée : Harbor Green `#0F4B3A`, Warm Ivory `#F2EFE5`, Antique Brass `#B69A62`, Ink Charcoal `#1D2523`. Le concept validé est un roundel historique sobre avec phare géométrique minimal et typographie rétro ; les détails inutiles sont exclus. Les cols des quatre tenues sont unis.

## Washington Capitals
Concept de basketball original : monument abstrait, étoile et géométrie civique. Le maillot Icon navy comporte des étoiles blanches répétées sur les deux panneaux latéraux. Ne reprendre aucun actif de la franchise NHL Washington Capitals. Le nom exige une revue juridique prioritaire avant publication commerciale.

## Sacramento Diggers, Milwaukee Stags et Utah Desert Raptors
Les dossiers individuels sont désormais définitifs :
- Sacramento : California Gold, logo The Golden Nugget (C), Heritage-modern, maillots Classic.
- Milwaukee : Great Lakes Heritage, logo The Great Stag (A), Heritage-modern, maillots Heritage.
- Utah : Red Rock Flight, logo The Raptor Flight (B), Modern, maillots Modern.

## Palettes désormais gelées — neuf franchises

Les neuf palettes suivantes ont été explicitement approuvées le 17 novembre 2026. L'ordre est : principale, secondaire, accent, sombre.

| Franchise | Principale | Secondaire | Accent | Sombre |
|---|---|---|---|---|
| New York Skyliners | Skyline Blue `#2878A5` | Urban White `#F1F3F4` | Metro Silver `#AEB8C2` | Night Graphite `#252D35` |
| Philadelphia Founders | Founders Parchment `#E7DDC8` | Liberty Brick `#A64B3C` | Colonial Navy `#293B50` | Ink Black `#252525` |
| Detroit Cylinders | Industrial Charcoal `#343B43` | Foundry Steel `#A7B0B8` | Volt Yellow `#D6E342` | Machine White `#F0F1ED` |
| Indianapolis Racers | Racing Blue `#2455A4` | Victory Gold `#D5A63C` | Track White `#F2F0E9` | Asphalt Black `#252A30` |
| Orlando Comets | Cosmic Purple `#5C4B91` | Stardust Silver `#C5C8D2` | Nebula Blue `#344E78` | Space White `#F1F0F5` |
| Washington Capitals | Capital Navy `#0B2D5B` | Capitol Red `#C43D45` | Federal White `#F4F3EF` | Monument Silver `#AEB7C2` |
| Denver Summit | Summit Ice `#8EC5D4` | Alpine Granite `#59636F` | Peak Navy `#26384B` | Snow White `#F1F4F3` |
| Minnesota Borealis | Borealis Teal `#2D8B83` | Aurora Mint `#A8D6C2` | Midnight Blue `#202C3A` | Arctic Ice `#E7F0ED` |
| Oklahoma City Storm Riders | Storm Orange `#E36F32` | Storm Graphite `#30343B` | Thunder Blue `#42647C` | Cloud White `#F0F1ED` |

Les 30 palettes sont désormais validées et leurs quatre codes HEX sont consignés dans `data/franchises.json`. Toute modification ultérieure nécessite un nouvel arbitrage explicite.

## Interface
- Navigation latérale persistante sur desktop ; navigation adaptée au mobile.
- Bandeau supérieur avec date, prochain match et notifications.
- Tableaux analytiques denses, typographie lisible, chiffres tabulaires.
- Base graphite ou bleu nuit ; couleurs de franchise utilisées comme accents.
