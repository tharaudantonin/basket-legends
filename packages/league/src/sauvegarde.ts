// Tranche 4 : le format versionné des sauvegardes (stockées dans IndexedDB par l'interface).
//
// Une sauvegarde contient l'état complet de la saison (objet JSON) et les versions des données qui l'ont produit :
// règles, réglages du moteur et modèle de notes. À la lecture, le format est validé par Zod ; une sauvegarde d'une
// version plus ancienne passe par `migrer` (aucune migration pour l'instant : la version 1 est la première).
import { z } from 'zod';
import type { EtatSaison } from './types';

export const VERSION_SAUVEGARDE = 1;

const resume = z.looseObject({
  id: z.number().int(),
  nature: z.enum(['reguliere', 'play-in', 'playoffs', 'all-star']),
  date: z.string(),
  domicile: z.string(),
  exterieur: z.string(),
  graine: z.number().int(),
  score: z.tuple([z.number().int(), z.number().int()]),
  absents: z.array(z.string()),
  empreinte: z.string(),
});

const etat = z.looseObject({
  version: z.literal(1),
  saison: z.string(),
  graine: z.number().int(),
  franchise: z.string(),
  phase: z.enum(['reguliere', 'play-in', 'playoffs', 'terminee']),
  calendrier: z.array(
    z.looseObject({
      date: z.string(),
      matchs: z.array(z.looseObject({ id: z.number().int(), domicile: z.string(), exterieur: z.string() })),
    }),
  ),
  jour: z.number().int().min(0),
  date: z.string(),
  matchs: z.array(resume),
  // Tranche 5 : match interactif en cours (facultatif : les sauvegardes de la tranche 4 restent lisibles telles quelles).
  matchInteractif: z
    .strictObject({
      id: z.number().int(),
      decisions: z.array(
        z.looseObject({
          arret: z.number().int().min(0),
          equipe: z.union([z.literal(0), z.literal(1)]),
          genre: z.enum(['plan', 'temps_mort', 'remplacement']),
        }),
      ),
      arret: z.number().int().min(0),
    })
    .optional(),
  blessures: z.record(z.string(), z.number().int()),
  statistiques: z.record(z.string(), z.looseObject({ equipe: z.string(), matchs: z.number().int() })),
  statistiquesPlayoffs: z.record(z.string(), z.looseObject({ equipe: z.string() })),
  statistiquesFinale: z.record(z.string(), z.looseObject({ equipe: z.string() })),
  actualites: z.array(z.looseObject({ id: z.number().int(), date: z.string(), titre: z.string(), texte: z.string() })),
  derniereSemaine: z.number().int(),
  // Tranche 7 : la Draft de la saison (facultative : les sauvegardes des tranches 4 à 6 restent lisibles telles quelles).
  draft: z
    .looseObject({
      annee: z.number().int(),
      classe: z.array(z.looseObject({ id: z.string(), note: z.number(), potentiel: z.number() })),
      observations: z.record(z.string(), z.number().int().min(0)),
      selections: z.record(z.string(), z.string()),
    })
    .optional(),
  // Tranche 8 : univers de la carrière et archives des saisons jouées (facultatifs : la première saison n'en a pas).
  univers: z
    .looseObject({
      saison: z.string(),
      joueurs: z.record(z.string(), z.looseObject({ id: z.string(), age: z.number().int(), note: z.number() })),
      effectifs: z.record(z.string(), z.array(z.string())),
      horsNba: z.record(z.string(), z.enum(['developpement', 'libre'])),
    })
    .optional(),
  archives: z.array(z.looseObject({ saison: z.string(), champion: z.string(), retraites: z.array(z.string()) })).optional(),
});

export const schemaSauvegarde = z.strictObject({
  schemaVersion: z.literal(VERSION_SAUVEGARDE),
  creeLe: z.string(),
  modifieLe: z.string(),
  /** Versions des données qui ont produit la partie (une partie ne se rejoue à l'identique qu'avec les mêmes). */
  donnees: z.strictObject({ regles: z.string(), moteur: z.string(), notes: z.string(), carriere: z.string().optional() }),
  etat,
});

export type Sauvegarde = Omit<z.infer<typeof schemaSauvegarde>, 'etat'> & { etat: EtatSaison };

export function creerSauvegarde(etatSaison: EtatSaison, donnees: Sauvegarde['donnees'], maintenant: string, creeLe?: string): Sauvegarde {
  return { schemaVersion: VERSION_SAUVEGARDE, creeLe: creeLe ?? maintenant, modifieLe: maintenant, donnees, etat: etatSaison };
}

/** Migrations d'une version à la suivante (vide en version 1). */
function migrer(brut: unknown): unknown {
  return brut;
}

/** Lit une sauvegarde : migration éventuelle, puis validation. Lève une erreur lisible si elle est illisible. */
export function lireSauvegarde(brut: unknown): Sauvegarde {
  const lu = schemaSauvegarde.safeParse(migrer(brut));
  if (!lu.success)
    throw new Error(`Sauvegarde illisible : ${lu.error.issues.map((i) => `${i.path.join('.')} — ${i.message}`).join(' ; ')}`);
  return lu.data as unknown as Sauvegarde;
}
