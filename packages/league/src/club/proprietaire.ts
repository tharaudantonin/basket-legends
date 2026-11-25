// Tranche 10 (réponses 50, 51 et 54) : le propriétaire de chaque franchise — son profil, l'objectif de la saison, la
// confiance revue à plusieurs rendez-vous, le licenciement du GM (celui du joueur comme ceux de l'IA), les offres
// d'emploi qui suivent, et la proposition de déménagement faite au GM du joueur.
//
// Organisation reprise de rugby-legends@19dd48f:src/manager/moteur/carriere.ts ; adaptations : objectifs selon le rang
// de force dans la ligue (et non le budget), niveaux de la phase finale NBA (Play-In, tours des playoffs), taxe de luxe
// au-delà de la tolérance du propriétaire, propriétaires et licenciements pour les 30 franchises, profil hérité du
// miroir (récidivistes de la taxe plus souvent « ambitieux »).
import { situationEquipe } from '../cba';
import { calculerBilans, pctBilan } from '../classement';
import { anneesEntre } from '../carriere/univers';
import type { Univers } from '../carriere/types';
import { forcesDesEquipes } from '../marche/echanges';
import { ecrireAuBureau } from '../marche/ia';
import type { ContexteLigue, EtatSaison } from '../types';
import { borner, clubDe, conferenceDe, etatClub, hasardDuClub, modeleClub, nomEquipe, publier, rangsDeConference, remplir } from './commun';
import type { ClubUnivers, ModeleClub, Objectif, ProfilProprietaire, TypeObjectif } from './types';

/** Niveau de la phase finale : 0 rien, 1 Play-In, 2 playoffs, 3 deuxième tour, 4 finale de conférence, 5 finale, 6 titre. */
export const NIVEAU_REQUIS: Record<Exclude<TypeObjectif, 'reconstruction'>, number> = {
  titre: 5,
  'finale-conference': 4,
  playoffs: 2,
  'play-in': 1,
};

export const LIBELLES_OBJECTIF: Record<TypeObjectif, string> = {
  titre: 'jouer la finale NBA',
  'finale-conference': 'atteindre la finale de conférence',
  playoffs: 'se qualifier pour les playoffs',
  'play-in': 'atteindre le Play-In',
  reconstruction: 'reconstruire',
};

export function libelleObjectif(o: Objectif): string {
  if (o.type === 'reconstruction') return `${LIBELLES_OBJECTIF.reconstruction} (au moins ${o.victoiresMin ?? 0} victoires)`;
  return LIBELLES_OBJECTIF[o.type];
}

/** Le profil d'un propriétaire (réponse 51) : hérité du miroir pour les récidivistes de la taxe, tiré pour les autres. */
function profilDe(M: ModeleClub, u: Univers, graine: number, equipe: string): ProfilProprietaire {
  const h = hasardDuClub({ graine }, `proprietaire-${equipe}`);
  const P = M.proprietaire;
  if (u.equipes[equipe]?.recidiviste && h.chance(P.recidivisteAmbitieux)) return 'ambitieux';
  const profils = Object.keys(P.profils) as ProfilProprietaire[];
  return h.pondere(profils, (p) => P.profils[p].part);
}

/** Complète un univers avec l'état du club (propriétaires, moral, carrière du GM). Modifie `u`. */
export function initialiserClub(ctx: ContexteLigue, u: Univers, graine: number, franchise: string): ClubUnivers {
  const M = modeleClub(ctx);
  if (!u.club) {
    const proprietaires: ClubUnivers['proprietaires'] = {};
    for (const e of Object.keys(u.effectifs).sort()) {
      const profil = profilDe(M, u, graine, e);
      proprietaires[e] = { profil, confiance: M.proprietaire.profils[profil].depart, gm: 0, gmDepuis: u.saison };
    }
    u.club = {
      proprietaires,
      reputation: M.proprietaire.reputation.depart,
      moral: {},
      roles: {},
      basDepuis: {},
      demandes: {},
      equipes: {},
      assignes: {},
      affilies: {},
      licenciements: {},
      parcours: [{ franchise, de: u.saison }],
    };
  }
  return u.club;
}

/**
 * L'objectif de la saison de chaque équipe, selon son rang attendu au début de la saison régulière : le rang de la
 * force de son effectif, et à partir de la deuxième saison la moyenne de ce rang et de celui de son bilan de la saison
 * passée (les notes seules prédisent mal les résultats : corrélation d'environ 0,5 avec les victoires, docs/CLUB.md § 3).
 */
