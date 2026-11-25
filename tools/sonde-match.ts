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
  schemaModeleStaff,
  valeursDesRegles,
  type StatistiquesLigue,
} from '@basket-legends/data';
import { preferencesReparties, type ModeleStaff } from '@basket-legends/league';
import {
  creerHasard,
  simulerMatch,
  type EquipeDuMatch,
  type PlanDeJeu,
  type ReglagesMatch,
  type ReglesMatch,
} from '@basket-legends/engine';

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

function chargerMoteur(racine: string): { regles: ReglesMatch; reglages: ReglagesMatch; equipes: EquipeDuMatch[] } {
  const json = (chemin: string): unknown => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));
  return {
    regles: valeursDesRegles(schemaRegles.parse(json('data/regles/nba-2026-27.json'))),
    reglages: reglagesDuMoteur(schemaReglagesMatch.parse(json('data/moteur/match-v5.json'))),
    equipes: readdirSync(join(racine, 'data/rosters/2026-27'))
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => equipeDuMatch(schemaEffectif.parse(json(`data/rosters/2026-27/${f}`)))),
  };
}

/** Les deux équipes du match n° g du lot de mesure (calendrier fixe). */
function affiche(equipes: EquipeDuMatch[], g: number): [EquipeDuMatch, EquipeDuMatch] {
  const a = equipes[g % 30]!;
  let b = equipes[(g * 7 + 3 + Math.floor(g / 30)) % 30]!;
  if (a.id === b.id) b = equipes[(g + 1) % 30]!;
  return [a, b];
}

