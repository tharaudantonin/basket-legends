# Saison — tranche 4 (24 novembre 2026)

> Statut : **implémenté et testé**. Une saison 2026-27 complète (1 230 matchs, All-Star Game, Play-In, playoffs, palmarès) se joue en 3 à 4 secondes dans le Web Worker ; la partie est sauvegardée dans le navigateur (IndexedDB).

## 1. Ce que fait la tranche 4

Depuis l'effectif, « Commencer la saison » crée une partie (graine tirée de l'horloge, puis tout est déterministe). L'écran de saison permet d'avancer d'un jour, d'une semaine, jusqu'au All-Star Game, jusqu'à la fin de la saison régulière ou jusqu'au titre, et montre : calendrier de la franchise (chaque match se revit en box score ou en commenté), classements de conférence, actualités, leaders statistiques, All-Star Game, Play-In et playoffs, palmarès. La partie est enregistrée après chaque avancée et se reprend depuis l'accueil.

Critère de sortie (`docs/AUDIT_2026-11.md` § 7) : saison complète en moins de 10 s — testé (`packages/league/tests/saison.test.ts`, environ 4 s dans Node) et vérifié dans le navigateur (3,5 s, parcours Playwright `apps/web/parcours/saison.spec.ts`).

## 2. Données et sources (`data/ligue/saison-2026-27.json`)

| Bloc | Contenu | Source |
|---|---|---|
| Conférences et divisions | Chaque franchise prend la place de son club de référence (Atlantique, Centrale, Sud-Est ; Nord-Ouest, Pacifique, Sud-Ouest). | NBA.com, standings 2025-26 (primaire) |
| Calendrier | 82 matchs : 4 contre chaque adversaire de division, 4 contre 6 adversaires de conférence et 3 contre les 4 autres, 2 contre chaque équipe de l'autre conférence ; 41 à domicile ; du 20 octobre 2026 au 11 avril 2027. | NBA.com (primaire) |
| Play-In | 7e reçoit 8e, 9e reçoit 10e, le perdant de 7-8 reçoit le vainqueur de 9-10. | NBA.com (primaire) |
| Playoffs | 8 équipes par conférence, séries au meilleur des sept, 2-2-1-1-1, tableau fixe 1-8, 4-5, 3-6, 2-7 ; avantage du terrain à la meilleure tête de série, au meilleur bilan en finale. | Presse (secondaire, à recouper) |
| Départages | Critères NBA à deux équipes et à plusieurs équipes, titres de division d'abord, reprise depuis le début après un départage partiel, tirage en dernier recours. | NBA.com (primaire) |
| Récompenses | Règle des 65 matchs (match compté à partir de 20 minutes) pour MVP, défenseur, progression et All-NBA ; trois équipes All-NBA de cinq, sans poste. | Presse (secondaire, à recouper) |
| All-Star Game | 5 titulaires par conférence au vote pondéré (fans 50 %, joueurs 25 %, médias 25 %), 7 remplaçants choisis par les entraîneurs, sans poste. Match Est-Ouest (décision du 24/11/2026, réponse 9). | NBA Communications (primaire) |

Contrôlé par `npm run verifier` (schéma Zod, chaque franchise dans une seule division).

## 3. Le paquet `packages/league`

| Fichier | Rôle |
|---|---|
| `calendrier.ts` | Appariements selon la formule (adversaires à 3 matchs désignés par un décalage tiré au sort), puis dates : jour après jour, sans match double ni trois jours de suite. |
| `classement.ts` | Bilans (domicile, extérieur, division, conférence, confrontations, série, 10 derniers) et classements avec départages. |
| `saison.ts` | État de saison, `avancer`, matchs (graine = graine de la saison + numéro du match), blessures, statistiques, Play-In, playoffs, All-Star Game, actualités, match de la semaine, palmarès ; `rejouerMatch` revit un match à l'identique. |
| `recompenses.ts` | Vote du All-Star Game et récompenses de fin de saison. |
| `statistiques.ts` | Cumul des box scores (saison régulière, playoffs, finale). |
| `sauvegarde.ts` | Format versionné des sauvegardes (Zod), migration prévue par version. |

