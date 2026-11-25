// Tranche 9 : marché (échanges, agents libres, IA des GM, staff, délégations) et critère de sortie.
import { describe, expect, it } from 'vitest';
import {
  actifsDe,
  appliquerProprietes,
  avancer,
  cbaDeLaSaison,
  cbaDeLUnivers,
  ceQuIlFaudrait,
  contexteDeLaSaison,
  controlerEquipe,
  creerSauvegarde,
  DELEGATIONS_STAFF,
  droitsBird,
  ecartsDuMarche,
  equipeDuJoueur,
  evaluerEchange,
  executerEchange,
  facteurBlessures,
  facteurScouting,
  faireOffre,
  jouerJourneeIntersaison,
  lireSauvegarde,
  margeEchange,
  maximumAvecDroits,
  maximumRecevable,
  mesurerMarche,
  nouvellePartie,
  offreQualificative,
  ouvrirIntersaison,
  passerALaSaisonSuivante,
  plafondSuivant,
  preferencesReparties,
  rejouerMatch,
  salaireDeLaSaison,
  situationEquipe,
  salairesDeLUnivers,
  saisonCourte,
  terminerIntersaison,
  terminerSansMatchs,
  verifierEchange,
  type ContratJoueur,
  type EtatSaison,
  type PropositionEchange,
} from '../src';
import { creerHasard } from '@basket-legends/engine';
import { chargerContexte } from './outils';

const base = chargerContexte(false, true);
const M = base.marche!.modele;
const P = base.salaires.cba;
const partie = (franchise = 'boston'): EtatSaison => nouvellePartie(base, 2026, franchise);
const M$ = 1_000_000;

describe('CBA de la tranche 9 (paramètres sourcés)', () => {
  it('marge d’échange indexée sur le plafond (7,5 M$ en 2023-24 → 9,096 M$ en 2026-27)', () => {
    expect(margeEchange(P)).toBe(9_096_000);
  });

  it('correspondance des salaires selon la masse après l’échange', () => {
    expect(maximumRecevable(P, 5 * M$, P.plafondSalarial)).toBe(Infinity);
    expect(maximumRecevable(P, 5 * M$, P.plafondSalarial + 5 * M$)).toBe(10_250_000);
    expect(maximumRecevable(P, 30 * M$, P.plafondSalarial + 5 * M$)).toBe(30 * M$ + 9_096_000);
    expect(maximumRecevable(P, 40 * M$, P.plafondSalarial + 5 * M$)).toBe(50_250_000);
    expect(maximumRecevable(P, 40 * M$, P.premierApron + 1)).toBe(40 * M$);
  });

  it('plafond 2027-28 estimé, puis croissance bornée par le lissage (10 %)', () => {
    const p28 = plafondSuivant(P, { plafondSalarial: P.plafondSalarial, seuilTaxe: P.seuilTaxe }, '2027-28', 1);
    expect(p28).toEqual({ plafondSalarial: 176_000_000, seuilTaxe: 213_000_000 });
    for (let g = 0; g < 50; g++) {
      const p29 = plafondSuivant(P, p28, '2028-29', g);
      expect(p29.plafondSalarial / p28.plafondSalarial - 1).toBeGreaterThanOrEqual(0);
      expect(p29.plafondSalarial / p28.plafondSalarial - 1).toBeLessThanOrEqual(P.croissancePlafondMax + 1e-9);
    }
    const P28 = cbaDeLaSaison(P, p28);
    expect(P28.premierApron / P.premierApron).toBeCloseTo(176 / 164.961, 3);
    expect(P28.salaireMaximum.at(-1)!.montant).toBe(Math.round(0.35 * 176_000_000));
  });
});

