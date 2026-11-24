// Tranche 5 : mode interactif (décisions, arrêts de jeu, reprise déterministe), plans de jeu et défenseur direct.
import { describe, expect, it } from 'vitest';
import {
  ajouterDecision,
  annulerDecisions,
  cinqAuMoment,
  commenterMatch,
  pasSuivant,
  simulerMatch,
  type DecisionMatch,
  type EntreeMatch,
  type Lecture,
  type PlanDeJeu,
  type ResultatMatch,
} from '../src';
import { entree, equipes, regles, reglages } from './outils';

const base = entree(2026, 'boston', 'new-york');
const jouer = (decisions: DecisionMatch[] = [], e: EntreeMatch = base): ResultatMatch =>
  simulerMatch({ ...e, decisions }, { arrets: true });
const sans = jouer();
const arrets = sans.arrets!;
const premierBallonMort = arrets.find((a) => !a.debutDePeriode && a.periode === 2)!;

describe('arrêts de jeu', () => {
  it("rendre l'état aux arrêts ne change pas le match", () => {
    const rapide = simulerMatch(base);
    expect(sans.evenements).toEqual(rapide.evenements);
    expect(sans.empreinte).toBe(rapide.empreinte);
    expect(rapide.arrets).toBeUndefined();
  });

  it('numérote les arrêts dans l’ordre : avant le match, chaque début de période, chaque ballon mort', () => {
    expect(arrets[0]).toMatchObject({ numero: 0, indice: 0, debutDePeriode: true, periode: 1, possession: null });
    arrets.forEach((a, i) => expect(a.numero).toBe(i));
    for (let i = 1; i < arrets.length; i++) expect(arrets[i]!.indice).toBeGreaterThanOrEqual(arrets[i - 1]!.indice);
    const periodes = sans.boxScore.periodes;
    expect(arrets.filter((a) => a.debutDePeriode)).toHaveLength(periodes);
    // Un début de période précède toujours l'événement « début de période » du journal.
    for (const a of arrets.filter((x) => x.debutDePeriode)) expect(sans.evenements[a.indice]!.type).toBe('debut_periode');
    // Assez d'arrêts pour diriger un match (plus d'une centaine de ballons morts).
    expect(arrets.length).toBeGreaterThan(100);
  });

  it("décrit l'état du match : cinq sur le terrain, fraîcheur, temps-morts restants", () => {
    const a = premierBallonMort;
    expect(a.surTerrain[0]).toEqual(cinqAuMoment(sans.evenements, a.indice - 1)[0]);
    expect(a.joueurs[0]).toHaveLength(base.domicile.joueurs.length);
    for (const j of a.joueurs[0]) expect(j.fraicheur).toBeGreaterThanOrEqual(0);
    expect(a.tempsMortsRestants[0]).toBeLessThanOrEqual(regles.tempsMortsParMatch);
    expect(a.possession === 0 || a.possession === 1).toBe(true);
  });
});

describe('reprise déterministe', () => {
  const decisions: DecisionMatch[] = [
    { arret: 0, equipe: 0, genre: 'plan', plan: { rythme: 'rapide', defense: 'zone' } },
    { arret: premierBallonMort.numero, equipe: 0, genre: 'temps_mort' },
    { arret: premierBallonMort.numero + 3, equipe: 1, genre: 'plan', plan: { troisPoints: 'plus' } },
  ];

  it('même graine et mêmes décisions : même match, mêmes arrêts', () => {
    const a = jouer(decisions);
    const b = jouer(decisions.map((d) => ({ ...d })));
    expect(b.evenements).toEqual(a.evenements);
    expect(b.arrets).toEqual(a.arrets);
    expect(b.empreinte).toBe(a.empreinte);
    expect(a.decisionsRejetees).toEqual([]);
    expect(a.empreinte).not.toBe(sans.empreinte);
  });

  it("le match avant un arrêt ne dépend pas des décisions prises à cet arrêt (ni de l'état du générateur)", () => {
    for (const k of [0, 1, premierBallonMort.numero, arrets.length - 2]) {
      const r = jouer([{ arret: k, equipe: 1, genre: 'plan', plan: { rythme: 'lent', defense: 'zone', troisPoints: 'moins' } }]);
      const a = arrets[k]!;
      expect(r.evenements.slice(0, a.indice)).toEqual(sans.evenements.slice(0, a.indice));
      expect(r.arrets!.slice(0, k)).toEqual(arrets.slice(0, k));
      expect(r.arrets![k]!.hasard).toBe(a.hasard);
      expect(r.arrets![k]!.plans[1]).toMatchObject({ rythme: 'lent', defense: 'zone', troisPoints: 'moins' });
    }
  });

  it('jouer décision après décision donne le même match que tout rejouer depuis le coup d’envoi', () => {
    // Comme l'écran : une décision, on rejoue, on avance, une autre décision, on rejoue.
    let d: DecisionMatch[] = [];
    let r = jouer(d);
    for (const k of [5, 30, 60, arrets.length - 5]) {
      const avant = r;
      d = ajouterDecision(d, { arret: k, equipe: 0, genre: 'plan', plan: { rythme: k % 2 ? 'lent' : 'rapide' } });
      r = jouer(d);
      const a = avant.arrets![k]!;
      expect(r.evenements.slice(0, a.indice)).toEqual(avant.evenements.slice(0, a.indice));
    }
    expect(jouer(structuredClone(d)).empreinte).toBe(r.empreinte);
  });
});

