// Tranche 5 : les matchs interactifs de la saison — le match dirigé par le coach est celui que la saison enregistre, et
// un match interactif interrompu se reprend au même point après une sauvegarde.
import { describe, expect, it } from 'vitest';
import type { DecisionMatch } from '@basket-legends/engine';
import { avancer, creerSauvegarde, lireSauvegarde, matchDuProchainPas, nouvelleSaison, rejouerMatch, type EtatSaison } from '../src';
import { chargerContexte } from './outils';

const ctx = chargerContexte();

/** Avance jusqu'à un jour où la franchise joue (et rend ce match). */
function versUnMatch(etat: EtatSaison) {
  let e = etat;
  for (let n = 0; n < 10; n++) {
    const m = matchDuProchainPas(ctx, e);
    if (m) return { etat: e, match: m };
    e = avancer(ctx, e, 'jour');
  }
  throw new Error('Aucun match trouvé.');
}

describe('match interactif de la saison', () => {
  const depart = nouvelleSaison(ctx, 2026, 'boston');
  const { etat, match } = versUnMatch(depart);
  const camp = match.domicile === 'boston' ? 0 : 1;

  it('trouve le prochain match de la franchise tel que la saison le jouera', () => {
    const joue = avancer(ctx, etat, 'jour').matchs.find((m) => m.id === match.id)!;
    expect(joue).toMatchObject({
      id: match.id,
      graine: match.graine,
      domicile: match.domicile,
      exterieur: match.exterieur,
      absents: match.absents,
    });
    // Sans décision, le match interactif est le match de la saison.
    expect(rejouerMatch(ctx, etat, match).empreinte).toBe(joue.empreinte);
  });

  it('la saison joue le match avec les décisions du coach : même match, enregistré avec ses décisions', () => {
    const essai = rejouerMatch(ctx, etat, match, { arrets: true });
    const k = essai.arrets!.find((a) => !a.debutDePeriode && a.periode === 2)!.numero;
    const decisions: DecisionMatch[] = [
      { arret: 0, equipe: camp, genre: 'plan', plan: { rythme: 'rapide', troisPoints: 'plus' } },
      { arret: k, equipe: camp, genre: 'temps_mort' },
      { arret: k + 4, equipe: camp, genre: 'plan', plan: { defense: 'zone' } },
    ];
    const interactif = rejouerMatch(ctx, etat, { ...match, decisions }, { arrets: true });
    expect(interactif.decisionsRejetees).toEqual([]);

    const apres = avancer(ctx, { ...etat, matchInteractif: { id: match.id, decisions, arret: k + 4 } }, 'jour');
    const joue = apres.matchs.find((m) => m.id === match.id)!;
    expect(joue.empreinte).toBe(interactif.empreinte);
    expect(joue.decisions).toEqual(decisions);
    expect(apres.matchInteractif).toBeUndefined();
    // Revivre le match (mode commenté, box score) le rejoue avec ses décisions.
    expect(rejouerMatch(ctx, apres, joue).empreinte).toBe(interactif.empreinte);
    // Les autres matchs du jour ne changent pas.
    const sans = avancer(ctx, etat, 'jour');
    const autres = (s: EtatSaison) => s.matchs.filter((m) => m.id !== match.id).map((m) => m.empreinte);
    expect(autres(apres)).toEqual(autres(sans));
  });

  it('un match interactif interrompu se reprend au même point après sauvegarde', () => {
    const decisions: DecisionMatch[] = [{ arret: 0, equipe: camp, genre: 'plan', plan: { defense: 'zone' } }];
    const avant = rejouerMatch(ctx, etat, { ...match, decisions }, { arrets: true });
    const enCours = { ...etat, matchInteractif: { id: match.id, decisions, arret: 37 } };
    const s = creerSauvegarde(enCours, { regles: 'nba-2026-27', moteur: 'match-v4', notes: 'notes-v1' }, '2026-11-24T12:00:00Z');
    const relue = lireSauvegarde(JSON.parse(JSON.stringify(s))).etat;
    expect(relue.matchInteractif).toEqual(enCours.matchInteractif);
    const repris = rejouerMatch(ctx, relue, { ...match, decisions: relue.matchInteractif!.decisions }, { arrets: true });
    expect(repris.arrets![37]).toEqual(avant.arrets![37]);
    expect(repris.empreinte).toBe(avant.empreinte);
  });

  it('une sauvegarde de la tranche 4 (sans match interactif) reste lisible', () => {
    const s = creerSauvegarde(depart, { regles: 'nba-2026-27', moteur: 'match-v3', notes: 'notes-v1' }, '2026-11-24T12:00:00Z');
    expect(lireSauvegarde(JSON.parse(JSON.stringify(s))).etat).toEqual(depart);
  });
});
