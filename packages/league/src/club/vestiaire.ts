// Tranche 10 (réponses 52 et 53) : le vestiaire — moral de chaque joueur NBA (résultats, temps de jeu face à son rôle,
// tempérament et personnalité), moral du groupe (les meneurs comptent plus) et son petit effet en match, demandes
// d'échange, messages à choix pour la franchise du joueur.
//
// Organisation reprise de rugby-legends@19dd48f:src/manager/moteur/vestiaire.ts ; adaptations : le moral est calculé
// pour les 30 équipes (il pèse sur les prolongations et les échanges de l'IA, réponse 53) ; l'effet en match est mesuré
// par rapport à la moyenne de la ligue (effet moyen nul, calibration inchangée) et noté dans le résumé du match (rejeu à
// l'identique) ; rôles et minutes du basket (cinq de départ, rotation, fin de banc).
import { creerHasard, type ResultatMatch } from '@basket-legends/engine';
import { calculerBilans } from '../classement';
import type { JoueurCarriere, Univers } from '../carriere/types';
import { personnalite } from '../marche/personnalite';
import type { ContexteLigue, EtatSaison, ResumeMatch } from '../types';
import { borner, clubDe, etatClub, hasardDuClub, modeleClub, nomEquipe, publier, remplir } from './commun';
import { assignerEnGLeague, peutEtreAssigne } from './gleague';
import { libelleObjectif } from './proprietaire';
import { situationEquipe } from '../cba';
import type { ChoixMessage, ClubUnivers, EvenementClub, MessageClub, ModeleClub, Role, Temperament } from './types';

const cacheTemperaments = new Map<string, Temperament>();
const cachePersonnalites = new Map<string, ReturnType<typeof personnalite>>();

function personnaliteEnCache(M: Parameters<typeof personnalite>[0], joueur: string, graine: number): ReturnType<typeof personnalite> {
  const cle = `${graine}:${joueur}`;
  let p = cachePersonnalites.get(cle);
  if (!p) {
    if (cachePersonnalites.size > 50_000) cachePersonnalites.clear();
    cachePersonnalites.set(cle, (p = personnalite(M, joueur, graine)));
  }
  return p;
}

/** Le tempérament d'un joueur (fixe pour une partie) : un meneur est trois fois plus probable avec un mental élevé. */
export function temperamentDe(M: ModeleClub, j: Pick<JoueurCarriere, 'id' | 'familles'>, graine: number): Temperament {
  const cle = `${graine}:${j.id}:${j.familles.mental >= M.vestiaire.meneurMental ? 1 : 0}`;
  let t = cacheTemperaments.get(cle);
  if (!t) {
    if (cacheTemperaments.size > 50_000) cacheTemperaments.clear();
    cacheTemperaments.set(cle, (t = tirerTemperament(M, j, graine)));
  }
  return t;
}

function tirerTemperament(M: ModeleClub, j: Pick<JoueurCarriere, 'id' | 'familles'>, graine: number): Temperament {
  const T = M.vestiaire.temperaments;
  const poids = (t: Temperament) => T[t].part * (t === 'meneur' && j.familles.mental >= M.vestiaire.meneurMental ? 3 : 1);
  return creerHasard(graine, `temperament-${j.id}`).pondere(Object.keys(T) as Temperament[], poids);
}

export const moralDe = (M: ModeleClub, c: ClubUnivers | undefined, joueur: string): number => c?.moral[joueur] ?? M.vestiaire.moral.depart;

/** Les joueurs d'une équipe qui comptent dans son vestiaire (hors assignés en G League). */
const vestiaireDe = (u: Univers, equipe: string): string[] => (u.effectifs[equipe] ?? []).filter((j) => !u.club?.assignes[j]);

