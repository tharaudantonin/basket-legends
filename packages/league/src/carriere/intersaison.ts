// Tranche 8 : l'intersaison, entre la fin d'une saison (Draft comprise) et le début de la suivante.
//
// Dans l'ordre : archive de la saison ; arrivée des joueurs draftés (et des prospects non draftés, hors NBA) ;
// progression et vieillissement de tous les joueurs ; retraites ; contrats échus ; effectifs complétés ; changement
// éventuel de franchise ; nouvelle saison (calendrier, classe de Draft). Tout est déterministe (graine de la saison).
//
// Règle provisoire jusqu'à la free agency et à l'IA de GM (tranche 9) : une équipe prolonge d'une saison, au même
// salaire, ses joueurs dont le contrat est échu tant qu'elle a de la place (les meilleurs d'abord), puis complète son
// effectif au salaire minimum avec les meilleurs joueurs libres. Les options (joueur, équipe) sont toutes exercées.
import { creerHasard } from '@basket-legends/engine';
import { salaireMinimum, saisonCourte, situationEquipe, type ContratJoueur } from '../cba';
import { calculerBilans } from '../classement';
import { nouvelleSaison } from '../saison';
import type { Actualite, ContexteLigue, EtatSaison } from '../types';
import type { Prospect } from '../draft/types';
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

/**
 * Le passage d'un univers à la saison suivante, sans le calendrier ni les actualités : utilisable seul (outil de
 * stabilité sur 20 saisons). `etat` : la saison terminée (Draft faite) ; `ctx` : son contexte.
 */
