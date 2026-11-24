// Schémas Zod des données de référence (tranche 0). Ils décrivent les fichiers tels qu'ils sont dans `data/` :
// les noms de champs déjà établis sont conservés (CLAUDE.md, « Conventions de code »).
import { z } from 'zod';

const hex = z.string().regex(/^#[0-9A-F]{6}$/, 'couleur HEX en majuscules attendue (#RRGGBB)');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date AAAA-MM-JJ attendue');
const saison = z.string().regex(/^\d{4}-\d{4}$/, 'saison AAAA-AAAA attendue');
const note = z.number().int().min(1).max(100);

/** Les identifiants canoniques des franchises : ceux de `data/franchises.json`. */
export const idFranchise = z.string().regex(/^[a-z]+(?:-[a-z]+)*$/, 'identifiant de franchise en minuscules (kebab-case) attendu');

/** Les identifiants stables des joueurs du snapshot, sans nom réel. */
export const idJoueur = z.string().regex(/^j\d{4}$/, 'identifiant de joueur « j0001 » attendu');

export const schemaFranchise = z.looseObject({
  id: idFranchise,
  city: z.string().min(1),
  referenceClub: z.string().min(1),
  fictionalName: z.string().min(1),
  creativeTerritory: z.string().min(1),
  palette: z.strictObject({ primary: hex, secondary: hex, accent: hex, neutral: hex }),
  nameStatus: z.string(),
  nameClearance: z.string(),
  visualStatus: z.string(),
  historyMirror: z.looseObject({ status: z.string() }),
  playStyleMirror: z.looseObject({ status: z.string(), referenceSeason: saison }),
  playerMirror: z.looseObject({ status: z.string(), referenceSeason: saison }),
  identityFiles: z.array(z.string()).optional(),
  artDirectionStatus: z.string(),
  paletteStatus: z.literal('validated'),
  paletteNames: z.array(z.string().min(1)).length(4),
});

export const schemaRegistre = z.looseObject({
  schemaVersion: z.literal(3),
  updatedAt: date,
  snapshot: z.looseObject({ season: saison, date, status: z.literal('approved'), statisticsSeason: saison }),
  franchises: z.array(schemaFranchise).length(30),
});

const conversion = z.enum(['derived-rounded', 'source-provided']);
const taille = z.strictObject({
  sourceValue: z.string(),
  sourceUnit: z.literal('ft-in'),
  heightCm: z.number().int().min(150).max(250),
  conversionStatus: conversion,
});
const poids = z.strictObject({
  sourceValue: z.number().positive(),
  sourceUnit: z.enum(['lb', 'kg']),
  weightKg: z.number().int().min(50).max(180),
  conversionStatus: conversion,
});

export const schemaJoueur = z.strictObject({
  id: idJoueur,
  fictionalDisplayName: z.string().min(3),
  fictionalFirstName: z.string().min(1),
  fictionalLastName: z.string().min(1),
  fictionalSuffix: z.enum(['Jr.', 'Sr.', 'II', 'III', 'IV']).nullable(),
  fictionalInitials: z.string().regex(/^[A-Z]{2,5}$/),
  nameStatus: z.enum(['proposed-pending-review', 'validated']),
  jerseyNumber: z.string().regex(/^\d{1,2}$/),
  sourcePosition: z.enum(['G', 'F', 'C', 'G-F', 'F-G', 'F-C', 'C-F']),
  measurements: z.strictObject({ height: taille, weight: poids }),
  lastAttended: z.string().nullable(),
  country: z.string().min(2),
  sourcePlayerId: z.string().nullable(),
  rosterStatus: z.string(),
  ratings: z.looseObject({ overall: note, scale: z.literal(100), source: z.string(), status: z.string() }),
  attributes: z.strictObject({ technique: note, physical: note, mental: note, tactical: note, scale: z.literal(100) }),
  notes: z.strictObject({ archetype: z.string().optional() }).nullable(),
});

export const schemaEffectif = z.strictObject({
  schemaVersion: z.literal(2),
  datasetId: z.literal('basket-legends-rosters-2026-27'),
  snapshot: z.strictObject({ season: z.literal('2026-2027'), date: z.literal('2026-11-17'), timezone: z.string(), status: z.literal('approved') }),
  franchise: z.strictObject({ id: idFranchise, fictionalName: z.string(), referenceClub: z.string(), referenceAbbreviation: z.string() }),
  roster: z.looseObject({ status: z.string(), playerCount: z.number().int().positive() }),
  provenance: z.looseObject({ sourceType: z.string() }),
  units: z.looseObject({ canonical: z.literal('metric') }),
  players: z.array(schemaJoueur).min(1),
});

const listeParInitiale = z.record(z.string(), z.array(z.string().min(1)));
export const schemaBanques = z.looseObject({
  schemaVersion: z.literal(1),
  culturesParPays: z.record(z.string(), z.strictObject({ prenoms: z.string(), noms: z.string() })),
  cultures: z.record(z.string(), z.strictObject({ prenoms: listeParInitiale.optional(), noms: listeParInitiale.optional() })),
});

const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
export const schemaEmpreintes = z.looseObject({
  schemaVersion: z.literal(1),
  normalisation: z.string(),
  nomsComplets: z.array(sha256).min(1),
  nomsDeFamille: z.array(sha256).min(1),
});

export type Franchise = z.infer<typeof schemaFranchise>;
export type Registre = z.infer<typeof schemaRegistre>;
export type Joueur = z.infer<typeof schemaJoueur>;
export type Effectif = z.infer<typeof schemaEffectif>;
export type Banques = z.infer<typeof schemaBanques>;
export type Empreintes = z.infer<typeof schemaEmpreintes>;