export function fixerObjectifs(ctx: ContexteLigue, etat: EtatSaison): void {
  const u = etat.univers!;
  const M = modeleClub(ctx);
  const forces = forcesDesEquipes((ctx.base ?? ctx).marche!.modele, u);
  const parForce = Object.keys(forces).sort((a, b) => forces[b]! - forces[a]! || (a < b ? -1 : 1));
  const bilans = etat.archives?.at(-1)?.bilans;
  const pct = (e: string) => (bilans?.[e] ? bilans[e][0] / Math.max(1, bilans[e][0] + bilans[e][1]) : 0.5);
  const parBilan = parForce.slice().sort((a, b) => pct(b) - pct(a) || (a < b ? -1 : 1));
  const attendu = (e: string) => (bilans ? (parForce.indexOf(e) + parBilan.indexOf(e)) / 2 : parForce.indexOf(e));
  const ordre = parForce.slice().sort((a, b) => attendu(a) - attendu(b) || parForce.indexOf(a) - parForce.indexOf(b));
  const E = etatClub(etat);
  E.objectifs = {};
  E.rendezVous = 0;
  ordre.forEach((e, i) => {
    const o = M.proprietaire.objectifs.find((x) => i + 1 <= x.jusqua) ?? M.proprietaire.objectifs.at(-1)!;
    E.objectifs[e] = {
      type: o.type,
      rangConference: o.rangConference,
      rangForce: i + 1,
      ...(o.victoiresMin !== undefined ? { victoiresMin: o.victoiresMin } : {}),
    };
  });
  const o = E.objectifs[etat.franchise];
  if (o)
    publier(etat, {
      date: etat.date,
      genre: 'club',
      importance: 2,
      equipes: [etat.franchise],
      titre: `L’objectif du propriétaire : ${libelleObjectif(o)}`,
      texte: `${nomEquipe(ctx, u, etat.franchise)} est attendue au ${o.rangForce}e rang de la ligue (force de l’effectif${bilans ? ' et bilan de la saison passée' : ''}). Le propriétaire (profil ${clubDe(u).proprietaires[etat.franchise]!.profil}) attend de vous : ${libelleObjectif(o)}. Confiance actuelle : ${Math.round(clubDe(u).proprietaires[etat.franchise]!.confiance)}/100.`,
    });
}

/** Le niveau atteint par une équipe dans la phase finale (après la saison régulière). */
export function niveauAtteint(etat: EtatSaison, equipe: string, rang: number, rangsPlayIn: [number, number]): number {
  let n = rang <= rangsPlayIn[1] ? 1 : 0;
  for (const s of etat.series ?? []) {
    if (s.haut !== equipe && s.bas !== equipe) continue;
    n = Math.max(n, s.tour + 1);
    if (s.vainqueur === equipe) n = Math.max(n, s.tour + 2);
  }
  if (etat.palmares?.champion === equipe) n = 6;
  return n;
}

/** L'écart à l'objectif, en places de conférence (positif : en avance). */
function ecart(o: Objectif, rang: number, victoires: number, defaites: number, matchsParEquipe: number): number {
  if (o.type !== 'reconstruction') return o.rangConference - rang;
  const projetees = victoires + defaites ? (victoires / (victoires + defaites)) * matchsParEquipe : 0;
  return (projetees - (o.victoiresMin ?? 0)) / 3;
}

const variation = (M: ModeleClub, profil: ProfilProprietaire, places: number, poids: number): number => {
  const C = M.proprietaire.confiance;
  const brut = C.parPlace * poids * places * (places < 0 ? M.proprietaire.profils[profil].severite : 1);
  return borner(brut, -C.plafondBaisse, C.plafondHausse);
};

function texteDuProprietaire(
  ctx: ContexteLigue,
  etat: EtatSaison,
  genre: 'bon' | 'moyen' | 'mauvais' | 'licenciement',
  o: Objectif,
): string {
  const textes = modeleClub(ctx).proprietaire.textes[genre];
  const h = hasardDuClub(etat, `texte-${etat.saison}-${etat.date}-${genre}`);
  return remplir(h.choisir(textes), { club: nomEquipe(ctx, etat.univers, etat.franchise), objectif: libelleObjectif(o) });
}

