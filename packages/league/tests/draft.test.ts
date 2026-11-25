// Tranche 7 : loterie 3-2-1, propriété des choix 2027, classe de Draft, scouting à notes incertaines, soirée de Draft.
import { describe, expect, it } from 'vitest';
import {
  appliquerProprietes,
  avancer,
  avancerDraft,
  contratDeRookie,
  genererClasse,
  nouvelleSaison,
  observationsRestantes,
  probabilitesDeLaLoterie,
  prochainChoix,
  rangInterdit,
  rapport,
  rapportDuConsensus,
  tirerLoterie,
  type EtatSaison,
  type ParticipantLoterie,
} from '../src';
import { chargerContexte } from './outils';

const ctx = chargerContexte(true);
const D = ctx.draft!;
const equipes = Object.keys(ctx.equipes).filter((e) => !e.startsWith('all-star'));

/** 16 participants fictifs dans l'ordre du bilan : 3 reléguées, 7 non qualifiées, 4 du Play-In 9-10, 2 perdants 7-8. */
const participants: ParticipantLoterie[] = equipes.slice(0, 16).map((equipe, i) => ({
  equipe,
  rangBilan: i + 1,
  categorie: i < 3 ? 'releguees' : i < 10 ? 'non-qualifiees' : i < 14 ? 'play-in-9-10' : 'perdants-7-8',
}));

describe('loterie 3-2-1', () => {
  it('tire 16 équipes distinctes, toujours dans le même ordre pour une même graine', () => {
    const a = tirerLoterie(D.loterie, participants, {}, 7, 'test');
    expect(a.ordre).toHaveLength(16);
    expect(new Set(a.ordre).size).toBe(16);
    expect(tirerLoterie(D.loterie, participants, {}, 7, 'test')).toEqual(a);
    expect(tirerLoterie(D.loterie, participants, {}, 8, 'test').ordre).not.toEqual(a.ordre);
  });

  it('refuse une loterie dont les catégories ne correspondent pas aux règles', () => {
    expect(() => tirerLoterie(D.loterie, participants.slice(1), {}, 1)).toThrow(/15 équipes/);
    const faux = participants.map((p, i) => (i === 3 ? { ...p, categorie: 'releguees' as const } : p));
    expect(() => tirerLoterie(D.loterie, faux, {}, 1)).toThrow(/releguees/);
  });

  it('ne fait jamais tomber une reléguée sous le 12e choix', () => {
    const releguees = participants.filter((p) => p.categorie === 'releguees').map((p) => p.equipe);
    for (let t = 0; t < 400; t++) {
      const { ordre } = tirerLoterie(D.loterie, participants, {}, 3, `plancher-${t}`);
      for (const e of releguees) expect(ordre.indexOf(e) + 1).toBeLessThanOrEqual(12);
    }
  });

  it('donne des probabilités cohérentes : chaque rang est attribué une fois, 3 boules > 2 boules > 1 boule pour le n° 1', () => {
    const p = probabilitesDeLaLoterie(D.loterie, participants, 3000, 11);
    for (let r = 0; r < 16; r++) expect(Object.values(p).reduce((s, v) => s + v[r]!, 0)).toBeCloseTo(1, 6);
    const moyenne = (cat: ParticipantLoterie['categorie']) => {
      const ids = participants.filter((x) => x.categorie === cat).map((x) => x.equipe);
      return ids.reduce((s, e) => s + p[e]![0]!, 0) / ids.length;
    };
    // 3 boules sur 37 ≈ 8,1 % ; 2 sur 37 ≈ 5,4 % ; 1 sur 37 ≈ 2,7 % (plus ou moins le bruit de 3 000 tirages).
    expect(moyenne('non-qualifiees')).toBeGreaterThan(moyenne('releguees'));
    expect(moyenne('releguees')).toBeGreaterThan(moyenne('perdants-7-8'));
    expect(moyenne('non-qualifiees')).toBeCloseTo(3 / 37, 1);
  });

  it('reproduit la table des probabilités par choix fournie par Antonin le 25/11/2026 (source communautaire, à recouper)', () => {
    // Table par catégorie (moyenne des équipes de la catégorie), en % : choix 1 à 16. Transmise par Antonin, issue d'une
    // analyse communautaire publiée sur Reddit (URL non fournie) ; pas encore recoupée avec la table officielle de la NBA.
    const table: Record<ParticipantLoterie['categorie'], number[]> = {
      releguees: [5.4, 5.48, 5.57, 5.69, 5.8, 5.92, 6.04, 6.18, 6.34, 8.11, 14.39, 25.07, 0, 0, 0, 0],
      'non-qualifiees': [8.11, 8.0, 7.85, 7.71, 7.54, 7.39, 7.16, 6.94, 6.68, 6.04, 4.39, 1.84, 7.0, 6.1, 4.73, 2.53],
      'play-in-9-10': [5.41, 5.49, 5.58, 5.67, 5.81, 5.92, 6.04, 6.18, 6.33, 6.12, 4.72, 2.14, 8.8, 9.25, 9.27, 7.29],
      'perdants-7-8': [2.7, 2.83, 2.97, 3.12, 3.3, 3.51, 3.75, 4.03, 4.39, 4.49, 3.65, 1.7, 7.93, 10.16, 14.97, 26.51],
    };
    const p = probabilitesDeLaLoterie(D.loterie, participants, 20_000, 5);
    for (const [cat, attendu] of Object.entries(table) as [ParticipantLoterie['categorie'], number[]][]) {
      const ids = participants.filter((x) => x.categorie === cat).map((x) => x.equipe);
      for (let r = 0; r < 16; r++) {
        const simule = (100 * ids.reduce((s, e) => s + p[e]![r]!, 0)) / ids.length;
        // Bruit de 20 000 tirages : moins de 0,35 point d'écart-type pour la catégorie la moins nombreuse.
        expect(Math.abs(simule - attendu[r]!), `${cat}, choix ${r + 1}`).toBeLessThan(1);
      }
    }
  });

  it('applique les limites : pas de n° 1 deux fois de suite, pas de top 5 trois fois de suite', () => {
    expect(rangInterdit(D.loterie, [1], 1)).toBe(true);
    expect(rangInterdit(D.loterie, [1], 2)).toBe(false);
    expect(rangInterdit(D.loterie, [5, 2], 5)).toBe(true);
    expect(rangInterdit(D.loterie, [5, 2], 6)).toBe(false);
    expect(rangInterdit(D.loterie, [9, 2], 3)).toBe(false);
    // Historique réel : Washington n° 1 en 2026 ; Utah 5e en 2025 puis 2e en 2026.
    expect(D.historique['washington']?.at(-1)).toBe(1);
    expect(D.historique['utah']).toEqual([5, 2]);
    const avecHistorique = participants.map((p, i) => (i === 0 ? { ...p, equipe: 'washington' } : i === 1 ? { ...p, equipe: 'utah' } : p));
    const sansDoublon = avecHistorique.filter((p, i) => i < 2 || !['washington', 'utah'].includes(p.equipe));
    if (sansDoublon.length !== 16) return; // les deux équipes figuraient déjà dans la liste : cas couvert ci-dessus
    for (let t = 0; t < 300; t++) {
      const { ordre } = tirerLoterie(D.loterie, sansDoublon, D.historique, 5, `limites-${t}`);
      expect(ordre[0]).not.toBe('washington');
      expect(ordre.indexOf('utah') + 1).toBeGreaterThan(5);
    }
  });
});

