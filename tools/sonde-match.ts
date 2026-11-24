// `npm run sonde [nombre de matchs]` : joue un lot de matchs rapides et compare les moyennes par équipe et par match aux
// moyennes de la saison régulière 2025-2026 (data/statistiques/2025-26/ligue.json). Outil de calibration (tranche 2).
//
// Fourchettes (critère de sortie de la tranche 2, docs/SIMULATION_MATCH.md § 3) : ±3 % de la cible pour les volumes,
// ±1 point pour les pourcentages, ±3 points pour la part de victoires à domicile. Ce sont des tolérances de calibration
// choisies pour 1 000 matchs, pas des valeurs sourcées.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  equipeDuMatch,
  reglagesDuMoteur,
  schemaEffectif,
  schemaReglagesMatch,
  schemaRegles,
  schemaStatistiquesLigue,
  valeursDesRegles,
  type StatistiquesLigue,
} from '@basket-legends/data';
import { simulerMatch, type ReglagesMatch } from '@basket-legends/engine';

export interface Mesure {
  cle: string;
  libelle: string;
  valeur: number;
  cible?: number;
  /** Tolérance absolue autour de la cible. */
  tolerance?: number;
}

export interface Rapport {
  mesures: Mesure[];
  horsFourchette: Mesure[];
  msParMatch: number;
}

export function chargerLigue(racine: string): StatistiquesLigue {
  return schemaStatistiquesLigue.parse(JSON.parse(readFileSync(join(racine, 'data/statistiques/2025-26/ligue.json'), 'utf8')));
}