describe('droits de Bird et agents libres restreints', () => {
  const c = (s: number, draft: ContratJoueur['draft'] = null, anciennete = 6): ContratJoueur => ({
    type: 'standard',
    salaires: [{ saison: '2026-27', montant: 10 * M$ }],
    garanti: null,
    anciennete,
    draft,
    saisonsAvecEquipe: s,
  });
  it('trois saisons : Bird ; deux : Early Bird ; moins : Non-Bird', () => {
    expect(droitsBird(P, c(3))).toBe('bird');
    expect(droitsBird(P, c(2))).toBe('early-bird');
    expect(droitsBird(P, c(1))).toBe('non-bird');
  });
  it('maximums avec droits : Early Bird 175 %, Non-Bird 120 %', () => {
    expect(maximumAvecDroits(P, 'early-bird', 10 * M$, 6, 60 * M$)).toBe(17.5 * M$);
    expect(maximumAvecDroits(P, 'non-bird', 10 * M$, 6, 60 * M$)).toBe(12 * M$);
    expect(maximumAvecDroits(P, 'bird', 10 * M$, 6, 60 * M$)).toBe(60 * M$);
  });
  it('offre qualificative : 140 % (1er choix) à 160 % (30e) pour un rookie, 135 % ou minimum + 200 000 $ sinon', () => {
    expect(offreQualificative(P, c(4, { annee: 2023, tour: 1, rang: 1 }, 4), 10 * M$)).toBe(14 * M$);
    expect(offreQualificative(P, c(4, { annee: 2023, tour: 1, rang: 30 }, 4), 10 * M$)).toBe(16 * M$);
    expect(offreQualificative(P, c(2, null, 2), 10 * M$)).toBe(13.5 * M$);
  });
  it('chaque contrat du snapshot a son horloge de Bird (relevée ou approximée)', () => {
    const contrats = Object.values(base.salaires.contrats);
    expect(contrats.every((x) => x.saisonsAvecEquipe !== undefined)).toBe(true);
    expect(contrats.filter((x) => x.saisonsAvecEquipeStatut === 'releve').length).toBeGreaterThan(480);
  });
});

describe('propriété des choix 2028 à 2033', () => {
  const equipes = Object.keys(base.equipes).sort();
  const rangs1 = Object.fromEntries(equipes.map((e, i) => [e, i + 1]));
  const rangs2 = Object.fromEntries(equipes.map((e, i) => [e, 31 + i]));
  it('chaque Draft se résout sans détenteur provisoire, choix confisqués retirés', () => {
    for (const a of ['2028', '2029', '2030', '2031', '2032', '2033']) {
      const p = base.draft!.proprietes[a]!;
      const t1 = appliquerProprietes(1, rangs1, p.tours['1'], rangs1);
      const t2 = appliquerProprietes(2, rangs2, p.tours['2'], rangs1);
      for (const c of [...t1, ...t2]) expect(equipes).toContain(c.detenteur);
      expect(t1.length).toBe(a === '2028' ? 30 : 29); // un choix de 1er tour confisqué de 2029 à 2033
      expect(t2.length).toBe(30);
    }
  });
  it('dette de Denver : le 1er tour 2028 reste à Denver si 2027 a été transmis à Oklahoma City', () => {
    const p = base.draft!.proprietes['2028']!;
    const r = { ...rangs1, denver: 20 };
    const sans = appliquerProprietes(1, r, p.tours['1'], r, {});
    const avec = appliquerProprietes(1, r, p.tours['1'], r, { '2027': [{ tour: 1, original: 'denver', detenteur: 'oklahoma-city' }] });
    expect(sans.find((c) => c.original === 'denver')!.detenteur).toBe('oklahoma-city');
    expect(avec.find((c) => c.original === 'denver')!.detenteur).toBe('denver');
  });
  it('choix gelés de 2032 (second apron)', () => {
    expect(base.draft!.proprietes['2032']!.geles).toEqual(['boston', 'minnesota', 'phoenix']);
  });
});

/** Un échange simple et légal entre deux équipes de l'IA : deux joueurs de salaires proches. */
function echangeSimple(etat: EtatSaison): PropositionEchange {
  const u = etat.univers!;
  const Sc = saisonCourte(u.saison);
  const sal = (j: string) => salaireDeLaSaison(u.contrats[j], Sc);
  for (const a of ['detroit', 'utah', 'chicago'])
    for (const ja of u.effectifs[a]!.filter((j) => sal(j) > 8 * M$))
      for (const b of ['sacramento', 'toronto', 'orlando'])
        for (const jb of u.effectifs[b]!) {
          const prop: PropositionEchange = { equipes: [a, b], actifs: [[{ type: 'joueur', id: ja }], [{ type: 'joueur', id: jb }]] };
          if (Math.abs(sal(ja) - sal(jb)) < 2 * M$ && verifierEchange(contexteDeLaSaison(base, etat), etat, prop).legal) return prop;
        }
  throw new Error('Aucun échange simple trouvé');
}