describe('décisions du coach', () => {
  it('le temps-mort demandé est pris tout de suite, une fois par arrêt', () => {
    const k = premierBallonMort.numero;
    const r = jouer([
      { arret: k, equipe: 0, genre: 'temps_mort' },
      { arret: k, equipe: 0, genre: 'temps_mort' },
    ]);
    expect(r.decisionsRejetees).toEqual([1]);
    const ev = r.evenements[premierBallonMort.indice]!;
    expect(ev).toMatchObject({ type: 'temps_mort', equipe: 0, motif: 'demande', nature: 'equipe' });
    expect(r.arrets![k]!.tempsMortsRestants[0]).toBe(premierBallonMort.tempsMortsRestants[0] - 1);
    expect(r.arrets![k]!.peutTempsMort[0]).toBe(false);
    const ligne = commenterMatch(r, regles.periodesReglementaires).find((l) => l.indice === premierBallonMort.indice)!;
    expect(ligne.texte).toMatch(/demande un temps-mort/);
  });

  it('pas de temps-mort en début de période, ni de changement avant le coup d’envoi', () => {
    const r = jouer([
      { arret: 0, equipe: 0, genre: 'temps_mort' },
      { arret: 0, equipe: 0, genre: 'remplacement', sortant: base.domicile.joueurs[0]!.id, entrant: base.domicile.joueurs[6]!.id },
    ]);
    expect(r.decisionsRejetees).toEqual([0, 1]);
    expect(r.empreinte).toBe(sans.empreinte);
  });

  it('le changement demandé est fait et se voit dans le journal et à l’arrêt', () => {
    const a = premierBallonMort;
    const sortant = a.surTerrain[0][0]!;
    const entrant = a.joueurs[0].find((j) => !a.surTerrain[0].includes(j.id) && !j.blesse && !j.exclu)!.id;
    const r = jouer([{ arret: a.numero, equipe: 0, genre: 'remplacement', sortant, entrant }]);
    expect(r.decisionsRejetees).toEqual([]);
    expect(r.evenements[a.indice]).toMatchObject({ type: 'remplacement', equipe: 0, sortant, entrant });
    expect(r.arrets![a.numero]!.surTerrain[0]).toContain(entrant);
    expect(r.arrets![a.numero]!.surTerrain[0]).not.toContain(sortant);
  });

  it('entre deux périodes, le changement est annoncé dans le cinq de la période', () => {
    const a = arrets.find((x) => x.debutDePeriode && x.periode === 3)!;
    const sortant = a.surTerrain[1][0]!;
    const entrant = a.joueurs[1].find((j) => !a.surTerrain[1].includes(j.id) && !j.blesse && !j.exclu)!.id;
    const r = jouer([{ arret: a.numero, equipe: 1, genre: 'remplacement', sortant, entrant }]);
    expect(r.evenements[a.indice]).toMatchObject({ type: 'debut_periode' });
    const ev = r.evenements[a.indice]!;
    if (ev.type !== 'debut_periode') throw new Error('début de période attendu');
    expect(ev.cinq[1]).toContain(entrant);
    expect(ev.cinq[1]).not.toContain(sortant);
  });

  it('une décision impossible est ignorée et ne change rien', () => {
    const a = premierBallonMort;
    const surLeBanc = a.joueurs[0].find((j) => !a.surTerrain[0].includes(j.id))!.id;
    const r = jouer([
      { arret: a.numero, equipe: 0, genre: 'remplacement', sortant: surLeBanc, entrant: a.surTerrain[0][1]! },
      { arret: a.numero, equipe: 0, genre: 'remplacement', sortant: a.surTerrain[0][1]!, entrant: 'inconnu' },
      { arret: a.numero, equipe: 0, genre: 'plan', plan: { rythme: 'supersonique' } as unknown as Partial<PlanDeJeu> },
      { arret: a.numero, equipe: 2, genre: 'temps_mort' } as unknown as DecisionMatch,
    ]);
    expect(r.decisionsRejetees).toEqual([0, 1, 2, 3]);
    expect(r.evenements).toEqual(sans.evenements);
  });

  it('quand le coach gère les changements, le staff ne fait que les changements forcés', () => {
    for (let g = 0; g < 20; g++) {
      const e = entree(500 + g, equipes[g]!.id, equipes[(g + 11) % 30]!.id);
      const r = jouer([{ arret: 0, equipe: 0, genre: 'plan', plan: { remplacements: 'coach', tempsMorts: 'coach' } }], e);
      const sortis = new Set<string>();
      for (const ev of r.evenements) {
        if ((ev.type === 'blessure' || ev.type === 'exclusion') && ev.equipe === 0) sortis.add(ev.joueur);
        if (ev.type === 'remplacement' && ev.equipe === 0) expect(sortis.has(ev.sortant)).toBe(true);
        if (ev.type === 'temps_mort' && ev.equipe === 0) expect(ev.motif).toBe('obligatoire');
      }
      // Les titulaires jouent tout le match sauf blessure ou exclusion.
      const titulaires = r.boxScore.equipes[0].joueurs.filter((j) => j.titulaire && !j.blesse && !j.exclu);
      const duree =
        (regles.periodesReglementaires * regles.dureePeriodeSecondes + r.boxScore.prolongations * regles.dureeProlongationSecondes) * 10;
      for (const j of titulaires) expect(j.dixiemes).toBe(duree);
    }
  });
});