export function universSuivant(ctx: ContexteLigue, etat: EtatSaison): { univers: Univers; bilan: BilanIntersaison } {
  const C = ctx.carriere;
  const u0 = ctx.univers;
  if (!C || !u0) throw new Error('Pas de carrière dans cette partie.');
  const M = C.modele;
  const S = etat.saison;
  const N = saisonSuivante(S);
  const Nc = saisonCourte(N);
  const P = ctx.salaires.cba;
  const u: Univers = structuredClone(u0);
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

  // 1. Progression et vieillissement des joueurs déjà dans l'univers.
  for (const id of Object.keys(u.joueurs).sort()) {
    const avant = u.joueurs[id]!;
    const apres = vieillir(M.progression, avant, etat.graine, N);
    u.joueurs[id] = apres;
    bilan.progressions.push({ joueur: id, avant: avant.note, apres: apres.note });
  }

  // 2. Retraites.
  const hR = creerHasard(etat.graine, `retraites-${N}`);
  for (const id of Object.keys(u.joueurs).sort()) {
    const j = u.joueurs[id]!;
    const e = equipeDe[id] ?? null;
    // Joueur NBA (dans un effectif à la fin de la saison) ou hors NBA.
    if (hR.reel() >= probabiliteDeRetraite(M.retraite, j, !!e)) continue;
    u.retraites[id] = {
      nom: j.nom,
      saison: S,
      age: j.age - 1,
      noteMax: Math.max(...j.notes.map((n) => n.note)),
      equipe: e,
    };
    retirer(id);
    delete u.joueurs[id];
    delete u.contrats[id];
    bilan.retraites.push(id);
  }

  // 3. Les joueurs draftés arrivent (âge de la saison à venir, sans progression cette année) ; les autres prospects
  // de la classe passent hors NBA, en développement.
  const draft = etat.draft;
  const recrues = draft?.recrues ?? [];
  const draftes = new Set(recrues.map((r) => r.prospect));
  for (const p of draft?.classe ?? []) {
    u.joueurs[p.id] = joueurDuProspect(p, N);
    if (!draftes.has(p.id)) u.horsNba[p.id] = 'developpement';
  }

  // 4. Contrats échus et effectifs. Les équipes passent dans l'ordre de la Draft (pire bilan d'abord).
  const ordre = draft?.choix
    ? [...new Set(draft.choix.filter((c) => c.tour === 1).map((c) => c.original))]
    : Object.keys(u.effectifs).sort();
  for (const e of Object.keys(u.effectifs)) if (!ordre.includes(e)) ordre.push(e);
  const actif = (j: string) => u.contrats[j]?.salaires.some((s) => s.saison === Nc) ?? false;
  const standard = (e: string) => (u.effectifs[e] ?? []).filter((j) => u.contrats[j]?.type === 'standard').length;
  const twoWay = (e: string) => (u.effectifs[e] ?? []).filter((j) => u.contrats[j]?.type === 'two-way').length;
  const anciennete = (j: string) => u.contrats[j]?.anciennete ?? 0;
  // Ancienneté : une saison de plus pour chaque joueur sous contrat NBA.
  for (const js of Object.values(u.effectifs))
    for (const j of js) if (u.contrats[j]?.anciennete !== null && u.contrats[j]) u.contrats[j]!.anciennete = anciennete(j) + 1;

  // 4a. Contrats échus (standard sans salaire pour la saison à venir, two-way et non relevés) : sortis de l'effectif,
  // gardés à part pour la prolongation.
  const echus: Record<string, string[]> = {};
  for (const e of ordre) {
    for (const j of [...(u.effectifs[e] ?? [])]) {
      const c = u.contrats[j];
      if (c?.type === 'standard' && actif(j)) continue;
      (echus[e] ??= []).push(j);
      u.effectifs[e] = u.effectifs[e]!.filter((x) => x !== j);
      delete equipeDe[j];
    }
  }
  // 4b. Choix de premier tour : contrat de l'échelle des rookies (deux saisons garanties, deux options d'équipe).
  for (const r of recrues.filter((x) => x.salaires)) {
    const a = Number(N.slice(0, 4));
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
    });
    bilan.recrues.push(r.prospect);
  }
  // 4c. Prolongations : les meilleurs joueurs échus d'abord, tant qu'il reste de la place ; un two-way reste two-way.
  for (const e of ordre) {
    const liste = (echus[e] ?? []).filter((j) => u.joueurs[j]).sort((a, b) => u.joueurs[b]!.note - u.joueurs[a]!.note || (a < b ? -1 : 1));
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
      const dernier = c?.salaires.at(-1)?.montant ?? 0;
      const montant = Math.max(dernier, salaireMinimum(P, anciennete(j)));
      const duree = M.effectifs.dureeProlongation;
      const a = Number(N.slice(0, 4));
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
  // 4d. Choix de second tour : two-way s'il reste une place, sinon hors NBA (en développement).
  for (const r of recrues.filter((x) => !x.salaires)) {
    if (twoWay(r.equipe) < P.contratsTwoWayMax) {
      signer(r.prospect, r.equipe, {
        type: 'two-way',
        salaires: [],
        garanti: null,
        anciennete: 0,
        draft: { annee: draft!.annee, tour: 2, rang: r.rang },
      });
      bilan.recrues.push(r.prospect);
      bilan.signatures.push({ joueur: r.prospect, equipe: r.equipe, type: 'two-way' });
    }
  }
  // 4e. Effectifs complétés avec les meilleurs joueurs hors NBA : contrats standard d'une saison au minimum, puis two-way
  // pour les jeunes.
  const libres = () =>
    Object.keys(u.horsNba)
      .filter((j) => u.joueurs[j])
      .sort((a, b) => u.joueurs[b]!.note - u.joueurs[a]!.note || (a < b ? -1 : 1));
  const a = Number(N.slice(0, 4));
  for (const e of ordre) {
    while (standard(e) < M.effectifs.standardVises) {
      const j = libres()[0];
      if (!j) break;
      const montant = salaireMinimum(P, anciennete(j));
      signer(j, e, {
        type: 'standard',
        salaires: [{ saison: saisonCourte(`${a}-${a + 1}`), montant }],
        garanti: montant,
        anciennete: anciennete(j),
        draft: null,
        note: 'Signature au minimum (règle provisoire de la tranche 8).',
      });
      bilan.signatures.push({ joueur: j, equipe: e, type: 'standard' });
    }
  }
  for (const e of ordre) {
    while (twoWay(e) < P.contratsTwoWayMax) {
      const j = libres().find((x) => u.joueurs[x]!.age <= M.effectifs.ageMaxTwoWay);
      if (!j) break;
      signer(j, e, { type: 'two-way', salaires: [], garanti: null, anciennete: anciennete(j), draft: null });
      bilan.signatures.push({ joueur: j, equipe: e, type: 'two-way' });
    }
  }
  // 4f. Au-delà du maximum de contrats standard (contrats garantis + choix de premier tour) : l'équipe coupe le moins
  // bon ; son salaire de la saison reste à sa charge (argent mort).
  const argentMort: Record<string, number> = {};
  for (const e of ordre) {
    while (standard(e) > P.contratsStandardMax) {
      const j = (u.effectifs[e] ?? [])
        .filter((x) => u.contrats[x]?.type === 'standard' && !draftes.has(x))
        .sort((x, y) => u.joueurs[x]!.note - u.joueurs[y]!.note || (x < y ? -1 : 1))[0];
      if (!j) break;
      argentMort[e] = (argentMort[e] ?? 0) + (u.contrats[j]!.salaires.find((x) => x.saison === Nc)?.montant ?? 0);
      retirer(j);
      u.horsNba[j] = 'libre';
      delete u.contrats[j];
      bilan.liberes.push(j);
    }
  }
  // 5. Hors NBA : au-delà d'un âge, un joueur en développement devient libre.
  for (const j of Object.keys(u.horsNba))
    if (u.horsNba[j] === 'developpement' && u.joueurs[j]!.age > M.effectifs.ageFinDeveloppement) u.horsNba[j] = 'libre';
  // Les joueurs hors NBA n'ont pas de contrat NBA.
  for (const j of Object.keys(u.horsNba)) delete u.contrats[j];

  // 6. Historique de la loterie, recrues, points de la saison passée, taxes.
  if (draft?.choix) {
    for (const c of draft.choix.filter((x) => x.tour === 1)) (u.historiqueLoterie[c.original] ??= []).push(c.rang);
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
    u.equipes[e] = {
      massePubliee: 0,
      taxePubliee: 0,
      recidiviste: fois >= 3,
      plafondStrict: null,
      // L'argent mort relevé au snapshot ne concerne que sa saison ; ensuite, seul celui des joueurs coupés cet été.
      autresCharges: argentMort[e] ?? 0,
    };
  }

  // 7. Changement de franchise (rare).
  const d = demenager(C, u, etat.franchise, etat.graine, N, ctx.structure);
  if (d) bilan.demenagement = d;
  return { univers: u, bilan };
}

/**
 * L'intersaison complète : rend l'état de la saison suivante (univers, archives, calendrier, classe de Draft,
 * actualités de l'intersaison). `base` : le contexte des données de référence.
 */
export function passerALaSaisonSuivante(base: ContexteLigue, etat: EtatSaison): EtatSaison {
  if (!intersaisonPossible(etat)) throw new Error('La saison n’est pas terminée (Draft comprise).');
  const ctx = contexteDeLaSaison(base, etat);
  const archive = archiver(ctx, etat);
  const { univers, bilan } = universSuivant(ctx, etat);
  archive.retraites = bilan.retraites;
  if (bilan.demenagement) archive.demenagement = bilan.demenagement;
  const ctxN = contexteDeLUnivers(base, univers);
  const graine = graineDeLaSaison(etat.graine, univers.saison);
  const suivant = nouvelleSaison(ctxN, graine, etat.franchise);
  suivant.univers = univers;
  suivant.archives = [...(etat.archives ?? []), archive];
  publierIntersaison(base, ctx, suivant, bilan);
  return suivant;
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