/** Le rôle d'un joueur : celui qu'on lui a promis, sinon son rang par note dans l'effectif. */
export function roleDe(M: ModeleClub, u: Univers, equipe: string, joueur: string): Role {
  const promis = u.club?.roles[joueur];
  if (promis) return promis;
  const rang = vestiaireDe(u, equipe)
    .slice()
    .sort((a, b) => (u.joueurs[b]?.note ?? 0) - (u.joueurs[a]?.note ?? 0) || (a < b ? -1 : 1))
    .indexOf(joueur);
  return rang < M.vestiaire.roles.titulaires
    ? 'titulaire'
    : rang < M.vestiaire.roles.titulaires + M.vestiaire.roles.rotation
      ? 'rotation'
      : 'banc';
}

/** Le moral du groupe : moyenne des moraux, les meneurs pesant plus. */
export function moralDuGroupe(M: ModeleClub, u: Univers, equipe: string, graine: number): number {
  let s = 0;
  let p = 0;
  for (const j of vestiaireDe(u, equipe)) {
    const joueur = u.joueurs[j];
    if (!joueur) continue;
    const w = temperamentDe(M, joueur, graine) === 'meneur' ? M.vestiaire.moral.poidsMeneur : 1;
    s += w * moralDe(M, u.club, j);
    p += w;
  }
  return p ? s / p : M.vestiaire.moral.depart;
}

/** La part des meneurs dans le groupe (chance des réponses « les cadres règlent ça »). */
function partDesMeneurs(M: ModeleClub, u: Univers, equipe: string, graine: number): number {
  const js = vestiaireDe(u, equipe);
  const n = js.filter((j) => u.joueurs[j] && temperamentDe(M, u.joueurs[j]!, graine) === 'meneur').length;
  return Math.min(0.8, 0.3 + (0.5 * n) / Math.max(1, js.length) + 0.1 * n);
}

/**
 * La forme des deux équipes d'un match : l'écart de leur moral de groupe à la moyenne de la ligue, en points de
 * réussite au tir, borné (réponse 52 : petit effet ; moyenne nulle sur la ligue).
 */
const cacheMoyenne = new WeakMap<object, { date: string; moyenne: number }>();

export function formeDuMatch(ctx: ContexteLigue, etat: EtatSaison, domicile: string, exterieur: string): [number, number] | undefined {
  const u = etat.univers;
  if (!u?.club || !ctx.club) return undefined;
  const M = modeleClub(ctx);
  // La moyenne de la ligue est prise au premier match du jour (même valeur pour tous les matchs du jour).
  let c = cacheMoyenne.get(etat.club ?? etat);
  if (c?.date !== etat.date) {
    const equipes = Object.keys(u.effectifs);
    const moyenne = equipes.reduce((s, e) => s + moralDuGroupe(M, u, e, etat.graine), 0) / Math.max(1, equipes.length);
    cacheMoyenne.set(etat.club ?? etat, (c = { date: etat.date, moyenne }));
  }
  const moyenne = c.moyenne;
  const groupes: Record<string, number> = {
    [domicile]: moralDuGroupe(M, u, domicile, etat.graine),
    [exterieur]: moralDuGroupe(M, u, exterieur, etat.graine),
  };
  const E = M.vestiaire.effetMatch;
  // « || 0 » : pas de -0 (perdu par la sauvegarde JSON).
  const f = (e: string) => Math.round(borner(E.parPoint * ((groupes[e] ?? moyenne) - moyenne), -E.max, E.max) * 1e5) / 1e5 || 0;
  const forme: [number, number] = [f(domicile), f(exterieur)];
  return forme[0] || forme[1] ? forme : undefined;
}