Écran : `apps/web/src/ecrans/Saison.tsx` ; moteur dans le Web Worker (`moteur.worker.ts`, contexte de ligue `ligue.ts`) ; IndexedDB : `apps/web/src/sauvegarde.ts` (une partie, clé « principale », versions des règles, du moteur et des notes enregistrées avec elle).

## 4. Choix du modèle (non sourcés)

- **Blessures en match :** probabilité par minute jouée et durées d'absence (1 à 3 matchs : 55 % ; 4 à 15 : 35 % ; 16 à 50 : 10 %), dans `data/moteur/match-v3.json`. Le joueur sort au prochain arrêt de jeu et manque les matchs suivants de son équipe. Aucune cible sourcée : à calibrer si des données de blessures sont relevées.
- **Endurance :** indice du modèle de notes (minutes par match, titularisations), qui module la perte de fraîcheur de ± 30 % (`docs/NOTES_JOUEURS.md`).
- **All-Star Game :** après 60 % des jours de calendrier, sur terrain neutre ; votes simulés par des formules explicites (points, note, bilan de l'équipe, impact) et un écart déterministe par votant ; MVP du match : le meilleur du vainqueur.
- **Récompenses :** MVP et All-NBA à l'impact par match (Game Score) pondéré par le bilan de l'équipe ; défenseur aux interceptions, contres, sens tactique et bilan ; rookie parmi les recrues draftées en 2026 (30 matchs au moins) ; sixième homme parmi les joueurs titularisés moins d'un match sur deux (41 matchs au moins) ; progression par rapport aux points par match 2025-26 sourcés. Pas d'entraîneur de l'année (les entraîneurs ne sont pas encore modélisés).
- **Actualités :** moments marquants des matchs, résultats de la franchise, blessures de 10 matchs ou plus, séries de victoires, match de la semaine (le plus intéressant de chaque semaine, à revivre en commenté), All-Star Game, Play-In, séries de playoffs, palmarès.
- **Calendrier des phases finales :** Play-In deux jours après la saison, puis un match tous les deux jours pour chaque série.

## 5. Simplifications connues

- La NBA Cup n'est pas simulée (ses matchs de poule comptent dans les 82 du calendrier).
- Pas de jours de repos autour du All-Star Game, pas de dates réelles par équipe (le calendrier officiel par équipe n'est pas relevé).
- Pas de fatigue d'un match à l'autre (back-to-back), pas de gestion des minutes par le coach.
- Exceptions de la règle des 65 matchs (matchs de 15 à 20 minutes, blessure de fin de saison) non simulées.

## 6. Matchs interactifs (tranche 5)

- **Jouer son match en interactif :** depuis l'écran de saison, « Prochain match en interactif » ouvre le match que sa franchise jouera au prochain jour (`matchDuProchainPas` : le pas de saison est joué sur une copie de l'état, seul moyen sûr de connaître l'identifiant d'un match de Play-In ou de playoffs). Mode interactif : `docs/SIMULATION_MATCH.md` § 8.
- **Sauvegarde :** l'état de la saison porte le match interactif en cours (`matchInteractif` : identifiant du match, décisions, dernier arrêt atteint), enregistré à chaque décision. Après rechargement, « Reprendre le match interactif » rejoue le match avec les mêmes décisions et reprend au même arrêt. Le champ est facultatif : les sauvegardes de la tranche 4 restent lisibles sans migration (format en version 1).
- **Fin du match :** la saison joue le jour ; le match de sa franchise se joue avec les décisions du coach (même empreinte que dans l'écran interactif, vérifiée à l'écran) ; le résumé du match garde les décisions (`ResumeMatch.decisions`) pour le revivre en mode commenté. Si le joueur avance la saison sans finir son match interactif, les décisions déjà prises s'appliquent et le staff fait le reste.
