// Tranche 8 : progression, vieillissement, intersaison, changements de franchise et stabilité sur 20 saisons.
import { describe, expect, it } from 'vitest';
import {
  avancer,
  contexteDeLaSaison,
  creerSauvegarde,
  demenager,
  ecartsDeStabilite,
  evolutionAttendue,
  intersaisonPossible,
  lireSauvegarde,
  mesurerUnivers,
  nouvelleSaison,
  passerALaSaisonSuivante,
  probabiliteDeRetraite,
  terminerSansMatchs,
  vieillir,
  type EtatSaison,
  type JoueurCarriere,
  type Univers,
} from '../src';
import { chargerContexte } from './outils';

const base = chargerContexte(false, true);
const C = base.carriere!;
const M = C.modele;
const u0 = base.univers!;

/** Une saison accélérée puis l'intersaison. */
const saisonSuivante = (etat: EtatSaison): EtatSaison =>
  passerALaSaisonSuivante(base, terminerSansMatchs(contexteDeLaSaison(base, etat), etat));
const depart = nouvelleSaison(base, 2026, 'boston');
const deuxieme = saisonSuivante(depart);
const u1 = deuxieme.univers!;

describe('progression et vieillissement', () => {
  const joueurs = Object.values(u0.joueurs);
  it('est déterministe, ajoute un an et garde l’historique des notes', () => {
    const j = joueurs[0]!;
    const a = vieillir(M.progression, j, 1, '2027-2028');
    expect(vieillir(M.progression, j, 1, '2027-2028')).toEqual(a);
    expect(a.age).toBe(j.age + 1);
    expect(a.notes.at(-1)).toEqual({ saison: '2027-2028', note: a.note });
    expect(a.notes).toHaveLength(j.notes.length + 1);
  });

  it('fait progresser les jeunes et décliner les plus âgés, en moyenne', () => {
    const evolution = (age: number) => {
      const groupe = joueurs.filter((j) => j.origine === 'snapshot' && j.age === age);
      const d = groupe.flatMap((j) => [1, 2, 3].map((g) => vieillir(M.progression, j, g, '2027-2028').note - j.note));
      return d.reduce((s, x) => s + x, 0) / d.length;
    };
    expect(evolution(21)).toBeGreaterThan(0.5);
    expect(evolution(32)).toBeLessThan(-1);
    expect(evolution(34)).toBeLessThan(evolution(30));
  });

  it('rapproche un joueur généré de son potentiel avant le pic, jamais au-delà en moyenne', () => {
    const jeune: JoueurCarriere = { ...joueurs.find((j) => j.potentiel !== null)!, age: 20, note: 60, potentiel: 80 };
    expect(evolutionAttendue(M.progression, jeune)).toBeGreaterThan(0);
    expect(evolutionAttendue(M.progression, { ...jeune, note: 80 })).toBe(0);
  });

  it('fait décliner l’athlétisme plus tôt que la lecture du jeu', () => {
    const vieux = joueurs.filter((j) => j.age >= 31);
    let vitesse = 0;
    let qi = 0;
    for (const j of vieux) {
      const a = vieillir(M.progression, j, 5, '2027-2028');
      vitesse += a.details.vitesse - j.details.vitesse;
      qi += a.details.qiOffensif - j.details.qiOffensif;
    }
    expect(vitesse / vieux.length).toBeLessThan(qi / vieux.length - 1);
  });

  it('garde notes, attributs et familles dans les bornes', () => {
    for (const j of joueurs.slice(0, 200)) {
      const a = vieillir(M.progression, j, 9, '2027-2028');
      for (const x of [a.note, ...Object.values(a.details), ...Object.values(a.familles)]) {
        expect(x).toBeGreaterThanOrEqual(M.progression.bornes[0]);
        expect(x).toBeLessThanOrEqual(M.progression.bornes[1]);
      }
    }
  });
});

describe('retraites', () => {
  const j = Object.values(u0.joueurs)[0]!;
  it('aucune avant l’âge du modèle, certaine au-delà de l’âge maximum, plus probable hors NBA', () => {
    expect(probabiliteDeRetraite(M.retraite, { ...j, age: 24 }, true)).toBe(0);
    expect(probabiliteDeRetraite(M.retraite, { ...j, age: M.retraite.ageMax + 1 }, true)).toBe(1);
    expect(probabiliteDeRetraite(M.retraite, { ...j, age: 34, note: 70 }, false)).toBeGreaterThan(
      probabiliteDeRetraite(M.retraite, { ...j, age: 34, note: 70 }, true),
    );
  });
});

