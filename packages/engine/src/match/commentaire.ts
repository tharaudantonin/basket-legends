// Tranche 3 : le mode commenté, possession par possession.
//
// Le commentaire est déduit du seul journal d'événements d'un match déjà simulé : il ne tire aucun hasard et ne peut
// donc pas changer le résultat. Le mode commenté et le mode rapide montrent le même match (même journal, même box
// score, même empreinte). Les tournures varient selon la position de l'événement dans le journal, pas au hasard.
import type { BoxScore, Camp, Evenement, PlanDeJeu, ResultatMatch, TypeTir } from './types';
import { PLAN_PAR_DEFAUT } from './types';

/** Tranche 5 : les libellés des choix d'un plan de jeu (commentaire et écran interactif). */
export const LIBELLES_PLAN: { [K in keyof PlanDeJeu]: Record<PlanDeJeu[K], string> } = {
  rythme: { lent: 'rythme lent', normal: 'rythme normal', rapide: 'rythme rapide' },
  defense: { individuelle: 'défense individuelle', zone: 'défense de zone' },
  troisPoints: {
    moins: 'moins de tirs à trois points',
    normal: 'tirs à trois points comme d’habitude',
    plus: 'plus de tirs à trois points',
  },
  remplacements: { staff: 'changements confiés au staff', coach: 'changements gérés par le coach' },
  tempsMorts: { staff: 'temps-morts confiés au staff', coach: 'temps-morts gérés par le coach' },
};

export type GenreCommentaire =
  | 'periode'
  | 'entre_deux'
  | 'panier'
  | 'echec'
  | 'lancers'
  | 'perte'
  | 'faute'
  | 'exclusion'
  | 'blessure'
  | 'temps_mort'
  | 'changement'
  | 'rebond'
  | 'plan';

export interface LigneCommentaire {
  /** Index, dans le journal, du dernier événement couvert par la ligne (pour rejouer le match jusqu'à ce point). */
  indice: number;
  periode: number;
  /** Temps restant dans la période, en dixièmes de seconde. */
  restant: number;
  score: [number, number];
  /** L'équipe concernée (null pour les lignes de chronologie). */
  equipe: Camp | null;
  genre: GenreCommentaire;
  texte: string;
  /** Moment fort : panier au buzzer, fin de période, exclusion, panier qui donne l'avantage en fin de match… */
  important: boolean;
}

const varier = (indice: number, formes: readonly string[]): string => formes[indice % formes.length]!;

/** Nom d'une période : « 1er quart-temps », « prolongation », « 2e prolongation ». */
export function nomDePeriode(periode: number, periodesReglementaires: number): string {
  if (periode <= periodesReglementaires) return periode === 1 ? '1er quart-temps' : `${periode}e quart-temps`;
  const n = periode - periodesReglementaires;
  return n === 1 ? 'prolongation' : `${n}e prolongation`;
}

/** Chronomètre lisible : « 7:42 », ou « 0:04.3 » dans la dernière minute. */
export function chrono(restant: number): string {
  const secondes = restant / 10;
  if (secondes < 60) return `0:${Math.floor(secondes).toString().padStart(2, '0')}.${restant % 10}`;
  const m = Math.floor(secondes / 60);
  return `${m}:${Math.floor(secondes % 60)
    .toString()
    .padStart(2, '0')}`;
}

const zone = (tir: TypeTir, distance: number, i: number): string => {
  const pieds = `${Math.round(distance)} pieds`;
  if (tir === 'troisPoints') return varier(i, [`à trois points (${pieds})`, `de loin (${pieds})`, `derrière l'arc (${pieds})`]);
  if (tir === 'miDistance') return varier(i, [`à mi-distance (${pieds})`, `en pull-up (${pieds})`, `en suspension (${pieds})`]);
  return varier(i, ['près du cercle', 'au layup', 'dans la raquette']);
};

