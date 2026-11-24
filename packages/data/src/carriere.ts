// Tranche 8 : passage des données de référence à l'univers initial de la carrière (saison 2026-27) et au modèle de carrière.
import type { DonneesCarriere, DonneesSalariales, HistoriqueChoix, JoueurCarriere, ModeleCarriere, Univers } from '@basket-legends/league';
import type { Effectif, ModeleCarriereFichier, Registre, VillesDAccueilFichier, VivierFichier } from './schemas';

/** Le modèle de carrière, sans l'en-tête ni les sources (elles restent dans le fichier). */
export function modeleDeCarriere(f: ModeleCarriereFichier): ModeleCarriere {
  return {
    progression: { ...f.progression, profils: f.progression.profils.map(({ attributs, apres, parAn, max }) => ({ attributs, apres, parAn, max })) },
    retraite: f.retraite,
    effectifs: f.effectifs,
    demenagement: f.demenagement,
  };
}

export function donneesDeCarriere(
  modele: ModeleCarriereFichier,
  villes: VillesDAccueilFichier,
  registre: Registre,
  effectifs: readonly Effectif[],
): DonneesCarriere {
  const abreviation = Object.fromEntries(effectifs.map((e) => [e.franchise.id, e.franchise.referenceAbbreviation]));
  return {
    modele: modeleDeCarriere(modele),
    villes: villes.villes.map((v) => ({ id: v.id, ville: v.ville, conference: v.conference, noms: v.noms, abreviation: v.abreviation })),
    franchises: Object.fromEntries(
      registre.franchises.map((f) => [f.id, { ville: f.city, nom: f.fictionalName, abreviation: abreviation[f.id] ?? f.id.slice(0, 3).toUpperCase() }]),
    ),
  };
}

/** L'univers de la première saison : joueurs du snapshot (sous contrat) et du vivier (hors NBA). */
export function universInitial(
  saison: string,
  effectifs: readonly Effectif[],
  vivier: VivierFichier,
  salaires: DonneesSalariales,
  historiqueLoterie: HistoriqueChoix,
): Univers {
  const joueurs: Record<string, JoueurCarriere> = {};
  for (const e of effectifs)
    for (const p of e.players) {
      if (p.seasonAge === null) throw new Error(`Âge de saison inconnu : ${p.id}`);
      joueurs[p.id] = {
        id: p.id,
        nom: p.fictionalDisplayName,
        numero: p.jerseyNumber,
        poste: p.sourcePosition,
        tailleCm: p.measurements.height.heightCm,
        poidsKg: p.measurements.weight?.weightKg ?? null,
        pays: p.country,
        age: p.seasonAge,
        note: p.ratings.overall,
        potentiel: null,
        familles: {
          technique: p.attributes.technique,
          physique: p.attributes.physical,
          mental: p.attributes.mental,
          tactique: p.attributes.tactical,
          endurance: p.attributes.endurance,
        },
        details: { ...p.attributes.details },
        origine: 'snapshot',
        depuis: saison,
        notes: [{ saison, note: p.ratings.overall }],
      };
    }
  const horsNba: Univers['horsNba'] = {};
  for (const g of vivier.joueurs) {
    joueurs[g.id] = {
      id: g.id,
      nom: `${g.prenom} ${g.nom}`,
      numero: '',
      poste: g.poste,
      tailleCm: g.tailleCm,
      poidsKg: g.poidsKg,
      pays: g.pays,
      age: g.age,
      note: g.note,
      potentiel: g.potentiel,
      familles: { ...g.familles },
      details: { ...g.details },
      origine: 'vivier',
      depuis: saison,
      notes: [{ saison, note: g.note }],
    };
    horsNba[g.id] = g.statut;
  }
  return {
    saison,
    joueurs,
    effectifs: Object.fromEntries(effectifs.map((e) => [e.franchise.id, e.players.map((p) => p.id)])),
    horsNba,
    contrats: structuredClone(salaires.contrats),
    equipes: structuredClone(salaires.equipes),
    franchises: {},
    retraites: {},
    historiqueLoterie: structuredClone(historiqueLoterie),
    recrues: [],
    pointsParMatchPrecedents: {},
    // Récidive de taxe : une équipe récidiviste au snapshot est comptée comme ayant payé les trois saisons précédentes
    // (approximation : la règle dit trois des quatre saisons précédentes, docs/CARRIERE.md § 5).
    taxesPayees: Object.fromEntries(
      ['2023-2024', '2024-2025', '2025-2026'].map((s) => [
        s,
        Object.entries(salaires.equipes)
          .filter(([, x]) => x.recidiviste)
          .map(([e]) => e),
      ]),
    ),
  };
}