describe('échanges : légalité, exécution, rejeu', () => {
  it('un échange légal s’exécute : effectifs, horloge de Bird gardée, journal', () => {
    const etat = partie();
    const ctx = contexteDeLaSaison(base, etat);
    const prop = echangeSimple(etat);
    const ja = (prop.actifs[0][0] as { id: string }).id;
    const horloge = etat.univers!.contrats[ja]!.saisonsAvecEquipe;
    executerEchange(ctx, etat, prop);
    expect(equipeDuJoueur(etat.univers!, ja)).toBe(prop.equipes[1]);
    expect(etat.univers!.contrats[ja]!.saisonsAvecEquipe).toBe(horloge);
    expect(etat.univers!.journal!.at(-1)!.genre).toBe('echange');
    expect(etat.marche!.echanges).toBe(1);
  });

  it('refuse : salaires trop éloignés, effectif complet, règle Stepien, choix gelé, date limite', () => {
    const etat = partie();
    const ctx = contexteDeLaSaison(base, etat);
    const u = etat.univers!;
    const Sc = saisonCourte(u.saison);
    const sal = (j: string) => salaireDeLaSaison(u.contrats[j], Sc);
    // Une star contre un contrat minimum, pour une équipe au-dessus du plafond.
    const riche = Object.keys(u.effectifs).find(
      (e) => salairesDeLUnivers(P, u).equipes[e] && cbaDeLUnivers(P, u).plafondSalarial < u.effectifs[e]!.reduce((t, j) => t + sal(j), 0),
    )!;
    const pauvre = Object.keys(u.effectifs).find((e) => e !== riche)!;
    const star = [...u.effectifs[pauvre]!].sort((a, b) => sal(b) - sal(a))[0]!;
    const mini = [...u.effectifs[riche]!].filter((j) => sal(j) > 0).sort((a, b) => sal(a) - sal(b))[0]!;
    const v1 = verifierEchange(ctx, etat, {
      equipes: [riche, pauvre],
      actifs: [[{ type: 'joueur', id: mini }], [{ type: 'joueur', id: star }]],
    });
    expect(v1.legal).toBe(false);
    expect(v1.motifs.join(' ')).toMatch(/au plus/);
    // Règle Stepien : céder ses 1ers tours 2027 et 2028.
    const e = 'utah';
    const v2 = verifierEchange(ctx, etat, {
      equipes: [e, 'detroit'],
      actifs: [
        [
          { type: 'choix', annee: 2028, tour: 1, original: e },
          { type: 'choix', annee: 2029, tour: 1, original: e },
          { type: 'choix', annee: 2030, tour: 1, original: e },
        ],
        [],
      ],
    });
    expect(v2.motifs.join(' ')).toMatch(/Stepien/);
    // Choix gelé.
    const v3 = verifierEchange(ctx, etat, {
      equipes: ['boston', 'detroit'],
      actifs: [[{ type: 'choix', annee: 2032, tour: 1, original: 'boston' }], []],
    });
    expect(v3.motifs.join(' ')).toMatch(/gelé/);
    // Après la date limite.
    const tard = { ...etat, date: '2027-02-12' };
    expect(verifierEchange(ctx, tard, echangeSimple(etat)).motifs.join(' ')).toMatch(/fermés/);
  });

  it('un match joué avant un échange se rejoue à l’identique après', { timeout: 30_000 }, () => {
    const etat0 = partie();
    const ctx0 = contexteDeLaSaison(base, etat0);
    const apresSemaine = avancer(ctx0, { ...etat0, delegations: { ...DELEGATIONS_STAFF } }, 'semaine');
    const prop = echangeSimple(apresSemaine);
    const m = apresSemaine.matchs.find((x) => x.domicile === prop.equipes[0] || x.exterieur === prop.equipes[0])!;
    executerEchange(contexteDeLaSaison(base, apresSemaine), apresSemaine, prop);
    const ctx = contexteDeLaSaison(base, apresSemaine);
    expect(rejouerMatch(ctx, apresSemaine, m).empreinte).toBe(m.empreinte);
  });
});

