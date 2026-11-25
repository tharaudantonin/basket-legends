// Tranche 10 : vie du club — propriétaire, vestiaire, G League, contrats en cours de saison (docs/CLUB.md).
import { beforeAll, describe, expect, it } from 'vitest';
import {
  actionDuGm,
  avancer,
  avancerDraft,
  bilansGLeague,
  contexteDeLaSaison,
  creerSauvegarde,
  dateDansLaSaison,
  DELEGATIONS_STAFF,
  effectifGLeague,
  facteurFidelite,
  formeDuMatch,
  hardshipDisponibles,
  lireSauvegarde,
  mesurerClub,
  niveauAtteint,
  nouvellePartie,
  ouvrirIntersaison,
  passerALaSaisonSuivante,
  rejouerMatch,
  salaireMinimum,
  situationEquipe,
  temperamentDe,
  type EtatSaison,
} from '../src';
import { chargerContexte } from './outils';

const base = chargerContexte(false, true);
const MC = base.club!.modele;
const P = base.salaires.cba;
const partie = (franchise = 'boston'): EtatSaison => nouvellePartie(base, 2026, franchise);
const ctxDe = (e: EtatSaison) => contexteDeLaSaison(base, e);
/** Avance jour par jour jusqu'à une date (saison régulière). */
function jusqua(etat: EtatSaison, date: string): EtatSaison {
  let e = etat;
  while (e.phase === 'reguliere' && e.date < date) e = avancer(ctxDe(e), e, 'jour');
  return e;
}

describe('données de la tranche 10 (paramètres sourcés)', () => {
  it('contrats de 10 jours, exception de difficulté, two-way en saison', () => {
    expect(P.dixJours).toEqual({
      premierJour: '01-05',
      jours: 10,
      matchsMin: 3,
      joursSaison: 174,
      parJoueurEtEquipe: 2,
      joursRestantsMin: 10,
    });
    expect(P.hardship).toEqual({ blessesMin: 4, matchsManquesMin: 3, joursRestantsMin: 14 });
    expect(P.twoWayEnSaison.dateLimiteSignature).toBe('03-04');
    expect(dateDansLaSaison('2026-2027', '03-04')).toBe('2027-03-04');
    expect(dateDansLaSaison('2026-2027', '11-06')).toBe('2026-11-06');
  });
  it('G League : 30 équipes affiliées, Tip-Off de 14 matchs, saison de 36, huit par conférence en playoffs', () => {
    const G = base.club!.gLeague;
    expect([G.affiliees, G.tipOff.matchs, G.saisonReguliere.matchs, G.playoffs.parConference]).toEqual([30, 14, 36, 8]);
    expect(base.club!.licenciementsReleves['2024-2025']).toBe(5);
  });
});

describe('propriétaires (réponses 50 et 51)', () => {
  it('chaque franchise a un propriétaire ; les récidivistes de la taxe sont plus souvent ambitieux', () => {
    const e = partie();
    const C = e.univers!.club!;
    expect(Object.keys(C.proprietaires)).toHaveLength(30);
    const recidivistes = Object.keys(C.proprietaires).filter((x) => e.univers!.equipes[x]?.recidiviste);
    for (const x of Object.keys(C.proprietaires))
      expect(C.proprietaires[x]!.confiance).toBe(MC.proprietaire.profils[C.proprietaires[x]!.profil].depart);
    if (recidivistes.length) expect(recidivistes.filter((x) => C.proprietaires[x]!.profil === 'ambitieux').length).toBeGreaterThan(0);
    expect(C.parcours).toEqual([{ franchise: 'boston', de: '2026-2027' }]);
  });
  it('objectifs selon le rang de force : les plus fortes visent la finale, les plus faibles reconstruisent', () => {
    const e = partie();
    const o = Object.values(e.club!.objectifs);
    expect(o).toHaveLength(30);
    const parRang = o.sort((a, b) => a.rangForce - b.rangForce);
    expect(parRang[0]!.type).toBe('titre');
    expect(parRang.at(-1)!.type).toBe('reconstruction');
    expect(e.actualites.some((a) => a.genre === 'club' && a.titre.startsWith('L’objectif du propriétaire'))).toBe(true);
  });
  it('niveau atteint : Play-In, tours des playoffs, titre', () => {
    const e = {
      series: [
        { tour: 1, haut: 'a', bas: 'b', vainqueur: 'a' },
        { tour: 2, haut: 'a', bas: 'c', vainqueur: 'c' },
      ],
      palmares: undefined,
    } as unknown as EtatSaison;
    expect(niveauAtteint(e, 'a', 3, [7, 10])).toBe(3);
    expect(niveauAtteint(e, 'c', 2, [7, 10])).toBe(4);
    expect(niveauAtteint(e, 'b', 6, [7, 10])).toBe(2);
    expect(niveauAtteint(e, 'z', 9, [7, 10])).toBe(1);
    expect(niveauAtteint(e, 'y', 12, [7, 10])).toBe(0);
  });
});

