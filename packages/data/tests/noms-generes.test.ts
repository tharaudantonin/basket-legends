// Tranche 7 : SHA-256 du navigateur et filtre des noms réels pour les joueurs générés.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { empreinteNom, generateurDeNoms, schemaBanques, schemaEmpreintes, sha256Hex } from '../src';
import { empreinte } from '../src/verification';

const racine = join(import.meta.dirname, '../../..');
const json = (chemin: string): unknown => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));

describe('sha256Hex', () => {
  it('donne la même empreinte que node:crypto, y compris pour l’UTF-8 et les longueurs limites', () => {
    const textes = ['', 'abc', 'é', 'Đorđević', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000), '漢字 😀'];
    for (const t of textes) expect(sha256Hex(t)).toBe(createHash('sha256').update(t, 'utf8').digest('hex'));
  });

  it('calcule les empreintes des noms comme la vérification Node', () => {
    for (const nom of ['Jean Dupont', 'José Álvarez', 'Ana-María de la Cruz']) expect(empreinteNom(nom)).toBe(empreinte(nom));
  });
});

describe('générateur de noms', () => {
  const banques = schemaBanques.parse(json('data/noms/banques.json'));
  const empreintes = schemaEmpreintes.parse(json('data/noms/empreintes.json'));
  const g = generateurDeNoms(banques, empreintes);

  it('a des banques pour chaque pays de la génération des prospects', () => {
    const modele = json('data/draft/modele-draft.json') as { classe: { paysParOrigine: Record<string, Record<string, number>> } };
    for (const pays of Object.values(modele.classe.paysParOrigine).flatMap((o) => Object.keys(o))) {
      const b = g.parPays[pays];
      expect(b, pays).toBeDefined();
      // Assez de combinaisons pour plusieurs décennies de classes de Draft.
      expect(b!.prenoms.length * b!.noms.length, pays).toBeGreaterThanOrEqual(300);
    }
  });

  it('utilise la culture de génération quand elle diffère de celle du snapshot (Grèce)', () => {
    expect(banques.culturesParPaysGeneration?.['Greece']?.noms).toBe('grec');
    expect(g.parPays['Greece']!.noms).toContain('Papadopoulos');
  });

  it('refuse un nom dont l’empreinte est interdite', () => {
    const faux = generateurDeNoms(banques, { ...empreintes, nomsComplets: [empreinteNom('Jean Testeur')], nomsDeFamille: [empreinteNom('Interdit')] });
    expect(faux.estInterdit('Jean', 'Testeur')).toBe(true);
    expect(faux.estInterdit('Paul', 'Interdit-Martin')).toBe(true);
    expect(faux.estInterdit('Paul', 'Testeur')).toBe(false);
  });
});
