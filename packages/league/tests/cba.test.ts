// Tranche 6 : contrats et CBA — masse salariale, taxe de luxe, minimums et maximums, exceptions, signatures, effectifs.
import { describe, expect, it } from 'vitest';
import {
  controlerEquipe,
  exceptionsDisponibles,
  niveauSalarial,
  salaireMaximum,
  salaireMinimum,
  situationEquipe,
  taxeDeLuxe,
  verifierSignature,
  type DemandeSignature,
  type SituationEquipe,
} from '../src';
import { chargerContexte } from './outils';

const ctx = chargerContexte();
const D = ctx.salaires;
const P = D.cba;
const joueursDe = (e: string) => ctx.equipes[e]!.joueurs.map((j) => j.id);
const situations = Object.fromEntries(Object.keys(ctx.equipes).map((e) => [e, situationEquipe(D, e, joueursDe(e))]));

describe('taxe de luxe', () => {
  it('retrouve au dollar près la taxe publiée de chacune des 30 équipes (barème 2025-26 et suivantes)', () => {
    for (const [id, e] of Object.entries(D.equipes)) expect(taxeDeLuxe(P, e.massePubliee, e.recidiviste), id).toBe(e.taxePubliee);
  });

  it('suit le barème par tranches, avec un taux récidiviste plus lourd', () => {
    const L = P.taxe.largeurTranche;
    expect(taxeDeLuxe(P, P.seuilTaxe, false)).toBe(0);
    expect(taxeDeLuxe(P, P.seuilTaxe + L, false)).toBe(Math.round(L * P.taxe.taux[0]!));
    expect(taxeDeLuxe(P, P.seuilTaxe + 2 * L, true)).toBe(Math.round(L * (P.taxe.tauxRecidiviste[0]! + P.taxe.tauxRecidiviste[1]!)));
    // Au-delà du barème : + 0,50 par tranche.
    const cinq = P.taxe.taux.reduce((s, t) => s + t * L, 0) + (P.taxe.taux.at(-1)! + P.taxe.hausseParTrancheSuivante) * L;
    expect(taxeDeLuxe(P, P.seuilTaxe + 5 * L, false)).toBe(Math.round(cinq));
  });
});

describe('masse salariale et effectifs', () => {
  it("donne la masse publiée de chaque équipe : contrats de l'effectif plus les autres charges", () => {
    for (const [id, s] of Object.entries(situations)) {
      expect(s.masse, id).toBe(D.equipes[id]!.massePubliee);
      // Les contrats individuels expliquent l'essentiel de la masse (le reste : argent mort, montants imputés).
      expect(s.contrats / s.masse, id).toBeGreaterThan(0.7);
      expect(s.autresCharges, id).toBeGreaterThan(-2_000_000);
    }
  });

  it('passe les contrôles du cap : effectifs, plafonds stricts', () => {
    for (const s of Object.values(situations)) expect(controlerEquipe(D, s).erreurs).toEqual([]);
    // Une hausse au-delà du plafond strict est refusée.
    const min = situations['minnesota']!;
    expect(controlerEquipe(D, { ...min, masse: min.masse + 1 }).erreurs.join()).toMatch(/plafond strict/);
    const totalTwoWay = Object.values(situations).reduce((t, s) => t + s.effectif.twoWay, 0);
    expect(totalTwoWay).toBeGreaterThan(80);
  });

  it('classe chaque équipe par niveau salarial', () => {
    expect(niveauSalarial(P, P.plafondSalarial)).toBe('sous-plafond');
    expect(niveauSalarial(P, P.plafondSalarial + 1)).toBe('au-dessus-du-plafond');
    expect(niveauSalarial(P, P.seuilTaxe + 1)).toBe('taxe');
    expect(niveauSalarial(P, P.premierApron + 1)).toBe('premier-apron');
    expect(niveauSalarial(P, P.deuxiemeApron + 1)).toBe('deuxieme-apron');
    expect(situations['brooklyn']!.niveau).toBe('sous-plafond');
    expect(situations['denver']!.niveau).toBe('premier-apron');
    expect(situations['atlanta']!.niveau).toBe('taxe');
  });
});

describe('minimums, maximums et exceptions', () => {
  it('lit les minimums et maximums par ancienneté', () => {
    expect(salaireMinimum(P, 0)).toBe(1_357_763);
    expect(salaireMinimum(P, 15)).toBe(3_876_529);
    expect(salaireMaximum(P, 6)).toBe(41_240_250);
    expect(salaireMaximum(P, 7)).toBe(49_488_300);
    expect(salaireMaximum(P, 12)).toBe(57_736_350);
  });

  it('donne à chaque équipe les exceptions de son niveau, dans la limite de ses plafonds', () => {
    const sous = exceptionsDisponibles(P, P.plafondSalarial - 10_000_000);
    expect(sous.map((e) => e.moyen)).toEqual(['espace', 'mid-level-espace', 'minimum']);
    expect(sous[0]!.montantMax).toBe(10_000_000);
    const auDessus = exceptionsDisponibles(P, P.plafondSalarial + 1_000_000).map((e) => e.moyen);
    expect(auDessus).toEqual(['mid-level', 'mid-level-contribuable', 'biannuelle', 'minimum']);
    // Près du premier apron, la mid-level non contribuable est réduite pour ne pas le franchir.
    const pres = exceptionsDisponibles(P, P.premierApron - 3_000_000).find((e) => e.moyen === 'mid-level')!;
    expect(pres.montantMax).toBe(3_000_000);
    expect(exceptionsDisponibles(P, P.deuxiemeApron + 1).map((e) => e.moyen)).toEqual(['minimum']);
    // Une équipe déjà plafonnée au second apron ne peut plus utiliser la mid-level non contribuable.
    expect(
      exceptionsDisponibles(P, P.plafondSalarial + 1, {
        massePubliee: 0,
        taxePubliee: 0,
        recidiviste: false,
        plafondStrict: 'deuxieme',
        autresCharges: 0,
      }).map((e) => e.moyen),
    ).not.toContain('mid-level');
  });
});