describe('robot exploiteur (réponse 43)', () => {
  it('l’IA refuse les offres déséquilibrées : fins de banc, seconds tours ou mauvais contrats contre une star', () => {
    const etat = partie();
    const ctx = contexteDeLaSaison(base, etat);
    const u = etat.univers!;
    const gm = etat.franchise;
    const Sc = saisonCourte(u.saison);
    const sal = (j: string) => salaireDeLaSaison(u.contrats[j], Sc);
    const note = (j: string) => u.joueurs[j]!.note;
    let essais = 0;
    let acceptes = 0;
    // Le robot donne ses joueurs les moins bons (ou les plus mal payés pour leur note) jusqu'à équilibrer les salaires,
    // reçoit en plus les fins de banc nécessaires pour que l'effectif du partenaire reste légal.
    const fabriquer = (e: string, star: string, ordre: string[], sucre: PropositionEchange['actifs'][0]) => {
      const prop: PropositionEchange = { equipes: [gm, e], actifs: [[...sucre], [{ type: 'joueur', id: star }]] };
      const std = (j: string) => u.contrats[j]?.type === 'standard';
      const fins = [...u.effectifs[e]!].filter((j) => j !== star && std(j)).sort((a, b) => note(a) - note(b));
      for (const j of ordre) {
        if (verifierEchange(ctx, etat, prop).legal) break;
        prop.actifs[0].push({ type: 'joueur', id: j });
        const recoit = prop.actifs[0].filter((a) => a.type === 'joueur').length;
        while (u.effectifs[e]!.filter(std).length + recoit - prop.actifs[1].length > 15 && fins.length)
          prop.actifs[1].push({ type: 'joueur', id: fins.shift()! });
      }
      return verifierEchange(ctx, etat, prop).legal ? prop : undefined;
    };
    for (const e of Object.keys(u.effectifs).filter((x) => x !== gm)) {
      const star = [...u.effectifs[e]!].sort((a, b) => note(b) - note(a))[0]!;
      const mesJoueurs = [...u.effectifs[gm]!].filter((j) => u.contrats[j]?.type === 'standard');
      const pires = [...mesJoueurs].sort((a, b) => note(a) - note(b));
      const malPayes = [...mesJoueurs].sort((a, b) => note(a) - sal(a) / 1e6 - (note(b) - sal(b) / 1e6));
      const seconds = actifsDe(ctx, etat, gm).filter((a) => a.type === 'choix' && a.tour === 2);
      for (const prop of [fabriquer(e, star, pires, []), fabriquer(e, star, malPayes, []), fabriquer(e, star, pires, seconds)]) {
        if (!prop) continue;
        essais++;
        if (evaluerEchange(ctx, etat, prop, e).accepte) acceptes++;
      }
    }
    expect(essais).toBeGreaterThan(20);
    expect(acceptes).toBe(0);
  });

  it('« Qu’est-ce qu’il vous faudrait ? » rend une offre légale que l’équipe accepte, ou rien', () => {
    const etat = partie();
    const ctx = contexteDeLaSaison(base, etat);
    const u = etat.univers!;
    let trouvees = 0;
    for (const e of ['utah', 'sacramento', 'brooklyn', 'washington']) {
      const cible = [...u.effectifs[e]!].sort((a, b) => u.joueurs[b]!.note - u.joueurs[a]!.note)[3]!;
      const p = ceQuIlFaudrait(ctx, etat, { equipes: ['boston', e], actifs: [[], [{ type: 'joueur', id: cible }]] }, 'boston');
      if (!p) continue;
      trouvees++;
      expect(verifierEchange(ctx, etat, p).legal).toBe(true);
      expect(evaluerEchange(ctx, etat, p, e).accepte).toBe(true);
    }
    expect(trouvees).toBeGreaterThan(0);
  });
});

/** Une saison accélérée puis l'ouverture de l'intersaison (free agency, journée 0). */
function intersaison(): EtatSaison {
  const etat = partie();
  const fin = terminerSansMatchs(contexteDeLaSaison(base, etat), etat);
  return ouvrirIntersaison(base, fin);
}