/** Après un match : résultat, temps de jeu face au rôle, promesses tenues ou rompues. */
export function apresMatch(ctx: ContexteLigue, etat: EtatSaison, r: ResultatMatch, resume: ResumeMatch): void {
  const u = etat.univers;
  if (!u?.club || !ctx.club) return;
  const M = modeleClub(ctx);
  const V = M.vestiaire;
  const Mm = (ctx.base ?? ctx).marche!.modele;
  const E = etatClub(etat);
  const absents = new Set(resume.absents);
  r.boxScore.equipes.forEach((b, i) => {
    const gagne = b.points > r.boxScore.equipes[1 - i]!.points;
    const minutes = Object.fromEntries(b.joueurs.map((l) => [l.id, l.dixiemes / 600]));
    for (const j of vestiaireDe(u, b.id)) {
      const joueur = u.joueurs[j];
      if (!joueur || absents.has(j)) continue;
      const t = V.temperaments[temperamentDe(M, joueur, etat.graine)];
      const p = personnaliteEnCache(Mm, j, etat.graine);
      const m = minutes[j] ?? 0;
      const cran = m < V.moral.minutesRotation ? 0 : m < V.moral.minutesTitulaire ? 1 : 2;
      const role = roleDe(M, u, b.id, j);
      let d = (gagne ? V.moral.victoire : V.moral.defaite) * (p.victoire / 50);
      d += V.tempsDeJeu[role][cran] * t.tempsDeJeu * (p.role / 50);
      if (E.promesses[j]) {
        if (cran === 0) d += V.moral.promesseRompue;
        delete E.promesses[j];
      }
      u.club!.moral[j] = borner(moralDe(M, u.club, j) + d * t.variation, 0, 100);
      if (role !== 'banc' && cran === 0) E.peuJoue[j] = (E.peuJoue[j] ?? 0) + 1;
      else delete E.peuJoue[j];
    }
  });
}

/** Un jour de saison : retour du moral vers son niveau de départ, recrues, demandes d'échange, messages. */
export function journeeDuVestiaire(ctx: ContexteLigue, etat: EtatSaison): void {
  const u = etat.univers!;
  const C = clubDe(u);
  const M = modeleClub(ctx);
  const V = M.vestiaire.moral;
  for (const [e, js] of Object.entries(u.effectifs))
    for (const j of js) {
      if (C.equipes[j] !== e) {
        // Un joueur qui arrive dans une équipe : moral d'une recrue, ni rôle promis ni demande.
        if (C.equipes[j] !== undefined) {
          C.moral[j] = V.recrue;
          delete C.roles[j];
          delete C.basDepuis[j];
          delete C.demandes[j];
        }
        C.equipes[j] = e;
      }
      const m = moralDe(M, C, j);
      C.moral[j] = m + (V.depart - m) * V.retour;
      if (C.moral[j]! < V.demandeSeuil) {
        C.basDepuis[j] ??= etat.date;
        const jours = (Date.parse(etat.date) - Date.parse(C.basDepuis[j]!)) / 86_400_000;
        if (jours >= V.demandeJours && !C.demandes[j] && u.contrats[j]?.type === 'standard') {
          C.demandes[j] = { date: etat.date, equipe: e };
          if (e !== etat.franchise && (u.joueurs[j]?.note ?? 0) >= 70)
            publier(etat, {
              date: etat.date,
              genre: 'club',
              importance: 2,
              equipes: [e],
              titre: `${u.joueurs[j]!.nom} demande à être échangé`,
              texte: `Mécontent de son sort, ${u.joueurs[j]!.nom} (${nomEquipe(ctx, u, e)}) a demandé à quitter son équipe.`,
            });
        }
      } else {
        delete C.basDepuis[j];
        if (C.demandes[j] && C.moral[j]! >= V.depart) delete C.demandes[j];
      }
    }
  for (const j of Object.keys(C.equipes))
    if (!u.contrats[j] || !Object.values(u.effectifs).some((js) => js.includes(j))) delete C.equipes[j];
  repondreParDefaut(ctx, etat);
  messagesDuJour(ctx, etat);
}

/** À l'intersaison : le moral revient à mi-chemin de son niveau de départ ; rôles promis et demandes retombent. */
export function intersaisonDuVestiaire(M: ModeleClub, C: ClubUnivers): void {
  for (const j of Object.keys(C.moral))
    C.moral[j] = M.vestiaire.moral.depart + (C.moral[j]! - M.vestiaire.moral.depart) * (1 - M.vestiaire.moral.intersaison);
  C.roles = {};
  C.basDepuis = {};
  for (const [j, d] of Object.entries(C.demandes)) if (!d.acceptee) delete C.demandes[j];
}