describe('une saison complète avec la vie du club', () => {
  let fin: EtatSaison;
  beforeAll(() => {
    const e = partie();
    e.delegations = { ...DELEGATIONS_STAFF };
    fin = avancer(ctxDe(e), e, 'fin');
  }, 120_000);

  it('G League : 14 matchs de Tip-Off et 36 de saison par équipe, Showcase, champion, statistiques', () => {
    const G = fin.club!.gLeague!;
    const tip = bilansGLeague(G, 'tip-off');
    const reg = bilansGLeague(G, 'reguliere');
    for (const e of Object.keys(base.equipes)) {
      expect(tip[e]![0] + tip[e]![1]).toBe(14);
      expect(reg[e]![0] + reg[e]![1]).toBe(36);
      expect(effectifGLeague(fin.univers!, e).length).toBeGreaterThanOrEqual(8);
    }
    expect(G.vainqueurShowcase).toBeDefined();
    expect(G.champion).toBeDefined();
    expect(G.matchs.every((m) => m.score)).toBe(true);
    const lignes = Object.values(G.statistiques);
    expect(lignes.length).toBeGreaterThan(200);
    expect(lignes.every((l) => l.minutes <= 48 * l.matchs)).toBe(true);
  });

  it('bilan du propriétaire pour les 30 équipes ; licenciements notés ; moral dans ses bornes', () => {
    expect(Object.keys(fin.club!.bilan!)).toHaveLength(30);
    const lic = fin.univers!.club!.licenciements['2026-2027']!;
    expect(lic.length).toBe(Object.values(fin.club!.bilan!).filter((b) => b.licencie).length);
    for (const e of lic.filter((x) => x !== fin.franchise)) expect(fin.univers!.club!.proprietaires[e]!.gm).toBe(1);
    const m = mesurerClub(fin);
    expect(m.moralMoyen).toBeGreaterThan(MC.critereSortie.moralMoyen[0]);
    expect(m.moralMoyen).toBeLessThan(MC.critereSortie.moralMoyen[1]);
    expect(Math.abs(m.effetMoyen)).toBeLessThan(MC.critereSortie.effetMoyenMax);
    expect(m.ecartMax).toBeLessThanOrEqual(2 * MC.vestiaire.effetMatch.max + 1e-9);
  });

  it('les matchs se rejouent à l’identique avec la forme notée', () => {
    const ctx = ctxDe(fin);
    const avecForme = fin.matchs.filter((m) => m.forme);
    expect(avecForme.length).toBeGreaterThan(100);
    for (const m of [...avecForme.slice(0, 3), ...avecForme.slice(-3)]) expect(rejouerMatch(ctx, fin, m).empreinte).toBe(m.empreinte);
  });

  it('se sauvegarde et se relit à l’identique', () => {
    const s = lireSauvegarde(
      JSON.parse(JSON.stringify(creerSauvegarde(fin, { regles: 'r', moteur: 'm', notes: 'n' }, '2026-11-25T10:00:00Z'))),
    );
    expect(s.etat).toEqual(fin);
  });

  it('licencié, le GM du joueur choisit parmi ses offres avant la Draft et l’intersaison', () => {
    const e = structuredClone(fin);
    // Le propriétaire perd patience : on refait le bilan avec une confiance au plus bas.
    const C = e.univers!.club!;
    const offres = Object.keys(C.proprietaires)
      .filter((x) => x !== e.franchise)
      .slice(0, 3);
    e.club!.licenciement = { offres };
    expect(() => avancerDraft(ctxDe(e), e)).toThrow(/licencié/);
    expect(() => ouvrirIntersaison(base, e)).toThrow(/licencié/);
    const r = actionDuGm(base, e, { genre: 'offre-emploi', franchise: offres[1]! });
    expect(r.etat.franchise).toBe(offres[1]);
    expect(r.etat.club!.licenciement).toBeUndefined();
    expect(r.etat.univers!.club!.parcours.at(-1)).toEqual({ franchise: offres[1], de: '2026-2027' });
    expect(() => actionDuGm(base, e, { genre: 'offre-emploi', franchise: 'boston' })).toThrow();
  });

  it('intersaison : le moral retombe vers son niveau de départ, assignations finies', { timeout: 60_000 }, () => {
    const d = avancerDraft(ctxDe(fin), { ...fin, draft: { ...fin.draft!, delegue: true } });
    const s = passerALaSaisonSuivante(base, d);
    const M = MC.vestiaire.moral;
    for (const [j, m] of Object.entries(s.univers!.club!.moral).slice(0, 50)) {
      const avant = fin.univers!.club!.moral[j];
      if (avant !== undefined) expect(Math.abs(m - M.depart)).toBeLessThanOrEqual(Math.abs(avant - M.depart) + 1e-9);
    }
    // L'IA assigne ses jeunes, jamais ceux de la franchise du joueur.
    expect(Object.values(s.univers!.club!.assignes)).not.toContain(s.franchise);
    expect(s.club!.objectifs[s.franchise]).toBeDefined();
    expect(s.club!.gLeague!.matchs.length).toBe(750);
    expect(s.archives!.at(-1)!.championGLeague).toBe(fin.club!.gLeague!.champion);
  });
});

