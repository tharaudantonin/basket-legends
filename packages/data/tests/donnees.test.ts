import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { lireSources } from '../../../tools/verifier-donnees';
import { empreinte, lireCsv, verifierDonnees } from '../src/verification';
import { initialesDe, normaliserNom, schemaJoueur, schemaRegles, valeursDesRegles } from '../src';

const racine = join(import.meta.dirname, '../../..');

describe('données de référence du dépôt', () => {
  const sources = lireSources(racine);
  const rapport = verifierDonnees(sources);

  it('passent la vérification sans erreur', () => {
    expect(rapport.erreurs).toEqual([]);
    expect(rapport.joueurs).toBe(523);
  });

  it("ne contiennent aucun vrai nom ni note NBA 2K dans les effectifs", () => {
    for (const effectif of Object.values(sources.effectifs) as { players: Record<string, unknown>[] }[]) {
      for (const j of effectif.players) {
        expect(j).not.toHaveProperty('sourceName');
        expect(JSON.stringify(j)).not.toContain('nba2k');
      }
    }
  });
});

describe('contrôles', () => {
  const sources = lireSources(racine);
  const copie = <T>(x: T): T => structuredClone(x);

  it('refusent un identifiant de joueur en double', () => {
    const s = copie(sources);
    const [a, b] = Object.keys(s.effectifs) as [string, string];
    const ea = s.effectifs[a] as { players: { id: string }[] };
    const eb = s.effectifs[b] as { players: { id: string }[] };
    eb.players[0]!.id = ea.players[0]!.id;
    expect(verifierDonnees(s).erreurs.some((e) => e.includes('identifiant en double'))).toBe(true);
  });

  it('refusent un vrai nom réintroduit dans un effectif', () => {
    const joueur = (Object.values(sources.effectifs)[0] as { players: unknown[] }).players[0] as Record<string, unknown>;
    expect(schemaJoueur.safeParse({ ...joueur, sourceName: 'Nom Réel' }).success).toBe(false);
  });

  it('refusent un CSV qui diverge du JSON', () => {
    const s = copie(sources);
    s.csv = s.csv.replace('#0F4B3A', '#000000');
    expect(verifierDonnees(s).erreurs.some((e) => e.includes('franchises.csv'))).toBe(true);
  });

  it('refusent un numéro partagé non documenté', () => {
    const s = copie(sources);
    const e = s.effectifs['boston.json'] as { players: { jerseyNumber: string }[] };
    e.players[1]!.jerseyNumber = e.players[0]!.jerseyNumber;
    expect(verifierDonnees(s).erreurs.some((x) => x.includes('boston.json : numéro'))).toBe(true);
  });
});

describe('noms', () => {
  it('normalisent accents, suffixes et ponctuation comme la migration Python', () => {
    expect(normaliserNom("Élan O'Dupré-Martin Jr.")).toBe('elan o dupre martin');
    // Valeur calculée en Python avec la règle de tools/migrations/2026-11-24-tranche0.py : les deux langages doivent coïncider.
    expect(empreinte('Élan Dupré')).toBe('ee58f4ecbb0d716b3398fea375a9c9216ff170ee82badc43a1b36767d3422a00');
  });

  it('calculent les initiales avec traits d’union, particules et initiales seules', () => {
    expect(initialesDe('Salvador', 'de Lara')).toBe('SL');
    expect(initialesDe('Nathan', 'Aldrich-Waverly')).toBe('NAW');
    expect(initialesDe('T.J.', 'McBain')).toBe('TJM');
    expect(initialesDe('Octave-Mamadou', 'Perrin')).toBe('OMP');
  });

  it('lisent un CSV entre guillemets', () => {
    expect(lireCsv('"a","b"\n"1","x, ""y"""\n')).toEqual([{ a: '1', b: 'x, "y"' }]);
  });
});

describe('paramètres du match (tranche 1)', () => {
  const sources = lireSources(racine);
  const copie = <T>(x: T): T => structuredClone(x);

  it('lisent les règles 2026-27 en valeurs pour le moteur', () => {
    const r = valeursDesRegles(schemaRegles.parse(sources.regles['nba-2026-27.json']));
    expect(r.joueursSurLeTerrain).toBe(5);
    expect(r.possessionDebutDePeriode).toHaveLength(r.periodesReglementaires);
  });

  it('refusent une règle sans référence au règlement', () => {
    const s = copie(sources);
    const r = s.regles['nba-2026-27.json'] as { parametres: { dureePeriodeSecondes: { reference?: string } } };
    delete r.parametres.dureePeriodeSecondes.reference;
    expect(verifierDonnees(s).erreurs.some((e) => e.includes('data/regles/nba-2026-27.json'))).toBe(true);
  });

  it('refusent une répartition des tirs qui ne fait pas 1', () => {
    const s = copie(sources);
    (s.reglagesMatch['match-v5.json'] as { tirs: { repartition: { cercle: number } } }).tirs.repartition.cercle += 0.1;
    expect(verifierDonnees(s).erreurs.some((e) => e.includes('répartition des tirs'))).toBe(true);
  });
});
