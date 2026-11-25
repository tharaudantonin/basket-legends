// Tranche 4 : la saison — saison régulière, All-Star Game, Play-In, playoffs, palmarès et actualités.
//
// Tout est déterministe : la graine de la saison donne le calendrier, chaque match a sa graine (graine de la saison et
// numéro du match), et un match se rejoue à l'identique avec sa graine et la liste de ses absents. L'état de la saison
// est un objet JSON (types.ts) ; `avancer` en rend une copie avancée, sans toucher à l'original.
import {
  composerEquipe,
  detecterMoments,
  interetDuMatch,
  simulerMatch,
  type EquipeDuMatch,
  type OptionsSimulation,
  type ResultatMatch,
} from '@basket-legends/engine';
import { ajouterJours, genererCalendrier } from './calendrier';
import { appartenances, calculerBilans, classer, pctBilan } from './classement';
import { decernerRecompenses, selectionnerAllStars } from './recompenses';
import { situationEquipe } from './cba';
import { cumuler } from './statistiques';
import type { Actualite, Bilan, ContexteLigue, EtatPlayIn, EtatSaison, NatureMatch, ResumeMatch, Serie } from './types';
import { nouvelleDraft, preparerDraft } from './draft/draft';
import { composerSelonLOrdre, contexteDeLaSaison, joueurDuMatchCarriere } from './carriere/univers';
import { compositionDuMatch } from './marche/operations';
import { facteurBlessures } from './marche/staff';
import { journeeDeMarche } from './marche/ia';
import { apresMatch, finDeSaisonDuClub, formeDuMatch, journeeDuClub } from './club';

export type Cible = 'jour' | 'semaine' | 'all-star' | 'fin-reguliere' | 'fin';

/** Identifiants des sélections du All-Star Game (elles jouent sous ces noms). */
export const ID_ALL_STAR: Record<string, string> = { est: 'all-star-est', ouest: 'all-star-ouest' };

