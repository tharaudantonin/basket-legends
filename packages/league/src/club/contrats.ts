// Tranche 10 (réponse 49) : les contrats en cours de saison — two-way signés en saison (limite de matchs au prorata,
// date limite), conversion d'un two-way en contrat standard, contrats de 10 jours (à partir du 5 janvier, deux au plus
// avec la même équipe) et exception de difficulté (hardship). Règles sourcées dans data/cba/nba-2026-27.json
// (dixJours, hardship, twoWayEnSaison). L'IA s'en sert aussi : contrats de 10 jours quand ses blessés lui ouvrent une
// exception de difficulté, places two-way vides comblées, two-way convertis quand ils atteignent leur limite.
import { ajouterJours, joursEntre } from '../calendrier';
import { salaireMinimum, saisonCourte, type ContratJoueur } from '../cba';
import type { Univers } from '../carriere/types';
import {
  cbaDeLUnivers,
  noterComposition,
  noterTransaction,
  placerJoueur,
  retirerDeLEffectif,
  situationDansLUnivers,
} from '../marche/operations';
import type { ContexteLigue, EtatSaison } from '../types';
import { bornesDeLaSaison, clubDe, dateDansLaSaison, etatClub, joursRestants, modeleClub, nomEquipe, publier } from './commun';

const P0 = (ctx: ContexteLigue) => (ctx.base ?? ctx).salaires.cba;
const P = (ctx: ContexteLigue, u: Univers) => cbaDeLUnivers(P0(ctx), u);

/** Les joueurs d'une équipe blessés depuis assez de matchs et encore absents assez longtemps (exception de difficulté). */
export function blessesHardship(ctx: ContexteLigue, etat: EtatSaison, equipe: string): string[] {
  const u = etat.univers!;
  const H = P(ctx, u).hardship;
  const E = etatClub(etat);
  // « Deux semaines » en matchs : jours × matchs par équipe ÷ jours de la saison régulière.
  const { debut, fin } = bornesDeLaSaison(ctx, etat);
  const matchsRestantsMin = Math.ceil(
    (H.joursRestantsMin * ctx.structure.calendrier.matchsParEquipe) / Math.max(1, joursEntre(debut, fin) + 1),
  );
  return (u.effectifs[equipe] ?? []).filter(
    (j) => (E.absences[j] ?? 0) >= H.matchsManquesMin && (etat.blessures[j] ?? 0) >= matchsRestantsMin,
  );
}

/** Les exceptions de difficulté encore disponibles pour une équipe. */
export function hardshipDisponibles(ctx: ContexteLigue, etat: EtatSaison, equipe: string): number {
  const u = etat.univers!;
  const Pc = P(ctx, u);
  const s = situationDansLUnivers(P0(ctx), u, equipe);
  if (s.effectif.standard < Pc.contratsStandardMax) return 0;
  const n = blessesHardship(ctx, etat, equipe).length;
  const droit = n >= Pc.hardship.blessesMin ? n - Pc.hardship.blessesMin + 1 : 0;
  const utilisees = (u.effectifs[equipe] ?? []).filter((j) => u.contrats[j]?.dixJours?.hardship).length;
  return Math.max(0, droit - utilisees);
}

const estLibre = (u: Univers, j: string) => !!u.horsNba[j] && !!u.joueurs[j];

function noter(
  ctx: ContexteLigue,
  etat: EtatSaison,
  equipe: string,
  joueur: string,
  texte: string,
  genre: 'signature' | 'coupe' = 'signature',
): void {
  const u = etat.univers!;
  noterTransaction(u, { date: etat.date, genre, equipes: [equipe], joueurs: [joueur], texte });
  noterComposition(ctx, etat, equipe, undefined, {
    joueurs: etat.franchise === equipe && etat.compositionManuelle ? [...(u.effectifs[equipe] ?? [])] : [...(u.effectifs[equipe] ?? [])],
  });
  if (etat.franchise === equipe && etat.compositionManuelle)
    etat.compositionManuelle = etat.compositionManuelle.filter((j) => u.effectifs[equipe]?.includes(j));
}