/** Les rendez-vous du propriétaire en cours de saison (au tiers et aux deux tiers de la saison régulière). */
export function rendezVousDuJour(ctx: ContexteLigue, etat: EtatSaison): void {
  const M = modeleClub(ctx);
  const E = etatClub(etat);
  const u = etat.univers!;
  const C = clubDe(u);
  if (etat.phase !== 'reguliere' || E.rendezVous >= M.proprietaire.rendezVous.length || !Object.keys(E.objectifs).length) return;
  const part = etat.jour / Math.max(1, etat.calendrier.length);
  if (part < M.proprietaire.rendezVous[E.rendezVous]!) return;
  E.rendezVous++;
  const bilans = calculerBilans(ctx.structure, etat.matchs);
  const rangs = rangsDeConference(ctx, etat);
  for (const [e, o] of Object.entries(E.objectifs)) {
    const p = C.proprietaires[e];
    if (!p) continue;
    const b = bilans[e]!;
    const places = ecart(o, rangs[e]!, b.victoires, b.defaites, ctx.structure.calendrier.matchsParEquipe);
    p.confiance = borner(p.confiance + variation(M, p.profil, places, M.proprietaire.confiance.miSaison), 0, 100);
    if (e !== etat.franchise) continue;
    const genre = places >= 0 ? 'bon' : places >= -2 ? 'moyen' : 'mauvais';
    publier(etat, {
      date: etat.date,
      genre: 'club',
      importance: genre === 'mauvais' ? 3 : 2,
      equipes: [e],
      titre: `Rendez-vous avec le propriétaire (${E.rendezVous}/${M.proprietaire.rendezVous.length})`,
      texte: `${texteDuProprietaire(ctx, etat, genre, o)} ${nomEquipe(ctx, u, e)} est ${rangs[e]}e de sa conférence (${b.victoires}-${b.defaites}). Confiance : ${Math.round(p.confiance)}/100 (seuil : ${M.proprietaire.profils[p.profil].seuil}).`,
    });
  }
}

/**
 * Le bilan de fin de saison (après la finale) : objectif tenu ou non, confiance, réputation du GM du joueur,
 * licenciements. Le GM du joueur licencié reçoit des offres d'emploi ; ceux de l'IA sont remplacés.
 */
export function bilanDeFinDeSaison(ctx: ContexteLigue, etat: EtatSaison): void {
  const M = modeleClub(ctx);
  const E = etatClub(etat);
  const u = etat.univers!;
  const C = clubDe(u);
  if (!Object.keys(E.objectifs).length) return;
  const bilans = calculerBilans(ctx.structure, etat.matchs);
  const rangs = rangsDeConference(ctx, etat);
  const K = M.proprietaire.confiance;
  E.bilan = {};
  const licencies: string[] = [];
  for (const [e, o] of Object.entries(E.objectifs).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const p = C.proprietaires[e];
    if (!p) continue;
    const profil = M.proprietaire.profils[p.profil];
    const b = bilans[e]!;
    const niveau = niveauAtteint(etat, e, rangs[e]!, ctx.structure.playIn.rangsDuPlayIn);
    const tenu = o.type === 'reconstruction' ? b.victoires >= (o.victoiresMin ?? 0) || niveau >= 1 : niveau >= NIVEAU_REQUIS[o.type];
    let places = ecart(o, rangs[e]!, b.victoires, b.defaites, ctx.structure.calendrier.matchsParEquipe);
    if (o.type !== 'reconstruction') places += 2 * Math.max(0, niveau - NIVEAU_REQUIS[o.type]);
    let delta = variation(M, p.profil, places, K.finSaison);
    if (etat.palmares?.champion === e) delta += K.titre;
    else if (etat.palmares?.finaliste === e) delta += K.finale;
    // La taxe de luxe au-delà de ce que le propriétaire accepte.
    const taxe = situationEquipe(
      ctx.salaires,
      e,
      (ctx.equipes[e]?.joueurs ?? []).map((j) => j.id),
    ).taxe;
    const exces = Math.max(0, taxe - profil.toleranceTaxe);
    delta -= (K.taxeParDixMillions * exces * profil.severite) / 10_000_000;
    p.confiance = borner(p.confiance + delta, 0, 100);
    if (tenu) p.confiance = Math.max(p.confiance, profil.seuil + K.objectifTenuMarge);
    const licencie = p.confiance < profil.seuil;
    E.bilan[e] = { tenu, confiance: Math.round(p.confiance), licencie };
    if (e === etat.franchise) {
      const R = M.proprietaire.reputation;
      C.reputation = borner(
        C.reputation +
          (tenu ? R.objectifTenu : -R.objectifManque) +
          (etat.palmares?.champion === e ? R.titre : etat.palmares?.finaliste === e ? R.finale : 0) -
          (licencie ? R.licenciement : 0),
        0,
        100,
      );
      publier(etat, {
        date: etat.date,
        genre: 'club',
        importance: 3,
        equipes: [e],
        titre: licencie ? 'Vous êtes licencié' : `Bilan du propriétaire : objectif ${tenu ? 'tenu' : 'manqué'}`,
        texte: licencie
          ? `${texteDuProprietaire(ctx, etat, 'licenciement', o)} Votre réputation : ${Math.round(C.reputation)}/100.`
          : `${texteDuProprietaire(ctx, etat, tenu ? 'bon' : places >= -2 ? 'moyen' : 'mauvais', o)} Objectif : ${libelleObjectif(o)}. Confiance : ${Math.round(p.confiance)}/100. Votre réputation : ${Math.round(C.reputation)}/100.`,
      });
    }
    if (licencie) licencies.push(e);
  }
  C.licenciements[etat.saison] = licencies;
  // Les GM de l'IA licenciés sont remplacés dès maintenant (un nouveau GM, une nouvelle personnalité).
  for (const e of licencies) if (e !== etat.franchise) remplacerGm(ctx, u, e, etat.saison);
  const autres = licencies.filter((e) => e !== etat.franchise);
  if (autres.length)
    publier(etat, {
      date: etat.date,
      genre: 'club',
      importance: 2,
      equipes: autres,
      titre: `${autres.length} GM licencié${autres.length > 1 ? 's' : ''}`,
      texte: `Changement de direction sportive : ${autres.map((e) => nomEquipe(ctx, u, e)).join(', ')}.`,
    });
  if (licencies.includes(etat.franchise)) {
    C.parcours.at(-1)!.jusqua = etat.saison;
    C.parcours.at(-1)!.fin = 'licencie';
    E.licenciement = { offres: offresDEmploi(ctx, etat, licencies) };
    ecrireAuBureau(etat, {
      date: etat.date,
      genre: 'info',
      titre: 'Offres d’emploi',
      texte: `Après votre licenciement, ${E.licenciement.offres.map((e) => nomEquipe(ctx, u, e)).join(', ')} vous propose${E.licenciement.offres.length > 1 ? 'nt' : ''} un poste de GM. Choisissez votre nouvelle franchise.`,
    });
  }
}

