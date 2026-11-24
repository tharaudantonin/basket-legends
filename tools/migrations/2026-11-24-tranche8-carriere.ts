// Migration de la tranche 8 (24 novembre 2026) — modèle de carrière et villes d'accueil.
//
// data/modeles/carriere-v1.json : progression et vieillissement, retraites, règle provisoire des effectifs (avant la
// free agency de la tranche 9), fréquence des changements de franchise. Les valeurs sont des choix du modèle (statut
// « proposition ») : la forme de la courbe d'âge suit Vaci et al. (2019), la fréquence des changements la décision du
// 24/11/2026 (réponse 6), le reste est calé pour que la distribution des notes reste stable sur 20 saisons
// (`npm run carriere`, critère de sortie de la tranche 8).
//
// data/ligue/villes-d-accueil.json : la liste fermée des villes sans équipe NBA (décision du 24/11/2026, réponse 7),
// chacune citée par au moins une source comme marché possible d'expansion ou de déménagement. Les noms des franchises
// sont des propositions originales, à valider (et à passer à la revue juridique avant toute publication).
//
// Usage : npx tsx tools/migrations/2026-11-24-tranche8-carriere.ts [dépôt]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { schemaModeleCarriere, schemaVillesDAccueil } from '../../packages/data/src';

const depot = process.argv[2] ?? process.cwd();
const CONSULTE = '2026-11-24';

const VACI = {
  fournisseur: 'Behavior Research Methods (Springer)',
  titre: 'Vaci, Cocić, Gula et Bilalić, « Large data and Bayesian modeling—aging curves of NBA players », 51(4), p. 1544-1564',
  url: 'https://eprints.whiterose.ac.uk/159117/1/Large%20data%20and%20Bayesian%20modeling-aging%20curves%20of%20NBA%20players.pdf',
  niveau: 'primaire' as const,
  publieLe: '2019-01-25',
  consulteLe: CONSULTE,
};
const FOUTZOPOULOS = {
  fournisseur: 'MPRA (Munich Personal RePEc Archive), document n° 121540',
  titre: 'Foutzopoulos, Pandis et Tsagris, « Predicting full retirement attainment of NBA players »',
  url: 'https://mpra.ub.uni-muenchen.de/121540/1/MPRA_paper_121540.pdf',
  niveau: 'primaire' as const,
  publieLe: '2024-07-23',
  consulteLe: CONSULTE,
};

const modele = schemaModeleCarriere.parse({
  schemaVersion: 1,
  datasetId: 'basket-legends-modele-carriere',
  version: 'carriere-v1',
  statut: 'proposition',
  note:
    'Modèle de carrière de la tranche 8 (24/11/2026). Courbe d’âge : montée jusqu’au pic (27 ans, « around 27 or 28 years old », Vaci et al. 2019, p. 1549), déclin ensuite, d’abord rapide puis plus lent (« the rate of the decline is not constant and slows down in older age », p. 1550). Les montants (points de note par saison), les profils par attribut, les retraites et la règle des effectifs sont des choix du modèle, calés pour que la distribution des notes reste stable sur 20 saisons (docs/CARRIERE.md). Contrôle de vraisemblance : durée moyenne de carrière des joueurs restés au moins deux saisons, 9,0 ans (Foutzopoulos et al. 2024, tableau 1, joueurs draftés de 1999 à 2006).',
  sources: [VACI, FOUTZOPOULOS],
  progression: {
    evolution: { '19': 2.2, '20': 1.9, '21': 1.6, '22': 1.3, '23': 1, '24': 0.7, '25': 0.4, '26': 0.1, '27': -0.2, '28': -0.6, '29': -1, '30': -1.5, '31': -1.8, '32': -2.3, '33': -2.8, '34': -3.2, '36': -3.4, '38': -3 },
    ecart: { '19': 2.4, '23': 2.2, '27': 2, '31': 1.8, '35': 2 },
    rattrapage: { '19': 0.2, '22': 0.18, '25': 0.14, '26': 0.1 },
    agePic: 27,
    profils: [
      {
        attributs: ['vitesse', 'contre', 'interception', 'defenseExterieure', 'rebondOffensif'],
        apres: 27,
        parAn: -0.8,
        max: 6,
        note: 'Qualités athlétiques : déclinent plus tôt que la note (choix du modèle).',
      },
      {
        attributs: ['qiOffensif', 'qiDefensif', 'passe', 'lancersFrancs', 'tirATroisPoints', 'tirMiDistance'],
        apres: 24,
        parAn: 0.5,
        max: 4,
        note: 'Adresse et lecture du jeu : progressent plus longtemps que la note (choix du modèle).',
      },
    ],
    ecartAttribut: 1.2,
    compression: { debut: 88 },
    endurance: { apres: 30, parAn: -1 },
    bornes: [25, 99],
  },
  retraite: {
    ageMax: 41,
    sousContrat: { age: 33, base: 0.05, parAn: 0.08, parPoint: 0.02, seuil: 72 },
    sansContrat: { age: 25, base: 0.15, parAn: 0.08, parPoint: 0.06, seuil: 62 },
  },
  effectifs: {
    standardVises: 14,
    dureeProlongation: 1,
    noteMinProlongation: 62,
    ageMaxProlongation: 38,
    ageMaxTwoWay: 24,
    ageFinDeveloppement: 26,
  },
  demenagement: { probabiliteParSaison: 0.125, delaiMinimum: 15 },
});

