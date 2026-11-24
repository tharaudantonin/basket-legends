// Tranche 7 : passage des fichiers de data/draft/ (validés par Zod) aux données de la Draft de la ligue.
import type { DonneesDraft, GenerateurDeNoms, HistoriqueChoix, ModeleDraft, ProprieteChoix, ReglesLoterie } from '@basket-legends/league';
import { normaliserNom, partiesDuNom } from './noms';
import { sha256Hex } from './sha256';
import {
  schemaBanques,
  schemaChoixDraft,
  schemaEchelleRookies,
  schemaEmpreintes,
  schemaHistoriqueLoterie,
  schemaLoterie,
  schemaModeleDraft,
  type Banques,
  type ChoixDraftFichier,
  type EchelleRookiesFichier,
  type Effectif,
  type Empreintes,
  type HistoriqueLoterieFichier,
  type LoterieFichier,
  type ModeleDraftFichier,
} from './schemas';

/** Empreinte d'un nom, selon la normalisation de data/noms/empreintes.json. */
export const empreinteNom = (nom: string): string => sha256Hex(`basket-legends:${normaliserNom(nom)}`);

/** Banques par pays et filtre des noms réels interdits (nom complet ou partie du nom de famille). */
export function generateurDeNoms(banques: Banques, empreintes: Empreintes): GenerateurDeNoms {
  const complets = new Set(empreintes.nomsComplets);
  const familles = new Set(empreintes.nomsDeFamille);
  const aplatir = (liste?: Record<string, string[]>) => (liste ? Object.values(liste).flat() : []);
  const cultures = { ...banques.culturesParPays, ...banques.culturesParPaysGeneration };
  const parPays = Object.fromEntries(
    Object.entries(cultures).map(([pays, c]) => [
      pays,
      { prenoms: aplatir(banques.cultures[c.prenoms]?.prenoms), noms: aplatir(banques.cultures[c.noms]?.noms) },
    ]),
  );
  return {
    parPays,
    estInterdit: (prenom, nom) => complets.has(empreinteNom(`${prenom} ${nom}`)) || partiesDuNom(nom).some((p) => familles.has(empreinteNom(p))),
  };
}

export function reglesDeLaLoterie(f: LoterieFichier): ReglesLoterie {
  return {
    id: f.id,
    drafts: f.drafts,
    choixTires: f.choixTires,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    categories: f.categories.map(({ definition, ...c }) => c),
    premierChoixInterditApresUnPremier: f.premierChoixInterditApresUnPremier,
    limiteTop: f.limiteTop,
  };
}

/** Rangs des choix propres par équipe, des Drafts les plus anciennes aux plus récentes. */
export function historiqueDesChoix(f: HistoriqueLoterieFichier): HistoriqueChoix {
  const h: HistoriqueChoix = {};
  for (const annee of Object.keys(f.drafts).sort()) for (const [e, r] of Object.entries(f.drafts[annee]!)) (h[e] ??= []).push(r);
  return h;
}

export const proprieteDesChoix = (f: ChoixDraftFichier): ProprieteChoix => ({ annee: f.annee, statut: f.statut, tours: f.tours });

export function modeleDeDraft(f: ModeleDraftFichier): ModeleDraft {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { schemaVersion, datasetId, statut, note, ...m } = f;
  return m as ModeleDraft;
}

export function donneesDeDraft(f: {
  loterie: LoterieFichier;
  historique: HistoriqueLoterieFichier;
  choix: ChoixDraftFichier[];
  modele: ModeleDraftFichier;
  echelle: EchelleRookiesFichier;
  banques: Banques;
  empreintes: Empreintes;
  nomsPris: string[];
}): DonneesDraft {
  return {
    loterie: reglesDeLaLoterie(f.loterie),
    proprietes: Object.fromEntries(f.choix.map((c) => [String(c.annee), proprieteDesChoix(c)])),
    historique: historiqueDesChoix(f.historique),
    modele: modeleDeDraft(f.modele),
    noms: generateurDeNoms(f.banques, f.empreintes),
    echelle: { plafondDeReference: f.echelle.plafondDeReference, rangs: f.echelle.rangs.map((r) => r.montants) },
    nomsPris: f.nomsPris,
  };
}

/** Les noms complets des joueurs du snapshot : jamais redonnés à un joueur généré. */
export const nomsPrisDesEffectifs = (effectifs: readonly Effectif[]): string[] =>
  effectifs.flatMap((e) => e.players.map((j) => `${j.fictionalFirstName} ${j.fictionalLastName}`));

/** Les noms complets des joueurs du vivier (data/vivier/) : jamais redonnés à un prospect. */
export const nomsDuVivier = (vivier: { joueurs: { prenom: string; nom: string }[] }): string[] => vivier.joueurs.map((j) => `${j.prenom} ${j.nom}`);

/** Les données de la Draft à partir du contenu brut des fichiers (validé ici par Zod). */
export function lireDonneesDeDraft(
  bruts: { loterie: unknown; historique: unknown; choix: unknown[]; modele: unknown; echelle: unknown; banques: unknown; empreintes: unknown },
  effectifs: readonly Effectif[],
  nomsPris: readonly string[] = [],
): DonneesDraft {
  return donneesDeDraft({
    loterie: schemaLoterie.parse(bruts.loterie),
    historique: schemaHistoriqueLoterie.parse(bruts.historique),
    choix: bruts.choix.map((c) => schemaChoixDraft.parse(c)),
    modele: schemaModeleDraft.parse(bruts.modele),
    echelle: schemaEchelleRookies.parse(bruts.echelle),
    banques: schemaBanques.parse(bruts.banques),
    empreintes: schemaEmpreintes.parse(bruts.empreintes),
    nomsPris: [...nomsPrisDesEffectifs(effectifs), ...nomsPris],
  });
}
