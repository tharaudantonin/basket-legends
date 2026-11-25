// Tranches 8 et 9 : l'intersaison, entre la fin d'une saison (Draft comprise) et le premier match de la suivante.
//
// Ouverture (tranche 8) : archive de la saison ; progression et vieillissement de tous les joueurs (avec l'effet de
// l'entraîneur du développement, tranche 9) ; retraites ; arrivée des joueurs draftés (contrats de l'échelle des
// rookies, two-way des seconds tours) ; contrats échus ; changement éventuel de franchise ; nouvelle saison (calendrier,
// classe de Draft) en phase « intersaison ».
//
// Tranche 9 : la free agency se joue ensuite par journées (marche/agents.ts), avec les échanges de l'IA, jusqu'au
// camp, qui ouvre la saison régulière. Sans données du marché (contexte de la tranche 8), la règle provisoire de la
// tranche 8 s'applique encore : prolongations automatiques d'une saison et effectifs complétés au minimum.
import { creerHasard } from '@basket-legends/engine';
import { salaireMinimum, saisonCourte, situationEquipe, type ContratJoueur } from '../cba';
import { calculerBilans } from '../classement';
import { nouvelleSaison } from '../saison';
import type { Actualite, ContexteLigue, EtatSaison } from '../types';
import type { Prospect } from '../draft/types';
import { camp, jouerJourneeAgentsLibres, ouvrirAgentsLibres, prolongerAvantMarche, terminerAgentsLibres } from '../marche/agents';
import { ecrireAuBureau, echangesDeLIntersaison } from '../marche/ia';
import { initialiserMarche } from '../marche/operations';
import { plafondSuivant } from '../marche/plafond';
import { bonusProgression } from '../marche/staff';
import { DELEGATIONS_PAR_DEFAUT, DELEGATIONS_STAFF, type Offre } from '../marche/types';
import { demenager } from './demenagement';
import { vieillir } from './progression';
import type { ArchiveSaison, BilanIntersaison, JoueurCarriere, Univers } from './types';
import { contexteDeLaSaison, contexteDeLUnivers, nomDeFranchise, saisonSuivante } from './univers';