/** Effet du moral sur la fidélité d'un agent libre envers son équipe (agents libres, réponse 53). */
export function facteurFidelite(M: ModeleClub, C: ClubUnivers | undefined, joueur: string): number {
  if (!C) return 1;
  const m = moralDe(M, C, joueur);
  const d = M.vestiaire.moral.depart;
  const [bas, haut] = M.vestiaire.fidelite;
  return m < d ? bas + ((1 - bas) * m) / d : 1 + ((haut - 1) * (m - d)) / Math.max(1, 100 - d);
}

// --- Messages à choix (franchise du joueur). ---

const evenement = (M: ModeleClub, id: string): EvenementClub => M.vestiaire.evenements.find((e) => e.id === id)!;

function deposer(ctx: ContexteLigue, etat: EtatSaison, ev: EvenementClub, joueur?: string, joueur2?: string): void {
  const E = etatClub(etat);
  const u = etat.univers!;
  const o = E.objectifs[etat.franchise];
  const v = {
    joueur: joueur ? u.joueurs[joueur]!.nom : '',
    joueur2: joueur2 ? u.joueurs[joueur2]!.nom : '',
    club: nomEquipe(ctx, u, etat.franchise),
    objectif: o ? libelleObjectif(o) : '',
  };
  E.messages.push({
    id: (E.messages.at(-1)?.id ?? 0) + 1,
    evenement: ev.id,
    date: etat.date,
    titre: ev.titre,
    texte: remplir(ev.texte, v),
    de: ev.de,
    ...(joueur ? { joueur } : {}),
    ...(joueur2 ? { joueur2 } : {}),
    choix: ev.choix.map((c) => c.texte),
  });
}