/** Joue `nombre` matchs (calendrier fixe, graines 0…n-1) et compare aux cibles de la ligue. */
export function sonder(racine: string, nombre: number, reglagesForces?: ReglagesMatch): Rapport {
  const json = (chemin: string): unknown => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));
  const regles = valeursDesRegles(schemaRegles.parse(json('data/regles/nba-2026-27.json')));
  const reglages = reglagesForces ?? reglagesDuMoteur(schemaReglagesMatch.parse(json('data/moteur/match-v1.json')));
  const equipes = readdirSync(join(racine, 'data/rosters/2026-27'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => equipeDuMatch(schemaEffectif.parse(json(`data/rosters/2026-27/${f}`))));
  const L = chargerLigue(racine);

  const sommes = new Map<string, number>();
  const ajouter = (cle: string, v: number) => sommes.set(cle, (sommes.get(cle) ?? 0) + v);
  let prolongations = 0;
  let victoiresDomicile = 0;
  const debut = performance.now();
  for (let g = 0; g < nombre; g++) {
    const a = equipes[g % 30]!;
    let b = equipes[(g * 7 + 3 + Math.floor(g / 30)) % 30]!;
    if (a.id === b.id) b = equipes[(g + 1) % 30]!;
    const r = simulerMatch({ graine: g, domicile: a, exterieur: b, regles, reglages });
    if (r.boxScore.prolongations) prolongations++;
    if (r.boxScore.equipes[0].points > r.boxScore.equipes[1].points) victoiresDomicile++;
    for (const e of r.boxScore.equipes) {
      const t = e.totaux;
      ajouter('points', e.points);
      ajouter('tirsReussis', t.tirsReussis);
      ajouter('tirsTentes', t.tirsTentes);
      ajouter('troisReussis', t.troisReussis);
      ajouter('troisTentes', t.troisTentes);
      ajouter('lancersReussis', t.lancersReussis);
      ajouter('lancersTentes', t.lancersTentes);
      ajouter('rebondsOffensifs', t.rebondsOffensifs);
      ajouter('rebondsDefensifs', t.rebondsDefensifs);
      ajouter('passes', t.passes);
      ajouter('interceptions', t.interceptions);
      ajouter('contres', t.contres);
      ajouter('pertes', t.pertes);
      ajouter('fautes', t.fautes);
      const mins = e.joueurs.map((j) => j.dixiemes / 600).sort((x, y) => y - x);
      ajouter('minutesDu1er', mins[0]!);
      ajouter('minutesDu8e', mins[7]!);
    }
    for (const ev of r.evenements) {
      if (ev.type !== 'tir') continue;
      ajouter(`tentes:${ev.tir}`, 1);
      if (ev.reussi) ajouter(`reussis:${ev.tir}`, 1);
    }
  }
  const msParMatch = (performance.now() - debut) / nombre;
  const parEquipe = (cle: string) => (sommes.get(cle) ?? 0) / (2 * nombre);
  const ratio = (a: string, b: string) => (sommes.get(a) ?? 0) / Math.max(1, sommes.get(b) ?? 0);
  const C = L.parEquipeParMatch;
  const D = L.tirsParDistance;
  const tirs = sommes.get('tirsTentes') ?? 1;
  const vol = (cle: keyof typeof C & string, libelle: string): Mesure => ({
    cle,
    libelle,
    valeur: parEquipe(cle),
    cible: C[cle] as number,
    tolerance: 0.03 * (C[cle] as number),
  });
  const pct = (cle: string, libelle: string, valeur: number, cible: number): Mesure => ({
    cle,
    libelle,
    valeur: 100 * valeur,
    cible: 100 * cible,
    tolerance: 1,
  });
  const miDistance = D.trois_dix_pieds.part + D.dix_seize_pieds.part + D.seize_pieds_ligne.part;
  const reussiteMi =
    (D.trois_dix_pieds.part * D.trois_dix_pieds.reussite +
      D.dix_seize_pieds.part * D.dix_seize_pieds.reussite +
      D.seize_pieds_ligne.part * D.seize_pieds_ligne.reussite) /
    miDistance;
  const mesures: Mesure[] = [
    vol('points', 'points'),
    vol('tirsTentes', 'tirs tentés'),
    pct('pctTirs', '% aux tirs', ratio('tirsReussis', 'tirsTentes'), L.pourcentages.tirs),
    vol('troisTentes', 'tirs à 3 pts tentés'),
    pct('pctTrois', '% à 3 pts', ratio('troisReussis', 'troisTentes'), L.pourcentages.trois),
    vol('lancersTentes', 'lancers tentés'),
    pct('pctLancers', '% aux lancers', ratio('lancersReussis', 'lancersTentes'), L.pourcentages.lancers),
    vol('rebondsOffensifs', 'rebonds offensifs'),
    vol('rebondsDefensifs', 'rebonds défensifs'),
    vol('passes', 'passes décisives'),
    vol('interceptions', 'interceptions'),
    vol('contres', 'contres'),
    vol('pertes', 'balles perdues'),
    vol('fautes', 'fautes'),
    pct('partCercle', 'part des tirs près du cercle', (sommes.get('tentes:cercle') ?? 0) / tirs, D.zero_trois_pieds.part),
    pct('reussiteCercle', 'réussite près du cercle', ratio('reussis:cercle', 'tentes:cercle'), D.zero_trois_pieds.reussite),
    pct('partMi', 'part des tirs à mi-distance', (sommes.get('tentes:miDistance') ?? 0) / tirs, miDistance),
    pct('reussiteMi', 'réussite à mi-distance', ratio('reussis:miDistance', 'tentes:miDistance'), reussiteMi),
    {
      cle: 'domicile',
      libelle: '% de victoires à domicile',
      valeur: (100 * victoiresDomicile) / nombre,
      cible: (100 * L.domicile.victoires) / (L.domicile.victoires + L.domicile.defaites),
      tolerance: 3,
    },
    { cle: 'prolongations', libelle: '% de prolongations (non sourcé)', valeur: (100 * prolongations) / nombre },
    { cle: 'minutesDu1er', libelle: 'minutes du joueur le plus utilisé', valeur: parEquipe('minutesDu1er') },
    { cle: 'minutesDu8e', libelle: 'minutes du 8e joueur', valeur: parEquipe('minutesDu8e') },
  ];
  const horsFourchette = mesures.filter((m) => m.cible !== undefined && Math.abs(m.valeur - m.cible) > (m.tolerance ?? 0));
  return { mesures, horsFourchette, msParMatch };
}

const appelDirect = process.argv[1]?.replace(/\\/g, '/').endsWith('tools/sonde-match.ts');
if (appelDirect) {
  const nombre = Number(process.argv[2] ?? 1000);
  const r = sonder(process.cwd(), nombre);
  for (const m of r.mesures) {
    const cible = m.cible === undefined ? '' : `   cible ${m.cible.toFixed(1).padStart(6)} ± ${(m.tolerance ?? 0).toFixed(1)}`;
    const etat = m.cible === undefined ? '' : r.horsFourchette.includes(m) ? '   HORS FOURCHETTE' : '   ok';
    console.log(`${m.libelle.padEnd(36)} ${m.valeur.toFixed(1).padStart(6)}${cible}${etat}`);
  }
  console.log(`${nombre} matchs · ${r.msParMatch.toFixed(2)} ms par match · ${r.horsFourchette.length} mesure(s) hors fourchette`);
  process.exitCode = r.horsFourchette.length ? 1 : 0;
}
