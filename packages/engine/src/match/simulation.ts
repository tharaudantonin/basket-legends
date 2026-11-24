// Tranche 1 : le match rapide, simulé possession par possession.
//
// Le moteur est une fonction pure : même entrée (graine, équipes, règles, réglages) → même journal d'événements, donc
// même box score. Il ne calcule aucune statistique lui-même : il écrit le journal (types.ts, `Evenement`) et le box score
// en est déduit (boxscore.ts). Les modes commenté (tranche 3) et interactif (tranche 5) liront le même journal.
//
// Une possession : durée tirée (bornée par l'horloge des 24 s et le temps restant), puis perte de balle, faute hors tir
// ou tir. Le tir est pris par un joueur choisi selon son usage, dans une zone selon son profil ; la réussite dépend de
// son adresse face à la défense présente, de sa fraîcheur et du terrain. Faute sur tir → lancers ; échec → contre
// éventuel puis rebond, offensif (horloge à 14 s) ou défensif. Fautes d'équipe et pénalité par période (règles de la
// saison). Fatigue : chaque joueur perd de la fraîcheur sur le terrain et en regagne sur le banc ; le staff remplace
// à ballon mort. Simplifications de la tranche 1, notées dans docs/SIMULATION_MATCH.md : pas de temps-mort, pas de
// faute offensive, pas de rebond d'équipe, horloge à 14 s après une faute hors tir sans pénalité.
import { creerHasard, type Hasard } from '../hasard';
import { construireBoxScore } from './boxscore';
import { empreinteBoxScore } from './empreinte';
import type { Camp, EntreeMatch, EquipeDuMatch, Evenement, JoueurDuMatch, ResultatMatch, TypeTir } from './types';
import { TYPES_TIR } from './types';

interface EtatJoueur {
  j: JoueurDuMatch;
  energie: number;
  fautes: number;
  exclu: boolean;
  /** Temps de jeu total (dixièmes) au moment de son entrée sur le terrain. */
  entree: number;
}

interface EtatEquipe {
  equipe: EquipeDuMatch;
  joueurs: Map<string, EtatJoueur>;
  surTerrain: string[];
  /** Les joueurs que le staff fait tourner (les `profondeur` premiers), puis les autres en dernier recours. */
  rotation: string[];
  fautesPeriode: number;
  fautesFinDePeriode: number;
}

const borner = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));
const moyenne = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const autre = (c: Camp): Camp => (c === 0 ? 1 : 0);