/** Signature d'un two-way en cours de saison : avant la date limite, limite de matchs au prorata des jours restants. */
export function signerTwoWayEnSaison(ctx: ContexteLigue, etat: EtatSaison, equipe: string, joueur: string): string {
  const u = etat.univers!;
  const Pc = P(ctx, u);
  if (etat.phase !== 'reguliere') throw new Error('Les two-way en cours de saison se signent pendant la saison régulière.');
  if (etat.date > dateDansLaSaison(etat.saison, Pc.twoWayEnSaison.dateLimiteSignature))
    throw new Error(`Plus de signature two-way après le ${Pc.twoWayEnSaison.dateLimiteSignature.split('-').reverse().join('/')}.`);
  if (!estLibre(u, joueur)) throw new Error('Ce joueur n’est pas libre.');
  const s = situationDansLUnivers(P0(ctx), u, equipe);
  if (s.effectif.twoWay >= Pc.contratsTwoWayMax) throw new Error(`Déjà ${Pc.contratsTwoWayMax} contrats two-way.`);
  const limite = Math.min(Pc.matchsMaxTwoWay, Math.round((joursRestants(ctx, etat) / Pc.twoWayEnSaison.joursSaison) * Pc.matchsMaxTwoWay));
  placerJoueur(u, joueur, equipe, {
    type: 'two-way',
    salaires: [],
    garanti: null,
    anciennete: 0,
    draft: null,
    saisonsAvecEquipe: 0,
    limiteMatchs: limite,
  });
  noter(ctx, etat, equipe, joueur, `${u.joueurs[joueur]!.nom} signe un contrat two-way avec ${equipe} (${limite} matchs NBA au plus).`);
  return `${u.joueurs[joueur]!.nom} signe un two-way (${limite} matchs NBA au plus).`;
}

/** Conversion d'un two-way en contrat standard (jusqu'à la fin de la saison régulière, au minimum, au prorata). */
export function convertirTwoWay(ctx: ContexteLigue, etat: EtatSaison, equipe: string, joueur: string): string {
  const u = etat.univers!;
  const Pc = P(ctx, u);
  const c = u.contrats[joueur];
  if (etat.phase !== 'reguliere') throw new Error('La conversion se fait pendant la saison régulière.');
  if (!u.effectifs[equipe]?.includes(joueur) || c?.type !== 'two-way')
    throw new Error('Ce joueur n’est pas sous contrat two-way chez vous.');
  const s = situationDansLUnivers(P0(ctx), u, equipe);
  if (s.effectif.standard >= Pc.contratsStandardMax)
    throw new Error(`Effectif complet (${Pc.contratsStandardMax} contrats standard) : coupez d’abord un joueur.`);
  const montant = Math.round(
    (salaireMinimum(Pc, c.anciennete ?? 0) * Math.min(Pc.dixJours.joursSaison, joursRestants(ctx, etat))) / Pc.dixJours.joursSaison,
  );
  u.contrats[joueur] = {
    type: 'standard',
    salaires: [{ saison: saisonCourte(u.saison), montant }],
    garanti: montant,
    anciennete: c.anciennete ?? 0,
    draft: c.draft,
    saisonsAvecEquipe: c.saisonsAvecEquipe ?? 0,
    signeLe: etat.date,
  };
  delete clubDe(u).assignes[joueur];
  noter(ctx, etat, equipe, joueur, `${u.joueurs[joueur]!.nom} passe d’un two-way à un contrat standard avec ${equipe}.`);
  return `${u.joueurs[joueur]!.nom} rejoint l’effectif standard (${(montant / 1e6).toFixed(2)} M$ pour la fin de saison).`;
}