const hacher = (...parties: (string | number)[]): number => {
  let h = 2166136261;
  for (const c of parties.join(':')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

/** La graine d'une saison de la carrière, tirée de la graine de la saison précédente. */
export const graineDeLaSaison = (grainePrecedente: number, saison: string): number => hacher(grainePrecedente, 'saison', saison);

/** L'intersaison peut commencer : saison terminée et Draft faite (s'il y en a une). */
export const intersaisonPossible = (etat: EtatSaison): boolean => etat.phase === 'terminee' && (!etat.draft || !!etat.draft.terminee);

function joueurDuProspect(p: Prospect, saison: string): JoueurCarriere {
  return {
    id: p.id,
    nom: `${p.prenom} ${p.nom}`,
    numero: '',
    poste: p.poste,
    tailleCm: p.tailleCm,
    poidsKg: p.poidsKg,
    pays: p.pays,
    age: p.age,
    note: p.note,
    potentiel: p.potentiel,
    familles: { ...p.familles },
    details: { ...p.details },
    origine: 'draft',
    depuis: saison,
    notes: [{ saison, note: p.note }],
  };
}

/** Le premier numéro libre de l'équipe (0 à 99, dans l'ordre). */
function numeroLibre(u: Univers, equipe: string): string {
  const pris = new Set((u.effectifs[equipe] ?? []).map((j) => u.joueurs[j]?.numero));
  for (let n = 0; n < 100; n++) if (!pris.has(String(n))) return String(n);
  return '';
}

function archiver(ctx: ContexteLigue, etat: EtatSaison): ArchiveSaison {
  const bilans = calculerBilans(ctx.structure, etat.matchs);
  const P = etat.palmares;
  const premier = etat.draft?.recrues?.[0];
  return {
    saison: etat.saison,
    franchise: etat.franchise,
    champion: P?.champion ?? '',
    finaliste: P?.finaliste ?? '',
    palmares: Object.fromEntries(
      (['mvp', 'mvpFinale', 'defenseur', 'rookie', 'sixiemeHomme', 'progression'] as const).filter((k) => P?.[k]).map((k) => [k, P![k]]),
    ),
    bilans: Object.fromEntries(Object.entries(bilans).map(([e, b]) => [e, [b.victoires, b.defaites]])),
    noms: Object.fromEntries(Object.entries(ctx.equipes).map(([e, x]) => [e, x.nom])),
    statistiques: Object.fromEntries(
      Object.entries(etat.statistiques).map(([j, l]) => [
        j,
        [l.equipe, l.matchs, Math.round(l.dixiemes / 600), l.points, l.rebondsOffensifs + l.rebondsDefensifs, l.passes],
      ]),
    ),
    ...(premier ? { premierChoix: { joueur: premier.prospect, equipe: premier.equipe } } : {}),
    retraites: [],
    ...(etat.marche ? { transactions: { echanges: etat.marche.echanges, signatures: etat.marche.signatures } } : {}),
  };
}

/** Probabilité de retraite d'un joueur (âge et note de la saison à venir) ; `nba` : dans un effectif NBA à la fin de la saison. */
export function probabiliteDeRetraite(
  M: NonNullable<ContexteLigue['carriere']>['modele']['retraite'],
  j: JoueurCarriere,
  nba: boolean,
): number {
  if (j.age > M.ageMax) return 1;
  const R = nba ? M.sousContrat : M.sansContrat;
  if (j.age < R.age) return 0;
  return Math.min(1, Math.max(0, R.base + R.parAn * (j.age - R.age) + R.parPoint * Math.max(0, R.seuil - j.note)));
}

/** Ce que prépare l'ouverture de l'intersaison : l'univers de la saison suivante, les contrats échus, le bilan. */
interface Ouverture {
  univers: Univers;
  bilan: BilanIntersaison;
  /** Équipe → joueurs dont le contrat est échu (sortis de l'effectif). */
  echus: Record<string, string[]>;
}

/** L'ouverture de l'intersaison (tout sauf les contrats échus, réglés ensuite par le marché ou par la règle de la tranche 8). */
function ouvrir(ctx: ContexteLigue, etat: EtatSaison): Ouverture {
  const C = ctx.carriere;
  const u0 = ctx.univers;
  if (!C || !u0) throw new Error('Pas de carrière dans cette partie.');
  const base = ctx.base ?? ctx;
  const M = C.modele;
  const S = etat.saison;
  const N = saisonSuivante(S);
  const Sc = saisonCourte(S);
  const Nc = saisonCourte(N);
  const u: Univers = structuredClone(u0);
  if (base.marche) initialiserMarche(base, u, etat.graine);
  u.saison = N;
  const bilan: BilanIntersaison = { progressions: [], retraites: [], prolongations: [], liberes: [], signatures: [], recrues: [] };
  const equipeDe: Record<string, string> = {};
  for (const [e, js] of Object.entries(u.effectifs)) for (const j of js) equipeDe[j] = e;
  const retirer = (j: string) => {
    const e = equipeDe[j];
    if (e) u.effectifs[e] = u.effectifs[e]!.filter((x) => x !== j);
    delete equipeDe[j];
    delete u.horsNba[j];
  };
  const signer = (j: string, e: string, c: ContratJoueur) => {
    retirer(j);
    (u.effectifs[e] ??= []).push(j);
    equipeDe[j] = e;
    u.contrats[j] = c;
    u.joueurs[j]!.numero =
      u.joueurs[j]!.numero && !u.effectifs[e]!.some((x) => x !== j && u.joueurs[x]?.numero === u.joueurs[j]!.numero)
        ? u.joueurs[j]!.numero
        : numeroLibre(u, e);
  };
  const P = ctx.salaires.cba;

  // 1. Progression et vieillissement (tranche 9 : bonus de l'entraîneur du développement de l'équipe).
  for (const id of Object.keys(u.joueurs).sort()) {
    const avant = u.joueurs[id]!;
    const e = equipeDe[id];
    const bonus = base.marche && e ? bonusProgression(base.marche.staff, u.staff?.[e], avant.age) : 0;
    const apres = vieillir(M.progression, avant, etat.graine, N, bonus);
    u.joueurs[id] = apres;
    bilan.progressions.push({ joueur: id, avant: avant.note, apres: apres.note });
  }

  // 2. Retraites.
  const hR = creerHasard(etat.graine, `retraites-${N}`);
  for (const id of Object.keys(u.joueurs).sort()) {
    const j = u.joueurs[id]!;
    const e = equipeDe[id] ?? null;
    if (hR.reel() >= probabiliteDeRetraite(M.retraite, j, !!e)) continue;
    u.retraites[id] = { nom: j.nom, saison: S, age: j.age - 1, noteMax: Math.max(...j.notes.map((n) => n.note)), equipe: e };
    retirer(id);
    delete u.joueurs[id];
    delete u.contrats[id];
    bilan.retraites.push(id);
  }

  // 3. Les joueurs draftés arrivent ; les autres prospects de la classe passent hors NBA, en développement.
  const draft = etat.draft;
  const recrues = draft?.recrues ?? [];
  const draftes = new Set(recrues.map((r) => r.prospect));
  for (const p of draft?.classe ?? []) {
    u.joueurs[p.id] = joueurDuProspect(p, N);
    if (!draftes.has(p.id)) u.horsNba[p.id] = 'developpement';
  }

  // 4. Ancienneté et horloge de Bird : une saison de plus pour chaque joueur sous contrat NBA avec son équipe.
  const ordre = draft?.choix
    ? [...new Set(draft.choix.filter((c) => c.tour === 1).map((c) => c.original))]
    : Object.keys(u.effectifs).sort();
  for (const e of Object.keys(u.effectifs)) if (!ordre.includes(e)) ordre.push(e);
  for (const js of Object.values(u.effectifs))
    for (const j of js) {
      const c = u.contrats[j];
      if (!c) continue;
      if (c.anciennete !== null) c.anciennete = (c.anciennete ?? 0) + 1;
      if (base.marche) c.saisonsAvecEquipe = Math.min(3, (c.saisonsAvecEquipe ?? 0) + 1);
      delete c.signeLe;
    }
  // Contrats échus (standard sans salaire pour la saison à venir, two-way, non relevés) : sortis de l'effectif.
  const actif = (j: string) => u.contrats[j]?.salaires.some((s) => s.saison === Nc) ?? false;
  const echus: Record<string, string[]> = {};
  for (const e of ordre)
    for (const j of [...(u.effectifs[e] ?? [])]) {
      const c = u.contrats[j];
      if (c?.type === 'standard' && actif(j)) continue;
      (echus[e] ??= []).push(j);
      u.effectifs[e] = u.effectifs[e]!.filter((x) => x !== j);
      delete equipeDe[j];
    }
  // Choix de premier tour : échelle des rookies (deux saisons garanties, deux options d'équipe).
  const a = Number(N.slice(0, 4));
  for (const r of recrues.filter((x) => x.salaires)) {
    signer(r.prospect, r.equipe, {
      type: 'standard',
      salaires: r.salaires!.map((montant, i) => ({
        saison: saisonCourte(`${a + i}-${a + i + 1}`),
        montant,
        ...(i >= 2 ? { option: 'equipe' as const } : {}),
      })),
      garanti: r.salaires!.slice(0, 2).reduce((s, x) => s + x, 0),
      anciennete: 0,
      draft: { annee: draft!.annee, tour: 1, rang: r.rang },
      saisonsAvecEquipe: 0,
    });
    bilan.recrues.push(r.prospect);
  }
  // Choix de second tour : two-way s'il reste une place, sinon hors NBA (en développement).
  for (const r of recrues.filter((x) => !x.salaires)) {
    const tw = (u.effectifs[r.equipe] ?? []).filter((j) => u.contrats[j]?.type === 'two-way').length;
    if (tw < P.contratsTwoWayMax) {
      signer(r.prospect, r.equipe, {
        type: 'two-way',
        salaires: [],
        garanti: null,
        anciennete: 0,
        draft: { annee: draft!.annee, tour: 2, rang: r.rang },
        saisonsAvecEquipe: 0,
      });
      bilan.recrues.push(r.prospect);
      bilan.signatures.push({ joueur: r.prospect, equipe: r.equipe, type: 'two-way' });
    }
  }
  // 5. Hors NBA : au-delà d'un âge, un joueur en développement devient libre.
  for (const j of Object.keys(u.horsNba))
    if (u.horsNba[j] === 'developpement' && u.joueurs[j]!.age > M.effectifs.ageFinDeveloppement) u.horsNba[j] = 'libre';

  // 6. Loterie, choix transmis, recrues, points de la saison passée, taxes, plafond de la saison à venir.
  if (draft?.choix) {
    for (const c of draft.choix.filter((x) => x.tour === 1)) (u.historiqueLoterie[c.original] ??= []).push(c.rang);
    if (u.choixTransmis)
      u.choixTransmis[String(draft.annee)] = draft.choix.map((c) => ({ tour: c.tour, original: c.original, detenteur: c.detenteur }));
    if (u.choix) delete u.choix[String(draft.annee)];
  }
  u.recrues = recrues.map((r) => r.prospect);
  u.pointsParMatchPrecedents = Object.fromEntries(
    Object.entries(etat.statistiques)
      .filter(([, l]) => l.matchs > 0)
      .map(([j, l]) => [j, l.points / l.matchs]),
  );
  const payeurs = Object.keys(ctx.equipes).filter(
    (e) =>
      situationEquipe(
        ctx.salaires,
        e,
        ctx.equipes[e]!.joueurs.map((j) => j.id),
      ).taxe > 0,
  );
  u.taxesPayees[S] = payeurs;
  const saisons = Object.keys(u.taxesPayees).sort().slice(-4);
  for (const e of Object.keys(u.effectifs)) {
    const fois = saisons.filter((s) => u.taxesPayees[s]!.includes(e)).length;
    u.equipes[e] = { massePubliee: 0, taxePubliee: 0, recidiviste: fois >= 3, plafondStrict: null, autresCharges: 0 };
  }
  if (u.plafonds) {
    const actuel = u.plafonds[Sc] ?? { plafondSalarial: base.salaires.cba.plafondSalarial, seuilTaxe: base.salaires.cba.seuilTaxe };
    u.plafonds[Nc] = plafondSuivant(base.salaires.cba, actuel, Nc, etat.graine);
  }
  u.exceptionsUtilisees = {};
  u.journal = [];

  // 7. Changement de franchise (rare).
  const d = demenager(C, u, etat.franchise, etat.graine, N, ctx.structure);
  if (d) bilan.demenagement = d;
  return { univers: u, bilan, echus };
}

/** Tranche 8 (sans données du marché) : prolongations automatiques, effectifs complétés au minimum, surnuméraires coupés. */
function completerSansMarche(ctx: ContexteLigue, o: Ouverture, ordre: string[]): void {
  const { univers: u, bilan, echus } = o;
  const M = ctx.carriere!.modele;
  const P = ctx.salaires.cba;
  const N = u.saison;
  const Nc = saisonCourte(N);
  const a = Number(N.slice(0, 4));
  const standard = (e: string) => (u.effectifs[e] ?? []).filter((j) => u.contrats[j]?.type === 'standard').length;
  const twoWay = (e: string) => (u.effectifs[e] ?? []).filter((j) => u.contrats[j]?.type === 'two-way').length;
  const anciennete = (j: string) => u.contrats[j]?.anciennete ?? 0;
  const signer = (j: string, e: string, c: ContratJoueur) => {
    for (const [x, js] of Object.entries(u.effectifs)) u.effectifs[x] = js.filter((y) => y !== j);
    delete u.horsNba[j];
    (u.effectifs[e] ??= []).push(j);
    u.contrats[j] = c;
    u.joueurs[j]!.numero =
      u.joueurs[j]!.numero && !u.effectifs[e]!.some((x) => x !== j && u.joueurs[x]?.numero === u.joueurs[j]!.numero)
        ? u.joueurs[j]!.numero
        : numeroLibre(u, e);
  };
  for (const e of ordre) {
    const liste = (echus[e] ?? []).filter((j) => u.joueurs[j]).sort((x, y) => u.joueurs[y]!.note - u.joueurs[x]!.note || (x < y ? -1 : 1));
    for (const j of liste) {
      const c = u.contrats[j];
      const age = u.joueurs[j]!.age;
      const estTwoWay = c?.type === 'two-way';
      const place = estTwoWay
        ? twoWay(e) < P.contratsTwoWayMax && age <= M.effectifs.ageMaxTwoWay
        : standard(e) < M.effectifs.standardVises;
      if (!place || age > M.effectifs.ageMaxProlongation || u.joueurs[j]!.note < M.effectifs.noteMinProlongation) {
        u.horsNba[j] = 'libre';
        delete u.contrats[j];
        bilan.liberes.push(j);
        continue;
      }
      const montant = Math.max(c?.salaires.at(-1)?.montant ?? 0, salaireMinimum(P, anciennete(j)));
      const duree = M.effectifs.dureeProlongation;
      signer(j, e, {
        type: estTwoWay ? 'two-way' : 'standard',
        salaires: estTwoWay ? [] : Array.from({ length: duree }, (_, i) => ({ saison: saisonCourte(`${a + i}-${a + i + 1}`), montant })),
        garanti: estTwoWay ? null : montant * duree,
        anciennete: c?.anciennete ?? 0,
        draft: c?.draft ?? null,
        note: 'Prolongation automatique (règle provisoire de la tranche 8).',
      });
      bilan.prolongations.push(j);
    }
  }
  const libres = () =>
    Object.keys(u.horsNba)
      .filter((j) => u.joueurs[j])
      .sort((x, y) => u.joueurs[y]!.note - u.joueurs[x]!.note || (x < y ? -1 : 1));
  for (const e of ordre)
    while (standard(e) < M.effectifs.standardVises) {
      const j = libres()[0];
      if (!j) break;
      const montant = salaireMinimum(P, anciennete(j));
      signer(j, e, {
        type: 'standard',
        salaires: [{ saison: Nc, montant }],
        garanti: montant,
        anciennete: anciennete(j),
        draft: null,
        note: 'Signature au minimum (règle provisoire de la tranche 8).',
      });
      bilan.signatures.push({ joueur: j, equipe: e, type: 'standard' });
    }
  for (const e of ordre)
    while (twoWay(e) < P.contratsTwoWayMax) {
      const j = libres().find((x) => u.joueurs[x]!.age <= M.effectifs.ageMaxTwoWay);
      if (!j) break;
      signer(j, e, { type: 'two-way', salaires: [], garanti: null, anciennete: anciennete(j), draft: null });
      bilan.signatures.push({ joueur: j, equipe: e, type: 'two-way' });
    }
  for (const e of ordre)
    while (standard(e) > P.contratsStandardMax) {
      const j = (u.effectifs[e] ?? [])
        .filter((x) => u.contrats[x]?.type === 'standard' && !u.recrues.includes(x))
        .sort((x, y) => u.joueurs[x]!.note - u.joueurs[y]!.note || (x < y ? -1 : 1))[0];
      if (!j) break;
      u.equipes[e]!.autresCharges += u.contrats[j]!.salaires.find((x) => x.saison === Nc)?.montant ?? 0;
      u.effectifs[e] = u.effectifs[e]!.filter((x) => x !== j);
      u.horsNba[j] = 'libre';
      delete u.contrats[j];
      bilan.liberes.push(j);
    }
  for (const j of Object.keys(u.horsNba)) delete u.contrats[j];
}

/**
 * Tranche 9 : ouvre l'intersaison. Rend l'état de la saison suivante en phase « intersaison », free agency ouverte
 * (journée 0 : décisions du GM). Sans données du marché, la règle de la tranche 8 complète les effectifs et la saison
 * commence directement.
 */
export function ouvrirIntersaison(base: ContexteLigue, etat: EtatSaison): EtatSaison {
  if (!intersaisonPossible(etat)) throw new Error('La saison n’est pas terminée (Draft comprise).');
  const ctx = contexteDeLaSaison(base, etat);
  const archive = archiver(ctx, etat);
  const o = ouvrir(ctx, etat);
  archive.retraites = o.bilan.retraites;
  if (o.bilan.demenagement) archive.demenagement = o.bilan.demenagement;
  const ordre = Object.keys(o.univers.effectifs).sort();
  if (!base.marche) completerSansMarche(ctx, o, ordre);
  const choix = { franchise: etat.franchise, compositionManuelle: etat.compositionManuelle, delegations: etat.delegations };
  const ctxN = contexteDeLUnivers(base, o.univers, choix);
  const graine = graineDeLaSaison(etat.graine, o.univers.saison);
  const suivant = nouvelleSaison(ctxN, graine, etat.franchise);
  suivant.univers = o.univers;
  suivant.archives = [...(etat.archives ?? []), archive];
  if (etat.delegations) suivant.delegations = { ...etat.delegations };
  if (etat.compositionManuelle)
    suivant.compositionManuelle = etat.compositionManuelle.filter((j) => o.univers.effectifs[etat.franchise]?.includes(j));
  suivant.bureau = (etat.bureau ?? []).filter((m) => m.statut === 'ouvert' && m.action?.type !== 'echange').slice(-20);
  publierIntersaison(base, ctx, suivant, o.bilan);
  if (base.marche) {
    suivant.phase = 'intersaison';
    suivant.marche = { echanges: 0, signatures: 0, refus: {}, propositions: 0 };
    suivant.delegations ??= { ...DELEGATIONS_PAR_DEFAUT };
    suivant.intersaison = ouvrirAgentsLibres(ctxN, suivant, o.echus);
    prolongerAvantMarche(ctxN, suivant);
  }
  return suivant;
}

/** La décision du GM du joueur sur un alignement : celle qu'il a donnée dans son bureau (sinon, son staff décide). */
function deciderParLeBureau(etat: EtatSaison): (equipe: string, o: Offre) => boolean | undefined {
  return (equipe, o) => {
    if (equipe !== etat.franchise) return undefined;
    const m = etat.bureau?.find((x) => x.action?.type === 'alignement' && x.action.joueur === o.joueur && x.statut !== 'expire');
    if (!m || m.statut === 'ouvert') return undefined;
    return m.statut === 'accepte';
  };
}

/** Prévient le GM du joueur des feuilles d'offre sur ses agents libres restreints (droit de s'aligner). */
function prevenirDesFeuilles(base: ContexteLigue, etat: EtatSaison): void {
  const I = etat.intersaison!;
  const u = etat.univers!;
  for (const f of I.feuilles) {
    const a = I.agents[f.offre.joueur];
    if (a?.ancienne !== etat.franchise || etat.bureau?.some((m) => m.action?.type === 'alignement' && m.action.joueur === f.offre.joueur))
      continue;
    ecrireAuBureau(etat, {
      date: etat.date,
      genre: 'alignement',
      titre: `${u.joueurs[f.offre.joueur]!.nom} signe une feuille d'offre`,
      texte: `${nomDeFranchise(base, u, f.offre.equipe)} lui offre ${f.offre.duree} saison(s) à ${(f.offre.salaire / 1e6).toFixed(2)} M$ la première. Vous pouvez vous aligner (droits ${a.droits}) jusqu'à la fin de la journée suivante.`,
      action: { type: 'alignement', joueur: f.offre.joueur, offre: f.offre },
      statut: 'ouvert',
    });
  }
}

/** Une journée de free agency (et les échanges de l'IA du jour). Rend un nouvel état. */
export function jouerJourneeIntersaison(base: ContexteLigue, etatInitial: EtatSaison): EtatSaison {
  if (etatInitial.phase !== 'intersaison' || !etatInitial.intersaison) throw new Error('Pas d’intersaison en cours.');
  const etat = structuredClone(etatInitial);
  const ctx = contexteDeLaSaison(base, etat);
  jouerJourneeAgentsLibres(ctx, etat, deciderParLeBureau(etat));
  echangesDeLIntersaison(contexteDeLaSaison(base, etat), etat, etat.intersaison!.journee);
  prevenirDesFeuilles(base, etat);
  if (etat.intersaison!.journee >= etat.intersaison!.journees) return terminerIntersaison(base, etat);
  return etat;
}

/** Fin de l'intersaison : journées restantes au pilote automatique, camp, puis saison régulière. Rend un nouvel état. */
export function terminerIntersaison(base: ContexteLigue, etatInitial: EtatSaison): EtatSaison {
  if (etatInitial.phase !== 'intersaison') throw new Error('Pas d’intersaison en cours.');
  const etat = structuredClone(etatInitial);
  const I = etat.intersaison;
  if (I && !I.terminee) {
    while (I.journee < I.journees) {
      jouerJourneeAgentsLibres(contexteDeLaSaison(base, etat), etat, deciderParLeBureau(etat));
      echangesDeLIntersaison(contexteDeLaSaison(base, etat), etat, I.journee);
    }
    terminerAgentsLibres(contexteDeLaSaison(base, etat), etat, deciderParLeBureau(etat));
    if (!I.terminee) camp(contexteDeLaSaison(base, etat), etat);
  }
  for (const m of etat.bureau ?? []) if (m.statut === 'ouvert' && m.action?.type === 'alignement') m.statut = 'expire';
  etat.phase = 'reguliere';
  const u = etat.univers!;
  if (etat.compositionManuelle) {
    const effectif = u.effectifs[etat.franchise] ?? [];
    etat.compositionManuelle = [
      ...etat.compositionManuelle.filter((j) => effectif.includes(j)),
      ...effectif.filter((j) => !etat.compositionManuelle!.includes(j)),
    ];
  }
  const nom = (j: string) => u.joueurs[j]?.nom ?? j;
  const siennes = (I?.signatures ?? []).filter((s) => s.equipe === etat.franchise);
  const grosses = [...(I?.signatures ?? [])].sort((a, b) => b.salaire - a.salaire).slice(0, 5);
  const publier = (a: Omit<Actualite, 'id' | 'date' | 'genre'>) =>
    etat.actualites.push({ id: etat.actualites.length + 1, date: etat.date, genre: 'marche', ...a });
  if (grosses.length)
    publier({
      importance: 2,
      equipes: [...new Set(grosses.map((s) => s.equipe))],
      titre: 'Free agency : les plus gros contrats',
      texte:
        grosses
          .map(
            (s) =>
              `${nom(s.joueur)} (${nomDeFranchise(base, u, s.equipe)}, ${s.duree} an${s.duree > 1 ? 's' : ''}, ${(s.salaire / 1e6).toFixed(1)} M$)`,
          )
          .join(' ; ') + '.',
    });
  if (siennes.length)
    publier({
      importance: 2,
      equipes: [etat.franchise],
      titre: `${nomDeFranchise(base, u, etat.franchise)} : vos signatures`,
      texte:
        siennes.map((s) => `${nom(s.joueur)} (${s.duree} an${s.duree > 1 ? 's' : ''}, ${(s.salaire / 1e6).toFixed(1)} M$)`).join(' ; ') +
        '.',
    });
  return etat;
}

/**
 * L'intersaison complète au pilote automatique (outils, tests ; réponse 45) : le staff décide aussi pour la franchise
 * du joueur. Rend l'état de la saison suivante, prête à jouer.
 */
export function passerALaSaisonSuivante(base: ContexteLigue, etat: EtatSaison): EtatSaison {
  const ouverte = ouvrirIntersaison(base, {
    ...etat,
    delegations: { ...(etat.delegations ?? DELEGATIONS_PAR_DEFAUT), ...DELEGATIONS_STAFF },
  });
  const fin = ouverte.phase === 'intersaison' ? terminerIntersaison(base, ouverte) : ouverte;
  fin.delegations = etat.delegations ? { ...etat.delegations } : fin.delegations;
  if (!etat.delegations) delete fin.delegations;
  return fin;
}

/** Le passage d'un univers à la saison suivante, au pilote automatique (outil de stabilité). */
export function universSuivant(ctx: ContexteLigue, etat: EtatSaison): { univers: Univers; bilan: BilanIntersaison } {
  const suivant = passerALaSaisonSuivante(ctx.base ?? ctx, { ...etat, univers: etat.univers ?? ctx.univers });
  const signatures = (suivant.univers!.journal ?? [])
    .filter((t) => t.genre === 'signature')
    .map((t) => ({ joueur: t.joueurs[0]!, equipe: t.equipes[0]!, type: 'standard' as const }));
  return {
    univers: suivant.univers!,
    bilan: {
      progressions: [],
      retraites: suivant.archives?.at(-1)?.retraites ?? [],
      prolongations: [],
      liberes: [],
      signatures,
      recrues: suivant.univers!.recrues,
    },
  };
}

function publierIntersaison(base: ContexteLigue, ctxAvant: ContexteLigue, etat: EtatSaison, b: BilanIntersaison): void {
  const u = etat.univers!;
  const date = etat.date;
  const publier = (a: Omit<Actualite, 'id' | 'date' | 'genre'>) =>
    etat.actualites.push({ id: etat.actualites.length + 1, date, genre: 'intersaison', ...a });
  const nomJ = (id: string) => u.joueurs[id]?.nom ?? u.retraites[id]?.nom ?? id;
  const nomE = (id: string) => nomDeFranchise(base, u, id);
  if (b.demenagement) {
    const d = b.demenagement;
    publier({
      importance: 3,
      equipes: [d.franchise],
      titre: `Les ${d.de} deviennent les ${d.vers}`,
      texte: `La franchise ${d.de} déménage et devient ${d.vers}. Elle garde son histoire, son palmarès et ses records.`,
    });
  }
  const retraites = b.retraites.map((id) => u.retraites[id]!).filter((r) => r.equipe);
  const notables = [...retraites].sort((x, y) => y.noteMax - x.noteMax).slice(0, 5);
  if (notables.length)
    publier({
      importance: 2,
      equipes: [...new Set(notables.map((r) => r.equipe!))],
      titre: `${b.retraites.length} joueurs prennent leur retraite`,
      texte: `Parmi eux : ${notables.map((r) => `${r.nom} (${r.age} ans, ${ctxAvant.equipes[r.equipe!]?.nom ?? r.equipe})`).join(', ')}.`,
    });
  const siens = (u.effectifs[etat.franchise] ?? []).filter((j) => u.joueurs[j]!.notes.length >= 2);
  const evol = siens
    .map((j) => {
      const n = u.joueurs[j]!.notes;
      return { j, d: n.at(-1)!.note - n.at(-2)!.note };
    })
    .sort((x, y) => y.d - x.d);
  if (evol.length)
    publier({
      importance: 2,
      equipes: [etat.franchise],
      titre: `${nomE(etat.franchise)} : les progrès de l’été`,
      texte: `En hausse : ${
        evol
          .filter((x) => x.d > 0)
          .slice(0, 3)
          .map((x) => `${nomJ(x.j)} (+${x.d})`)
          .join(', ') || 'personne'
      }. En baisse : ${
        evol
          .filter((x) => x.d < 0)
          .slice(-3)
          .reverse()
          .map((x) => `${nomJ(x.j)} (${x.d})`)
          .join(', ') || 'personne'
      }.`,
    });
  const mouvements = [
    ...b.prolongations.filter((j) => u.effectifs[etat.franchise]?.includes(j)).map((j) => `${nomJ(j)} prolongé`),
    ...b.signatures
      .filter((s) => s.equipe === etat.franchise)
      .map((s) => `${nomJ(s.joueur)} signé (${s.type === 'two-way' ? 'two-way' : 'minimum'})`),
  ];
  if (mouvements.length)
    publier({
      importance: 1,
      equipes: [etat.franchise],
      titre: `${nomE(etat.franchise)} : effectif ${etat.saison}`,
      texte: `${mouvements.join(', ')}.`,
    });
}