/** Tirage gaussien (Box-Muller) à partir du hasard déterministe. */
function gaussien(h: Hasard, moyenneV: number, ecart: number): number {
  const u = 1 - h.reel();
  const v = h.reel();
  return moyenneV + ecart * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function simulerMatch(entree: EntreeMatch): ResultatMatch {
  const { regles: R, reglages: G } = entree;
  const h = creerHasard(entree.graine, `match:${entree.domicile.id}:${entree.exterieur.id}`);
  const journal: Evenement[] = [];
  const score: [number, number] = [0, 0];
  let tempsDeJeu = 0; // dixièmes écoulés depuis le début du match
  let periode = 0;
  let restant = 0;

  const preparer = (equipe: EquipeDuMatch): EtatEquipe => {
    if (equipe.joueurs.length < R.joueursSurLeTerrain) throw new Error(`${equipe.nom} n'a pas assez de joueurs pour jouer.`);
    const joueurs = new Map(equipe.joueurs.map((j) => [j.id, { j, energie: 100, fautes: 0, exclu: false, entree: 0 }]));
    return {
      equipe,
      joueurs,
      surTerrain: equipe.joueurs.slice(0, R.joueursSurLeTerrain).map((j) => j.id),
      rotation: equipe.joueurs.map((j) => j.id),
      fautesPeriode: 0,
      fautesFinDePeriode: 0,
    };
  };
  const equipes: [EtatEquipe, EtatEquipe] = [preparer(entree.domicile), preparer(entree.exterieur)];
  const titulaires = equipes.map((e) => e.surTerrain.slice()) as [string[], string[]];

  const etat = (c: Camp, id: string): EtatJoueur => equipes[c].joueurs.get(id) as EtatJoueur;
  const presents = (c: Camp): EtatJoueur[] => equipes[c].surTerrain.map((id) => etat(c, id));
  const malus = (e: EtatJoueur): number => G.fatigue.malusParPointPerdu * (100 - e.energie);
  const effectif = (e: EtatJoueur): number => e.j.note - malus(e);
  const ecrire = (ev: Evenement): void => {
    journal.push(ev);
  };
  const repere = () => ({ periode, restant });

  // Le temps passe : fraîcheur et chronomètre.
  const ecouler = (dixiemes: number): void => {
    const d = Math.min(dixiemes, restant);
    restant -= d;
    tempsDeJeu += d;
    const minutes = d / 600;
    for (const eq of equipes) {
      for (const e of eq.joueurs.values()) {
        if (eq.surTerrain.includes(e.j.id)) e.energie = Math.max(0, e.energie - G.fatigue.perteParMinute * minutes);
        else e.energie = Math.min(100, e.energie + G.fatigue.recuperationParMinute * minutes);
      }
    }
  };

  // Tirages pondérés de joueurs (départage stable : l'ordre du terrain).
  const choisirParmi = (liste: EtatJoueur[], poids: (e: EtatJoueur) => number): EtatJoueur => h.pondere(liste, poids);

  // --- Remplacements, seulement à ballon mort. ---
  const disponible = (e: EtatJoueur, seuil: number): boolean => !e.exclu && e.energie >= seuil;
  const remplacer = (c: Camp, sortant: string, entrant: string): void => {
    const eq = equipes[c];
    eq.surTerrain = eq.surTerrain.map((id) => (id === sortant ? entrant : id));
    etat(c, entrant).entree = tempsDeJeu;
    ecrire({ type: 'remplacement', ...repere(), equipe: c, entrant, sortant });
  };
  const meilleurRemplacant = (c: Camp, sortant: EtatJoueur, seuil: number, toutLeBanc: boolean): EtatJoueur | undefined => {
    const eq = equipes[c];
    const vivier = toutLeBanc ? eq.rotation : eq.rotation.slice(0, G.rotation.profondeur);
    const candidats = vivier.map((id) => etat(c, id)).filter((e) => !eq.surTerrain.includes(e.j.id) && disponible(e, seuil));
    if (!candidats.length) return undefined;
    const valeur = (e: EtatJoueur) => effectif(e) + (e.j.groupe === sortant.j.groupe ? 10 : 0);
    return candidats.reduce((m, e) => (valeur(e) > valeur(m) ? e : m));
  };
  const faireTourner = (c: Camp): void => {
    const eq = equipes[c];
    // 1. Joueurs exclus : remplacés par n'importe quel joueur valide (s'il n'y en a plus, l'exclu reste, comme le permet le règlement).
    for (const e of presents(c).filter((x) => x.exclu)) {
      const r = meilleurRemplacant(c, e, 0, true);
      if (r) remplacer(c, e.j.id, r.j.id);
    }
    // 2. Joueurs fatigués, les plus fatigués d'abord.
    for (const e of presents(c).sort((a, b) => a.energie - b.energie)) {
      if (e.energie >= G.fatigue.seuilRemplacement) continue;
      const r = meilleurRemplacant(c, e, G.fatigue.seuilRetour, false);
      if (r) remplacer(c, e.j.id, r.j.id);
    }
    // 3. Retour des meilleurs reposés à la place d'un joueur moins bon du même groupe, après un relais minimal.
    const relais = G.rotation.relaisMinimalSecondes * 10;
    for (const id of eq.rotation.slice(0, G.rotation.profondeur)) {
      const r = etat(c, id);
      if (eq.surTerrain.includes(id) || !disponible(r, G.fatigue.seuilRetour)) continue;
      const cible = presents(c)
        .filter((e) => e.j.groupe === r.j.groupe && tempsDeJeu - e.entree >= relais && effectif(e) + 3 < effectif(r))
        .sort((a, b) => effectif(a) - effectif(b))[0];
      if (cible) remplacer(c, cible.j.id, id);
    }
  };

  // --- Fautes et lancers francs. ---
  const enPenalite = (fautive: Camp): boolean => {
    const eq = equipes[fautive];
    const prolongation = periode > R.periodesReglementaires;
    const rang = prolongation ? R.rangFauteEquipePenaliteProlongation : R.rangFauteEquipePenalite;
    if (eq.fautesPeriode >= rang) return true;
    return restant <= R.finDePeriodeSecondes * 10 && eq.fautesFinDePeriode >= R.rangFauteEquipeFinDePeriode;
  };
  const commettreFaute = (fautive: Camp, joueur: EtatJoueur, victime: EtatJoueur, nature: 'tir' | 'hors_tir'): boolean => {
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
    const p = borner(L.reussiteDeBase + L.sensibiliteParPoint * (tireur.j.technique - 70 - malus(tireur)), L.reussiteMin, L.reussiteMax);
    let dernier = false;
    for (let n = 1; n <= nombre; n++) {
      dernier = h.chance(p);
      if (dernier) score[c] += R.valeurLancerFranc;
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
  const forceRebond = (e: EtatJoueur): number =>
    G.rebonds.poidsParGroupe[e.j.groupe] * (e.j.physique - malus(e) + (e.j.tailleCm - 200) * 0.5);
  const rebond = (attaque: Camp): Camp => {
    const def = autre(attaque);
    const ecart = moyenne(presents(attaque).map(forceRebond)) - moyenne(presents(def).map(forceRebond));
    const offensif = h.chance(borner(G.rebonds.offensifDeBase + G.rebonds.sensibiliteParPoint * ecart, 0.08, 0.5));
    const camp = offensif ? attaque : def;
    const preneur = choisirParmi(presents(camp), (e) => Math.max(1, forceRebond(e)) ** 2);
    ecrire({ type: 'rebond', ...repere(), equipe: camp, joueur: preneur.j.id, offensif });
    return camp;
  };

  // --- Une possession complète. Rend le camp qui aura le ballon ensuite et si le ballon est mort (remplacements permis). ---
  const adresse = (e: EtatJoueur, tir: TypeTir): number => {
    const j = e.j;
    const brut =
      tir === 'cercle' ? (j.technique + j.physique) / 2 : tir === 'miDistance' ? j.technique : 0.7 * j.technique + 0.3 * j.mental;
    return brut - malus(e);
  };
  const defense = (c: Camp): number => moyenne(presents(c).map((e) => 0.6 * e.j.tactique + 0.4 * e.j.physique - malus(e)));

  const jouerPossession = (attaque: Camp): { suivant: Camp; ballonMort: boolean } => {
    const def = autre(attaque);
    let horloge = R.horlogeDePossessionSecondes;
    for (;;) {
      if (restant < G.possession.tempsRestantMinimalPourTirer * 10) {
        ecouler(restant);
        return { suivant: def, ballonMort: true };
      }
      const P = G.possession;
      const duree = Math.round(
        borner(
          gaussien(h, P.dureeMoyenneSecondes * (horloge / R.horlogeDePossessionSecondes), P.dureeEcartSecondes),
          P.dureeMinimaleSecondes,
          horloge,
        ) * 10,
      );
      const attaquants = presents(attaque);
      const defenseurs = presents(def);

      // Perte de balle.
      const T = G.pertesDeBalle;
      const maitrise = moyenne(attaquants.map((e) => (e.j.mental + e.j.tactique) / 2 - malus(e)));
      if (h.chance(borner(T.probabiliteDeBase - T.sensibiliteParPoint * (maitrise - defense(def)), 0.04, 0.3))) {
        ecouler(Math.round(duree * (0.3 + 0.6 * h.reel())));
        const fautif = choisirParmi(attaquants, (e) => Math.exp((effectif(e) - 70) / G.tirs.usageEchelle));
        const vol = h.chance(T.partInterceptions) ? choisirParmi(defenseurs, (e) => Math.max(1, e.j.tactique - 40)) : undefined;
        ecrire({ type: 'perte_de_balle', ...repere(), equipe: attaque, joueur: fautif.j.id, ...(vol ? { interception: vol.j.id } : {}) });
        return { suivant: def, ballonMort: !vol };
      }

      // Faute défensive hors tir.
      if (h.chance(G.fautes.horsTirParPossession)) {
        ecouler(Math.round(duree * (0.3 + 0.6 * h.reel())));
        const fautif = choisirParmi(defenseurs, (e) => Math.max(1, 110 - e.j.tactique));
        const victime = choisirParmi(attaquants, (e) => Math.exp((effectif(e) - 70) / G.tirs.usageEchelle));
        if (commettreFaute(def, fautif, victime, 'hors_tir')) {
          if (tirerLancers(attaque, victime, R.lancersFrancsPenalite)) return { suivant: def, ballonMort: true };
          if (rebond(attaque) === def) return { suivant: def, ballonMort: false };
          horloge = R.horlogeApresRebondOffensifSecondes;
          continue;
        }
        faireTourner(0);
        faireTourner(1);
        horloge = R.horlogeApresRebondOffensifSecondes;
        continue;
      }

      // Tir.
      ecouler(duree);
      const tireur = choisirParmi(attaquants, (e) => Math.exp((effectif(e) - 70) / G.tirs.usageEchelle));
      const profil = G.tirs.profilParGroupe[tireur.j.groupe];
      const tir = h.pondere(TYPES_TIR, (t) => G.tirs.repartition[t] * profil[t]);
      const valeur = tir === 'troisPoints' ? R.valeurPanierATroisPoints : R.valeurPanierInterieur;
      const pReussite = borner(
        G.tirs.reussiteDeBase[tir] +
          G.tirs.sensibiliteParPoint * (adresse(tireur, tir) - defense(def)) +
          (attaque === 0 ? G.tirs.avantageDomicile : 0),
        0.05,
        0.9,
      );
      const faute = h.chance(G.fautes.surTirParType[tir]);
      const reussi = faute ? h.chance(G.fautes.partPanierAvecFaute) : h.chance(pReussite);
      const passeur =
        reussi && attaquants.length > 1 && h.chance(G.passes.probabiliteSurPanier)
          ? choisirParmi(
              attaquants.filter((e) => e !== tireur),
              (e) => G.passes.poidsParGroupe[e.j.groupe] * Math.max(1, e.j.tactique - 40),
            )
          : undefined;
      const contreur =
        !reussi && !faute && h.chance(G.contres.probabiliteSurEchecParType[tir])
          ? choisirParmi(defenseurs, (e) => G.contres.poidsParGroupe[e.j.groupe] * Math.max(1, e.j.physique - 40))
          : undefined;

      // Un tir manqué sur faute n'est pas une tentative : seul le tir réussi (panier avec faute) est écrit.
      if (!faute || reussi) {
        if (reussi) score[attaque] += valeur;
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
        });
      }
      if (faute) {
        const fautif = choisirParmi(defenseurs, (e) => G.contres.poidsParGroupe[e.j.groupe] * Math.max(1, 110 - e.j.tactique));
        commettreFaute(def, fautif, tireur, 'tir');
        const nombre = reussi
          ? R.lancersFrancsPanierAvecFaute
          : tir === 'troisPoints'
            ? R.lancersFrancsFauteSurTirATroisPoints
            : R.lancersFrancsFauteSurTirInterieur;
        if (tirerLancers(attaque, tireur, nombre)) return { suivant: def, ballonMort: true };
      } else if (reussi) return { suivant: def, ballonMort: true };

      if (rebond(attaque) === def) return { suivant: def, ballonMort: false };
      horloge = R.horlogeApresRebondOffensifSecondes;
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
    const prolongation = periode > R.periodesReglementaires;
    restant = (prolongation ? R.dureeProlongationSecondes : R.dureePeriodeSecondes) * 10;
    for (const eq of equipes) {
      eq.fautesPeriode = 0;
      eq.fautesFinDePeriode = 0;
    }
    // Au début de chaque période après la première, le staff remet les titulaires reposés.
    if (periode > 1) {
      for (const c of [0, 1] as const) {
        const eq = equipes[c];
        for (const id of titulaires[c]) {
          const e = etat(c, id);
          if (eq.surTerrain.includes(id) || e.exclu || e.energie < G.fatigue.seuilRemplacement) continue;
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
    ecrire({ type: 'debut_periode', periode, restant, cinq: [equipes[0].surTerrain.slice(), equipes[1].surTerrain.slice()] });
    const regle = prolongation ? 'entre-deux' : (R.possessionDebutDePeriode[periode - 1] ?? 'entre-deux');
    let attaque: Camp;
    if (regle === 'entre-deux') {
      attaque = entreDeux();
      if (periode === 1) gagnantEntreDeux = attaque;
    } else attaque = regle === 'gagnant' ? gagnantEntreDeux : autre(gagnantEntreDeux);

    while (restant > 0) {
      const { suivant, ballonMort } = jouerPossession(attaque);
      if (ballonMort && restant > 0) {
        faireTourner(0);
        faireTourner(1);
      }
      attaque = suivant;
    }
    ecrire({ type: 'fin_periode', periode, restant: 0, score: [score[0], score[1]] });
  };

  for (let p = 0; p < R.periodesReglementaires; p++) jouerPeriode();
  while (score[0] === score[1]) jouerPeriode();

  const boxScore = construireBoxScore(journal, [entree.domicile, entree.exterieur], titulaires, R.periodesReglementaires);
  return { graine: entree.graine, evenements: journal, boxScore, empreinte: empreinteBoxScore(boxScore) };
}
