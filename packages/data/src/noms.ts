// Outils purs sur les noms (utilisables dans le navigateur) : normalisation et initiales.
// Même règle que la migration de la tranche 0 (tools/migrations/2026-11-24-tranche0.py).

export const PARTICULES = new Set(['de', 'da', 'di', 'del', 'van', 'von', 'der', 'la', 'le', 'dos']);
const SUFFIXE = /,?\s+(Jr\.?|Sr\.?|II|III|IV)$/;
const INITIALES_SEULES = /^(?:[A-Z]\.){2}$|^[A-Z]{2}$/;

/** Forme comparable d'un nom : sans accents, minuscules, lettres et espaces seulement, sans suffixe (Jr., II…). */
export function normaliserNom(texte: string): string {
  return texte
    .replace(SUFFIXE, '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Initiales d'un nom : chaque prénom et chaque partie du nom de famille (traits d'union compris), particules exclues. */
export function initialesDe(prenom: string, nomDeFamille: string): string {
  const lettres: string[] = [];
  if (INITIALES_SEULES.test(prenom)) {
    lettres.push(...prenom.replace(/[^A-Z]/g, ''));
  } else {
    for (const partie of prenom.split('-')) lettres.push(partie.charAt(0).toUpperCase());
  }
  for (const mot of nomDeFamille.split(' ')) {
    if (PARTICULES.has(mot.toLowerCase())) continue;
    for (const partie of mot.split('-')) lettres.push(partie.charAt(0).toUpperCase());
  }
  return lettres.join('');
}

/** Les parties d'un nom de famille qui portent une initiale (sans particules), traits d'union séparés. */
export function partiesDuNom(nomDeFamille: string): string[] {
  return nomDeFamille
    .split(' ')
    .filter((mot) => !PARTICULES.has(mot.toLowerCase()))
    .flatMap((mot) => mot.split('-'));
}