describe('contrats en cours de saison (réponse 49)', () => {
  let janvier: EtatSaison;
  beforeAll(() => {
    janvier = jusqua(partie(), '2027-01-05');
  }, 120_000);
  const libre = (e: EtatSaison) =>
    Object.keys(e.univers!.horsNba)
      .filter((j) => e.univers!.joueurs[j])
      .sort((a, b) => e.univers!.joueurs[b]!.note - e.univers!.joueurs[a]!.note)[0]!;
  const couperUn = (e: EtatSaison): EtatSaison => {
    const u = e.univers!;
    const j = u.effectifs
      .boston!.filter((x) => u.contrats[x]?.type === 'standard')
      .sort((a, b) => u.joueurs[a]!.note - u.joueurs[b]!.note)[0]!;
    return actionDuGm(base, e, { genre: 'couper', joueur: j, etaler: false }).etat;
  };

  it('10 jours : salaire au prorata, fin après 10 jours et 3 matchs, deux au plus avec la même équipe', { timeout: 120_000 }, () => {
    let e = structuredClone(janvier);
    const avant = situationEquipe(ctxDe(e).salaires, 'boston', e.univers!.effectifs.boston!).effectif.standard;
    if (avant >= P.contratsStandardMax) e = couperUn(e);
    const j = libre(e);
    e = actionDuGm(base, e, { genre: 'dix-jours', joueur: j, hardship: false }).etat;
    const c = e.univers!.contrats[j]!;
    expect(c.dixJours).toMatchObject({ numero: 1, hardship: false });
    expect(c.salaires[0]!.montant).toBe(Math.round((salaireMinimum(ctxDe(e).salaires.cba, 0) * 10) / 174));
    const debut = e.date;
    for (let k = 0; k < 14 && e.univers!.effectifs.boston!.includes(j); k++) e = avancer(ctxDe(e), e, 'jour');
    expect(e.univers!.effectifs.boston!.includes(j)).toBe(false);
    expect(e.univers!.horsNba[j]).toBe('libre');
    const joues = e.matchs.filter(
      (m) => m.date >= debut && (m.domicile === 'boston' || m.exterieur === 'boston') && m.date < e.date,
    ).length;
    expect(joues).toBeGreaterThanOrEqual(3);
    e = actionDuGm(base, e, { genre: 'dix-jours', joueur: j, hardship: false }).etat;
    expect(e.univers!.contrats[j]!.dixJours!.numero).toBe(2);
    e = actionDuGm(base, e, { genre: 'garder-dix-jours', joueur: j }).etat;
    expect(e.univers!.contrats[j]!.dixJours).toBeUndefined();
    expect(e.univers!.effectifs.boston!).toContain(j);
  });

  it('refusés : 10 jours avant le 5 janvier, two-way après le 4 mars, troisième contrat de 10 jours', () => {
    const tot = partie();
    expect(() => actionDuGm(base, tot, { genre: 'dix-jours', joueur: libre(tot), hardship: false })).toThrow(/5\/01|01\/05|avant/);
    const tard = structuredClone(janvier);
    tard.date = '2027-03-05';
    expect(() => actionDuGm(base, tard, { genre: 'two-way', joueur: libre(tard) })).toThrow(/04\/03|après/);
    const e = structuredClone(janvier);
    e.club!.dixJoursSignes[`${libre(e)}:boston`] = 2;
    expect(() => actionDuGm(base, e, { genre: 'dix-jours', joueur: libre(e), hardship: false })).toThrow(/Déjà 2/);
  });

  it('two-way signé en saison : limite de matchs au prorata ; conversion avec une place parmi les 15', () => {
    let e = structuredClone(janvier);
    const u = e.univers!;
    const tw = u.effectifs.boston!.filter((x) => u.contrats[x]?.type === 'two-way');
    if (tw.length >= P.contratsTwoWayMax) e = actionDuGm(base, e, { genre: 'couper', joueur: tw[0]!, etaler: false }).etat;
    const j = libre(e);
    e = actionDuGm(base, e, { genre: 'two-way', joueur: j }).etat;
    const limite = e.univers!.contrats[j]!.limiteMatchs!;
    expect(limite).toBeLessThan(50);
    expect(limite).toBeGreaterThan(10);
    const standard = situationEquipe(ctxDe(e).salaires, 'boston', e.univers!.effectifs.boston!).effectif.standard;
    if (standard >= P.contratsStandardMax) expect(() => actionDuGm(base, e, { genre: 'convertir', joueur: j })).toThrow(/complet/);
    else {
      const r = actionDuGm(base, e, { genre: 'convertir', joueur: j });
      expect(r.etat.univers!.contrats[j]!.type).toBe('standard');
    }
  });

  it('exception de difficulté : quatre blessés de longue durée ouvrent une place hors des 15', () => {
    let e = structuredClone(janvier);
    const v = e.univers!;
    // Effectif standard complété directement (15 contrats).
    while (situationEquipe(ctxDe(e).salaires, 'boston', v.effectifs.boston!).effectif.standard < P.contratsStandardMax) {
      const j = libre(e);
      delete v.horsNba[j];
      v.effectifs.boston!.push(j);
      v.contrats[j] = {
        type: 'standard',
        salaires: [{ saison: '2026-27', montant: 1_000_000 }],
        garanti: 1_000_000,
        anciennete: 0,
        draft: null,
      };
    }
    expect(hardshipDisponibles(ctxDe(e), e, 'boston')).toBe(0);
    const blesses = v.effectifs.boston!.filter((x) => v.contrats[x]?.type === 'standard').slice(0, 5);
    for (const j of blesses) {
      e.blessures[j] = 20;
      e.club!.absences[j] = 3;
    }
    expect(hardshipDisponibles(ctxDe(e), e, 'boston')).toBe(2);
    e = actionDuGm(base, e, { genre: 'dix-jours', joueur: libre(e), hardship: true }).etat;
    expect(hardshipDisponibles(ctxDe(e), e, 'boston')).toBe(1);
    expect(situationEquipe(ctxDe(e).salaires, 'boston', e.univers!.effectifs.boston!).effectif.standard).toBe(P.contratsStandardMax);
  });
});