/** Les messages possibles du jour (au plus un par jour, et un nombre maximal par saison), dans l'ordre de l'urgence. */
function messagesDuJour(ctx: ContexteLigue, etat: EtatSaison): void {
  const M = modeleClub(ctx);
  const V = M.vestiaire;
  const E = etatClub(etat);
  const u = etat.univers!;
  const C = clubDe(u);
  const f = etat.franchise;
  if (etat.phase !== 'reguliere' || E.messages.length >= V.messages.parSaison) return;
  if (E.messages.filter((m) => m.date === etat.date).length >= V.messages.parJour) return;
  if (E.messages.some((m) => m.reponse === undefined)) return;
  const h = hasardDuClub(etat, `messages-${etat.date}`);
  const S = V.seuils;
  const ch = V.chances;
  const deja = (id: string, joueur?: string) => E.messages.some((m) => m.evenement === id && (!joueur || m.joueur === joueur));
  const effectif = vestiaireDe(u, f);
  const bilan = calculerBilans(ctx.structure, etat.matchs)[f];
  const serie = bilan?.serie ?? 0;
  const parNote = effectif.slice().sort((a, b) => (u.joueurs[b]?.note ?? 0) - (u.joueurs[a]?.note ?? 0) || (a < b ? -1 : 1));
  // VES-004 : une demande d'échange.
  const demande = effectif.find((j) => C.demandes[j]?.equipe === f && !deja('VES-004', j));
  if (demande && h.chance(ch['VES-004'] ?? 1)) return deposer(ctx, etat, evenement(M, 'VES-004'), demande);
  // VES-001 : temps de jeu réclamé.
  const frustre = effectif.find((j) => (E.peuJoue[j] ?? 0) >= (S['VES-001_matchs'] ?? 3) && moralDe(M, C, j) < (S['VES-001_moral'] ?? 50));
  if (frustre && !deja('VES-001', frustre) && h.chance(ch['VES-001'] ?? 0)) return deposer(ctx, etat, evenement(M, 'VES-001'), frustre);
  // PRO-002 : la taxe de luxe au-delà de la tolérance du propriétaire (une fois par saison, après la date limite des échanges).
  const p = C.proprietaires[f];
  if (p && !E.taxeSignalee && etat.jour > etat.calendrier.length / 2) {
    const taxe = situationEquipe(
      ctx.salaires,
      f,
      (ctx.equipes[f]?.joueurs ?? []).map((x) => x.id),
    ).taxe;
    if (taxe > M.proprietaire.profils[p.profil].toleranceTaxe) {
      E.taxeSignalee = true;
      if (h.chance(ch['PRO-002'] ?? 0)) return deposer(ctx, etat, evenement(M, 'PRO-002'));
    }
  }
  // PRO-001 : le propriétaire s'inquiète (confiance basse) : au plus une fois par rendez-vous.
  const inquietudes = E.messages.filter((m) => m.evenement === 'PRO-001').length;
  if (p && p.confiance < (S['PRO-001_confiance'] ?? 45) && inquietudes < E.rendezVous && h.chance(ch['PRO-001'] ?? 0))
    return deposer(ctx, etat, evenement(M, 'PRO-001'));
  // VES-006 : le groupe doute (longue série de défaites) : au plus une fois par mois.
  const ceMois = E.messages.some((m) => m.evenement === 'VES-006' && m.date.slice(0, 7) === etat.date.slice(0, 7));
  if (serie <= -(S['VES-006_defaites'] ?? 5) && !ceMois && h.chance(ch['VES-006'] ?? 0)) {
    const cadre = parNote.find((j) => temperamentDe(M, u.joueurs[j]!, etat.graine) === 'meneur') ?? parNote[0];
    if (cadre) return deposer(ctx, etat, evenement(M, 'VES-006'), cadre);
  }
  // VES-003 : un cadre conteste (série de défaites).
  if (serie <= -(S['VES-003_defaites'] ?? 3)) {
    const cadre = parNote
      .slice(0, S['VES-003_rang'] ?? 5)
      .find(
        (j) =>
          u.joueurs[j]!.age >= (S['VES-003_age'] ?? 28) &&
          temperamentDe(M, u.joueurs[j]!, etat.graine) !== 'discret' &&
          !deja('VES-003', j),
      );
    if (cadre && h.chance(ch['VES-003'] ?? 0)) return deposer(ctx, etat, evenement(M, 'VES-003'), cadre);
  }
  // VES-005 : un jeune s'impatiente.
  const jeune = effectif.find(
    (j) =>
      u.joueurs[j]!.age <= (S['VES-005_age'] ?? 22) &&
      (u.joueurs[j]!.potentiel ?? u.joueurs[j]!.note) >= (S['VES-005_potentiel'] ?? 70) &&
      roleDe(M, u, f, j) === 'banc' &&
      !deja('VES-005', j),
  );
  if (jeune && h.chance(ch['VES-005'] ?? 0)) return deposer(ctx, etat, evenement(M, 'VES-005'), jeune);
  // VES-002 : accrochage à l'entraînement (après une défaite ; plus probable avec des sanguins).
  if (serie < 0) {
    const sanguins = effectif.filter((j) => temperamentDe(M, u.joueurs[j]!, etat.graine) === 'sanguin');
    const chance = Math.min(0.15, (ch['VES-002'] ?? 0) + (ch['VES-002_par_sanguin'] ?? 0) * sanguins.length);
    if (sanguins.length && effectif.length >= 2 && h.chance(chance)) {
      const a = h.choisir(sanguins);
      const b = h.choisir(effectif.filter((x) => x !== a));
      return deposer(ctx, etat, evenement(M, 'VES-002'), a, b);
    }
  }
}

/** Les messages restés sans réponse au-delà du délai reçoivent la réponse par défaut. */
function repondreParDefaut(ctx: ContexteLigue, etat: EtatSaison): void {
  const M = modeleClub(ctx);
  const E = etatClub(etat);
  for (const m of E.messages) {
    if (m.reponse !== undefined) continue;
    const jours = (Date.parse(etat.date) - Date.parse(m.date)) / 86_400_000;
    if (jours < M.vestiaire.messages.delai) continue;
    const ev = evenement(M, m.evenement);
    repondreAuMessage(
      ctx,
      etat,
      m.id,
      Math.max(
        0,
        ev.choix.findIndex((c) => c.defaut),
      ),
      true,
    );
  }
}