describe('free agency par journées', () => {
  it('ouverture : agents libres, droits, journée 0 ; le GM fait une offre et l’agent répond', { timeout: 30_000 }, () => {
    const etat = intersaison();
    expect(etat.phase).toBe('intersaison');
    expect(etat.saison).toBe('2027-2028');
    const I = etat.intersaison!;
    expect(Object.keys(I.agents).length).toBeGreaterThan(50);
    const ctx = contexteDeLaSaison(base, etat);
    const a = Object.values(I.agents)
      .sort((x, y) => y.demande - x.demande)
      .find((x) => x.ancienne !== etat.franchise && x.demande > 5 * M$)!;
    const r1 = faireOffre(ctx, etat, {
      joueur: a.joueur,
      equipe: etat.franchise,
      salaire: Math.round(a.demande * 0.5),
      duree: 2,
      hausse: 0.05,
      moyen: 'minimum',
    });
    expect(['invalide', 'refus']).toContain(r1.type);
  });

  it('intersaison complète : effectifs conformes, aucun doublon, déterministe', { timeout: 60_000 }, () => {
    const a = terminerIntersaison(base, jouerJourneeIntersaison(base, intersaison()));
    const b = terminerIntersaison(base, jouerJourneeIntersaison(base, intersaison()));
    expect(a.phase).toBe('reguliere');
    expect(a.univers!.journal).toEqual(b.univers!.journal);
    const u = a.univers!;
    const D = salairesDeLUnivers(P, u);
    const vus = new Set<string>();
    for (const [e, js] of Object.entries(u.effectifs)) {
      for (const j of js) {
        expect(vus.has(j)).toBe(false);
        vus.add(j);
        expect(u.horsNba[j]).toBeUndefined();
      }
      const std = js.filter((j) => u.contrats[j]?.type === 'standard').length;
      expect(std).toBeGreaterThanOrEqual(13);
      expect(std).toBeLessThanOrEqual(15);
      expect(controlerEquipe(D, situationEquipe(D, e, js)).erreurs).toEqual([]);
    }
  });
});

describe('saison avec le marché', () => {
  it('les échanges de l’IA s’arrêtent à la date limite ; tous les matchs se rejouent à l’identique', () => {
    const etat = partie();
    etat.delegations = { ...DELEGATIONS_STAFF };
    const fin = avancer(contexteDeLaSaison(base, etat), etat, 'fin-reguliere');
    const echanges = (fin.univers!.journal ?? []).filter((t) => t.genre === 'echange');
    expect(echanges.length).toBeGreaterThan(5);
    expect(echanges.every((t) => t.date < '2027-02-11')).toBe(true);
    const ctx = contexteDeLaSaison(base, fin);
    for (const m of fin.matchs.filter((_, i) => i % 7 === 0)) expect(rejouerMatch(ctx, fin, m).empreinte).toBe(m.empreinte);
  }, 60_000);
});

describe('staff (réponses 18, 39, 40)', () => {
  it('effets bornés, de moyenne proche de la référence ; plans de jeu répartis', () => {
    const etat = partie();
    const S = base.marche!.staff;
    const staffs = Object.values(etat.univers!.staff!);
    expect(staffs).toHaveLength(30);
    const fs = staffs.map((s) => facteurScouting(S, s));
    const fb = staffs.map((s) => facteurBlessures(S, s));
    for (const f of [...fs, ...fb]) {
      expect(f).toBeGreaterThanOrEqual(0.85);
      expect(f).toBeLessThanOrEqual(1.15);
    }
    expect(fs.reduce((a, b) => a + b, 0) / 30).toBeCloseTo(1, 1);
    const prefs = preferencesReparties(S, 30, creerHasard(1, 'x'));
    // Proportions exactes à l'arrondi près (répartition cumulée).
    for (const r of ['lent', 'normal', 'rapide'] as const)
      expect(Math.abs(prefs.filter((p) => p.rythme === r).length - 30 * S.preferences.rythme[r])).toBeLessThanOrEqual(1);
    const ctx = contexteDeLaSaison(base, etat);
    expect(Object.values(ctx.equipes).every((e) => e.plan)).toBe(true);
  });
});

describe('critère de sortie : saisons au pilote automatique (réponses 43 et 45)', () => {
  it('10 saisons accélérées : effectifs, taxe, salaires selon la note, agents libres, stars, équilibre', () => {
    let etat = partie();
    etat.delegations = { ...DELEGATIONS_STAFF };
    const ecarts: string[] = [];
    for (let s = 0; s < 10; s++) {
      etat = terminerSansMatchs(contexteDeLaSaison(base, etat), etat);
      etat = passerALaSaisonSuivante(base, etat);
      ecarts.push(...ecartsDuMarche(M, mesurerMarche(M, P, etat.univers!)));
    }
    expect(ecarts).toEqual([]);
  }, 120_000);

  it('une partie en intersaison se sauvegarde et se relit à l’identique', { timeout: 30_000 }, () => {
    const etat = intersaison();
    const s = lireSauvegarde(
      JSON.parse(JSON.stringify(creerSauvegarde(etat, { regles: 'r', moteur: 'm', notes: 'n' }, '2026-11-25T10:00:00Z'))),
    );
    expect(s.etat).toEqual(etat);
  });
});