const ESPN = {
  fournisseur: 'ESPN (Tim Bontemps, Kevin Pelton, Brian Windhorst)',
  titre: 'NBA expansion FAQ: Cities, draft, teams and the league’s future',
  url: 'https://www.espn.co.uk/nba/story/_/id/41286389/nba-expansion-cities-draft-teams-leagues-line',
  niveau: 'secondaire' as const,
  publieLe: '2024-09-17',
  consulteLe: CONSULTE,
};
const FOS = {
  fournisseur: 'Front Office Sports (Alex Schiffer)',
  titre: 'NBA Expansion Heats Up in Vegas, Slows in Seattle',
  url: 'https://frontofficesports.com/article/nba-expansion-heats-up-vegas-slows-seattle/',
  niveau: 'secondaire' as const,
  publieLe: '2026-07-09',
  consulteLe: CONSULTE,
};
const NTD = {
  fournisseur: 'NTD / The Epoch Times (Ross Kelly)',
  titre: 'Top Potential NBA Expansion Cities If Las Vegas and Seattle Don’t Land Teams',
  url: 'https://www.ntd.com/top-potential-nba-expansion-cities-if-las-vegas-and-seattle-dont-land-teams_1135239.html',
  niveau: 'secondaire' as const,
  publieLe: '2026-03-28',
  consulteLe: CONSULTE,
};
const SI = {
  fournisseur: 'Sports Illustrated, On SI (Jeremy Brener)',
  titre: '3 Potential Blazers Relocation Cities If Moda Center Deal Fails',
  url: 'https://www.si.com/nba/trailblazers/onsi/3-potential-blazers-relocation-cities-if-moda-center-deal-fails',
  niveau: 'secondaire' as const,
  publieLe: '2026-07-29',
  consulteLe: CONSULTE,
};

const ville = (id: string, nom: string, pays: string, conference: 'est' | 'ouest', abreviation: string, noms: string[], sources: (typeof ESPN)[]) => ({
  id,
  ville: nom,
  pays,
  conference,
  abreviation,
  noms,
  statutNoms: 'proposition' as const,
  sources,
});

const villes = schemaVillesDAccueil.parse({
  schemaVersion: 1,
  datasetId: 'basket-legends-villes-d-accueil',
  statut: 'proposition',
  note:
    'Villes sans équipe NBA citées comme marchés possibles d’expansion ou de déménagement (décision du 24/11/2026, réponse 7 : liste fermée). Conférence : rattachement géographique proposé par le jeu (une franchise ne déménage que vers une ville de sa conférence, docs/CARRIERE.md § 7). Noms : propositions originales à valider par Antonin, puis à soumettre à la revue juridique de la porte de publication (homonymes possibles dans d’autres sports).',
  villes: [
    ville('seattle', 'Seattle', 'États-Unis', 'ouest', 'SEA', ['Cascades', 'Evergreens'], [ESPN, FOS]),
    ville('las-vegas', 'Las Vegas', 'États-Unis', 'ouest', 'LVG', ['Neons', 'Mirages'], [ESPN, FOS]),
    ville('mexico', 'Mexico', 'Mexique', 'ouest', 'MEX', ['Volcanes', 'Quetzales'], [ESPN, NTD, SI]),
    ville('kansas-city', 'Kansas City', 'États-Unis', 'ouest', 'KCF', ['Fountains', 'Plainsmen'], [ESPN, SI]),
    ville('vancouver', 'Vancouver', 'Canada', 'ouest', 'VAN', ['Orcas', 'Tidewater'], [ESPN, NTD]),
    ville('san-jose', 'San José', 'États-Unis', 'ouest', 'SJV', ['Voltage', 'Circuit'], [ESPN]),
    ville('austin', 'Austin', 'États-Unis', 'ouest', 'AUS', ['Armadillos', 'Hill Country'], [ESPN]),
    ville('louisville', 'Louisville', 'États-Unis', 'est', 'LOU', ['Thoroughbreds', 'Bourbons'], [ESPN, NTD]),
    ville('montreal', 'Montréal', 'Canada', 'est', 'MTL', ['Aurores', 'Voyageurs'], [ESPN]),
    ville('virginia-beach', 'Virginia Beach', 'États-Unis', 'est', 'VAB', ['Breakers', 'Lighthouses'], [NTD, SI]),
    ville('saint-louis', 'Saint-Louis', 'États-Unis', 'est', 'STL', ['Arches', 'Riverboats'], [NTD]),
  ],
});

const ecrire = (chemin: string, donnees: unknown) => writeFileSync(join(depot, chemin), `${JSON.stringify(donnees, null, 2)}\n`);
ecrire('data/modeles/carriere-v1.json', modele);
ecrire('data/ligue/villes-d-accueil.json', villes);
console.log(`Modèle de carrière et ${villes.villes.length} villes d’accueil écrits.`);
