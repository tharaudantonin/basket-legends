// Tranche 1 : mise en forme des nombres et des couleurs, à la française.

/** Temps de jeu (dixièmes de seconde) en « mm:ss ». */
export function minutes(dixiemes: number): string {
  const s = Math.round(dixiemes / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Pourcentage à une décimale (« 47,3 % »), ou un tiret sans tentative. */
export function pourcentage(reussis: number, tentes: number): string {
  if (!tentes) return '–';
  return `${((100 * reussis) / tentes).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function signe(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}

/** Une encre lisible (blanc cassé ou presque noir) sur un fond donné, selon sa luminance relative (WCAG). */
export function encreSur(fond: string): string {
  const canal = (i: number): number => {
    const c = parseInt(fond.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
  return l > 0.36 ? '#15202B' : '#FAFAF7';
}

/** Taille en mètres (« 2,03 m »). */
export function taille(cm: number): string {
  return `${(cm / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} m`;
}

/** Tranche 6 : un montant en dollars, en millions (« 41,240 M$ ») ; avec `signe`, « + » ou « − » devant. */
export function dollars(montant: number, avecSigne = false): string {
  const m = (Math.abs(montant) / 1e6).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const s = montant < 0 ? '−' : avecSigne && montant > 0 ? '+' : '';
  return `${s}${m} M$`;
}
