# Basket Legends

> Jeu web de management basketball — simulation sportive et gestion de franchise à long terme.

**Statut :** préproduction / blueprint. Le registre des 30 noms de franchise reflète les choix de l'utilisateur au 17 novembre 2026. Boston Beacons et Washington Capitals disposent de concepts graphiques documentés ; les identités sont encore en cours de conception. La disponibilité juridique des noms n'a pas été vérifiée.

## Vision
Basket Legends est une simulation de management basketball dans laquelle le joueur incarne un **General Manager**. Il construit son effectif, gère contrats et finances, supervise le recrutement, fixe les orientations sportives et délègue certaines responsabilités au coach.

## Décisions validées
- Jeu web, desktop-first.
- 30 franchises fictives situées dans les villes des 30 franchises NBA de référence.
- Les noms retenus figurent dans `data/franchises.json` et `docs/FRANCHISE_BIBLE.md`.
- Chaque franchise reprend l'héritage historique, les couleurs générales, les statistiques collectives et le style de jeu de son club réel analogue, sur la base de données documentées.
- Les effectifs de départ sont conçus par correspondance individuelle joueur par joueur : poste, âge au snapshot, taille, poids, statistiques et attributs de référence ; les noms affichés sont fictifs et conservent les initiales réelles.
- Les fiches visuelles des personnages s'appuient sur les caractéristiques physiques documentées du joueur de référence. Les portraits/illustrations seront produits spécifiquement pour le jeu ; aucun asset tiers ne sera utilisé sans droits.
- Les logos seront des emblèmes sportifs modernes (mascotte stylisée, monogramme, écusson ou symbole territorial), non des logos de marques commerciales et sans copier les actifs officiels.
- Trois modes de match : rapide, commenté possession par possession et interactif.
- Le joueur est General Manager ; coach et staff disposent de délégations configurables.
- Environ 840 joueurs au lancement : 450 dans les équipes principales, 180 en ligue de développement et 210 joueurs libres/prospects (répartition indicative à affiner).
- Carrière multi-saisons avec Draft, free agency, transferts, progression, retraites et génération continue.

## Documents
- `docs/GDD.md` — Game Design Document.
- `docs/TDD.md` — architecture technique.
- `docs/ART_BIBLE.md` — direction artistique.
- `docs/FRANCHISE_BIBLE.md` — registre des 30 franchises.
- `docs/IDENTITY_CONCEPTS.md` — concepts de logos, palettes et maillots en cours.
- `docs/DATA_PARITY.md` — héritage et correspondance statistique des franchises.
- `docs/PLAYER_MIRROR.md` — correspondance individuelle des joueurs.
- `docs/ROADMAP.md` — feuille de route.
- `docs/SOURCES.md` — politique de provenance des données.
- `data/franchises.json` et `data/franchises.csv` — registre exploitable.
- `assets/franchises/boston-beacons/` — concept vectoriel vintage en révision.
- `assets/franchises/washington-capitals/` — concept de maillots avec étoiles latérales sur l'Icon.

## Points ouverts
1. Confirmer le snapshot des effectifs (proposition : saison 2025-2026, au 30 juin 2026).
2. Effectuer une revue de disponibilité de tous les noms et des droits avant diffusion publique/commerciale.
3. Collecter puis vérifier les données historiques, les profils statistiques et les données individuelles.

## Stack cible
React + TypeScript, Tailwind CSS, Node.js + TypeScript, PostgreSQL, Prisma, Zod, Vitest et Playwright. Monolithe modulaire pour la V1.

**Le dépôt est documentaire à ce stade : le jeu n'est pas encore implémenté.**