/** Un nouveau GM pour une franchise : la confiance de départ du propriétaire, une nouvelle personnalité. */
function remplacerGm(ctx: ContexteLigue, u: Univers, equipe: string, saison: string): void {
  const p = clubDe(u).proprietaires[equipe]!;
  p.gm++;
  p.gmDepuis = saison;
  p.confiance = modeleClub(ctx).proprietaire.profils[p.profil].depart;
}

/**
 * Les franchises qui offrent un poste au GM du joueur licencié : celles qui viennent de licencier le leur, puis les
 * moins confiantes, dont le prestige (rang de force) ne dépasse pas sa réputation de plus de « ecartOffres ».
 */
export function offresDEmploi(ctx: ContexteLigue, etat: EtatSaison, licencies: readonly string[]): string[] {
  const M = modeleClub(ctx);
  const u = etat.univers!;
  const C = clubDe(u);
  const forces = forcesDesEquipes((ctx.base ?? ctx).marche!.modele, u);
  const ordre = Object.keys(forces).sort((a, b) => forces[b]! - forces[a]! || (a < b ? -1 : 1));
  const n = ordre.length;
  const prestige = (e: string) => (100 * (n - ordre.indexOf(e))) / n;
  const accessibles = ordre.filter((e) => e !== etat.franchise && prestige(e) <= C.reputation + M.proprietaire.reputation.ecartOffres);
  const confiance = (e: string) => C.proprietaires[e]?.confiance ?? 50;
  const candidates = [
    ...accessibles.filter((e) => licencies.includes(e)),
    ...accessibles.filter((e) => !licencies.includes(e)).sort((a, b) => confiance(a) - confiance(b) || (a < b ? -1 : 1)),
  ];
  const offres = candidates.slice(0, M.proprietaire.offres);
  return offres.length ? offres : [ordre.at(-1)!];
}