describe('plans de jeu et défenseur direct', () => {
  const lot = (plan: Partial<PlanDeJeu>) => {
    const s = { tirs: 0, trois: 0, troisAdverses: 0, cercleAdverse: 0, tirsAdverses: 0 };
    for (let g = 0; g < 120; g++) {
      const e = entree(7000 + g, equipes[g % 30]!.id, equipes[(g * 7 + 3) % 30 === g % 30 ? (g + 1) % 30 : (g * 7 + 3) % 30]!.id);
      const r = simulerMatch({ ...e, decisions: [{ arret: 0, equipe: 0, genre: 'plan', plan }] });
      s.tirs += r.boxScore.equipes[0].totaux.tirsTentes;
      s.trois += r.boxScore.equipes[0].totaux.troisTentes;
      s.troisAdverses += r.boxScore.equipes[1].totaux.troisTentes;
      for (const ev of r.evenements)
        if (ev.type === 'tir' && ev.equipe === 1) {
          s.tirsAdverses++;
          if (ev.tir === 'cercle') s.cercleAdverse++;
        }
    }
    return s;
  };
  const normal = lot({});

  it('le rythme change le nombre de tirs', () => {
    expect(lot({ rythme: 'rapide' }).tirs).toBeGreaterThan(normal.tirs * 1.03);
    expect(lot({ rythme: 'lent' }).tirs).toBeLessThan(normal.tirs * 0.97);
  });

  it('la part du tir à trois points suit la consigne', () => {
    expect(lot({ troisPoints: 'plus' }).trois).toBeGreaterThan(normal.trois * 1.1);
    expect(lot({ troisPoints: 'moins' }).trois).toBeLessThan(normal.trois * 0.9);
  });

  it("la zone pousse l'adversaire à tirer de loin plutôt que près du cercle", () => {
    const zone = lot({ defense: 'zone' });
    expect(zone.troisAdverses).toBeGreaterThan(normal.troisAdverses * 1.05);
    expect(zone.cercleAdverse / zone.tirsAdverses).toBeLessThan(normal.cercleAdverse / normal.tirsAdverses);
  });

  it('en défense individuelle, chaque tir a un défenseur direct sur le terrain ; en zone, aucun', () => {
    const r = jouer([{ arret: 0, equipe: 1, genre: 'plan', plan: { defense: 'zone' } }]);
    r.evenements.forEach((ev, i) => {
      if (ev.type !== 'tir') return;
      const cinq = cinqAuMoment(r.evenements, i);
      if (ev.equipe === 0) expect(ev.defenseur).toBeUndefined();
      else expect(cinq[0]).toContain(ev.defenseur);
    });
  });

  it('un meilleur défenseur direct fait baisser l’adresse du tireur', () => {
    // Même match, un défenseur de l'équipe qui se déplace rendu bien meilleur (ou bien pire) en défense.
    const adresse = (bonus: number) => {
      let reussis = 0;
      let tentes = 0;
      for (let g = 0; g < 150; g++) {
        const e = entree(8000 + g, 'boston', 'new-york');
        const exterieur = {
          ...e.exterieur,
          joueurs: e.exterieur.joueurs.map((j) => {
            const borne = (x: number) => Math.min(100, Math.max(1, x + bonus));
            // Tranche 7 : la défense se lit sur les attributs détaillés.
            return {
              ...j,
              detail: {
                ...j.detail,
                defenseExterieure: borne(j.detail.defenseExterieure),
                defenseInterieure: borne(j.detail.defenseInterieure),
              },
            };
          }),
        };
        const r = simulerMatch({
          ...e,
          exterieur,
          reglages: { ...reglages, pertesDeBalle: { ...reglages.pertesDeBalle, sensibiliteParPoint: 0 } },
        });
        for (const ev of r.evenements)
          if (ev.type === 'tir' && ev.equipe === 0) {
            tentes++;
            if (ev.reussi) reussis++;
          }
      }
      return reussis / tentes;
    };
    expect(adresse(15)).toBeLessThan(adresse(-15) - 0.02);
  });
});