/** Contrat de 10 jours (standard, ou grâce à l'exception de difficulté). */
export function signerDixJours(ctx: ContexteLigue, etat: EtatSaison, equipe: string, joueur: string, hardship: boolean): string {
  const u = etat.univers!;
  const Pc = P(ctx, u);
  const D = Pc.dixJours;
  const E = etatClub(etat);
  if (etat.phase !== 'reguliere') throw new Error('Les contrats de 10 jours se signent pendant la saison régulière.');
  if (!estLibre(u, joueur)) throw new Error('Ce joueur n’est pas libre.');
  const cle = `${joueur}:${equipe}`;
  if ((E.dixJoursSignes[cle] ?? 0) >= D.parJoueurEtEquipe)
    throw new Error(
      `Déjà ${D.parJoueurEtEquipe} contrats de 10 jours avec cette équipe : signez-le jusqu’à la fin de la saison ou laissez-le partir.`,
    );
  const s = situationDansLUnivers(P0(ctx), u, equipe);
  if (hardship) {
    if (hardshipDisponibles(ctx, etat, equipe) <= 0)
      throw new Error(
        `Pas d’exception de difficulté : il faut 15 contrats standard et au moins ${Pc.hardship.blessesMin} blessés absents depuis ${Pc.hardship.matchsManquesMin} matchs et pour deux semaines encore.`,
      );
  } else {
    if (etat.date < dateDansLaSaison(etat.saison, D.premierJour))
      throw new Error(`Pas de contrat de 10 jours avant le ${D.premierJour.split('-').reverse().join('/')}.`);
    if (joursRestants(ctx, etat) < D.joursRestantsMin) throw new Error('Trop tard dans la saison pour un contrat de 10 jours.');
    if (s.effectif.standard >= Pc.contratsStandardMax) throw new Error(`Effectif complet (${Pc.contratsStandardMax} contrats standard).`);
  }
  const anciennete = 0;
  const jours = Math.min(D.jours, Math.max(1, joursRestants(ctx, etat)));
  const montant = Math.round((salaireMinimum(Pc, anciennete) * jours) / D.joursSaison);
  const numero = (E.dixJoursSignes[cle] ?? 0) + 1;
  const fin = ajouterJours(etat.date, D.jours - 1);
  const contrat: ContratJoueur = {
    type: 'standard',
    salaires: [{ saison: saisonCourte(u.saison), montant }],
    garanti: montant,
    anciennete,
    draft: null,
    saisonsAvecEquipe: 0,
    signeLe: etat.date,
    dixJours: { fin, numero, hardship },
  };
  placerJoueur(u, joueur, equipe, contrat);
  E.dixJoursSignes[cle] = numero;
  E.dixJours.push({ joueur, equipe, debut: etat.date, fin, numero, hardship });
  noter(
    ctx,
    etat,
    equipe,
    joueur,
    `${u.joueurs[joueur]!.nom} signe un contrat de 10 jours${hardship ? ' (exception de difficulté)' : ''} avec ${equipe}.`,
  );
  return `${u.joueurs[joueur]!.nom} signe un contrat de 10 jours (n° ${numero}${hardship ? ', exception de difficulté' : ''}).`;
}

/** Garder un joueur en fin de contrat de 10 jours : contrat standard jusqu'à la fin de la saison, au prorata. */
export function garderJusquALaFin(ctx: ContexteLigue, etat: EtatSaison, equipe: string, joueur: string): string {
  const u = etat.univers!;
  const Pc = P(ctx, u);
  const c = u.contrats[joueur];
  if (!c?.dixJours || !u.effectifs[equipe]?.includes(joueur)) throw new Error('Ce joueur n’est pas sous contrat de 10 jours chez vous.');
  const s = situationDansLUnivers(P0(ctx), u, equipe);
  if (c.dixJours.hardship && s.effectif.standard >= Pc.contratsStandardMax)
    throw new Error('Effectif complet : il faut une place parmi les 15.');
  const montant = Math.round(
    (salaireMinimum(Pc, c.anciennete ?? 0) * Math.min(Pc.dixJours.joursSaison, joursRestants(ctx, etat))) / Pc.dixJours.joursSaison,
  );
  // Le salaire de ses contrats de 10 jours reste payé (argent mort de la saison).
  const Sc = saisonCourte(u.saison);
  const mort = ((u.argentMort ??= {})[equipe] ??= {});
  mort[Sc] = (mort[Sc] ?? 0) + (c.salaires.find((x) => x.saison === Sc)?.montant ?? 0);
  u.contrats[joueur] = {
    type: 'standard',
    salaires: [{ saison: Sc, montant }],
    garanti: montant,
    anciennete: c.anciennete,
    draft: null,
    saisonsAvecEquipe: 0,
    signeLe: etat.date,
  };
  const E = etatClub(etat);
  E.dixJours = E.dixJours.filter((x) => x.joueur !== joueur);
  noter(ctx, etat, equipe, joueur, `${u.joueurs[joueur]!.nom} signe avec ${equipe} jusqu’à la fin de la saison.`);
  return `${u.joueurs[joueur]!.nom} reste jusqu’à la fin de la saison.`;
}

/** Fin d'un contrat de 10 jours : le joueur redevient libre, son salaire reste payé. */
function terminerDixJours(ctx: ContexteLigue, etat: EtatSaison, equipe: string, joueur: string): void {
  const u = etat.univers!;
  const c = u.contrats[joueur];
  const Sc = saisonCourte(u.saison);
  const mort = ((u.argentMort ??= {})[equipe] ??= {});
  mort[Sc] = (mort[Sc] ?? 0) + (c?.salaires.find((x) => x.saison === Sc)?.montant ?? 0);
  retirerDeLEffectif(u, joueur);
  delete u.contrats[joueur];
  u.horsNba[joueur] = 'libre';
  noter(ctx, etat, equipe, joueur, `Fin du contrat de 10 jours de ${u.joueurs[joueur]?.nom ?? joueur} (${equipe}).`, 'coupe');
}