function hacher(...parties: (string | number)[]): number {
  let h = 2166136261;
  for (const c of parties.join(':')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** La graine d'un match de la saison. */
export const graineDuMatch = (graineSaison: number, id: number): number => hacher(graineSaison, 'match', id);

export function nouvelleSaison(ctx: ContexteLigue, graine: number, franchise: string): EtatSaison {
  const calendrier = genererCalendrier(ctx.structure, graine);
  return {
    version: 1,
    saison: ctx.structure.saison,
    graine,
    franchise,
    phase: 'reguliere',
    calendrier,
    jour: 0,
    date: ajouterJours(calendrier[0]!.date, -1),
    matchs: [],
    blessures: {},
    statistiques: {},
    statistiquesPlayoffs: {},
    statistiquesFinale: {},
    actualites: [],
    derniereSemaine: 0,
    ...(ctx.draft ? { draft: nouvelleDraft(ctx, graine, ctx.structure.saison) } : {}),
  };
}

const nomDe = (ctx: ContexteLigue, id: string): string =>
  ctx.equipes[id]?.nom ?? (id === ID_ALL_STAR.est ? 'Étoiles de l’Est' : id === ID_ALL_STAR.ouest ? 'Étoiles de l’Ouest' : id);
const nomJoueur = (ctx: ContexteLigue, id: string): string => {
  for (const e of Object.values(ctx.equipes)) {
    const j = e.joueurs.find((x) => x.id === id);
    if (j) return j.nom;
  }
  return id;
};

function publier(etat: EtatSaison, a: Omit<Actualite, 'id'>): void {
  etat.actualites.push({ id: etat.actualites.length + 1, ...a });
}

/** Les deux équipes d'un match, sans leurs absents (au moins cinq joueurs : le moins blessé revient sinon). */
/** Ce qu'il faut de l'état pour rejouer un match : All-Star Game, compositions notées et ordre des matchs. */
export type EtatPourRejouer = Pick<EtatSaison, 'allStar'> &
  Partial<Pick<EtatSaison, 'compositions'>> & { matchs?: Pick<ResumeMatch, 'id'>[] };

/** La position d'un match dans la saison (les matchs déjà joués ; un match à jouer vient après eux). */
const positionDuMatch = (etat: EtatPourRejouer, id: number): number => {
  const i = etat.matchs?.findIndex((x) => x.id === id) ?? -1;
  return i >= 0 ? i : (etat.matchs?.length ?? 0);
};

/** Tranche 9 : l'équipe telle qu'elle était à un match (après un échange ou un changement de composition en saison). */
function equipeAuMatch(ctx: ContexteLigue, etat: EtatPourRejouer, id: string, position: number): { equipe: EquipeDuMatch; ordre: boolean } {
  const base = ctx.equipes[id]!;
  const note = compositionDuMatch(etat, id, position);
  const u = ctx.univers;
  if (!note || !u) return { equipe: base, ordre: !!base.ordreDuGm };
  const joueurs = note.joueurs
    .filter((j) => u.joueurs[j])
    .map((j) => ({ ...joueurDuMatchCarriere(u.joueurs[j]!), ...(note.numeros?.[j] !== undefined ? { numero: note.numeros[j]! } : {}) }));
  const e = note.ordre ? composerSelonLOrdre(id, base.nom, joueurs, note.joueurs) : composerEquipe(id, base.nom, joueurs);
  const plan = note.plan ?? base.plan;
  return { equipe: plan ? { ...e, plan } : e, ordre: !!note.ordre };
}

export function equipesDuMatch(
  ctx: ContexteLigue,
  etat: EtatPourRejouer,
  m: Pick<ResumeMatch, 'domicile' | 'exterieur' | 'absents'> & { id?: number; forme?: [number, number] },
): [EquipeDuMatch, EquipeDuMatch] {
  const absents = new Set(m.absents);
  const position = m.id === undefined ? (etat.matchs?.length ?? 0) : positionDuMatch(etat, m.id);
  const equipe = (id: string): EquipeDuMatch => {
    if (id === ID_ALL_STAR.est || id === ID_ALL_STAR.ouest) {
      const conf = id === ID_ALL_STAR.est ? 'est' : 'ouest';
      const ids = [...(etat.allStar?.titulaires[conf] ?? []), ...(etat.allStar?.remplacants[conf] ?? [])];
      const joueurs = ids
        .map((j) =>
          Object.values(ctx.equipes)
            .flatMap((e) => e.joueurs)
            .find((x) => x.id === j)!,
        )
        .filter(Boolean);
      return composerEquipe(id, nomDe(ctx, id), joueurs);
    }
    const { equipe: base, ordre } = equipeAuMatch(ctx, etat, id, position);
    const presents = base.joueurs.filter((j) => !absents.has(j.id));
    const joueurs = presents.length >= ctx.regles.joueursSurLeTerrain ? presents : base.joueurs;
    // Tranche 9 : l'ordre choisi par le GM est gardé (sans les absents) ; sinon le staff recompose.
    const e = ordre ? { id: base.id, nom: base.nom, joueurs } : composerEquipe(base.id, base.nom, joueurs);
    return base.plan ? { ...e, plan: base.plan } : e;
  };
  const [d, e] = [equipe(m.domicile), equipe(m.exterieur)];
  // Tranche 10 : la forme du jour (moral du groupe), notée dans le résumé du match.
  return m.forme
    ? [
        { ...d, forme: m.forme[0] },
        { ...e, forme: m.forme[1] },
      ]
    : [d, e];
}

/** Rejoue un match de la saison à l'identique (mode commenté, box score), avec les décisions du coach s'il y en a. */
export function rejouerMatch(ctx: ContexteLigue, etat: EtatPourRejouer, m: ResumeMatch, options: OptionsSimulation = {}): ResultatMatch {
  const [domicile, exterieur] = equipesDuMatch(ctx, etat, m);
  const reglages = m.neutre ? { ...ctx.reglages, tirs: { ...ctx.reglages.tirs, avantageDomicile: 0 } } : ctx.reglages;
  return simulerMatch(
    { graine: m.graine, domicile, exterieur, regles: ctx.regles, reglages, ...(m.decisions?.length ? { decisions: m.decisions } : {}) },
    options,
  );
}

/** Joue un match, met à jour blessures, statistiques et actualités ; rend son résumé. */
function jouerMatch(
  ctx: ContexteLigue,
  etat: EtatSaison,
  id: number,
  nature: NatureMatch,
  domicile: string,
  exterieur: string,
  date: string,
  neutre = false,
): ResumeMatch {
  const effectifs = [domicile, exterieur].flatMap((e) => ctx.equipes[e]?.joueurs.map((j) => j.id) ?? []);
  // Tranche 6 : les joueurs two-way ne jouent ni le Play-In ni les playoffs, ni plus de 50 matchs de saison régulière
  // (CBA) ; comme les blessés, ils sont notés absents du match, ce qui suffit à le rejouer.
  const { cba, contrats } = ctx.salaires;
  const phaseFinale = nature === 'play-in' || nature === 'playoffs';
  const nonQualifie = (j: string) =>
    contrats[j]?.type === 'two-way' &&
    (phaseFinale
      ? !cba.twoWayEnPhaseFinale
      : nature === 'reguliere' && (etat.statistiques[j]?.matchs ?? 0) >= (contrats[j]?.limiteMatchs ?? cba.matchsMaxTwoWay));
  // Tranche 10 : les joueurs assignés en G League et ceux écartés par le GM (sanction) manquent aussi le match.
  const club = nature === 'all-star' ? undefined : etat.club;
  const assignes = nature === 'all-star' ? undefined : etat.univers?.club?.assignes;
  const absents = effectifs
    .filter((j) => (etat.blessures[j] ?? 0) > 0 || nonQualifie(j) || !!assignes?.[j] || (club?.ecartes[j] ?? 0) > 0)
    .sort();
  const graine = graineDuMatch(etat.graine, id);
  const resume: ResumeMatch = {
    id,
    nature,
    date,
    domicile,
    exterieur,
    graine,
    score: [0, 0],
    prolongations: 0,
    absents,
    empreinte: '',
    interet: 0,
    moments: [],
    ...(neutre ? { neutre } : {}),
  };
  const forme = nature === 'all-star' ? undefined : formeDuMatch(ctx, etat, domicile, exterieur);
  if (forme) resume.forme = forme;
  // Tranche 5 : le match interactif de la franchise du joueur se joue avec les décisions du coach.
  if (etat.matchInteractif?.id === id) {
    if (etat.matchInteractif.decisions.length) resume.decisions = etat.matchInteractif.decisions;
    delete etat.matchInteractif;
  }
  const r = rejouerMatch(ctx, etat, resume);
  const moments = detecterMoments(r);
  resume.score = [r.boxScore.equipes[0].points, r.boxScore.equipes[1].points];
  resume.prolongations = r.boxScore.prolongations;
  resume.empreinte = r.empreinte;
  resume.interet = interetDuMatch(moments, r.boxScore);
  resume.moments = moments.filter((m) => m.importance >= 2).map((m) => m.texte);
  etat.matchs.push(resume);
  etat.date = date;

  if (nature === 'all-star') return resume;
  // Tranche 10 : moral après le match ; matchs consécutifs manqués (exception de difficulté) ; sanctions purgées.
  if (club) {
    apresMatch(ctx, etat, r, resume);
    for (const j of effectifs) {
      if ((etat.blessures[j] ?? 0) > 0) club.absences[j] = (club.absences[j] ?? 0) + 1;
      else delete club.absences[j];
      if (club.ecartes[j]) delete club.ecartes[j];
    }
  }
  // Blessures : les absents ont manqué un match de plus ; les nouveaux blessés sont indisponibles.
  for (const j of absents.filter((x) => etat.blessures[x])) {
    const reste = (etat.blessures[j] ?? 0) - 1;
    if (reste > 0) etat.blessures[j] = reste;
    else delete etat.blessures[j];
  }
  for (const ev of r.evenements) {
    if (ev.type !== 'blessure') continue;
    // Tranche 9 : le responsable médical de l'équipe allonge ou raccourcit l'absence (effet borné, de moyenne nulle).
    const equipe = r.boxScore.equipes[ev.equipe].id;
    const staff = ctx.marche ? ctx.univers?.staff?.[equipe] : undefined;
    const absence = staff ? Math.max(1, Math.round(ev.matchsAbsent * facteurBlessures(ctx.marche!.staff, staff))) : ev.matchsAbsent;
    etat.blessures[ev.joueur] = Math.max(etat.blessures[ev.joueur] ?? 0, absence);
    if (absence >= 10)
      publier(etat, {
        date,
        genre: 'blessure',
        importance: 2,
        equipes: [equipe],
        titre: `${nomJoueur(ctx, ev.joueur)} blessé`,
        texte: `${nomJoueur(ctx, ev.joueur)} (${nomDe(ctx, equipe)}) se blesse et sera absent ${absence} matchs.`,
      });
  }
  const min = ctx.structure.recompenses.minutesPourCompter;
  cumuler(nature === 'reguliere' ? etat.statistiques : etat.statistiquesPlayoffs, r.boxScore, min);
  if (nature === 'playoffs' && etat.series?.some((s) => s.conference === null && s.matchs.includes(id)))
    cumuler(etat.statistiquesFinale, r.boxScore, min);

  // Actualités du match.
  const [a, b] = [nomDe(ctx, domicile), nomDe(ctx, exterieur)];
  const tableau = `${a} ${resume.score[0]} – ${resume.score[1]} ${b}${resume.prolongations ? ` (${resume.prolongations === 1 ? 'prolongation' : `${resume.prolongations} prolongations`})` : ''}`;
  const importance = moments.some((m) => m.importance === 3) ? 3 : 2;
  if (resume.moments.length)
    publier(etat, {
      date,
      genre: 'moment',
      importance,
      equipes: [domicile, exterieur],
      match: id,
      titre: resume.moments[0]!,
      texte: `${tableau}. ${resume.moments.join(' ')}`,
    });
  else if (domicile === etat.franchise || exterieur === etat.franchise) {
    const gagne = (domicile === etat.franchise) === resume.score[0] > resume.score[1];
    publier(etat, {
      date,
      genre: 'resultat',
      importance: 1,
      equipes: [domicile, exterieur],
      match: id,
      titre: `${gagne ? 'Victoire' : 'Défaite'} : ${tableau}`,
      texte: `${tableau}.`,
    });
  }
  return resume;
}

// --- Saison régulière. ---

function jourDuAllStar(ctx: ContexteLigue, etat: EtatSaison): number {
  return Math.floor(etat.calendrier.length * ctx.structure.allStar.partDeLaSaison);
}

function jouerAllStar(ctx: ContexteLigue, etat: EtatSaison): void {
  const bilans = calculerBilans(ctx.structure, etat.matchs);
  const sel = selectionnerAllStars(ctx, etat, bilans);
  const date = ajouterJours(etat.date, 1);
  etat.allStar = { date, ...sel };
  publier(etat, {
    date,
    genre: 'all-star',
    importance: 2,
    equipes: [],
    titre: 'Les sélections du All-Star Game',
    texte: ctx.structure.conferences
      .map(
        (c) =>
          `${c.nom} — titulaires : ${sel.titulaires[c.id]!.map((j) => nomJoueur(ctx, j)).join(', ')} ; remplaçants : ${sel.remplacants[c.id]!.map((j) => nomJoueur(ctx, j)).join(', ')}.`,
      )
      .join(' '),
  });
  const r = jouerMatch(ctx, etat, 100_000, 'all-star', ID_ALL_STAR.est!, ID_ALL_STAR.ouest!, date, true);
  etat.allStar.resultat = r.id;
  const res = rejouerMatch(ctx, etat, r);
  const gagnant = res.boxScore.equipes[r.score[0] > r.score[1] ? 0 : 1];
  const mvp = [...gagnant.joueurs].sort((x, y) => y.points + y.rebonds + y.passes - (x.points + x.rebonds + x.passes))[0];
  etat.allStar.mvp = mvp?.id;
  publier(etat, {
    date,
    genre: 'all-star',
    importance: 3,
    equipes: [],
    match: r.id,
    titre: `All-Star Game : ${gagnant.nom} l'emporte`,
    texte: `${nomDe(ctx, r.domicile)} ${r.score[0]} – ${r.score[1]} ${nomDe(ctx, r.exterieur)}. MVP : ${mvp ? `${mvp.nom} (${mvp.points} points)` : '—'}.`,
  });
}

function jouerJourRegulier(ctx: ContexteLigue, etat: EtatSaison): void {
  const jour = etat.calendrier[etat.jour]!;
  for (const m of jour.matchs) jouerMatch(ctx, etat, m.id, 'reguliere', m.domicile, m.exterieur, jour.date);
  etat.jour++;
  // Séries de victoires remarquables.
  const bilans = calculerBilans(ctx.structure, etat.matchs);
  for (const m of jour.matchs) {
    for (const e of [m.domicile, m.exterieur]) {
      const s = bilans[e]!.serie;
      if (s >= 8 && s % 2 === 0)
        publier(etat, {
          date: jour.date,
          genre: 'serie',
          importance: 2,
          equipes: [e],
          titre: `${nomDe(ctx, e)} : ${s} victoires de suite`,
          texte: `${nomDe(ctx, e)} enchaîne ${s} victoires (bilan ${bilans[e]!.victoires}-${bilans[e]!.defaites}).`,
        });
    }
  }
  // Match de la semaine : tous les sept jours de calendrier, le match le plus intéressant.
  const debut = etat.derniereSemaine;
  if (etat.jour - debut >= 7 || etat.jour === etat.calendrier.length) {
    const ids = new Set(etat.calendrier.slice(debut, etat.jour).flatMap((j) => j.matchs.map((m) => m.id)));
    const meilleur = etat.matchs.filter((m) => ids.has(m.id)).sort((a, b) => b.interet - a.interet || a.id - b.id)[0];
    if (meilleur)
      publier(etat, {
        date: jour.date,
        genre: 'match-de-la-semaine',
        importance: 2,
        equipes: [meilleur.domicile, meilleur.exterieur],
        match: meilleur.id,
        titre: `Match de la semaine : ${nomDe(ctx, meilleur.domicile)} – ${nomDe(ctx, meilleur.exterieur)}`,
        texte: `${nomDe(ctx, meilleur.domicile)} ${meilleur.score[0]} – ${meilleur.score[1]} ${nomDe(ctx, meilleur.exterieur)}${meilleur.moments.length ? ` : ${meilleur.moments.join(' ')}` : '.'} À revivre en mode commenté.`,
      });
    etat.derniereSemaine = etat.jour;
  }
  if (etat.jour === etat.calendrier.length) commencerPlayIn(ctx, etat);
}

// --- Play-In et playoffs. ---

function commencerPlayIn(ctx: ContexteLigue, etat: EtatSaison): void {
  const S = ctx.structure;
  const { conferences } = classer(S, calculerBilans(S, etat.matchs), etat.graine);
  const [de, a] = S.playIn.rangsDuPlayIn;
  etat.playIn = S.conferences.map((c) => {
    const eq = conferences[c.id]!.slice(de - 1, a);
    return {
      conference: c.id,
      equipes: eq,
      matchs: [
        { etape: '7-8', domicile: eq[0]!, exterieur: eq[1]! },
        { etape: '9-10', domicile: eq[2]!, exterieur: eq[3]! },
      ],
    } satisfies EtatPlayIn;
  });
  etat.tetesDeSerie = Object.fromEntries(S.conferences.map((c) => [c.id, conferences[c.id]!.slice(0, S.playIn.qualifiesDirects)]));
  etat.phase = 'play-in';
  publier(etat, {
    date: etat.date,
    genre: 'play-in',
    importance: 2,
    equipes: etat.playIn.flatMap((p) => p.equipes),
    titre: 'Fin de la saison régulière',
    texte: S.conferences
      .map(
        (c) =>
          `${c.nom} : ${conferences[c.id]!.slice(0, 3)
            .map((e) => nomDe(ctx, e))
            .join(', ')} en tête ; Play-In pour ${etat
            .playIn!.find((p) => p.conference === c.id)!
            .equipes.map((e) => nomDe(ctx, e))
            .join(', ')}.`,
      )
      .join(' '),
  });
}

const prochainId = (etat: EtatSaison) => Math.max(200_000, ...etat.matchs.map((m) => m.id)) + 1;

function jourDePlayIn(ctx: ContexteLigue, etat: EtatSaison): void {
  const date = ajouterJours(etat.date, 2);
  const gagnant = (r: ResumeMatch) => (r.score[0] > r.score[1] ? r.domicile : r.exterieur);
  const perdant = (r: ResumeMatch) => (r.score[0] > r.score[1] ? r.exterieur : r.domicile);
  for (const p of etat.playIn!) {
    for (const m of p.matchs.filter((x) => x.resultat === undefined)) {
      const r = jouerMatch(ctx, etat, prochainId(etat), 'play-in', m.domicile, m.exterieur, date);
      m.resultat = r.id;
      publier(etat, {
        date,
        genre: 'play-in',
        importance: 2,
        equipes: [m.domicile, m.exterieur],
        match: r.id,
        titre: `Play-In : ${nomDe(ctx, gagnant(r))} s'impose`,
        texte: `${nomDe(ctx, m.domicile)} ${r.score[0]} – ${r.score[1]} ${nomDe(ctx, m.exterieur)}.`,
      });
    }
    const resultat = (etape: string) => etat.matchs.find((x) => x.id === p.matchs.find((m) => m.etape === etape)?.resultat);
    const r78 = resultat('7-8');
    const r910 = resultat('9-10');
    if (r78 && r910 && !p.matchs.some((m) => m.etape === 'finale')) {
      p.septieme = gagnant(r78);
      p.matchs.push({ etape: 'finale', domicile: perdant(r78), exterieur: gagnant(r910) });
    }
    const rf = resultat('finale');
    if (rf) p.huitieme = gagnant(rf);
  }
  if (etat.playIn!.every((p) => p.huitieme)) commencerPlayoffs(ctx, etat);
}

function nouvelleSerie(tour: number, conference: string | null, haut: string, bas: string, teteHaut: number, teteBas: number): Serie {
  return {
    id: `${conference ?? 'finale'}-${tour}-${haut}-${bas}`,
    tour,
    conference,
    haut,
    bas,
    teteHaut,
    teteBas,
    victoires: [0, 0],
    matchs: [],
  };
}

function commencerPlayoffs(ctx: ContexteLigue, etat: EtatSaison): void {
  const S = ctx.structure;
  etat.series = [];
  for (const c of S.conferences) {
    const p = etat.playIn!.find((x) => x.conference === c.id)!;
    const tetes = [...etat.tetesDeSerie![c.id]!, p.septieme!, p.huitieme!];
    etat.tetesDeSerie![c.id] = tetes;
    for (const [h, b] of S.playoffs.appariementsPremierTour) etat.series.push(nouvelleSerie(1, c.id, tetes[h - 1]!, tetes[b - 1]!, h, b));
  }
  etat.phase = 'playoffs';
  publier(etat, {
    date: etat.date,
    genre: 'playoffs',
    importance: 2,
    equipes: etat.series.flatMap((s) => [s.haut, s.bas]),
    titre: 'Les playoffs commencent',
    texte: etat.series.map((s) => `${nomDe(ctx, s.haut)} (${s.teteHaut}) – ${nomDe(ctx, s.bas)} (${s.teteBas})`).join(' ; ') + '.',
  });
}

function jourDePlayoffs(ctx: ContexteLigue, etat: EtatSaison): void {
  const S = ctx.structure;
  // Un match tous les deux jours pour chaque série en cours.
  const date = ajouterJours(etat.date, 2);
  const tour = Math.max(...etat.series!.map((s) => s.tour));
  const enCours = etat.series!.filter((s) => s.tour === tour && !s.vainqueur);
  for (const s of enCours) {
    const n = s.matchs.length;
    const hautRecoit = S.playoffs.receveurParMatch[n] !== 'bas';
    const [dom, ext] = hautRecoit ? [s.haut, s.bas] : [s.bas, s.haut];
    const id = prochainId(etat);
    s.matchs.push(id);
    const r = jouerMatch(ctx, etat, id, 'playoffs', dom, ext, date);
    const gagnantHaut = r.score[0] > r.score[1] === hautRecoit;
    s.victoires[gagnantHaut ? 0 : 1]++;
    if (s.victoires[0] === S.playoffs.victoiresPourGagnerUneSerie || s.victoires[1] === S.playoffs.victoiresPourGagnerUneSerie) {
      s.vainqueur = s.victoires[0] > s.victoires[1] ? s.haut : s.bas;
      const perdant = s.vainqueur === s.haut ? s.bas : s.haut;
      publier(etat, {
        date,
        genre: 'playoffs',
        importance: s.conference === null ? 3 : 2,
        equipes: [s.haut, s.bas],
        match: id,
        titre:
          s.conference === null ? `${nomDe(ctx, s.vainqueur)} champion !` : `${nomDe(ctx, s.vainqueur)} élimine ${nomDe(ctx, perdant)}`,
        texte: `${nomDe(ctx, s.vainqueur)} remporte la série ${Math.max(...s.victoires)}-${Math.min(...s.victoires)}${s.conference === null ? ' et le titre.' : '.'}`,
      });
    }
  }
  if (etat.series!.filter((s) => s.tour === tour).every((s) => s.vainqueur)) {
    const finis = etat.series!.filter((s) => s.tour === tour);
    if (finis.length === 1 && finis[0]!.conference === null) return terminer(ctx, etat, finis[0]!);
    const bilans = calculerBilans(S, etat.matchs);
    if (finis.every((s) => s.conference !== null) && finis.length === S.conferences.length) {
      // Finale : avantage du terrain au meilleur bilan de saison régulière.
      const [a, b] = finis.map((s) => s.vainqueur!) as [string, string];
      const [haut, bas] = classerParBilan(bilans, a, b, etat.graine);
      etat.series!.push(nouvelleSerie(tour + 1, null, haut, bas, 1, 2));
      return;
    }
    // Tour suivant dans chaque conférence : tableau fixe, vainqueurs des séries voisines.
    for (const c of S.conferences) {
      const duTour = finis.filter((s) => s.conference === c.id);
      for (let i = 0; i + 1 < duTour.length; i += 2) {
        const v1 = duTour[i]!;
        const v2 = duTour[i + 1]!;
        const t1 = v1.vainqueur === v1.haut ? v1.teteHaut : v1.teteBas;
        const t2 = v2.vainqueur === v2.haut ? v2.teteHaut : v2.teteBas;
        const [h, b, th, tb] = t1 < t2 ? [v1.vainqueur!, v2.vainqueur!, t1, t2] : [v2.vainqueur!, v1.vainqueur!, t2, t1];
        etat.series!.push(nouvelleSerie(tour + 1, c.id, h, b, th, tb));
      }
    }
  }
}

function classerParBilan(bilans: Record<string, Bilan>, a: string, b: string, graine: number): [string, string] {
  const ba = bilans[a]!;
  const bb = bilans[b]!;
  const d =
    pctBilan(bb) - pctBilan(ba) ||
    bb.pointsPour - bb.pointsContre - (ba.pointsPour - ba.pointsContre) ||
    hacher(graine, a) - hacher(graine, b);
  return d <= 0 ? [a, b] : [b, a];
}

function terminer(ctx: ContexteLigue, etat: EtatSaison, finale: Serie): void {
  const champion = finale.vainqueur!;
  const finaliste = champion === finale.haut ? finale.bas : finale.haut;
  const bilans = calculerBilans(ctx.structure, etat.matchs);
  etat.palmares = decernerRecompenses(ctx, etat, bilans, champion, finaliste);
  etat.phase = 'terminee';
  // Tranche 6 : la taxe de luxe, calculée sur la masse de fin de saison régulière (aucune transaction en cours de saison).
  const taxes = Object.keys(ctx.equipes)
    .map((id) =>
      situationEquipe(
        ctx.salaires,
        id,
        ctx.equipes[id]!.joueurs.map((j) => j.id),
      ),
    )
    .filter((s) => s.taxe > 0)
    .sort((a, b) => b.taxe - a.taxe);
  const m = (x: number) => `${(x / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M$`;
  publier(etat, {
    date: etat.date,
    genre: 'finances',
    importance: 2,
    equipes: taxes.map((s) => s.equipe),
    titre: `Taxe de luxe ${etat.saison} : ${taxes.length} équipe${taxes.length > 1 ? 's' : ''} paie${taxes.length > 1 ? 'nt' : ''} ${m(taxes.reduce((t, s) => t + s.taxe, 0))}`,
    texte: taxes.length
      ? `${taxes.map((s) => `${nomDe(ctx, s.equipe)} ${m(s.taxe)}${s.recidiviste ? ' (récidiviste)' : ''}`).join(' ; ')}.`
      : 'Aucune équipe ne dépasse le seuil de taxe.',
  });
  // Tranche 10 : fin de la G League, bilan du propriétaire, licenciements.
  finDeSaisonDuClub(ctx, etat);
  // Tranche 7 : la loterie se tire à la fin de la saison ; les 60 choix sont fixés.
  if (ctx.draft && etat.draft) {
    etat.draft = preparerDraft(ctx, etat);
    const o = etat.draft.loterie!.ordre;
    publier(etat, {
      date: etat.date,
      genre: 'draft',
      importance: 3,
      equipes: o.slice(0, 4),
      titre: `Loterie de la Draft ${etat.draft.annee} : ${nomDe(ctx, o[0]!)} obtient le premier choix`,
      texte: `Ordre des quatre premiers choix (choix propres, avant les échanges) : ${o
        .slice(0, 4)
        .map((e, i) => `${i + 1}. ${nomDe(ctx, e)}`)
        .join(', ')}.`,
    });
  }
  const P = etat.palmares;
  const n = (id?: string) => (id ? nomJoueur(ctx, id) : '—');
  publier(etat, {
    date: etat.date,
    genre: 'palmares',
    importance: 3,
    equipes: [champion, finaliste],
    titre: `Palmarès ${etat.saison}`,
    texte: `Champion : ${nomDe(ctx, champion)} (MVP des finales : ${n(P.mvpFinale)}). MVP : ${n(P.mvp)}. Défenseur : ${n(P.defenseur)}. Rookie : ${n(P.rookie)}. Sixième homme : ${n(P.sixiemeHomme)}. Progression : ${n(P.progression)}.`,
  });
}

// --- Avancer. ---

/** Un pas de saison : un jour de calendrier, le All-Star Game, ou un jour de Play-In ou de playoffs. */
function pas(ctx: ContexteLigue, etat: EtatSaison): void {
  if (etat.phase === 'reguliere') {
    if (!etat.allStar && etat.jour >= jourDuAllStar(ctx, etat)) return jouerAllStar(ctx, etat);
    return jouerJourRegulier(ctx, etat);
  }
  if (etat.phase === 'play-in') return jourDePlayIn(ctx, etat);
  if (etat.phase === 'playoffs') return jourDePlayoffs(ctx, etat);
}

/**
 * Un pas de saison suivi du marché du jour (tranche 9 : échanges de l'IA jusqu'à la date limite). Rend le contexte à
 * utiliser ensuite : recalculé si une transaction a changé l'univers.
 */
function pasEtMarche(ctx: ContexteLigue, etat: EtatSaison): ContexteLigue {
  const regulier = etat.phase === 'reguliere' && !(!etat.allStar && etat.jour >= jourDuAllStar(ctx, etat));
  pas(ctx, etat);
  if (!etat.univers || etat.phase === 'terminee') return ctx;
  const version = etat.univers.version;
  // Tranche 10 : la vie du club (propriétaire, vestiaire, G League, contrats en saison), chaque jour joué.
  journeeDuClub(ctx, etat);
  if (regulier && ctx.marche) journeeDeMarche(ctx, etat);
  return etat.univers.version !== version ? contexteDeLaSaison(ctx.base ?? ctx, etat) : ctx;
}

/** Avance la saison jusqu'à la cible ; rend un nouvel état (l'ancien n'est pas modifié). */
export function avancer(ctxInitial: ContexteLigue, etatInitial: EtatSaison, cible: Cible): EtatSaison {
  if (etatInitial.phase === 'intersaison') throw new Error('La saison n’a pas commencé : terminez d’abord l’intersaison.');
  const etat = structuredClone(etatInitial);
  let ctx = ctxInitial;
  const fini = () => etat.phase === 'terminee';
  const p = () => (ctx = pasEtMarche(ctx, etat));
  if (cible === 'jour') p();
  else if (cible === 'semaine') for (let k = 0; k < 7 && !fini(); k++) p();
  else if (cible === 'all-star') while (!etat.allStar && etat.phase === 'reguliere') p();
  else if (cible === 'fin-reguliere') while (etat.phase === 'reguliere') p();
  else while (!fini()) p();
  return etat;
}

/**
 * Tranche 5 : le match que la franchise du joueur jouera au prochain pas de saison (« jour »), s'il y en a un, tel que la
 * saison le jouera (identifiant, graine, absents). On le trouve en jouant ce pas sur une copie de l'état : c'est le seul
 * moyen sûr de connaître l'identifiant d'un match de Play-In ou de playoffs, attribué au fil de la saison.
 */
export function matchDuProchainPas(ctx: ContexteLigue, etat: EtatSaison): ResumeMatch | undefined {
  if (etat.phase === 'terminee' || etat.phase === 'intersaison') return undefined;
  const essai = structuredClone(etat);
  delete essai.matchInteractif;
  const avant = essai.matchs.length;
  pas(ctx, essai);
  const m = essai.matchs.slice(avant).find((x) => x.domicile === etat.franchise || x.exterieur === etat.franchise);
  if (!m) return undefined;
  return { ...m, score: [0, 0], prolongations: 0, empreinte: '', interet: 0, moments: [] };
}

/** Le prochain match de la franchise du joueur (saison régulière), s'il y en a un. */
export function prochainMatch(etat: EtatSaison): { date: string; domicile: string; exterieur: string } | undefined {
  for (const j of etat.calendrier.slice(etat.jour)) {
    const m = j.matchs.find((x) => x.domicile === etat.franchise || x.exterieur === etat.franchise);
    if (m) return { date: j.date, domicile: m.domicile, exterieur: m.exterieur };
  }
  return undefined;
}

export { appartenances };
