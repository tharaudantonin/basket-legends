# Asset Production Specification — Basket Legends

> Phase 1 — Production du système visuel  
> Version 1.0 — 17 novembre 2026  
> Référence : `docs/ART_BIBLE.md`, `docs/FRANCHISE_BIBLE.md` et `docs/art-direction/franchises/`

## 1. Objectif

Transformer les 30 directions artistiques approuvées en assets originaux, cohérents, exploitables dans le jeu et maintenables par l'équipe. La validation des concepts ne vaut pas validation des fichiers finaux.

## 2. Pré-requis avant gel graphique

- Retranscrire les codes HEX exacts des neuf franchises suivantes depuis les arbitrages originaux : New York Skyliners, Philadelphia Founders, Detroit Cylinders, Indianapolis Racers, Orlando Comets, Washington Capitals, Denver Summit, Minnesota Borealis et Oklahoma City Storm Riders.
- Effectuer une revue juridique des 30 noms et des territoires de marque. Priorité élevée : Washington Capitals, en raison du conflit de dénomination avec la franchise NHL.
- Vérifier les droits et la provenance de toute référence visuelle.
- Maintenir les couleurs déjà validées sans les modifier sans nouvel arbitrage.

## 3. Livrables par franchise

### Identité de marque
- Logo principal : SVG maître, couleur, monochrome, inversé.
- Logo secondaire : SVG maître et variantes.
- Monogramme : SVG maître et variantes.
- Wordmark : SVG maître et variantes.
- Icône/avatar optimisé pour les petites tailles.
- Fiche d'usage : zone de protection, taille minimale, fonds autorisés, interdits.

### Collection textile
Quatre maillots par franchise, soit 120 tenues au total :
- Association
- Icon
- Statement
- City Edition

Chaque tenue doit comporter vues face/dos, maillot et short, couleurs HEX, emplacement des logos, wordmark, numéros et motifs. Chaque col est uni, d'une seule couleur, sans dégradé ni liseré contrastant. Les numéros et inscriptions doivent rester lisibles à distance.

### Environnement de match
- Terrain : parquet, lignes, raquettes, cercle central, marquages et variante événementielle.
- Arène : façade, intérieur, tribunes, éclairage, écrans et signalétique.
- Déclinaisons broadcast : scoreboard, cartes de match, écran d'avant-match.

## 4. Organisation des fichiers

Convention cible :

```text
assets/franchises/<franchise-id>/
  brand/
    logo-primary.svg
    logo-primary-mono.svg
    logo-secondary.svg
    monogram.svg
    wordmark.svg
    avatar.svg
    usage.md
  uniforms/
    association-front.svg
    association-back.svg
    icon-front.svg
    icon-back.svg
    statement-front.svg
    statement-back.svg
    city-front.svg
    city-back.svg
  court/
    court.svg
  arena/
    exterior.svg
    interior.svg
  exports/
    preview.png
```

Les SVG sont les sources maîtresses pour les éléments vectoriels. Les exports raster sont des rendus dérivés, jamais les seules sources. Les noms de fichiers sont en minuscules kebab-case ; les identifiants de franchise correspondent à ceux du registre JSON.

## 5. Règles de qualité et d'acceptation

- Originalité : aucun logo, wordmark, uniforme ou composition d'une franchise réelle ne doit être copié.
- Lisibilité : contrôle en monochrome, en miniature et à distance.
- Accessibilité : contrôle des contrastes et des principales formes de daltonisme.
- Cohérence : la silhouette, les proportions et le langage graphique restent constants entre les variantes.
- Textile : cols unis ; numéros, noms et logos lisibles ; cohérence entre les quatre tenues.
- Intégration : dimensions, viewBox, couleurs et noms de fichiers documentés.
- Traçabilité : chaque asset doit être associé à une franchise, une version, une date et un statut de validation.

## 6. Ordre de production

1. Finaliser les neuf palettes HEX en attente et effectuer la revue juridique prioritaire.
2. Produire un pack pilote complet sur une franchise afin de valider le workflow et les standards.
3. Corriger le pipeline à partir du retour utilisateur.
4. Produire les 30 systèmes de logos.
5. Produire les 120 tenues.
6. Produire les 30 terrains et les 30 kits d'arène.
7. Construire les planches comparatives des 30 franchises.
8. Intégrer les exports dans le kit UI desktop et mobile.

## 7. Statut

- Directions artistiques : 30/30 approuvées.
- Palettes HEX retranscrites depuis les décisions consolidées : 21/30.
- Palettes restant à retranscrire : 9/30.
- Assets finaux : production à lancer.
- Revue juridique : à effectuer.
