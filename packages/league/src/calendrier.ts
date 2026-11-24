// Tranche 4 : le calendrier de 82 matchs (formule NBA, data/ligue/saison-2026-27.json).
//
// Appariements : 4 matchs contre chaque adversaire de division (2 à domicile) ; contre les deux autres divisions de la
// conférence, 4 matchs contre 6 adversaires et 3 contre 4 (deux par division, désignés par un décalage tiré au sort,
// l'un reçu deux fois, l'autre une) ; 2 matchs contre chaque équipe de l'autre conférence. Chaque équipe joue 41 matchs
// à domicile. Dates : les matchs, mélangés de façon déterministe, sont posés jour après jour entre la première et la
// dernière date de la saison, sans qu'une équipe joue deux fois le même jour ni trois jours de suite.
import { creerHasard, type Hasard } from '@basket-legends/engine';
import type { JourCalendrier, MatchPrevu, StructureLigue } from './types';

/** Ajoute des jours à une date AAAA-MM-JJ (UTC, sans fuseau). */
export function ajouterJours(date: string, jours: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

export function joursEntre(debut: string, fin: string): number {
  return Math.round((Date.parse(`${fin}T12:00:00Z`) - Date.parse(`${debut}T12:00:00Z`)) / 86_400_000);
}

function melanger<T>(h: Hasard, liste: T[]): T[] {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = h.entier(0, i);
    [liste[i], liste[j]] = [liste[j]!, liste[i]!];
  }
  return liste;
}

/** Les rencontres de la saison (sans dates), chacune avec son équipe qui reçoit. */
export function genererAppariements(S: StructureLigue, h: Hasard): { domicile: string; exterieur: string }[] {
  const C = S.calendrier;
  const rencontres: { domicile: string; exterieur: string }[] = [];
  const jouer = (a: string, b: string, aDomicile: number, bDomicile: number) => {
    for (let k = 0; k < aDomicile; k++) rencontres.push({ domicile: a, exterieur: b });
    for (let k = 0; k < bDomicile; k++) rencontres.push({ domicile: b, exterieur: a });
  };
  const moitie = (n: number) => [Math.ceil(n / 2), Math.floor(n / 2)] as const;
  for (const conf of S.conferences) {
    // Division.
    for (const div of conf.divisions) {
      for (let i = 0; i < div.franchises.length; i++)
        for (let j = i + 1; j < div.franchises.length; j++)
          jouer(div.franchises[i]!, div.franchises[j]!, ...moitie(C.contreChaqueAdversaireDeDivision));
    }
    // Conférence, hors division : par paire de divisions, deux adversaires à 3 matchs par équipe.
    const divs = conf.divisions;
    const parDivision = C.adversairesDeConferenceA3Matchs / Math.max(1, divs.length - 1);
    for (let a = 0; a < divs.length; a++) {
      for (let b = a + 1; b < divs.length; b++) {
        const A = divs[a]!.franchises;
        const B = divs[b]!.franchises;
        const n = B.length;
        const decalage = h.entier(0, n - 1);
        A.forEach((ta, i) =>
          B.forEach((tb, j) => {
            const k = (j - i + n) % n;
            const rang = (k - decalage + n) % n;
            if (rang < parDivision) {
              // Trois matchs : l'une des deux équipes reçoit deux fois, en alternance.
              if (rang % 2 === 0) jouer(ta, tb, 2, 1);
              else jouer(ta, tb, 1, 2);
            } else jouer(ta, tb, 2, 2);
          }),
        );
      }
    }
  }
  // L'autre conférence.
  const [est, ouest] = S.conferences;
  if (est && ouest) {
    const E = est.divisions.flatMap((d) => d.franchises);
    const O = ouest.divisions.flatMap((d) => d.franchises);
    for (const a of E) for (const b of O) jouer(a, b, ...moitie(C.contreChaqueAdversaireDeLAutreConference));
  }
  return rencontres;
}

/** Le calendrier daté de la saison régulière. */
export function genererCalendrier(S: StructureLigue, graine: number): JourCalendrier[] {
  const h = creerHasard(graine, `calendrier:${S.saison}`);
  const restants = melanger(h, genererAppariements(S, h));
  const nbJours = joursEntre(S.calendrier.premierJour, S.calendrier.dernierJour) + 1;
  const derniers = new Map<string, number[]>(); // équipe → jours joués
  const jours: JourCalendrier[] = [];
  let id = 1;
  for (let d = 0; restants.length; d++) {
    const date = ajouterJours(S.calendrier.premierJour, d);
    // Une marge de dix jours en fin de saison absorbe les derniers matchs difficiles à placer.
    const joursRestants = Math.max(1, nbJours - 10 - d);
    const cible = Math.ceil(restants.length / joursRestants);
    const occupees = new Set<string>();
    const matchs: MatchPrevu[] = [];
    const peutJouer = (t: string) => {
      if (occupees.has(t)) return false;
      const jj = derniers.get(t) ?? [];
      // Pas trois jours de suite (sauf en fin de calendrier, si c'est le seul moyen de tout caser).
      return d >= nbJours || !(jj.includes(d - 1) && jj.includes(d - 2));
    };
    for (let i = 0; i < restants.length && matchs.length < cible;) {
      const r = restants[i]!;
      if (peutJouer(r.domicile) && peutJouer(r.exterieur)) {
        matchs.push({ id: id++, ...r });
        occupees.add(r.domicile).add(r.exterieur);
        for (const t of [r.domicile, r.exterieur]) derniers.set(t, [...(derniers.get(t) ?? []).slice(-2), d]);
        restants.splice(i, 1);
      } else i++;
    }
    jours.push({ date, matchs });
  }
  return jours.filter((j) => j.matchs.length > 0);
}
