// Tranches 1 à 3 : le match, simulé possession par possession.
//
// Le moteur est une fonction pure : même entrée (graine, équipes, règles, réglages) → même journal d'événements, donc
// même box score. Il ne calcule aucune statistique lui-même : il écrit le journal (types.ts, `Evenement`) et le box score
// en est déduit (boxscore.ts). Les présentations rapide et commentée (tranche 3) et interactive (tranche 5) lisent ce
// même journal.
//
// Une possession : durée tirée (bornée par l'horloge des 24 s et le temps restant), puis perte de balle, faute hors tir
// ou tir. Le tir est pris par un joueur choisi selon son usage, dans une zone selon son profil ; la réussite dépend de
// son adresse face à la défense présente, de sa fraîcheur et du terrain. Faute sur tir → lancers ; échec → contre
// éventuel puis rebond, offensif (horloge à 14 s) ou défensif, ou rebond d'équipe. Fautes d'équipe et pénalité par
// période (règles de la saison). Fatigue : chaque joueur perd de la fraîcheur sur le terrain et en regagne sur le banc
// et pendant les temps-morts ; le staff remplace à ballon mort.
//
// Tranche 3 : temps-morts (obligatoires, après une série adverse, avant la dernière action), fins de période (horloge
// des tirs éteinte, dernier tir gardé, tir pressé au buzzer) et fins de match tactiques (fautes volontaires, gestion du
// chronomètre par l'équipe qui mène, jeu rapide de celle qui est menée). La position de chaque tir est tirée d'un
// générateur à part : elle décrit le tir sans changer le cours du match.
//
// Tranche 5 : plans de jeu (rythme, défense individuelle ou de zone, part du tir à trois points, délégation des
// changements et des temps-morts au staff), qualité du tir selon le défenseur direct, et mode interactif. Le coach
// décide aux arrêts de jeu (avant le match, en début de période, à chaque ballon mort avant une possession) ; ses
// décisions sont une entrée du moteur (`EntreeMatch.decisions`) : rejouer la même graine avec les mêmes décisions
// redonne le même match, et le journal avant un arrêt ne dépend pas des décisions prises à cet arrêt ou après.
// Simplifications notées dans docs/SIMULATION_MATCH.md : pas de faute offensive, de violation ni de faute technique.
import { creerHasard, type Hasard } from '../hasard';
import { construireBoxScore } from './boxscore';
import { empreinteBoxScore } from './empreinte';
import type {
  ArretDeJeu,
  Camp,
  DecisionMatch,
  EntreeMatch,
  EquipeDuMatch,
  Evenement,
  JoueurDuMatch,
  OptionsSimulation,
  PlanDeJeu,
  PositionTir,
  ReglagesMatch,
  ReglesMatch,
  ResultatMatch,
  TypeTir,
} from './types';
import { DEFENSES, GESTIONS, PLAN_PAR_DEFAUT, RYTHMES, TYPES_TIR, VOLUMES_TROIS } from './types';

interface EtatJoueur {
  j: JoueurDuMatch;
  energie: number;
  fautes: number;
  exclu: boolean;
  blesse: boolean;
  /** Temps de jeu total (dixièmes) au moment de son entrée sur le terrain. */
  entree: number;
  /** Sur le terrain : tenu à jour par `synchroniser` (lire seulement après l'avoir appelé). */
  terrain: boolean;
}

interface EtatEquipe {
  equipe: EquipeDuMatch;
  joueurs: Map<string, EtatJoueur>;
  surTerrain: string[];
  /** Les joueurs que le staff fait tourner (les `profondeur` premiers), puis les autres en dernier recours. */
  rotation: string[];
  fautesPeriode: number;
  fautesFinDePeriode: number;
  // Temps-morts (Rule No. 5, Section VI).
  tempsMortsMatch: number;
  tempsMortsQuatrieme: number;
  tempsMortsFinDeMatch: number;
  tempsMortsProlongation: number;
}

const borner = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));
/** La moyenne de f sur la liste ; même ordre d'addition qu'un `reduce` depuis 0, donc le même résultat au bit près. */
function moyenne<T>(xs: readonly T[], f: (x: T) => number): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += f(xs[i]!);
  return s / Math.max(1, xs.length);
}
const autre = (c: Camp): Camp => (c === 0 ? 1 : 0);

