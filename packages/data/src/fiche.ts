// Tranche 3 : les statistiques sourcées d'un joueur pour sa fiche (data/statistiques/2025-26/joueurs.json).
// Moyennes par match recalculées à partir des totaux (docs/SOURCES.md § 5 : les totaux font foi), compétitions séparées.
import type { StatistiquesJoueurs } from './schemas';

export type Competition = 'saisonReguliere' | 'playIn' | 'playoffs' | 'saison2024_25';

export const LIBELLES_COMPETITIONS: Record<Competition, string> = {
  saisonReguliere: 'Saison régulière 2025-26',
  playIn: 'Play-In 2026',
  playoffs: 'Playoffs 2026',
  saison2024_25: 'Saison régulière 2024-25',
};

export interface MoyennesJoueur {
  competition: Competition;
  libelle: string;
  matchs: number;
  titularisations: number | null;
  minutes: number;
  points: number;
  rebonds: number;
  passes: number;
  interceptions: number;
  contres: number;
  pertes: number;
  /** Pourcentages entre 0 et 1, null sans tentative. */
  pctTirs: number | null;
  pctTrois: number | null;
  pctLancers: number | null;
  source: { fournisseur: string; url: string };
}

const pct = (r: number, t: number): number | null => (t ? r / t : null);

/** Les moyennes sourcées d'un joueur, compétition par compétition (vide si le joueur n'a aucune statistique NBA). */
export function moyennesDuJoueur(stats: StatistiquesJoueurs, id: string): MoyennesJoueur[] {
  const fiche = stats.joueurs[id];
  if (!fiche) return [];
  const ordre: Competition[] = ['saisonReguliere', 'playIn', 'playoffs', 'saison2024_25'];
  return ordre.flatMap((competition) => {
    const t = fiche[competition];
    if (!t || !t.matchs) return [];
    const m = t.matchs;
    const source = stats.sources[competition];
    return [
      {
        competition,
        libelle: LIBELLES_COMPETITIONS[competition],
        matchs: m,
        titularisations: 'titularisations' in t ? t.titularisations : null,
        minutes: t.minutes / m,
        points: t.points / m,
        rebonds: (t.rebondsOffensifs + t.rebondsDefensifs) / m,
        passes: t.passes / m,
        interceptions: t.interceptions / m,
        contres: t.contres / m,
        pertes: t.pertes / m,
        pctTirs: pct(t.tirsReussis, t.tirsTentes),
        pctTrois: pct(t.troisReussis, t.troisTentes),
        pctLancers: pct(t.lancersReussis, t.lancersTentes),
        source: { fournisseur: source.fournisseur, url: source.url },
      },
    ];
  });
}