describe('contrôle des signatures', () => {
  const equipe = (masse: number, standard = 13, twoWay = 2, plafondStrict: SituationEquipe['plafondStrict'] = null): SituationEquipe => ({
    equipe: 'essai',
    masse,
    contrats: masse,
    autresCharges: 0,
    espace: P.plafondSalarial - masse,
    niveau: niveauSalarial(P, masse),
    taxe: 0,
    recidiviste: false,
    plafondStrict,
    effectif: { standard, twoWay, nonReleve: 0 },
    exceptions: exceptionsDisponibles(P, masse, {
      massePubliee: masse,
      taxePubliee: 0,
      recidiviste: false,
      plafondStrict,
      autresCharges: 0,
    }),
  });
  const demande = (d: Partial<DemandeSignature>): DemandeSignature => ({
    type: 'standard',
    salaire: 0,
    anciennete: 5,
    moyen: 'minimum',
    duree: 2,
    ...d,
  });

  it('accepte le minimum exact et impute le minimum de 2 ans pour un vétéran signé un an', () => {
    const v = verifierSignature(
      D,
      equipe(P.deuxiemeApron + 5_000_000),
      demande({ salaire: salaireMinimum(P, 12), anciennete: 12, duree: 1 }),
    );
    expect(v.autorise).toBe(true);
    expect(v.impute).toBe(P.minimumImputeVeteran);
    expect(verifierSignature(D, equipe(P.plafondSalarial), demande({ salaire: salaireMinimum(P, 5) + 1 })).autorise).toBe(false);
  });

  it("refuse un salaire hors du minimum ou du maximum de l'ancienneté", () => {
    const e = equipe(100_000_000);
    expect(verifierSignature(D, e, demande({ moyen: 'espace', salaire: salaireMaximum(P, 6) + 1, anciennete: 6 })).motifs.join()).toMatch(
      /maximum/,
    );
    expect(verifierSignature(D, e, demande({ moyen: 'espace', salaire: salaireMaximum(P, 6), anciennete: 6 })).autorise).toBe(true);
    // Espace insuffisant.
    expect(verifierSignature(D, equipe(140_000_000), demande({ moyen: 'espace', salaire: 40_000_000, anciennete: 6 })).autorise).toBe(
      false,
    );
    expect(verifierSignature(D, e, demande({ moyen: 'espace', salaire: 1_000_000, anciennete: 0 })).motifs.join()).toMatch(/minimum/);
  });

  it('applique les exceptions et les plafonds stricts', () => {
    const auDessus = equipe(P.plafondSalarial + 10_000_000);
    expect(verifierSignature(D, auDessus, demande({ moyen: 'mid-level', salaire: P.midLevelNonContribuable })).autorise).toBe(true);
    expect(verifierSignature(D, auDessus, demande({ moyen: 'mid-level', salaire: P.midLevelNonContribuable + 1 })).autorise).toBe(false);
    expect(verifierSignature(D, auDessus, demande({ moyen: 'espace', salaire: 5_000_000 })).autorise).toBe(false);
    const apron = equipe(P.premierApron + 1_000_000);
    expect(verifierSignature(D, apron, demande({ moyen: 'mid-level', salaire: 5_000_000 })).autorise).toBe(false);
    expect(verifierSignature(D, apron, demande({ moyen: 'mid-level-contribuable', salaire: P.midLevelContribuable })).autorise).toBe(true);
    // Plafond strict au premier apron : même un minimum ne peut pas le franchir.
    const strict = equipe(P.premierApron - 1_000_000, 13, 2, 'premier');
    expect(verifierSignature(D, strict, demande({ salaire: salaireMinimum(P, 5) })).motifs.join()).toMatch(/Plafond strict/);
  });

  it('respecte les limites d’effectif', () => {
    expect(verifierSignature(D, equipe(150_000_000, 15), demande({ salaire: salaireMinimum(P, 5) })).motifs.join()).toMatch(/15 contrats/);
    expect(verifierSignature(D, equipe(150_000_000, 13, 3), demande({ type: 'two-way' })).autorise).toBe(false);
    expect(verifierSignature(D, equipe(150_000_000, 13, 2), demande({ type: 'two-way' })).autorise).toBe(true);
  });
});
