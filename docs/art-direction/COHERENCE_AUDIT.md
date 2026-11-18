# Basket Legends — Audit de cohérence des 30 franchises

> Audit de cohérence v2.0 — 17 novembre 2026  
 > Statut : les 30 palettes canoniques sont synchronisées dans le registre JSON/CSV et les 30 dossiers Markdown ; les anciennes propositions ont été remplacées.

## 1. Objectif
Vérifier que les 30 franchises sont cohérentes avec leur territoire et restent différenciables dans l'interface, les logos, les maillots et les terrains.

## 2. Ce qui est acquis
- Les 30 noms et directions créatives sont arbitrés.
- Les 30 palettes sont transcrites et validées, avec quatre codes HEX par franchise.
- Les 30 palettes sont enregistrées dans `data/franchises.json` et répliquées dans `data/franchises.csv`.
- Les trois derniers dossiers — Sacramento Diggers, Milwaukee Stags et Utah Desert Raptors — sont désormais détaillés et validés.
- La validation créative ne remplace ni les tests visuels ni la revue juridique.

## 3. Audit de parité des données

`data/franchises.json` est la source canonique des quatre couleurs par franchise (`primary`, `secondary`, `accent`, `neutral`). `data/franchises.csv` en est le miroir tabulaire. Les deux fichiers ont été harmonisés sur 30 franchises ; les codes HEX validés n'ont pas été modifiés lors de la migration du champ `dark` vers `neutral`.

Les 30 dossiers Markdown ont été synchronisés avec le registre canonique. Les anciennes palettes et mentions de proposition ont été remplacées par les quatre couleurs et noms actuellement validés.

**Règle permanente pour les outils et les contributeurs :** lire les valeurs de palette exclusivement dans `data/franchises.json`. `data/franchises.csv` et les dossiers Markdown en sont des miroirs documentaires. En cas de divergence future, le JSON prévaut et toute correction doit être reportée dans les autres formats sans modifier les valeurs validées.

## 4. Principaux risques à contrôler lors de la production

| Famille | Risque | Contrôle attendu |
|---|---|---|
| Bleus profonds | Plusieurs identités utilisent une base bleue ou navy | Comparaison des maillots Icon en miniature et en niveaux de gris |
| Rouges / terres | Chicago, Miami, Phoenix, Portland, Sacramento, Utah et autres accents chauds | Distinguer température, proportion et contraste |
| Animaux | Ours, cheval, cerf, aigle, abeille, scorpion, rapace, otarie | Silhouettes et angles de vue distincts |
| Littoral | Boston, Golden Seals, Beachers, Tropics, Royal | Différencier port, faune marine, plage, tropiques et fleuve |
| Histoire civique | Boston, Philadelphia, Washington, Sacramento | Symboles territoriaux spécifiques et non interchangeables |
| Étoiles / ciel | Los Angeles Stars, Washington et autres motifs secondaires | Réserver des constructions et hiérarchies distinctes |

## 5. Règles de différenciation
1. Chaque franchise possède un symbole principal distinct.
2. Chaque maillot Icon doit être identifiable par sa dominante.
3. Deux couples dominant/secondaire ne doivent pas être confondus à saturation et luminosité proches.
4. La silhouette du logo doit rester différenciable avant même la couleur.
5. Les récits de villes d'une même région doivent rester distincts.
6. Les quatre tenues doivent former une collection cohérente.
7. Les cols restent unis et d'une seule couleur.
8. Les logos doivent fonctionner en monochrome et en petite taille.
9. Contraste, daltonisme et lisibilité sur fond clair/sombre doivent être testés.
10. Aucune palette validée ne peut être modifiée sans nouvel arbitrage utilisateur.

## 6. Plan de contrôle visuel
- Planche de 30 logos monochromes, à taille identique.
- Planche de 30 palettes avec proportions d'usage.
- Planche de 30 maillots Icon et Association vus de face.
- Comparaison des symboles sans wordmarks.
- Tests en miniature, à distance, sur fond clair et sombre.
- Contrôle des cols, numéros et contrastes.
- Revue juridique des noms, logos et droits d'image.

## 7. Risque juridique prioritaire
Le nom **Washington Capitals** entre en collision avec une franchise existante de NHL. Le nom doit faire l'objet d'une revue juridique avant toute diffusion publique ou commerciale. Aucun actif graphique de cette franchise ne doit être utilisé.

## 8. Conclusion
La phase d'arbitrage créatif des 30 franchises est terminée. La synchronisation des 30 dossiers Markdown est terminée. La phase suivante porte sur la production des assets et leur contrôle comparatif. Les 30 palettes sont gelées dans le registre canonique ; toute modification nécessite un nouvel arbitrage utilisateur.