describe('lecture interactive', () => {
  const lignes = commenterMatch(sans, regles.periodesReglementaires);

  it('sans arrêt voulu, la lecture montre tout le match et finit', () => {
    let l: Lecture = { curseur: 0, dernierArret: -1 };
    let n = 0;
    for (;;) {
      const p = pasSuivant(lignes, arrets, l, () => false);
      l = p.lecture;
      if (p.genre === 'fin') break;
      expect(p.genre).toBe('ligne');
      n++;
    }
    expect(n).toBe(lignes.length);
    expect(l.dernierArret).toBe(arrets.at(-1)!.numero);
  });

  it('en demandant chaque arrêt, la lecture s’arrête à tous, dans l’ordre, sans sauter de ligne', () => {
    let l: Lecture = { curseur: 0, dernierArret: -1 };
    const vus: number[] = [];
    let montrees = 0;
    for (;;) {
      const p = pasSuivant(lignes, arrets, l, () => true);
      if (p.genre === 'arret') {
        expect(p.lecture.curseur).toBeGreaterThanOrEqual(l.curseur);
        vus.push(p.arret.numero);
      } else if (p.genre === 'ligne') montrees++;
      l = p.lecture;
      if (p.genre === 'fin') break;
    }
    expect(vus).toEqual(arrets.map((a) => a.numero));
    expect(montrees).toBe(lignes.length);
  });

  it('les changements de plan au même arrêt ne font qu’une décision ; annuler revient en arrière', () => {
    let d = ajouterDecision([], { arret: 3, equipe: 0, genre: 'plan', plan: { rythme: 'rapide' } });
    d = ajouterDecision(d, { arret: 3, equipe: 0, genre: 'plan', plan: { defense: 'zone' } });
    d = ajouterDecision(d, { arret: 3, equipe: 1, genre: 'plan', plan: { defense: 'zone' } });
    expect(d).toEqual([
      { arret: 3, equipe: 0, genre: 'plan', plan: { rythme: 'rapide', defense: 'zone' } },
      { arret: 3, equipe: 1, genre: 'plan', plan: { defense: 'zone' } },
    ]);
    d = ajouterDecision(d, { arret: 8, equipe: 0, genre: 'temps_mort' });
    expect(annulerDecisions(d, 8)).toHaveLength(2);
    expect(annulerDecisions(d, 3)).toEqual([]);
  });

  it('le changement de plan est raconté', () => {
    const r = jouer([{ arret: 0, equipe: 0, genre: 'plan', plan: { defense: 'zone', rythme: 'rapide' } }]);
    const ligne = commenterMatch(r, regles.periodesReglementaires).find((l) => l.genre === 'plan')!;
    expect(ligne.texte).toBe('Boston Beacons : rythme rapide, défense de zone.');
  });
});