describe('intersaison', () => {
  it('suppose la saison terminée, Draft comprise', () => {
    expect(intersaisonPossible(depart)).toBe(false);
    expect(() => passerALaSaisonSuivante(base, depart)).toThrow();
  });

  it('rend la saison suivante : univers, archive, calendrier décalé, nouvelle classe de Draft', () => {
    expect(deuxieme.saison).toBe('2027-2028');
    expect(deuxieme.phase).toBe('reguliere');
    expect(u1.saison).toBe('2027-2028');
    expect(deuxieme.archives).toHaveLength(1);
    expect(deuxieme.archives![0]!.saison).toBe('2026-2027');
    expect(deuxieme.draft?.annee).toBe(2028);
    // Même jour de la semaine que la saison de référence (décalage en semaines entières).
    const jour = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
    expect(jour(deuxieme.calendrier[0]!.date)).toBe(jour(depart.calendrier[0]!.date));
    expect(deuxieme.calendrier[0]!.date.startsWith('2027-10')).toBe(true);
  });

  it('est déterministe', { timeout: 30_000 }, () => {
    expect(saisonSuivante(depart)).toEqual(deuxieme);
  });

  it('donne des effectifs conformes à la CBA, sans joueur en double ni contrat hors NBA', () => {
    const P = base.salaires.cba;
    const vus = new Set<string>();
    for (const [e, js] of Object.entries(u1.effectifs)) {
      const standard = js.filter((j) => u1.contrats[j]?.type === 'standard');
      const twoWay = js.filter((j) => u1.contrats[j]?.type === 'two-way');
      expect(standard.length + twoWay.length, e).toBe(js.length);
      expect(standard.length, e).toBeGreaterThanOrEqual(M.effectifs.standardVises);
      expect(standard.length, e).toBeLessThanOrEqual(P.contratsStandardMax);
      expect(twoWay.length, e).toBeLessThanOrEqual(P.contratsTwoWayMax);
      for (const j of js) {
        expect(vus.has(j), j).toBe(false);
        vus.add(j);
        expect(u1.joueurs[j], j).toBeDefined();
        expect(u1.horsNba[j], j).toBeUndefined();
      }
      // Chaque contrat standard a un salaire pour la saison à venir.
      for (const j of standard)
        expect(
          u1.contrats[j]!.salaires.some((s) => s.saison === '2027-28'),
          j,
        ).toBe(true);
      // Numéros uniques dans l'équipe.
      const numeros = js.map((j) => u1.joueurs[j]!.numero).filter((n) => n !== '');
      expect(new Set(numeros).size, e).toBeGreaterThanOrEqual(numeros.length - 2);
    }
    for (const j of Object.keys(u1.horsNba)) expect(u1.contrats[j], j).toBeUndefined();
  });

  it('fait vieillir les joueurs, retire les retraités et accueille la classe de Draft', () => {
    const archive = deuxieme.archives![0]!;
    expect(archive.retraites.length).toBeGreaterThan(30);
    for (const id of archive.retraites) {
      expect(u1.joueurs[id]).toBeUndefined();
      expect(u1.retraites[id]).toBeDefined();
    }
    const resteDuSnapshot = Object.values(u1.joueurs).filter((j) => j.origine === 'snapshot');
    for (const j of resteDuSnapshot) expect(j.age).toBe(u0.joueurs[j.id]!.age + 1);
    const classe = depart.draft ? terminerSansMatchs(contexteDeLaSaison(base, depart), depart).draft!.classe : [];
    for (const p of classe) expect(u1.joueurs[p.id], p.id).toBeDefined();
    expect(u1.recrues).toHaveLength(60);
  });

  it('se sauvegarde et se relit à l’identique (univers et archives compris)', () => {
    const donnees = { regles: 'nba-2026-27', moteur: 'match-v5', notes: 'notes-v2', carriere: 'carriere-v1' };
    const s = creerSauvegarde(deuxieme, donnees, '2026-11-24T12:00:00Z');
    expect(lireSauvegarde(JSON.parse(JSON.stringify(s))).etat).toEqual(deuxieme);
  });

  it('se joue : la saison suivante avance avec le contexte de son univers', () => {
    const ctx = contexteDeLaSaison(base, deuxieme);
    expect(ctx.structure.saison).toBe('2027-2028');
    expect(Object.values(ctx.equipes).every((e) => e.joueurs.length >= 13)).toBe(true);
    const apres = avancer(ctx, deuxieme, 'jour');
    expect(apres.matchs.length).toBeGreaterThan(0);
  });
});

describe('changement de franchise', () => {
  const certain = { ...C, modele: { ...M, demenagement: { probabiliteParSaison: 1, delaiMinimum: 15 } } };
  it('ne touche jamais la franchise du joueur, ne donne une ville qu’une fois, reste dans la conférence', () => {
    const conference: Record<string, string> = {};
    for (const c of base.structure.conferences) for (const d of c.divisions) for (const f of d.franchises) conference[f] = c.id;
    for (let g = 0; g < 60; g++) {
      const u: Univers = structuredClone(u0);
      const vus = new Set<string>();
      for (let s = 0; s < 12; s++) {
        const saison = `${2027 + s}-${2028 + s}`;
        const d = demenager(certain, u, 'boston', g, saison, base.structure);
        if (!d) continue;
        expect(d.franchise).not.toBe('boston');
        const ville = u.franchises[d.franchise]!.ville;
        expect(vus.has(ville)).toBe(false);
        vus.add(ville);
        expect(C.villes.find((v) => v.ville === ville)!.conference).toBe(conference[d.franchise]);
      }
    }
  });

  it('arrive en moyenne une fois toutes les 8 saisons', () => {
    let n = 0;
    const essais = 400;
    for (let g = 0; g < essais; g++)
      if (demenager(C, { ...u0, franchises: structuredClone(u0.franchises) }, 'boston', g, '2027-2028', base.structure)) n++;
    expect(n / essais).toBeGreaterThan(0.08);
    expect(n / essais).toBeLessThan(0.17);
  });
});

describe('critère de sortie de la tranche 8', () => {
  it('garde la distribution des notes stable sur 20 saisons (saisons accélérées, graine 2026)', () => {
    const m0 = mesurerUnivers(u0);
    let etat = depart;
    const ecarts: string[] = [];
    for (let s = 0; s < 20; s++) {
      etat = saisonSuivante(etat);
      ecarts.push(...ecartsDeStabilite(m0, mesurerUnivers(etat.univers!)));
    }
    expect(ecarts).toEqual([]);
    expect(etat.archives).toHaveLength(20);
  }, 120_000);
});