/** Le GM du joueur accepte une offre : il change de franchise (l'ancienne reçoit un GM de l'IA). */
export function accepterOffre(ctx: ContexteLigue, etat: EtatSaison, franchise: string): string {
  const E = etatClub(etat);
  if (!E.licenciement?.offres.includes(franchise)) throw new Error('Cette franchise ne vous a pas fait d’offre.');
  const u = etat.univers!;
  const C = clubDe(u);
  const ancienne = etat.franchise;
  remplacerGm(ctx, u, ancienne, etat.saison);
  remplacerGm(ctx, u, franchise, etat.saison);
  C.parcours.push({ franchise, de: etat.saison });
  etat.franchise = franchise;
  delete etat.compositionManuelle;
  if (etat.delegations) etat.delegations = { ...etat.delegations, rotation: 'staff' };
  delete E.licenciement;
  for (const m of etat.bureau ?? []) if (m.statut === 'ouvert') m.statut = 'expire';
  publier(etat, {
    date: etat.date,
    genre: 'club',
    importance: 3,
    equipes: [franchise, ancienne],
    titre: `Vous êtes le nouveau GM de ${nomEquipe(ctx, u, franchise)}`,
    texte: `Après votre départ de ${nomEquipe(ctx, u, ancienne)}, vous prenez la direction sportive de ${nomEquipe(ctx, u, franchise)}.`,
  });
  return `Vous rejoignez ${nomEquipe(ctx, u, franchise)}.`;
}

/** Réponse 54 : le propriétaire du joueur propose (rarement) un déménagement, à l'ouverture de l'intersaison. */
export function proposerDemenagement(ctx: ContexteLigue, etat: EtatSaison): void {
  const base = ctx.base ?? ctx;
  const Cc = base.carriere;
  const u = etat.univers!;
  if (!Cc) return;
  const M = modeleClub(ctx);
  const h = hasardDuClub(etat, `demenagement-${etat.saison}`);
  if (!h.chance(M.proprietaire.propositionDemenagement)) return;
  const e = etat.franchise;
  const depuis = u.franchises[e]?.depuis;
  if (depuis && anneesEntre(depuis, etat.saison) < Cc.modele.demenagement.delaiMinimum) return;
  const prises = new Set(Object.values(u.franchises).map((f) => f.ville));
  const villes = Cc.villes.filter((v) => !prises.has(v.ville) && v.conference === conferenceDe(ctx, e));
  if (!villes.length) return;
  const v = h.choisir(villes);
  etatClub(etat).demenagement = { ville: v.ville, nom: `${v.ville} ${h.choisir(v.noms)}`, abreviation: v.abreviation, statut: 'ouvert' };
  const texte = remplir(h.choisir(M.proprietaire.textes.demenagement), { club: nomEquipe(ctx, u, e), ville: v.ville });
  ecrireAuBureau(etat, { date: etat.date, genre: 'info', titre: 'Projet de déménagement', texte, statut: 'ouvert' });
  publier(etat, { date: etat.date, genre: 'club', importance: 3, equipes: [e], titre: 'Le propriétaire envisage un déménagement', texte });
}

/** Le GM du joueur accepte ou refuse le déménagement proposé (avant le premier match de la saison). */
export function repondreDemenagement(ctx: ContexteLigue, etat: EtatSaison, accepter: boolean): string {
  const E = etatClub(etat);
  const d = E.demenagement;
  if (!d || d.statut !== 'ouvert') throw new Error('Aucun projet de déménagement en attente.');
  if (etat.phase !== 'intersaison') throw new Error('Un déménagement se décide pendant l’intersaison.');
  const u = etat.univers!;
  const e = etat.franchise;
  const C = clubDe(u);
  const M = modeleClub(ctx);
  d.statut = accepter ? 'accepte' : 'refuse';
  if (!accepter) {
    C.proprietaires[e]!.confiance = borner(C.proprietaires[e]!.confiance - M.proprietaire.confiance.demenagementRefuse, 0, 100);
    return 'Le propriétaire renonce, à regret.';
  }
  const base = ctx.base ?? ctx;
  const actuelle = u.franchises[e] ?? { ...base.carriere!.franchises[e]! };
  u.franchises[e] = {
    ville: d.ville,
    nom: d.nom,
    abreviation: d.abreviation,
    depuis: etat.saison,
    anciennes: [...(actuelle.anciennes ?? []), { ville: actuelle.ville, nom: actuelle.nom, jusqua: etat.saison }],
  };
  u.version = (u.version ?? 0) + 1;
  publier(etat, {
    date: etat.date,
    genre: 'intersaison',
    importance: 3,
    equipes: [e],
    titre: `Les ${actuelle.nom} deviennent les ${d.nom}`,
    texte: `La franchise ${actuelle.nom} déménage et devient ${d.nom}. Elle garde son histoire, son palmarès et ses records.`,
  });
  return `La franchise devient ${d.nom}.`;
}

/** Les pourcentages de victoires utiles à l'écran du club. */
export const pctDe = (ctx: ContexteLigue, etat: EtatSaison, e: string): number => pctBilan(calculerBilans(ctx.structure, etat.matchs)[e]!);