const matchsDepuis = (etat: EtatSaison, equipe: string, debut: string) =>
  etat.matchs.filter((m) => m.date >= debut && (m.domicile === equipe || m.exterieur === equipe) && m.nature === 'reguliere').length;

/**
 * Un jour de saison régulière : contrats de 10 jours échus (au moins 10 jours et 3 matchs), puis l'IA (exceptions de
 * difficulté, places two-way, conversions). Rend vrai si un effectif a changé.
 */
export function journeeDesContrats(ctx: ContexteLigue, etat: EtatSaison): boolean {
  const u = etat.univers!;
  const E = etatClub(etat);
  const Pc = P(ctx, u);
  const version = u.version;
  for (const x of [...E.dixJours]) {
    if (!u.effectifs[x.equipe]?.includes(x.joueur) || !u.contrats[x.joueur]?.dixJours) {
      E.dixJours = E.dixJours.filter((y) => y !== x);
      continue;
    }
    if (etat.date <= x.fin || matchsDepuis(etat, x.equipe, x.debut) < Pc.dixJours.matchsMin) continue;
    E.dixJours = E.dixJours.filter((y) => y !== x);
    terminerDixJours(ctx, etat, x.equipe, x.joueur);
    if (x.equipe === etat.franchise)
      publier(etat, {
        date: etat.date,
        genre: 'club',
        importance: 1,
        equipes: [x.equipe],
        titre: `Fin du contrat de 10 jours de ${u.joueurs[x.joueur]?.nom ?? x.joueur}`,
        texte:
          x.numero >= Pc.dixJours.parJoueurEtEquipe
            ? 'Son second contrat de 10 jours est terminé : il est libre. Vous ne pouvez plus lui offrir qu’un contrat jusqu’à la fin de la saison.'
            : 'Il est libre ; vous pouvez lui offrir un second contrat de 10 jours.',
      });
  }
  iaDesContrats(ctx, etat);
  return u.version !== version;
}

/** L'IA : exceptions de difficulté, places two-way vides avant la date limite, two-way convertis à leur limite. */
function iaDesContrats(ctx: ContexteLigue, etat: EtatSaison): void {
  const u = etat.univers!;
  const Pc = P(ctx, u);
  const I = modeleClub(ctx).contratsIa;
  const E = etatClub(etat);
  const libres = () =>
    Object.keys(u.horsNba)
      .filter((j) => u.joueurs[j])
      .sort((a, b) => u.joueurs[b]!.note - u.joueurs[a]!.note || (a < b ? -1 : 1));
  const dimanche = new Date(`${etat.date}T12:00:00Z`).getUTCDay() === 0;
  for (const e of Object.keys(u.effectifs).sort()) {
    if (e === etat.franchise) continue;
    for (let n = hardshipDisponibles(ctx, etat, e); n > 0; n--) {
      const j = libres().find(
        (x) => u.joueurs[x]!.note >= I.noteMinHardship && (E.dixJoursSignes[`${x}:${e}`] ?? 0) < Pc.dixJours.parJoueurEtEquipe,
      );
      if (!j) break;
      signerDixJours(ctx, etat, e, j, true);
    }
    // Une fois par semaine : places two-way vides comblées, two-way à leur limite convertis.
    if (!dimanche) continue;
    const s = situationDansLUnivers(P0(ctx), u, e);
    if (s.effectif.twoWay < Pc.contratsTwoWayMax && etat.date <= dateDansLaSaison(etat.saison, Pc.twoWayEnSaison.dateLimiteSignature)) {
      const j = libres().find((x) => u.joueurs[x]!.age <= I.ageMaxTwoWay);
      if (j) signerTwoWayEnSaison(ctx, etat, e, j);
    }
    for (const j of (u.effectifs[e] ?? []).filter((x) => u.contrats[x]?.type === 'two-way')) {
      const limite = u.contrats[j]!.limiteMatchs ?? Pc.matchsMaxTwoWay;
      const joues = etat.statistiques[j]?.matchs ?? 0;
      if (
        joues >= limite &&
        u.joueurs[j]!.note >= I.noteMinConversion &&
        situationDansLUnivers(P0(ctx), u, e).effectif.standard < Pc.contratsStandardMax
      )
        convertirTwoWay(ctx, etat, e, j);
    }
  }
}

/** Les contrats de 10 jours en cours d'une équipe (écran). */
export const dixJoursDe = (etat: EtatSaison, equipe: string) => (etat.club?.dixJours ?? []).filter((x) => x.equipe === equipe);
export { nomEquipe };