/** Joue `nombre` matchs (calendrier fixe, graines 0…n-1) et compare aux cibles de la ligue. */
export function sonder(
  racine: string,
  nombre: number,
  reglagesForces?: ReglagesMatch,
  plans?: Record<string, Partial<PlanDeJeu>>,
): Rapport {
  const charge = chargerMoteur(racine);
  const { regles } = charge;
  // Tranche 9 : chaque équipe peut jouer le plan de son entraîneur (`--staff`).
  const equipes = plans ? charge.equipes.map((e) => ({ ...e, plan: plans[e.id] })) : charge.equipes;
  const reglages = reglagesForces ?? charge.reglages;
  const L = chargerLigue(racine);

  const sommes = new Map<string, number>();
  const ajouter = (cle: string, v: number) => sommes.set(cle, (sommes.get(cle) ?? 0) + v);
  let prolongations = 0;
  let victoiresDomicile = 0;
  const debut = performance.now();
  for (let g = 0; g < nombre; g++) {
    const [a, b] = affiche(equipes, g);
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

/** Tranche 5 : l'effet d'un plan de jeu, mesuré pour l'équipe qui l'applique (A) et son adversaire (B). */
export interface EffetPlan {
  libelle: string;
  plan: Partial<PlanDeJeu>;
  /** Moyennes par match. */
  mesures: Record<string, number>;
}

export const VARIANTES_PLANS: { libelle: string; plan: Partial<PlanDeJeu> }[] = [
  { libelle: 'plan par défaut', plan: {} },
  { libelle: 'rythme lent', plan: { rythme: 'lent' } },
  { libelle: 'rythme rapide', plan: { rythme: 'rapide' } },
  { libelle: 'moins de 3 pts', plan: { troisPoints: 'moins' } },
  { libelle: 'plus de 3 pts', plan: { troisPoints: 'plus' } },
  { libelle: 'défense de zone', plan: { defense: 'zone' } },
];

/** Joue `nombre` matchs par variante : chaque équipe applique le plan une fois sur deux (à domicile, puis à l'extérieur). */
export function sonderPlans(racine: string, nombre: number): EffetPlan[] {
  const { regles, reglages, equipes } = chargerMoteur(racine);
  return VARIANTES_PLANS.map(({ libelle, plan }) => {
    const s: Record<string, number> = {};
    const plus = (k: string, v: number) => (s[k] = (s[k] ?? 0) + v);
    for (let g = 0; g < nombre; g++) {
      const [x, y] = affiche(equipes, g);
      const camp = (g % 2) as 0 | 1;
      const decisions = Object.keys(plan).length ? [{ arret: 0, equipe: camp, genre: 'plan' as const, plan }] : [];
      const r = simulerMatch({ graine: g, domicile: x, exterieur: y, regles, reglages, decisions });
      const A = r.boxScore.equipes[camp];
      const B = r.boxScore.equipes[camp === 0 ? 1 : 0];
      plus('tirs A', A.totaux.tirsTentes);
      plus('3 pts A', A.totaux.troisTentes);
      plus('pertes A', A.totaux.pertes);
      plus('points A', A.points);
      plus('3 pts B', B.totaux.troisTentes);
      plus('3 pts réussis B', B.totaux.troisReussis);
      plus('rebonds off. B', B.totaux.rebondsOffensifs);
      plus('points B', B.points);
      plus('victoires A', A.points > B.points ? 1 : 0);
      for (const ev of r.evenements)
        if (ev.type === 'tir' && ev.equipe !== camp) {
          plus('tirs B', 1);
          if (ev.tir === 'cercle') plus('cercle B', 1);
        }
    }
    const m = (k: string) => (s[k] ?? 0) / nombre;
    return {
      libelle,
      plan,
      mesures: {
        'tirs A': m('tirs A'),
        '3 pts A': m('3 pts A'),
        'pertes A': m('pertes A'),
        '3 pts B': m('3 pts B'),
        '% 3 pts B': (100 * (s['3 pts réussis B'] ?? 0)) / Math.max(1, s['3 pts B'] ?? 0),
        '% cercle B': (100 * (s['cercle B'] ?? 0)) / Math.max(1, s['tirs B'] ?? 0),
        'rebonds off. B': m('rebonds off. B'),
        'points A': m('points A'),
        'points B': m('points B'),
        '% victoires A': 100 * m('victoires A'),
      },
    };
  });
}

const appelDirect = process.argv[1]?.replace(/\\/g, '/').endsWith('tools/sonde-match.ts');
if (appelDirect) {
  const arguments_ = process.argv.slice(2);
  const nombre = Number(arguments_.find((a) => /^\d+$/.test(a)) ?? 1000);
  // Tranche 9 (réponse 39) : `--staff` donne à chaque équipe le plan de son entraîneur, tiré comme dans une partie
  // (data/modeles/staff-v1.json, préférences), pour revérifier la calibration avec les plans des équipes de l'IA.
  let plans: Record<string, Partial<PlanDeJeu>> | undefined;
  if (arguments_.includes('--staff')) {
    const staff = schemaModeleStaff.parse(JSON.parse(readFileSync(join(process.cwd(), 'data/modeles/staff-v1.json'), 'utf8')));
    const graine = Number(arguments_.find((a) => a.startsWith('--graine='))?.slice(9) ?? 2026);
    const fichiers = readdirSync(join(process.cwd(), 'data/rosters/2026-27'))
      .filter((f) => f.endsWith('.json'))
      .sort();
    // Seules les préférences servent ici (le reste du fichier est ignoré).
    const prefs = preferencesReparties(staff as unknown as ModeleStaff, fichiers.length, creerHasard(graine, 'staff-preferences'));
    plans = Object.fromEntries(fichiers.map((f, i) => [f.replace('.json', ''), prefs[i]!]));
  }
  const r = sonder(process.cwd(), nombre, undefined, plans);
  for (const m of r.mesures) {
    const cible = m.cible === undefined ? '' : `   cible ${m.cible.toFixed(1).padStart(6)} ± ${(m.tolerance ?? 0).toFixed(1)}`;
    const etat = m.cible === undefined ? '' : r.horsFourchette.includes(m) ? '   HORS FOURCHETTE' : '   ok';
    console.log(`${m.libelle.padEnd(36)} ${m.valeur.toFixed(1).padStart(6)}${cible}${etat}`);
  }
  console.log(`${nombre} matchs · ${r.msParMatch.toFixed(2)} ms par match · ${r.horsFourchette.length} mesure(s) hors fourchette`);
  if (arguments_.includes('--plans')) {
    // Tranche 5 : effets des plans de jeu (A applique le plan, B garde le plan par défaut).
    const effets = sonderPlans(process.cwd(), nombre);
    const cles = Object.keys(effets[0]!.mesures);
    console.log(`
Plans de jeu (${nombre} matchs par variante ; A applique le plan, B garde le plan par défaut)`);
    console.log(''.padEnd(18) + cles.map((k) => k.padStart(15)).join(''));
    for (const e of effets) console.log(e.libelle.padEnd(18) + cles.map((k) => e.mesures[k]!.toFixed(1).padStart(15)).join(''));
  }
  process.exitCode = r.horsFourchette.length ? 1 : 0;
}