/** Tirage gaussien (Box-Muller) à partir du hasard déterministe. */
function gaussien(h: Hasard, moyenneV: number, ecart: number): number {
  const u = 1 - h.reel();
  const v = h.reel();
  return moyenneV + ecart * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** La position d'un tir, selon sa zone (générateur à part : la position ne change pas le cours du match). */
export function tirerPosition(h: Hasard, tir: TypeTir, presse: boolean, R: ReglesMatch, G: ReglagesMatch): PositionTir {
  const arrondi = (distance: number, angle: number): PositionTir => ({
    distance: Math.round(distance * 10) / 10,
    angle: Math.round(angle),
  });
  const cote = h.chance(0.5) ? -1 : 1;
  if (tir === 'cercle') return arrondi(3 * Math.sqrt(h.reel()), (h.reel() * 2 - 1) * 90);
  if (tir === 'miDistance') {
    const T = G.positions.miDistanceParTranche;
    const tranche = h.pondere(
      [
        [3, 10, T.troisDix],
        [10, 16, T.dixSeize],
        [16, R.ligneATroisPointsPieds - 0.5, T.seizeLigne],
      ] as const,
      (x) => x[2],
    );
    return arrondi(tranche[0] + h.reel() * (tranche[1] - tranche[0]), (h.reel() * 2 - 1) * 85);
  }
  if (presse) return arrondi(R.ligneATroisPointsPieds + 1 + h.reel() * 20, (h.reel() * 2 - 1) * 45);
  if (h.chance(G.positions.partTroisDansLesCoins))
    return arrondi(G.positions.distanceTroisDansLesCoinsPieds + h.reel(), cote * (80 + h.reel() * 10));
  return arrondi(R.ligneATroisPointsPieds + Math.min(6, Math.abs(gaussien(h, 0, 1.2))), (h.reel() * 2 - 1) * 70);
}

/** Une valeur de plan admise (les décisions viennent de l'interface ou d'une sauvegarde : elles sont vérifiées). */
function planValide(p: Partial<PlanDeJeu>): boolean {
  const admis: Record<keyof PlanDeJeu, readonly string[]> = {
    rythme: RYTHMES,
    defense: DEFENSES,
    troisPoints: VOLUMES_TROIS,
    remplacements: GESTIONS,
    tempsMorts: GESTIONS,
  };
  return Object.entries(p).every(([cle, v]) => cle in admis && admis[cle as keyof PlanDeJeu].includes(v as string));
}

export function simulerMatch(entree: EntreeMatch, options: OptionsSimulation = {}): ResultatMatch {
  const { regles: R, reglages: G } = entree;
  const h = creerHasard(entree.graine, `match:${entree.domicile.id}:${entree.exterieur.id}`);
  const hPositions = creerHasard(entree.graine, `positions:${entree.domicile.id}:${entree.exterieur.id}`);
  const journal: Evenement[] = [];
  const score: [number, number] = [0, 0];
  let tempsDeJeu = 0; // dixièmes écoulés depuis le début du match
  let periode = 0;
  let restant = 0;
  // Série en cours : le dernier camp qui a marqué et ses points sans réponse.
  let serie: { camp: Camp; points: number } = { camp: 0, points: 0 };
  // Temps-morts de la période (pour les temps-morts obligatoires).
  let tempsMortsPeriode = 0;
  let premierCharge: Camp | null = null;
  let obligatoire1 = false;
  let obligatoire2 = false;
  // Action préparée pendant un temps-mort de fin de match : vaut pour le prochain tir de ce camp.
  let actionPreparee: Camp | null = null;
  // Tranche 5 : plans de jeu, arrêts de jeu et décisions du coach.
  const plans: [PlanDeJeu, PlanDeJeu] = [
    { ...PLAN_PAR_DEFAUT, ...entree.domicile.plan },
    { ...PLAN_PAR_DEFAUT, ...entree.exterieur.plan },
  ];
  const decisionsParArret = new Map<number, { d: DecisionMatch; rang: number }[]>();
  (entree.decisions ?? []).forEach((d, rang) => {
    decisionsParArret.set(d.arret, [...(decisionsParArret.get(d.arret) ?? []), { d, rang }]);
  });
  const rejetees: number[] = [];
  const arrets: ArretDeJeu[] = [];
  let numeroArret = -1;

  const preparer = (equipe: EquipeDuMatch): EtatEquipe => {
    if (equipe.joueurs.length < R.joueursSurLeTerrain) throw new Error(`${equipe.nom} n'a pas assez de joueurs pour jouer.`);
    const joueurs = new Map(
      equipe.joueurs.map((j) => [j.id, { j, energie: 100, fautes: 0, exclu: false, blesse: false, entree: 0, terrain: false }]),
    );
    return {
      equipe,
      joueurs,
      surTerrain: equipe.joueurs.slice(0, R.joueursSurLeTerrain).map((j) => j.id),
      rotation: equipe.joueurs.map((j) => j.id),
      fautesPeriode: 0,
      fautesFinDePeriode: 0,
      tempsMortsMatch: 0,
      tempsMortsQuatrieme: 0,
      tempsMortsFinDeMatch: 0,
      tempsMortsProlongation: 0,
    };
  };
  const equipes: [EtatEquipe, EtatEquipe] = [preparer(entree.domicile), preparer(entree.exterieur)];
  // Tranche 10 : forme de chaque équipe (effet borné du moral du groupe, calculé par la ligue) ; absente, aucun effet.
  const forme: [number, number] = [entree.domicile.forme ?? 0, entree.exterieur.forme ?? 0];
  const titulaires = equipes.map((e) => e.surTerrain.slice()) as [string[], string[]];

  const etat = (c: Camp, id: string): EtatJoueur => equipes[c].joueurs.get(id) as EtatJoueur;
  // Performance (25/11/2026) : les joueurs sur le terrain sont gardés en cache tant que `surTerrain` ne change pas.
  // `surTerrain` n'est jamais modifié en place (chaque changement crée un nouveau tableau) : comparer l'identité suffit.
  // Le tableau rendu est partagé : un appelant qui veut le trier ou le modifier en fait d'abord une copie.
  const cache = equipes.map(() => ({ ids: null as string[] | null, presents: [] as EtatJoueur[] }));
  const tousLesJoueurs = equipes.map((eq) => [...eq.joueurs.values()]) as [EtatJoueur[], EtatJoueur[]];
  const rotationDe = equipes.map((eq, c) => eq.rotation.map((id) => etat(c as Camp, id))) as [EtatJoueur[], EtatJoueur[]];
  const synchroniser = (c: Camp) => {
    const k = cache[c]!;
    const ids = equipes[c].surTerrain;
    if (k.ids !== ids) {
      k.ids = ids;
      k.presents = ids.map((id) => etat(c, id));
      for (const e of tousLesJoueurs[c]) e.terrain = false;
      for (const e of k.presents) e.terrain = true;
    }
    return k;
  };
  const presents = (c: Camp): readonly EtatJoueur[] => synchroniser(c).presents;
  const malus = (e: EtatJoueur): number => G.fatigue.malusParPointPerdu * (100 - e.energie);
  const effectif = (e: EtatJoueur): number => e.j.note - malus(e);
  const ecrire = (ev: Evenement): void => {
    journal.push(ev);
  };
  const repere = () => ({ periode, restant });
  const prolongation = (): boolean => periode > R.periodesReglementaires;
  /** Quatrième quart-temps ou prolongation. */
  const finale = (): boolean => periode >= R.periodesReglementaires;
  /** Les deux dernières minutes d'une fin de match. */
  const deuxDernieresMinutes = (): boolean => finale() && restant <= R.finDePeriodeSecondes * 10;
  const marquer = (c: Camp, points: number): void => {
    score[c] += points;
    if (serie.camp === c) serie.points += points;
    else serie = { camp: c, points };
  };

  // Le temps passe : fraîcheur et chronomètre.
  const recuperer = (c: Camp, minutes: number, parMinute: number, aussiSurLeTerrain: boolean): void => {
    synchroniser(c);
    const gain = parMinute * minutes;
    for (const e of tousLesJoueurs[c]) {
      if (aussiSurLeTerrain || !e.terrain) e.energie = Math.min(100, e.energie + gain);
    }
  };
  const ecouler = (dixiemes: number): void => {
    const d = Math.min(dixiemes, restant);
    restant -= d;
    tempsDeJeu += d;
    const minutes = d / 600;
    for (const c of [0, 1] as const) {
      for (const e of presents(c)) {
        // Tranche 4 : chaque joueur se fatigue selon son endurance.
        const facteur = (1 - G.fatigue.effetEndurance * ((e.j.endurance - 70) / 30)) * G.plans.rythme[plans[c].rythme].fatigue;
        e.energie = Math.max(0, e.energie - G.fatigue.perteParMinute * Math.max(0.2, facteur) * minutes);
        // Blessure en match : il finit l'action, le staff le sort au prochain arrêt de jeu.
        if (!e.blesse && h.chance(G.blessures.probabiliteParMinute * minutes)) {
          e.blesse = true;
          const g = h.pondere(G.blessures.gravites, (x) => x.part);
          ecrire({ type: 'blessure', ...repere(), equipe: c, joueur: e.j.id, matchsAbsent: h.entier(g.matchsMin, g.matchsMax) });
        }
      }
      recuperer(c, minutes, G.fatigue.recuperationParMinute, false);
    }
  };

  // Tirages pondérés de joueurs (départage stable : l'ordre du terrain).
  const choisirParmi = (liste: readonly EtatJoueur[], poids: (e: EtatJoueur) => number): EtatJoueur => h.pondere(liste, poids);

  // --- Remplacements, seulement à ballon mort. ---
  const disponible = (e: EtatJoueur, seuil: number): boolean => !e.exclu && !e.blesse && e.energie >= seuil;
  const remplacer = (c: Camp, sortant: string, entrant: string): void => {
    const eq = equipes[c];
    eq.surTerrain = eq.surTerrain.map((id) => (id === sortant ? entrant : id));
    etat(c, entrant).entree = tempsDeJeu;
    ecrire({ type: 'remplacement', ...repere(), equipe: c, entrant, sortant });
  };
  const meilleurRemplacant = (c: Camp, sortant: EtatJoueur, seuil: number, toutLeBanc: boolean): EtatJoueur | undefined => {
    const eq = equipes[c];
    const n = toutLeBanc ? eq.rotation.length : Math.min(eq.rotation.length, G.rotation.profondeur);
    synchroniser(c);
    const valeur = (e: EtatJoueur) => effectif(e) + (e.j.groupe === sortant.j.groupe ? 10 : 0);
    // Le premier des meilleurs, dans l'ordre de la rotation.
    let meilleur: EtatJoueur | undefined;
    let meilleureValeur = 0;
    for (let i = 0; i < n; i++) {
      const e = rotationDe[c][i]!;
      if (e.terrain || !disponible(e, seuil)) continue;
      const v = valeur(e);
      if (!meilleur || v > meilleureValeur) {
        meilleur = e;
        meilleureValeur = v;
      }
    }
    return meilleur;
  };
  const faireTourner = (c: Camp): void => {
    const eq = equipes[c];
    // 1. Joueurs exclus ou blessés : remplacés par n'importe quel joueur valide (s'il n'y en a plus, il reste, comme le
    //    permet le règlement pour l'exclu).
    for (const e of presents(c).filter((x) => x.exclu || x.blesse)) {
      const r = meilleurRemplacant(c, e, 0, true);
      if (r) remplacer(c, e.j.id, r.j.id);
    }
    // Tranche 5 : quand le coach gère lui-même les changements, le staff ne fait plus que les changements forcés.
    if (plans[c].remplacements === 'coach') return;
    // 2. Joueurs fatigués, les plus fatigués d'abord.
    if (presents(c).some((e) => e.energie < G.fatigue.seuilRemplacement)) {
      for (const e of presents(c)
        .slice()
        .sort((a, b) => a.energie - b.energie)) {
        if (e.energie >= G.fatigue.seuilRemplacement) continue;
        const r = meilleurRemplacant(c, e, G.fatigue.seuilRetour, false);
        if (r) remplacer(c, e.j.id, r.j.id);
      }
    }
    // 3. Retour des meilleurs reposés à la place d'un joueur moins bon du même groupe, après un relais minimal.
    const relais = G.rotation.relaisMinimalSecondes * 10;
    const n = Math.min(eq.rotation.length, G.rotation.profondeur);
    for (let i = 0; i < n; i++) {
      const id = eq.rotation[i]!;
      const r = rotationDe[c][i]!;
      synchroniser(c);
      if (r.terrain || !disponible(r, G.fatigue.seuilRetour)) continue;
      // Le moins bon des joueurs remplaçables (le premier dans l'ordre du terrain en cas d'égalité).
      const valeurR = effectif(r);
      let cible: EtatJoueur | undefined;
      let valeurCible = 0;
      for (const e of presents(c)) {
        if (e.j.groupe !== r.j.groupe || tempsDeJeu - e.entree < relais) continue;
        const v = effectif(e);
        if (!(v + 3 < valeurR)) continue;
        if (!cible || v < valeurCible) {
          cible = e;
          valeurCible = v;
        }
      }
      if (cible) remplacer(c, cible.j.id, id);
    }
  };

  // --- Temps-morts (Rule No. 5, Section VI). ---
  const peutPrendreTempsMort = (c: Camp): boolean => {
    const eq = equipes[c];
    if (prolongation()) return eq.tempsMortsProlongation < R.tempsMortsParProlongation;
    if (eq.tempsMortsMatch >= R.tempsMortsParMatch) return false;
    if (periode === R.periodesReglementaires) {
      if (eq.tempsMortsQuatrieme >= R.tempsMortsMaxQuatriemePeriode) return false;
      if (restant <= R.debutFinDeMatchTempsMortsSecondes * 10 && eq.tempsMortsFinDeMatch >= R.tempsMortsMaxFinDeMatch) return false;
    }
    return true;
  };
  const restantsDe = (c: Camp): number =>
    prolongation() ? R.tempsMortsParProlongation - equipes[c].tempsMortsProlongation : R.tempsMortsParMatch - equipes[c].tempsMortsMatch;
  const prendreTempsMort = (c: Camp | null, motif: 'obligatoire' | 'serie' | 'fin_de_match' | 'demande'): void => {
    if (c !== null) {
      const eq = equipes[c];
      if (prolongation()) eq.tempsMortsProlongation++;
      else eq.tempsMortsMatch++;
      if (periode === R.periodesReglementaires) {
        eq.tempsMortsQuatrieme++;
        if (restant <= R.debutFinDeMatchTempsMortsSecondes * 10) eq.tempsMortsFinDeMatch++;
      }
      if (premierCharge === null) premierCharge = c;
    }
    tempsMortsPeriode++;
    const obligatoire = motif === 'obligatoire';
    ecrire({
      type: 'temps_mort',
      ...repere(),
      equipe: c,
      nature: obligatoire ? 'obligatoire' : 'equipe',
      motif,
      restants: c === null ? 0 : restantsDe(c),
    });
    // Tout le monde souffle pendant le temps-mort ; le staff peut changer qui il veut.
    const minutes = (obligatoire ? R.dureeTempsMortObligatoireSecondes : R.dureeTempsMortSecondes) / 60;
    recuperer(0, minutes, G.tempsMorts.recuperationParMinute, true);
    recuperer(1, minutes, G.tempsMorts.recuperationParMinute, true);
    if (motif === 'serie' && c !== null) serie = { camp: autre(c), points: 0 };
  };
  /** À ballon mort, avant la possession de `attaque` : temps-morts obligatoires, puis ceux que les coachs demandent. */
  const tempsMortsABallonMort = (attaque: Camp): void => {
    if (!prolongation()) {
      if (!obligatoire1 && restant <= R.repereTempsMortObligatoire1Secondes * 10) {
        obligatoire1 = true;
        if (tempsMortsPeriode === 0) prendreTempsMort(peutPrendreTempsMort(0) ? 0 : null, 'obligatoire');
      }
      if (!obligatoire2 && restant <= R.repereTempsMortObligatoire2Secondes * 10) {
        obligatoire2 = true;
        if (tempsMortsPeriode <= 1) {
          const c = autre(premierCharge ?? 0);
          prendreTempsMort(peutPrendreTempsMort(c) ? c : null, 'obligatoire');
        }
      }
    }
    // Série adverse : le coach de l'équipe qui subit arrête le jeu (pas dans les deux dernières minutes, où il les garde).
    const subit = autre(serie.camp);
    if (
      serie.points >= G.tempsMorts.serieAdverseDeclencheur &&
      !deuxDernieresMinutes() &&
      plans[subit].tempsMorts === 'staff' &&
      peutPrendreTempsMort(subit)
    )
      prendreTempsMort(subit, 'serie');
    // Dernière action : l'équipe à égalité ou menée de trois points au plus prépare son tir.
    const ecart = score[attaque] - score[autre(attaque)];
    if (
      finale() &&
      restant <= R.horlogeEteinteSousSecondes * 10 &&
      ecart <= 0 &&
      ecart >= -3 &&
      actionPreparee !== attaque &&
      plans[attaque].tempsMorts === 'staff' &&
      peutPrendreTempsMort(attaque)
    ) {
      prendreTempsMort(attaque, 'fin_de_match');
      actionPreparee = attaque;
    }
    faireTourner(0);
    faireTourner(1);
    arreter(false, attaque);
  };

  // --- Tranche 5 : arrêts de jeu et décisions du coach. ---
  const tempsMortDemande: [boolean, boolean] = [false, false];
  /** Applique une décision ; rend faux si elle est impossible à cet arrêt (elle est alors ignorée). */
  const appliquer = (d: DecisionMatch, debutDePeriode: boolean, possession: Camp | null): boolean => {
    if (d.equipe !== 0 && d.equipe !== 1) return false;
    const c = d.equipe;
    if (d.genre === 'plan') {
      if (!planValide(d.plan)) return false;
      plans[c] = { ...plans[c], ...d.plan };
      ecrire({ type: 'plan', ...repere(), equipe: c, plan: { ...plans[c] } });
      return true;
    }
    if (d.genre === 'temps_mort') {
      if (debutDePeriode || tempsMortDemande[c] || !peutPrendreTempsMort(c)) return false;
      tempsMortDemande[c] = true;
      prendreTempsMort(c, 'demande');
      // Comme le staff : en fin de match, l'équipe qui va attaquer prépare son action.
      if (possession === c && finale() && restant <= R.horlogeEteinteSousSecondes * 10) actionPreparee = c;
      return true;
    }
    if (d.genre === 'remplacement') {
      const eq = equipes[c];
      const entrant = eq.joueurs.get(d.entrant);
      // Le cinq de départ reste celui du staff (décision du 24/11/2026, jusqu'au module de management).
      if (numeroArret === 0 || !entrant || !eq.surTerrain.includes(d.sortant) || eq.surTerrain.includes(d.entrant)) return false;
      if (entrant.exclu || entrant.blesse) return false;
      if (debutDePeriode) {
        // Entre deux périodes, le cinq est simplement annoncé au début de la période (comme pour le staff).
        eq.surTerrain = eq.surTerrain.map((id) => (id === d.sortant ? d.entrant : id));
        entrant.entree = tempsDeJeu;
      } else remplacer(c, d.sortant, d.entrant);
      return true;
    }
    return false;
  };
  const instantane = (indice: number, debutDePeriode: boolean, possession: Camp | null): ArretDeJeu => {
    const peut = (c: Camp) => !debutDePeriode && !tempsMortDemande[c] && peutPrendreTempsMort(c);
    const joueursDe = (c: Camp) =>
      [...equipes[c].joueurs.values()].map((e) => ({
        id: e.j.id,
        fraicheur: Math.round(e.energie),
        fautes: e.fautes,
        exclu: e.exclu,
        blesse: e.blesse,
      }));
    return {
      numero: numeroArret,
      indice,
      periode,
      restant,
      score: [score[0], score[1]],
      debutDePeriode,
      possession,
      plans: [{ ...plans[0] }, { ...plans[1] }],
      surTerrain: [equipes[0].surTerrain.slice(), equipes[1].surTerrain.slice()],
      joueurs: [joueursDe(0), joueursDe(1)],
      tempsMortsRestants: [restantsDe(0), restantsDe(1)],
      peutTempsMort: [peut(0), peut(1)],
      hasard: h.etat(),
    };
  };
  /** Un arrêt de jeu : les décisions du coach prises à cet arrêt s'appliquent, puis l'état est rendu si demandé. */
  function arreter(debutDePeriode: boolean, possession: Camp | null): void {
    numeroArret++;
    tempsMortDemande[0] = false;
    tempsMortDemande[1] = false;
    const indice = journal.length;
    for (const { d, rang } of decisionsParArret.get(numeroArret) ?? []) if (!appliquer(d, debutDePeriode, possession)) rejetees.push(rang);
    if (options.arrets) arrets.push(instantane(indice, debutDePeriode, possession));
  }

  // --- Fautes et lancers francs. ---
  const enPenalite = (fautive: Camp): boolean => {
    const eq = equipes[fautive];
    const rang = prolongation() ? R.rangFauteEquipePenaliteProlongation : R.rangFauteEquipePenalite;
    if (eq.fautesPeriode >= rang) return true;
    return restant <= R.finDePeriodeSecondes * 10 && eq.fautesFinDePeriode >= R.rangFauteEquipeFinDePeriode;
  };
  const commettreFaute = (
    fautive: Camp,
    joueur: EtatJoueur,
    victime: EtatJoueur,
    nature: 'tir' | 'hors_tir',
    volontaire = false,
  ): boolean => {
    const eq = equipes[fautive];
    joueur.fautes += 1;
    eq.fautesPeriode += 1;
    if (restant <= R.finDePeriodeSecondes * 10) eq.fautesFinDePeriode += 1;
    const penalite = enPenalite(fautive);
    ecrire({
      type: 'faute',
      ...repere(),
      equipe: fautive,
      joueur: joueur.j.id,
      victime: victime.j.id,
      nature,
      fautesJoueur: joueur.fautes,
      fautesEquipe: eq.fautesPeriode,
      penalite,
      ...(volontaire ? { volontaire: true as const } : {}),
    });
    if (joueur.fautes >= R.fautesPersonnellesExclusion && !joueur.exclu) {
      joueur.exclu = true;
      ecrire({ type: 'exclusion', ...repere(), equipe: fautive, joueur: joueur.j.id });
      // La faute arrête le jeu : le staff remplace l'exclu tout de suite, avant les éventuels lancers.
      faireTourner(fautive);
    }
    return penalite;
  };
  /** Tire les lancers ; rend vrai si le dernier est réussi. */
  const tirerLancers = (c: Camp, tireur: EtatJoueur, nombre: number): boolean => {
    const L = G.lancersFrancs;
    const p = borner(
      L.reussiteDeBase + L.sensibiliteParPoint * (tireur.j.detail.lancersFrancs - 70 - malus(tireur)),
      L.reussiteMin,
      L.reussiteMax,
    );
    let dernier = false;
    for (let n = 1; n <= nombre; n++) {
      dernier = h.chance(p);
      if (dernier) marquer(c, R.valeurLancerFranc);
      ecrire({
        type: 'lancer_franc',
        ...repere(),
        equipe: c,
        joueur: tireur.j.id,
        reussi: dernier,
        numero: n,
        sur: nombre,
        points: dernier ? R.valeurLancerFranc : 0,
        score: [score[0], score[1]],
      });
    }
    return dernier;
  };

  // --- Rebond : rend le camp qui récupère le ballon. ---
  // Tranche 7 : rebond offensif pour l'attaque, défensif pour la défense (attributs détaillés).
  const forceRebond = (e: EtatJoueur, offensif: boolean): number =>
    G.rebonds.poidsParGroupe[e.j.groupe] *
    ((offensif ? e.j.detail.rebondOffensif : e.j.detail.rebondDefensif) - malus(e) + (e.j.tailleCm - 200) * 0.5);
  const rebond = (attaque: Camp): Camp => {
    const def = autre(attaque);
    const ecart = moyenne(presents(attaque), (e) => forceRebond(e, true)) - moyenne(presents(def), (e) => forceRebond(e, false));
    // Tranche 5 : la zone protège moins le rebond défensif (pas de vis-à-vis à écarter).
    const zone = plans[def].defense === 'zone' ? G.plans.zone.rebondOffensif : 0;
    const offensif = h.chance(borner(G.rebonds.offensifDeBase + G.rebonds.sensibiliteParPoint * ecart + zone, 0.08, 0.5));
    const camp = offensif ? attaque : def;
    if (h.chance(G.rebonds.partRebondsDEquipe)) {
      ecrire({ type: 'rebond_equipe', ...repere(), equipe: camp, offensif });
      return camp;
    }
    const preneur = choisirParmi(presents(camp), (e) => Math.max(1, forceRebond(e, offensif)) ** 2);
    ecrire({ type: 'rebond', ...repere(), equipe: camp, joueur: preneur.j.id, offensif });
    return camp;
  };

  // --- Une possession complète. Rend le camp qui aura le ballon ensuite et si le ballon est mort (remplacements permis). ---
  const adresse = (e: EtatJoueur, tir: TypeTir): number => {
    const j = e.j;
    // Tranche 7 : l'adresse de la zone de tir (attributs détaillés du modèle v2).
    const brut = tir === 'cercle' ? j.detail.tirCercle : tir === 'miDistance' ? j.detail.tirMiDistance : j.detail.tirATroisPoints;
    return brut - malus(e);
  };
  /** Tranche 7 : défense intérieure près du cercle, extérieure ailleurs ; sans zone de tir, la moyenne des deux. */
  const valeurDefensive = (e: EtatJoueur, tir?: TypeTir): number =>
    (tir === 'cercle'
      ? e.j.detail.defenseInterieure
      : tir
        ? e.j.detail.defenseExterieure
        : (e.j.detail.defenseInterieure + e.j.detail.defenseExterieure) / 2) - malus(e);
  const defense = (c: Camp, tir?: TypeTir): number => moyenne(presents(c), (e) => valeurDefensive(e, tir));
  /**
   * Tranche 5 : les vis-à-vis en défense individuelle. Les attaquants, du plus dangereux au moins dangereux, reçoivent
   * le meilleur défenseur libre de leur groupe (arrière, ailier, intérieur), à défaut le meilleur défenseur libre.
   */
  // Performance (25/11/2026) : l'attribution ne tire aucun hasard ; on s'arrête dès que le tireur a son défenseur.
  const defenseurDirect = (attaque: Camp, tireur: EtatJoueur): EtatJoueur | undefined => {
    const libres = presents(autre(attaque)).slice();
    const attaquants = presents(attaque)
      .slice()
      .sort((x, y) => effectif(y) - effectif(x));
    for (const a of attaquants) {
      // Le meilleur défenseur libre du même groupe, à défaut le meilleur libre (le premier en cas d'égalité).
      let d: EtatJoueur | undefined;
      let valeurD = 0;
      for (const memeGroupe of [true, false]) {
        for (const x of libres) {
          if (memeGroupe && x.j.groupe !== a.j.groupe) continue;
          const v = valeurDefensive(x);
          if (!d || v > valeurD) {
            d = x;
            valeurD = v;
          }
        }
        if (d) break;
      }
      if (!d) return undefined;
      if (a === tireur) return d;
      libres.splice(libres.indexOf(d), 1);
    }
    return undefined;
  };
  /** Tranche 7 : un joueur cherche les tirs de la zone où il est adroit. */
  const preference = (e: EtatJoueur, tir: TypeTir): number => {
    const E = G.tirs.preferenceZoneEchelle;
    if (!E) return 1;
    const a = tir === 'cercle' ? e.j.detail.tirCercle : tir === 'miDistance' ? e.j.detail.tirMiDistance : e.j.detail.tirATroisPoints;
    return Math.exp((a - 70) / E);
  };
  const usage = (e: EtatJoueur) => Math.exp((effectif(e) - 70) / G.tirs.usageEchelle);
  const minimalPourTirer = Math.round(R.tempsMinimalPourTirerSecondes * 10);

  const jouerPossession = (attaque: Camp): { suivant: Camp; ballonMort: boolean } => {
    const def = autre(attaque);
    const F = G.finDeMatch;
    // Tranche 5 : plans de jeu de l'attaque et de la défense.
    const rythme = G.plans.rythme[plans[attaque].rythme];
    const zone = plans[def].defense === 'zone' ? G.plans.zone : undefined;
    const volumeTrois = G.plans.troisPoints[plans[attaque].troisPoints];
    // Rule No. 7, Section II, 9 : à 24 s ou moins de la fin, l'horloge des tirs s'éteint après un changement de possession.
    let horloge = restant <= R.horlogeEteinteSousSecondes * 10 ? restant / 10 : R.horlogeDePossessionSecondes;
    for (let tentative = 0; ; tentative++) {
      // Trop peu de temps pour tirer : moins que le minimum réglementaire, ou, après un rebond offensif ou une faute,
      // moins que le minimum du modèle (le ballon n'est pas relancé). Une nouvelle possession tente sa chance dès 1 s.
      const seuil = tentative === 0 ? Math.max(minimalPourTirer, 10) : G.possession.tempsRestantMinimalPourTirer * 10;
      if (restant < seuil) {
        ecouler(restant);
        return { suivant: def, ballonMort: true };
      }
      const ecart = score[attaque] - score[def];
      const attaquants = presents(attaque);
      const defenseurs = presents(def);

      // Fin de match : la défense menée fait faute tout de suite pour arrêter le chronomètre.
      if (
        deuxDernieresMinutes() &&
        ecart >= 1 &&
        ecart <= F.fauteVolontaireEcartMax &&
        restant <= Math.min(F.fauteVolontaireSecondesMax, ecart * F.fauteVolontaireSecondesParPoint) * 10
      ) {
        const ecoule = Math.min(
          restant - 1,
          Math.round(borner(gaussien(h, F.dureeFauteVolontaireSecondes, 1), 1, 2 * F.dureeFauteVolontaireSecondes) * 10),
        );
        ecouler(ecoule);
        const fautif = choisirParmi(defenseurs, (e) => Math.max(1, 110 - e.j.detail.qiDefensif));
        // L'attaque donne le ballon à son meilleur tireur de lancers.
        const victime = attaquants.reduce((m, e) => (e.j.detail.lancersFrancs > m.j.detail.lancersFrancs ? e : m));
        if (commettreFaute(def, fautif, victime, 'hors_tir', true)) {
          if (tirerLancers(attaque, victime, R.lancersFrancsPenalite)) return { suivant: def, ballonMort: true };
          if (rebond(attaque) === def) return { suivant: def, ballonMort: false };
          horloge = Math.min(R.horlogeApresRebondOffensifSecondes, restant / 10);
          continue;
        }
        faireTourner(0);
        faireTourner(1);
        horloge = Math.min(Math.max(horloge - ecoule / 10, R.horlogeMinimaleApresFauteDefensiveSecondes), restant / 10);
        continue;
      }

      // Durée de l'action. L'attaque peut garder le ballon jusqu'au bout quand le temps restant tient dans l'horloge.
      const P = G.possession;
      const jusquAuBout = restant / 10 <= horloge;
      if (jusquAuBout && finale() && ecart > 0) {
        // L'équipe qui mène laisse filer le temps.
        ecouler(restant);
        return { suivant: def, ballonMort: true };
      }
      let duree: number;
      if (jusquAuBout) duree = restant - Math.max(minimalPourTirer, Math.round(h.reel() * F.margeDernierTirSecondes * 10));
      else {
        const moyenneDuree =
          deuxDernieresMinutes() && ecart > 0
            ? horloge * F.gestionAvanceFraction
            : deuxDernieresMinutes() && -ecart >= F.presseEcartMin
              ? F.presseDureeSecondes
              : P.dureeMoyenneSecondes * (horloge / R.horlogeDePossessionSecondes) * rythme.facteurDuree;
        duree = Math.round(borner(gaussien(h, moyenneDuree, P.dureeEcartSecondes), P.dureeMinimaleSecondes, horloge) * 10);
      }
      duree = borner(duree, 1, restant - 1);
      const presse = restant < P.tempsRestantMinimalPourTirer * 10;

      // Perte de balle.
      const T = G.pertesDeBalle;
      const maitrise = moyenne(attaquants, (e) => (e.j.detail.maniement + e.j.detail.qiOffensif) / 2 - malus(e));
      const pPerte = T.probabiliteDeBase - T.sensibiliteParPoint * (maitrise - defense(def)) + rythme.pertes + (zone?.pertes ?? 0);
      if (h.chance(borner(pPerte, 0.04, 0.3))) {
        ecouler(Math.round(duree * (0.3 + 0.6 * h.reel())));
        const fautif = choisirParmi(attaquants, usage);
        const vol = h.chance(T.partInterceptions) ? choisirParmi(defenseurs, (e) => Math.max(1, e.j.detail.interception - 40)) : undefined;
        ecrire({ type: 'perte_de_balle', ...repere(), equipe: attaque, joueur: fautif.j.id, ...(vol ? { interception: vol.j.id } : {}) });
        return { suivant: def, ballonMort: !vol };
      }

      // Faute défensive hors tir.
      if (h.chance(G.fautes.horsTirParPossession)) {
        const ecoule = Math.round(duree * (0.3 + 0.6 * h.reel()));
        ecouler(ecoule);
        const fautif = choisirParmi(defenseurs, (e) => Math.max(1, 110 - e.j.detail.qiDefensif));
        const victime = choisirParmi(attaquants, usage);
        if (commettreFaute(def, fautif, victime, 'hors_tir')) {
          if (tirerLancers(attaque, victime, R.lancersFrancsPenalite)) return { suivant: def, ballonMort: true };
          if (rebond(attaque) === def) return { suivant: def, ballonMort: false };
          horloge = Math.min(R.horlogeApresRebondOffensifSecondes, restant / 10);
          continue;
        }
        faireTourner(0);
        faireTourner(1);
        // Rule No. 7, Section IV, 5.1 : l'horloge garde sa valeur, ou remonte au minimum si elle était plus basse.
        horloge = Math.min(Math.max(horloge - ecoule / 10, R.horlogeMinimaleApresFauteDefensiveSecondes), restant / 10);
        continue;
      }

      // Tir.
      ecouler(duree);
      const tireur = choisirParmi(attaquants, usage);
      const profil = G.tirs.profilParGroupe[tireur.j.groupe];
      const pourEgaliser = finale() && ecart === -3 && restant <= R.horlogeEteinteSousSecondes * 10 && h.chance(F.partTroisEnRetardDeTrois);
      const tir = pourEgaliser
        ? 'troisPoints'
        : h.pondere(
            TYPES_TIR,
            (t) =>
              G.tirs.repartition[t] *
              profil[t] *
              (t === 'troisPoints' ? volumeTrois : 1) *
              (zone ? zone.repartition[t] : 1) *
              preference(tireur, t),
          );
      const valeur = tir === 'troisPoints' ? R.valeurPanierATroisPoints : R.valeurPanierInterieur;
      const preparee = actionPreparee === attaque;
      if (preparee) actionPreparee = null;
      // Tranche 5 : en défense individuelle, le défenseur direct pèse sur la qualité du tir (et sa taille près du cercle) ;
      // en zone, l'opposition est collective.
      const D = G.defenseurDirect;
      const direct = zone ? undefined : defenseurDirect(attaque, tireur);
      const opposition = direct
        ? (1 - D.poids) * defense(def, tir) +
          D.poids * (valeurDefensive(direct, tir) + (tir === 'cercle' ? D.tailleCercleParCm * (direct.j.tailleCm - tireur.j.tailleCm) : 0))
        : defense(def, tir);
      const pReussite = borner(
        G.tirs.reussiteDeBase[tir] +
          (zone ? zone.reussite[tir] : 0) +
          G.tirs.sensibiliteParPoint * (adresse(tireur, tir) - opposition) +
          (attaque === 0 ? G.tirs.avantageDomicile : 0) +
          forme[attaque] -
          (presse ? F.malusTirPresse : 0) +
          (preparee ? G.tempsMorts.bonusActionPreparee : 0),
        0.02,
        0.9,
      );
      const faute = !presse && h.chance(G.fautes.surTirParType[tir]);
      const reussi = faute ? h.chance(G.fautes.partPanierAvecFaute) : h.chance(pReussite);
      const passeur =
        reussi && attaquants.length > 1 && h.chance(G.passes.probabiliteSurPanier)
          ? choisirParmi(
              attaquants.filter((e) => e !== tireur),
              (e) => G.passes.poidsParGroupe[e.j.groupe] * Math.max(1, e.j.detail.passe - 40),
            )
          : undefined;
      const contreur =
        !reussi && !faute && h.chance(G.contres.probabiliteSurEchecParType[tir])
          ? choisirParmi(defenseurs, (e) => G.contres.poidsParGroupe[e.j.groupe] * Math.max(1, e.j.detail.contre - 40))
          : undefined;

      // Un tir manqué sur faute n'est pas une tentative : seul le tir réussi (panier avec faute) est écrit.
      if (!faute || reussi) {
        if (reussi) marquer(attaque, valeur);
        ecrire({
          type: 'tir',
          ...repere(),
          equipe: attaque,
          joueur: tireur.j.id,
          tir,
          reussi,
          points: reussi ? valeur : 0,
          ...(passeur ? { passe: passeur.j.id } : {}),
          ...(contreur ? { contre: contreur.j.id } : {}),
          score: [score[0], score[1]],
          position: tirerPosition(hPositions, tir, presse, R, G),
          ...(presse ? { presse: true as const } : {}),
          ...(restant <= 10 ? { auBuzzer: true as const } : {}),
          ...(preparee ? { preparee: true as const } : {}),
          ...(direct ? { defenseur: direct.j.id } : {}),
        });
      }
      if (faute) {
        const fautif = choisirParmi(defenseurs, (e) => G.contres.poidsParGroupe[e.j.groupe] * Math.max(1, 110 - e.j.detail.qiDefensif));
        commettreFaute(def, fautif, tireur, 'tir');
        const nombre = reussi
          ? R.lancersFrancsPanierAvecFaute
          : tir === 'troisPoints'
            ? R.lancersFrancsFauteSurTirATroisPoints
            : R.lancersFrancsFauteSurTirInterieur;
        if (tirerLancers(attaque, tireur, nombre)) return { suivant: def, ballonMort: true };
      } else if (reussi) return { suivant: def, ballonMort: true };

      if (restant < minimalPourTirer) {
        ecouler(restant);
        return { suivant: def, ballonMort: true };
      }
      if (rebond(attaque) === def) return { suivant: def, ballonMort: false };
      horloge = Math.min(R.horlogeApresRebondOffensifSecondes, restant / 10);
    }
  };

  // --- Déroulé du match. ---
  let gagnantEntreDeux: Camp = 0;
  const entreDeux = (): Camp => {
    const sauteur = (c: Camp): EtatJoueur =>
      presents(c).reduce((m, e) => (e.j.tailleCm + e.j.physique > m.j.tailleCm + m.j.physique ? e : m));
    const [a, b] = [sauteur(0), sauteur(1)];
    const ecart = a.j.tailleCm + a.j.physique - (b.j.tailleCm + b.j.physique);
    const c: Camp = h.chance(borner(0.5 + ecart * 0.01, 0.2, 0.8)) ? 0 : 1;
    ecrire({ type: 'entre_deux', ...repere(), equipe: c, joueurs: [a.j.id, b.j.id] });
    return c;
  };

  const jouerPeriode = (): void => {
    periode += 1;
    restant = (prolongation() ? R.dureeProlongationSecondes : R.dureePeriodeSecondes) * 10;
    for (const eq of equipes) {
      eq.fautesPeriode = 0;
      eq.fautesFinDePeriode = 0;
      eq.tempsMortsProlongation = 0;
    }
    tempsMortsPeriode = 0;
    premierCharge = null;
    obligatoire1 = false;
    obligatoire2 = false;
    actionPreparee = null;
    // Au début de chaque période après la première, le staff remet les titulaires reposés (sauf si le coach gère).
    if (periode > 1) {
      for (const c of [0, 1] as const) {
        const eq = equipes[c];
        for (const id of plans[c].remplacements === 'staff' ? titulaires[c] : []) {
          const e = etat(c, id);
          if (eq.surTerrain.includes(id) || e.exclu || e.blesse || e.energie < G.fatigue.seuilRemplacement) continue;
          const cible = presents(c)
            .filter((x) => !titulaires[c].includes(x.j.id))
            .sort((x, y) => Number(x.j.groupe !== e.j.groupe) - Number(y.j.groupe !== e.j.groupe) || effectif(x) - effectif(y))[0];
          if (cible) {
            eq.surTerrain = eq.surTerrain.map((x) => (x === cible.j.id ? id : x));
            e.entree = tempsDeJeu;
          }
        }
        faireTourner(c);
      }
    }
    // Arrêt de jeu du début de période (avant le coup d'envoi pour la première) : le coach peut décider.
    arreter(true, null);
    ecrire({ type: 'debut_periode', periode, restant, cinq: [equipes[0].surTerrain.slice(), equipes[1].surTerrain.slice()] });
    const regle = prolongation() ? 'entre-deux' : (R.possessionDebutDePeriode[periode - 1] ?? 'entre-deux');
    let attaque: Camp;
    if (regle === 'entre-deux') {
      attaque = entreDeux();
      if (periode === 1) gagnantEntreDeux = attaque;
    } else attaque = regle === 'gagnant' ? gagnantEntreDeux : autre(gagnantEntreDeux);

    while (restant > 0) {
      const { suivant, ballonMort } = jouerPossession(attaque);
      if (ballonMort && restant > 0) tempsMortsABallonMort(suivant);
      attaque = suivant;
    }
    ecrire({ type: 'fin_periode', periode, restant: 0, score: [score[0], score[1]] });
  };

  for (let p = 0; p < R.periodesReglementaires; p++) jouerPeriode();
  while (score[0] === score[1]) jouerPeriode();

  const boxScore = construireBoxScore(journal, [entree.domicile, entree.exterieur], titulaires, R.periodesReglementaires);
  return {
    graine: entree.graine,
    evenements: journal,
    boxScore,
    empreinte: empreinteBoxScore(boxScore),
    ...(options.arrets ? { arrets } : {}),
    ...(entree.decisions?.length ? { decisionsRejetees: rejetees } : {}),
  };
}