/** Répond à un message à choix : effets tirés au hasard (une même réponse peut bien ou mal tourner), puis l'action. */
export function repondreAuMessage(ctx: ContexteLigue, etat: EtatSaison, id: number, index: number, parDefaut = false): string {
  const M = modeleClub(ctx);
  const E = etatClub(etat);
  const u = etat.univers!;
  const C = clubDe(u);
  const m: MessageClub | undefined = E.messages.find((x) => x.id === id);
  if (!m || m.reponse !== undefined) throw new Error('Ce message n’attend pas de réponse.');
  const ev = evenement(M, m.evenement);
  const c: ChoixMessage | undefined = ev.choix[index];
  if (!c) throw new Error('Réponse inconnue.');
  const h = hasardDuClub(etat, `reponse-${etat.saison}-${id}`);
  const meneurs = partDesMeneurs(M, u, etat.franchise, etat.graine);
  const tirer = (liste?: number[]) => {
    if (!liste?.length) return 0;
    if (c.chance === 'meneurs' && liste.length >= 2) return h.chance(meneurs) ? liste[0]! : h.choisir(liste.slice(1));
    return h.choisir(liste);
  };
  const resultats: string[] = [];
  const bouger = (j: string | undefined, x: number) => {
    if (!j || !x) return;
    C.moral[j] = borner(moralDe(M, C, j) + x, 0, 100);
    resultats.push(`${u.joueurs[j]?.nom ?? j} ${x > 0 ? '+' : ''}${x}`);
  };
  bouger(m.joueur, tirer(c.effets.joueur));
  bouger(m.joueur2, tirer(c.effets.joueur2));
  const g = tirer(c.effets.groupe);
  if (g) {
    for (const j of vestiaireDe(u, etat.franchise)) C.moral[j] = borner(moralDe(M, C, j) + g, 0, 100);
    resultats.push(`groupe ${g > 0 ? '+' : ''}${g}`);
  }
  const k = tirer(c.effets.confiance);
  const p = C.proprietaires[etat.franchise];
  if (k && p) {
    p.confiance = borner(p.confiance + k, 0, 100);
    resultats.push(`confiance du propriétaire ${k > 0 ? '+' : ''}${k}`);
  }
  if (c.action === 'promesse' && m.joueur) E.promesses[m.joueur] = etat.date;
  if (c.action === 'ecarter') for (const j of [m.joueur, m.joueur2]) if (j) E.ecartes[j] = 1;
  if (c.action === 'role' && m.joueur) C.roles[m.joueur] = roleDe(M, u, etat.franchise, m.joueur) === 'banc' ? 'rotation' : 'titulaire';
  if (c.action === 'gleague' && m.joueur && peutEtreAssigne(ctx, etat, etat.franchise, m.joueur))
    assignerEnGLeague(ctx, etat, etat.franchise, m.joueur, true);
  if (c.action === 'echange' && m.joueur && C.demandes[m.joueur]) C.demandes[m.joueur]!.acceptee = true;
  if (c.action === 'garder' && m.joueur) delete C.demandes[m.joueur];
  m.reponse = index;
  if (parDefaut) m.parDefaut = true;
  m.resultat = resultats.length ? resultats.join(', ') : 'Sans effet visible.';
  return m.resultat;
}

/** Les moraux des joueurs d'une équipe (écran du vestiaire). */
export function vestiaireDeLEquipe(
  ctx: ContexteLigue,
  etat: EtatSaison,
  equipe: string,
): { joueur: string; moral: number; role: Role; temperament: Temperament; demande: boolean; assigne: boolean }[] {
  const u = etat.univers!;
  const M = modeleClub(ctx);
  return (u.effectifs[equipe] ?? []).map((j) => ({
    joueur: j,
    moral: Math.round(moralDe(M, u.club, j)),
    role: roleDe(M, u, equipe, j),
    temperament: temperamentDe(M, u.joueurs[j]!, etat.graine),
    demande: !!u.club?.demandes[j],
    assigne: !!u.club?.assignes[j],
  }));
}