describe('vestiaire (réponses 52 et 53)', () => {
  it('tempérament fixe pour une partie ; fidélité croissante avec le moral', () => {
    const e = partie();
    const j = e.univers!.joueurs[e.univers!.effectifs.boston![0]!]!;
    expect(temperamentDe(MC, j, 2026)).toBe(temperamentDe(MC, j, 2026));
    const C = structuredClone(e.univers!.club!);
    C.moral.x = 10;
    const bas = facteurFidelite(MC, C, 'x');
    C.moral.x = 65;
    const moyen = facteurFidelite(MC, C, 'x');
    C.moral.x = 95;
    const haut = facteurFidelite(MC, C, 'x');
    expect(bas).toBeLessThan(moyen);
    expect(moyen).toBeCloseTo(1, 9);
    expect(haut).toBeGreaterThan(moyen);
  });

  it('la forme d’un match est bornée et suit l’écart de moral à la moyenne de la ligue', () => {
    const e = partie();
    for (const j of e.univers!.effectifs.boston!) e.univers!.club!.moral[j] = 95;
    const f = formeDuMatch(ctxDe(e), e, 'boston', 'miami')!;
    expect(f[0]).toBeGreaterThan(0);
    expect(f[0]).toBeLessThanOrEqual(MC.vestiaire.effetMatch.max);
    expect(f[1]).toBeLessThanOrEqual(0);
  });

  it('un message à choix : effets tirés, réponse par défaut après le délai', () => {
    let e = partie();
    e.delegations = { ...DELEGATIONS_STAFF };
    e = avancer(ctxDe(e), e, 'jour');
    const j = e.univers!.effectifs.boston![0]!;
    e.club!.messages.push({
      id: 1,
      evenement: 'VES-001',
      date: e.date,
      titre: 't',
      texte: 't',
      de: 'adjoint',
      joueur: j,
      choix: ['a', 'b', 'c'],
    });
    const r = actionDuGm(base, e, { genre: 'club-message', id: 1, choix: 0 });
    expect(r.etat.club!.messages[0]!.reponse).toBe(0);
    expect(r.etat.club!.promesses[j]).toBe(e.date);
    expect(() => actionDuGm(base, r.etat, { genre: 'club-message', id: 1, choix: 1 })).toThrow();
    e.club!.messages[0] = { ...e.club!.messages[0]!, date: '2026-10-01' };
    const apres = avancer(ctxDe(e), e, 'jour');
    expect(apres.club!.messages[0]!.parDefaut).toBe(true);
    expect(apres.club!.messages[0]!.reponse).toBe(1);
  });
});