/** Les lignes du commentaire d'un match, dans l'ordre du journal. */
export function commenterMatch(resultat: ResultatMatch, periodesReglementaires: number): LigneCommentaire[] {
  const { evenements: E, boxScore } = resultat;
  const noms = new Map<string, string>();
  for (const eq of boxScore.equipes) for (const j of eq.joueurs) noms.set(j.id, j.nom);
  const nom = (id: string | undefined) => (id ? (noms.get(id) ?? id) : '');
  const equipe = (c: Camp) => boxScore.equipes[c].nom;
  const lignes: LigneCommentaire[] = [];
  let score: [number, number] = [0, 0];
  const pousser = (indice: number, ev: Evenement, l: Omit<LigneCommentaire, 'indice' | 'periode' | 'restant' | 'score'>) =>
    lignes.push({ indice, periode: ev.periode, restant: ev.restant, score: [score[0], score[1]], ...l });
  const derniere = (periode: number) => periode >= periodesReglementaires;
  const plansCourants: [PlanDeJeu, PlanDeJeu] = [{ ...PLAN_PAR_DEFAUT }, { ...PLAN_PAR_DEFAUT }];

  for (let i = 0; i < E.length; i++) {
    const ev = E[i]!;
    switch (ev.type) {
      case 'debut_periode':
        pousser(i, ev, {
          equipe: null,
          genre: 'periode',
          texte: `Début du ${nomDePeriode(ev.periode, periodesReglementaires)}.`,
          important: false,
        });
        break;
      case 'entre_deux':
        pousser(i, ev, {
          equipe: ev.equipe,
          genre: 'entre_deux',
          texte: `Entre-deux entre ${nom(ev.joueurs[0])} et ${nom(ev.joueurs[1])} : ${equipe(ev.equipe)} récupère le ballon.`,
          important: false,
        });
        break;
      case 'tir': {
        const avant = score;
        score = ev.score;
        let texte: string;
        const ou = zone(ev.tir, ev.position.distance, i);
        const prefixe = ev.preparee ? 'Sur l’action préparée pendant le temps-mort, ' : ev.presse ? 'Tir pressé par le chronomètre : ' : '';
        if (ev.reussi) {
          texte = `${prefixe}${nom(ev.joueur)} ${varier(i, ['marque', 'réussit', 'convertit'])} ${ou}`;
          if (ev.passe) texte += `, ${varier(i, ['servi par', 'sur une passe de', 'trouvé par'])} ${nom(ev.passe)}`;
          texte += ev.auBuzzer ? ' au buzzer !' : '.';
        } else {
          texte = `${prefixe}${nom(ev.joueur)} ${varier(i, ['manque', 'rate', 'ne convertit pas'])} ${ou}`;
          if (ev.contre) texte += `, ${varier(i, ['contré par', 'repoussé par'])} ${nom(ev.contre)}`;
          // Le rebond qui suit est raconté dans la même ligne.
          const suivant = E[i + 1];
          let indice = i;
          if (suivant?.type === 'rebond') {
            texte += suivant.offensif ? ` ; rebond offensif de ${nom(suivant.joueur)}` : ` ; rebond de ${nom(suivant.joueur)}`;
            indice = i + 1;
            i++;
          } else if (suivant?.type === 'rebond_equipe') {
            texte += ` ; ballon pour ${equipe(suivant.equipe)}`;
            indice = i + 1;
            i++;
          }
          texte += ev.auBuzzer ? ', au buzzer.' : '.';
          lignes.push({
            indice,
            periode: ev.periode,
            restant: ev.restant,
            score: [score[0], score[1]],
            equipe: ev.equipe,
            genre: 'echec',
            texte,
            important: false,
          });
          break;
        }
        // Panier qui donne l'avantage, ou égalise, dans la dernière minute d'une fin de match.
        const autreCamp: Camp = ev.equipe === 0 ? 1 : 0;
        const basculeOuEgalise = avant[ev.equipe] <= avant[autreCamp] && score[ev.equipe] >= score[autreCamp];
        pousser(i, ev, {
          equipe: ev.equipe,
          genre: 'panier',
          texte,
          important: Boolean(ev.auBuzzer) || (derniere(ev.periode) && ev.restant <= 600 && basculeOuEgalise),
        });
        break;
      }
      case 'lancer_franc': {
        // Une série de lancers du même joueur tient en une ligne.
        let fin = i;
        while (
          E[fin + 1]?.type === 'lancer_franc' &&
          (E[fin + 1] as typeof ev).joueur === ev.joueur &&
          (E[fin + 1] as typeof ev).numero > 1
        )
          fin++;
        const serie = E.slice(i, fin + 1) as (typeof ev)[];
        const reussis = serie.filter((l) => l.reussi).length;
        score = serie.at(-1)!.score;
        const texte = `${nom(ev.joueur)} aux lancers francs : ${reussis} sur ${serie.length}.`;
        lignes.push({
          indice: fin,
          periode: ev.periode,
          restant: ev.restant,
          score: [score[0], score[1]],
          equipe: ev.equipe,
          genre: 'lancers',
          texte,
          important: false,
        });
        i = fin;
        break;
      }
      case 'rebond':
        pousser(i, ev, {
          equipe: ev.equipe,
          genre: 'rebond',
          texte: `${ev.offensif ? 'Rebond offensif' : 'Rebond'} de ${nom(ev.joueur)}.`,
          important: false,
        });
        break;
      case 'rebond_equipe':
        pousser(i, ev, { equipe: ev.equipe, genre: 'rebond', texte: `Ballon pour ${equipe(ev.equipe)}.`, important: false });
        break;
      case 'perte_de_balle':
        pousser(i, ev, {
          equipe: ev.equipe,
          genre: 'perte',
          texte: ev.interception
            ? `${varier(i, ['Interception de', 'Ballon volé par', 'Main baladeuse de'])} ${nom(ev.interception)} face à ${nom(ev.joueur)}.`
            : `${varier(i, ['Perte de balle de', 'Ballon perdu par', 'Maladresse de'])} ${nom(ev.joueur)}.`,
          important: false,
        });
        break;
      case 'faute': {
        let texte: string;
        if (ev.volontaire) texte = `Faute volontaire de ${nom(ev.joueur)} sur ${nom(ev.victime)} pour arrêter le chronomètre.`;
        else if (ev.nature === 'tir') texte = `Faute de ${nom(ev.joueur)} sur le tir de ${nom(ev.victime)}.`;
        else texte = `Faute de ${nom(ev.joueur)} sur ${nom(ev.victime)}${ev.penalite ? ' (pénalité : lancers francs)' : ''}.`;
        if (ev.fautesJoueur >= 5 && ev.fautesJoueur < 6) texte += ` ${nom(ev.joueur)} en est à 5 fautes.`;
        pousser(i, ev, { equipe: ev.equipe, genre: 'faute', texte, important: false });
        break;
      }
      case 'exclusion':
        pousser(i, ev, {
          equipe: ev.equipe,
          genre: 'exclusion',
          texte: `${nom(ev.joueur)} est exclu après sa sixième faute.`,
          important: true,
        });
        break;
      case 'blessure':
        pousser(i, ev, {
          equipe: ev.equipe,
          genre: 'blessure',
          texte: `${nom(ev.joueur)} se blesse et sortira au prochain arrêt de jeu (absent ${ev.matchsAbsent} match${ev.matchsAbsent > 1 ? 's' : ''}).`,
          important: true,
        });
        break;
      case 'temps_mort': {
        const qui = ev.equipe === null ? 'officiel' : equipe(ev.equipe);
        const texte =
          ev.motif === 'obligatoire'
            ? `Temps-mort obligatoire${ev.equipe === null ? '' : ` (chargé à ${qui})`}.`
            : ev.motif === 'serie'
              ? `Temps-mort ${qui} pour couper la série adverse (${ev.restants} restant${ev.restants > 1 ? 's' : ''}).`
              : ev.motif === 'demande'
                ? `Le coach de ${qui} demande un temps-mort (${ev.restants} restant${ev.restants > 1 ? 's' : ''}).`
                : `Temps-mort ${qui} pour préparer la dernière action (${ev.restants} restant${ev.restants > 1 ? 's' : ''}).`;
        pousser(i, ev, { equipe: ev.equipe, genre: 'temps_mort', texte, important: ev.motif === 'fin_de_match' });
        break;
      }
      case 'remplacement': {
        // Les changements d'une même équipe au même arrêt de jeu tiennent en une ligne.
        let fin = i;
        while (E[fin + 1]?.type === 'remplacement' && (E[fin + 1] as typeof ev).equipe === ev.equipe && E[fin + 1]!.restant === ev.restant)
          fin++;
        const serie = E.slice(i, fin + 1) as (typeof ev)[];
        const texte = `Changement${serie.length > 1 ? 's' : ''} ${equipe(ev.equipe)} : ${serie.map((r) => `${nom(r.entrant)} remplace ${nom(r.sortant)}`).join(', ')}.`;
        lignes.push({
          indice: fin,
          periode: ev.periode,
          restant: ev.restant,
          score: [score[0], score[1]],
          equipe: ev.equipe,
          genre: 'changement',
          texte,
          important: false,
        });
        i = fin;
        break;
      }
      case 'plan': {
        // Tranche 5 : le plan de jeu choisi par le coach (seulement ce qui change par rapport au plan précédent).
        const avant = plansCourants[ev.equipe];
        const changements = (Object.keys(ev.plan) as (keyof PlanDeJeu)[])
          .filter((k) => ev.plan[k] !== avant[k])
          .map((k) => LIBELLES_PLAN[k][ev.plan[k] as never] as string);
        plansCourants[ev.equipe] = ev.plan;
        if (changements.length)
          pousser(i, ev, {
            equipe: ev.equipe,
            genre: 'plan',
            texte: `${equipe(ev.equipe)} : ${changements.join(', ')}.`,
            important: false,
          });
        break;
      }
      case 'fin_periode': {
        score = ev.score;
        const finDuMatch = i === E.length - 1;
        const tableau = `${equipe(0)} ${ev.score[0]} – ${ev.score[1]} ${equipe(1)}`;
        pousser(i, ev, {
          equipe: null,
          genre: 'periode',
          texte: finDuMatch ? `Fin du match : ${tableau}.` : `Fin du ${nomDePeriode(ev.periode, periodesReglementaires)} : ${tableau}.`,
          important: true,
        });
        break;
      }
    }
  }
  return lignes;
}

/** Le score affiché d'un box score (utile pour vérifier que commentaire et box score racontent le même match). */
export const scoreFinal = (b: BoxScore): [number, number] => [b.equipes[0].points, b.equipes[1].points];
