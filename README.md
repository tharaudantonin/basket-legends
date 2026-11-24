# Basket Legends

> Jeu web de management basketball — simulation sportive et gestion de franchise à long terme.

**Statut :** préproduction / blueprint. Le registre des 30 noms de franchise reflète les choix de l'utilisateur, mis à jour le 24 novembre 2026 (Washington Monuments et Denver Peaks remplacent Washington Capitals et Denver Summit). Boston Beacons et Washington Monuments disposent de concepts graphiques documentés. La disponibilité juridique des noms n'a pas été vérifiée. État réel et feuille de route : `docs/AUDIT_2026-11.md` ; décisions récentes : `docs/DECISIONS_2026-11.md`.

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
- `docs/DECISIONS_2026-11.md` — décisions validées les 23 et 24 novembre 2026.
- `docs/AUDIT_2026-11.md` — audit des dépôts, constats et feuille de route en tranches.
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
- `assets/franchises/boston/` — concept vectoriel vintage en révision.
- `assets/franchises/washington/` — Washington Monuments : concept de maillots avec étoiles latérales sur l'Icon.

## Points ouverts
1. Snapshot validé le 23 novembre 2026 : effectifs 2026-2027 arrêtés au 17 novembre 2026, statistiques 2025-2026 pour la calibration, carrière à partir de 2026-2027.
2. Effectuer une revue de disponibilité de tous les noms et des droits avant diffusion publique/commerciale.
3. Collecter puis vérifier les données historiques, les profils statistiques et les données individuelles.

## Stack cible
Jeu qui tourne entièrement dans le navigateur, comme Rugby Legends (décision du 24 novembre 2026) : Vite + React + TypeScript, Zod, Vitest (Playwright pour les parcours), sauvegardes versionnées dans IndexedDB, moteur de simulation pur exécuté dans un Web Worker, monorepo léger en npm workspaces. Pas de serveur ni de base de données.

## Lancer le projet

```
npm install
npm run dev
```

Puis ouvrir http://localhost:5180. Autres commandes : `npm test`, `npm run verifier` (données), `npm run ci` (tout ce que vérifie l'intégration continue).

**État au 24 novembre 2026 :** socle technique et données de référence prêts (tranche 0) ; le jeu lui-même commence à la tranche 1.