describe('propriété des choix 2027', () => {
  it('attribue les 30 choix de chaque tour sans erreur, quel que soit l’ordre', () => {
    const P = D.proprietes['2027']!;
    for (let t = 0; t < 50; t++) {
      const melange = [...equipes].sort(
        (a, b) => ((a.length * 31 + t * 17 + a.charCodeAt(0)) % 30) - ((b.length * 31 + t * 17 + b.charCodeAt(0)) % 30),
      );
      const rangs1 = Object.fromEntries(melange.map((e, i) => [e, i + 1]));
      const rangs2 = Object.fromEntries(melange.map((e, i) => [e, 31 + i]));
      const t1 = appliquerProprietes(1, rangs1, P.tours['1']);
      const t2 = appliquerProprietes(2, rangs2, P.tours['2'], rangs1);
      expect(t1.map((c) => c.rang)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
      expect(t2.map((c) => c.rang)).toEqual(Array.from({ length: 30 }, (_, i) => i + 31));
      for (const c of [...t1, ...t2]) expect(equipes).toContain(c.detenteur);
    }
  });

  it('applique une protection : le choix reste à son équipe hors de la plage protégée', () => {
    const regle = {
      membres: [{ original: 'a' }],
      attributions: { '1': [{ beneficiaire: 'b', rangs: [5, 30] as [number, number] }] },
      description: 'A → B, protégé 1-4',
    };
    expect(appliquerProprietes(1, { a: 3, b: 10 }, [regle]).find((c) => c.original === 'a')!.detenteur).toBe('a');
    expect(appliquerProprietes(1, { a: 7, b: 10 }, [regle]).find((c) => c.original === 'a')!.detenteur).toBe('b');
  });

  it('donne le plus favorable de deux choix au premier bénéficiaire', () => {
    const regle = {
      membres: [{ original: 'a' }, { original: 'b' }],
      attributions: { '2': [{ beneficiaire: 'a' }, { beneficiaire: 'c' }] },
      description: 'A prend le meilleur de A et B, C l’autre',
    };
    const choix = appliquerProprietes(1, { a: 9, b: 4, c: 20 }, [regle]);
    expect(choix.find((c) => c.rang === 4)!.detenteur).toBe('a');
    expect(choix.find((c) => c.rang === 9)!.detenteur).toBe('c');
  });
});

describe('classe de Draft', () => {
  const classe = genererClasse(D.modele, D.noms, 2026, 2027, D.nomsPris);

  it('est déterministe et compte la taille prévue', () => {
    expect(classe).toHaveLength(D.modele.classe.taille);
    expect(genererClasse(D.modele, D.noms, 2026, 2027, D.nomsPris)).toEqual(classe);
    expect(genererClasse(D.modele, D.noms, 2026, 2028, D.nomsPris)[0]!.nom).not.toBe(undefined);
  });

  it('suit l’échelle des vrais rookies (40-73) avec un potentiel au moins égal à la note', () => {
    for (const p of classe) {
      expect(p.note).toBeGreaterThanOrEqual(40);
      expect(p.note).toBeLessThanOrEqual(73);
      expect(p.potentiel).toBeGreaterThanOrEqual(p.note);
      expect(p.potentiel).toBeLessThanOrEqual(D.modele.classe.potentiel.max);
      expect(Object.keys(D.modele.classe.ages)).toContain(String(p.age));
    }
    // Les meilleurs talents d'abord : le potentiel moyen des 10 premiers dépasse celui des 10 derniers.
    const moy = (xs: typeof classe) => xs.reduce((s, p) => s + p.potentiel, 0) / xs.length;
    expect(moy(classe.slice(0, 10))).toBeGreaterThan(moy(classe.slice(-10)) + 5);
  });

  it('ne donne jamais un nom réel interdit, ni un nom déjà pris, ni deux fois le même nom', () => {
    const noms = classe.map((p) => `${p.prenom} ${p.nom}`);
    expect(new Set(noms).size).toBe(noms.length);
    const pris = new Set(D.nomsPris);
    for (const p of classe) {
      expect(D.noms.estInterdit(p.prenom, p.nom)).toBe(false);
      expect(pris.has(`${p.prenom} ${p.nom}`)).toBe(false);
    }
  });
});

describe('scouting à notes incertaines', () => {
  const p = genererClasse(D.modele, D.noms, 2026, 2027, D.nomsPris)[0]!;
  const M = D.modele.scouting;

  it('resserre la fourchette avec les observations, sans changer le signe de l’erreur', () => {
    const peu = rapport(M, 2026, 'boston', p, 0);
    const beaucoup = rapport(M, 2026, 'boston', p, M.observationsMax);
    expect(beaucoup.potentiel.haut - beaucoup.potentiel.bas).toBeLessThan(peu.potentiel.haut - peu.potentiel.bas);
    expect(Math.abs(beaucoup.potentiel.valeur - p.potentiel)).toBeLessThanOrEqual(Math.abs(peu.potentiel.valeur - p.potentiel) + 1);
    expect(rapport(M, 2026, 'boston', p, 99).observations).toBe(M.observationsMax);
  });

  it('donne à chaque équipe sa propre erreur, fixée par la graine', () => {
    expect(rapport(M, 2026, 'boston', p, 1)).toEqual(rapport(M, 2026, 'boston', p, 1));
    const autres = equipes.map((e) => rapport(M, 2026, e, p, 0).potentiel.valeur);
    expect(new Set(autres).size).toBeGreaterThan(3);
    expect(rapportDuConsensus(M, 2026, p).observations).toBe(M.observationsDuConsensus);
  });

  it('couvre la vraie valeur dans environ 90 % des cas', () => {
    const classe = genererClasse(D.modele, D.noms, 99, 2027, D.nomsPris);
    let dedans = 0;
    let total = 0;
    for (const x of classe)
      for (const e of equipes.slice(0, 10)) {
        const r = rapport(M, 99, e, x, 2).note;
        total++;
        if (x.note >= r.bas && x.note <= r.haut) dedans++;
      }
    expect(dedans / total).toBeGreaterThan(0.85);
    expect(dedans / total).toBeLessThan(0.95);
  });

  it('compte le budget d’observations du GM', () => {
    expect(observationsRestantes(M, {})).toBe(M.budgetObservations);
    expect(observationsRestantes(M, { a: 4, b: 6 })).toBe(M.budgetObservations - 10);
  });
});

describe('soirée de Draft après une saison complète', () => {
  const fin: EtatSaison = avancer(ctx, nouvelleSaison(ctx, 2026, 'boston'), 'fin');

  it('tire la loterie et fixe 60 choix à la fin de la saison', () => {
    const d = fin.draft!;
    expect(d.annee).toBe(2027);
    expect(d.loterie!.ordre).toHaveLength(16);
    expect(d.loterie!.participants.map((p) => p.equipe).sort()).toEqual([...d.loterie!.ordre].sort());
    expect(d.choix).toHaveLength(60);
    expect(d.choix!.map((c) => c.rang)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    for (const tour of [1, 2]) expect(new Set(d.choix!.filter((c) => c.tour === tour).map((c) => c.original)).size).toBe(30);
    // Les 14 équipes qualifiées d'office choisissent du 17e au 30e choix (choix propres).
    const qualifiees = new Set(Object.values(fin.tetesDeSerie ?? {}).flat());
    for (const c of d.choix!.filter((x) => x.tour === 1 && x.rang <= 16)) expect(d.loterie!.ordre).toContain(c.original);
    expect(d.choix!.filter((c) => c.tour === 1 && c.rang > 16).every((c) => qualifiees.has(c.original))).toBe(true);
    expect(fin.actualites.some((a) => a.genre === 'draft')).toBe(true);
  });

  it('s’arrête au premier choix du GM, puis enchaîne jusqu’au bout', () => {
    const avant = avancerDraft(ctx, fin);
    const c = prochainChoix(avant.draft!);
    const duGm = fin.draft!.choix!.some((x) => x.detenteur === 'boston');
    if (!duGm) {
      expect(avant.draft!.terminee).toBe(true);
      return;
    }
    expect(c!.detenteur).toBe('boston');
    const pris = new Set(Object.values(avant.draft!.selections));
    const libre = avant.draft!.classe.find((p) => !pris.has(p.id))!;
    expect(() => avancerDraft(ctx, avant, [...pris][0])).toThrow(/indisponible/);
    let etat = avancerDraft(ctx, avant, libre.id);
    expect(etat.draft!.selections[String(c!.rang)]).toBe(libre.id);
    for (let garde = 0; !etat.draft!.terminee && garde < 4; garde++) {
      const deja = new Set(Object.values(etat.draft!.selections));
      etat = avancerDraft(ctx, etat, etat.draft!.classe.find((p) => !deja.has(p.id))!.id);
    }
    expect(etat.draft!.terminee).toBe(true);
    expect(new Set(Object.values(etat.draft!.selections)).size).toBe(60);
  });

  it('laisse le staff choisir pour le GM qui délègue, de façon déterministe', () => {
    const delegue = { ...fin, draft: { ...fin.draft!, delegue: true } };
    const a = avancerDraft(ctx, delegue);
    expect(a.draft!.terminee).toBe(true);
    expect(Object.keys(a.draft!.selections)).toHaveLength(60);
    expect(avancerDraft(ctx, delegue).draft!.selections).toEqual(a.draft!.selections);
    // Recrues : 60 joueurs, contrats de l'échelle au 1er tour (provisoires : plafond 2027-28 pas encore relevé).
    const r = a.draft!.recrues!;
    expect(r).toHaveLength(60);
    expect(r.filter((x) => x.salaires?.length === 4)).toHaveLength(30);
    expect(r[0]!.salaires).toEqual(contratDeRookie(D, 1, ctx.salaires.cba.plafondSalarial));
    expect(r[0]!.plafond.provisoire).toBe(true);
    expect(a.actualites.filter((x) => x.genre === 'draft')).toHaveLength(2);
    // Les prospects pris tôt sont en moyenne meilleurs que ceux pris tard (le staff se trompe, mais pas au hasard).
    const vrai = new Map(a.draft!.classe.map((p) => [p.id, p.potentiel]));
    const moy = (r: number[]) => r.reduce((s, k) => s + vrai.get(a.draft!.selections[String(k)]!)!, 0) / r.length;
    expect(moy(Array.from({ length: 10 }, (_, i) => i + 1))).toBeGreaterThan(moy(Array.from({ length: 10 }, (_, i) => i + 51)) + 3);
  });
});

describe('échelle des rookies', () => {
  it('reprend l’échelle 2026 au plafond de référence et la suit en proportion du plafond', () => {
    expect(contratDeRookie(D, 1, D.echelle.plafondDeReference)).toEqual(D.echelle.rangs[0]);
    const plus = contratDeRookie(D, 30, D.echelle.plafondDeReference * 1.1)!;
    expect(plus[0]).toBe(Math.round(D.echelle.rangs[29]![0]! * 1.1));
    expect(contratDeRookie(D, 31, D.echelle.plafondDeReference)).toBeUndefined();
  });
});
