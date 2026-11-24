// Tranche 5 : le mode interactif. Le match se déroule possession par possession, comme en mode commenté ; à chaque
// arrêt de jeu (ballon mort, début de période, avant le coup d'envoi), le coach peut prendre la main : plan de jeu
// (rythme, défense individuelle ou de zone, part du tir à trois points), temps-mort, changements, et ce qu'il délègue
// au staff. Chaque décision relance le moteur depuis le coup d'envoi avec la même graine et toutes les décisions : le
// début du match ne change pas, la suite tient compte de la décision. Le même moteur sert aux trois présentations.
import { useEffect, useMemo, useState } from 'react';
import {
  LIBELLES_PLAN,
  ajouterDecision,
  annulerDecisions,
  boxScoreAuMoment,
  chrono,
  commenterMatch,
  evenementsAvantLArret,
  nomDePeriode,
  pasSuivant,
  type ArretDeJeu,
  type Camp,
  type DecisionMatch,
  type EquipeDuMatch,
  type Lecture,
  type PlanDeJeu,
  type ResultatMatch,
} from '@basket-legends/engine';
import { paletteDe, regles } from '../donnees';
import { encreSur, minutes, pourcentage } from '../format';

interface Props {
  /** Le camp dirigé par le joueur (0 : domicile). */
  camp: Camp;
  decisionsInitiales: DecisionMatch[];
  arretInitial: number;
  /** Simule le match avec ces décisions (et l'état à chaque arrêt de jeu), dans le Web Worker. */
  simuler: (decisions: DecisionMatch[]) => Promise<ResultatMatch>;
  /** Appelé à chaque décision et à chaque arrêt atteint (sauvegarde de la saison). */
  onProgression?: (decisions: DecisionMatch[], arret: number) => void;
  onTerminer: (resultat: ResultatMatch, decisions: DecisionMatch[]) => void;
  onRetour: () => void;
  libelleRetour: string;
}

const VITESSES = [
  { libelle: '×1', delai: 900 },
  { libelle: '×4', delai: 220 },
  { libelle: '×16', delai: 55 },
] as const;

const CHOIX: { cle: keyof PlanDeJeu; libelle: string }[] = [
  { cle: 'rythme', libelle: 'Rythme' },
  { cle: 'defense', libelle: 'Défense' },
  { cle: 'troisPoints', libelle: 'Tirs à trois points' },
  { cle: 'remplacements', libelle: 'Changements' },
  { cle: 'tempsMorts', libelle: 'Temps-morts' },
];

export function EcranInteractif({
  camp,
  decisionsInitiales,
  arretInitial,
  simuler,
  onProgression,
  onTerminer,
  onRetour,
  libelleRetour,
}: Props) {
  const N = regles.periodesReglementaires;
  const [decisions, setDecisions] = useState(decisionsInitiales);
  const [resultat, setResultat] = useState<ResultatMatch>();
  const [lecture, setLecture] = useState<Lecture>({ curseur: 0, dernierArret: -1 });
  /** L'arrêt de jeu où le coach a la main (la lecture est alors suspendue). */
  const [arret, setArret] = useState<ArretDeJeu>();
  const [enLecture, setEnLecture] = useState(true);
  const [pauseDemandee, setPauseDemandee] = useState(false);
  const [vitesse, setVitesse] = useState(1);
  const [pauseEntrePeriodes, setPauseEntrePeriodes] = useState(true);
  const [pauseTempsMorts, setPauseTempsMorts] = useState(true);
  const [calcul, setCalcul] = useState(false);
  const [message, setMessage] = useState<string>();
  const [sortant, setSortant] = useState('');
  const [entrant, setEntrant] = useState('');

  // Premier calcul : reprise à l'arrêt enregistré (0 : avant le coup d'envoi).
  useEffect(() => {
    let actif = true;
    void simuler(decisionsInitiales).then((r) => {
      if (!actif) return;
      const a = r.arrets?.find((x) => x.numero === arretInitial) ?? r.arrets?.[0];
      setResultat(r);
      if (a) {
        setArret(a);
        setLecture({ curseur: a.indice, dernierArret: a.numero });
      }
    });
    return () => {
      actif = false;
    };
    // Le calcul initial ne dépend que des valeurs de départ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lignes = useMemo(() => (resultat ? commenterMatch(resultat, N) : []), [resultat, N]);
  const equipes = useMemo(
    () =>
      resultat
        ? (resultat.boxScore.equipes.map((e) => ({ id: e.id, nom: e.nom, joueurs: e.joueurs })) as unknown as [
            EquipeDuMatch,
            EquipeDuMatch,
          ])
        : undefined,
    [resultat],
  );
  const nbEvenements = resultat?.evenements.length ?? 0;
  const fini = Boolean(resultat) && lecture.curseur >= nbEvenements;

  /** Faut-il laisser la main au coach à cet arrêt ? */
  const sArreter = (a: ArretDeJeu): boolean => {
    if (pauseDemandee) return true;
    if (pauseEntrePeriodes && a.debutDePeriode) return true;
    const avant = evenementsAvantLArret(resultat!.evenements, resultat!.arrets!, a);
    if (pauseTempsMorts && avant.some((e) => e.type === 'temps_mort' && e.motif !== 'demande')) return true;
    // Un de ses joueurs sort sur blessure ou exclusion : le coach est prévenu.
    return avant.some((e) => (e.type === 'blessure' || e.type === 'exclusion') && e.equipe === camp);
  };

  const sArreterA = (a: ArretDeJeu) => {
    setArret(a);
    setPauseDemandee(false);
    setSortant('');
    setEntrant('');
    onProgression?.(decisions, a.numero);
  };

  // Lecture pas à pas.
  useEffect(() => {
    if (!resultat || arret || !enLecture || fini) return;
    const minuterie = setTimeout(() => {
      const p = pasSuivant(lignes, resultat.arrets ?? [], lecture, sArreter);
      setLecture(p.lecture);
      if (p.genre === 'arret') sArreterA(p.arret);
    }, VITESSES[vitesse]!.delai);
    return () => clearTimeout(minuterie);
  });

  /** Avance d'un coup jusqu'au prochain arrêt de jeu (ou jusqu'à la fin si `jusquALaFin`). */
  const sauter = (jusquALaFin: boolean) => {
    if (!resultat) return;
    let l = lecture;
    for (;;) {
      const p = pasSuivant(lignes, resultat.arrets ?? [], l, () => !jusquALaFin);
      l = p.lecture;
      if (p.genre === 'arret') {
        setLecture(l);
        return sArreterA(p.arret);
      }
      if (p.genre === 'fin') break;
    }
    setLecture(l);
  };

  const decider = async (d: DecisionMatch) => {
    if (!arret) return;
    const nouvelles = ajouterDecision(decisions, d);
    setCalcul(true);
    setMessage(undefined);
    try {
      const r = await simuler(nouvelles);
      const rejetees = r.decisionsRejetees ?? [];
      // Une décision impossible est ignorée par le moteur : le résultat est celui des décisions gardées.
      const gardees = nouvelles.filter((_, i) => !rejetees.includes(i));
      if (rejetees.length) setMessage('Cette décision n’est pas possible à cet arrêt de jeu.');
      setDecisions(gardees);
      setResultat(r);
      setArret(r.arrets?.find((a) => a.numero === arret.numero));
      onProgression?.(gardees, arret.numero);
    } finally {
      setCalcul(false);
    }
  };

  const annuler = async () => {
    if (!arret) return;
    const gardees = annulerDecisions(decisions, arret.numero);
    setCalcul(true);
    try {
      const r = await simuler(gardees);
      setDecisions(gardees);
      setResultat(r);
      setArret(r.arrets?.find((a) => a.numero === arret.numero));
      onProgression?.(gardees, arret.numero);
    } finally {
      setCalcul(false);
    }
  };

  if (!resultat || !equipes) return <p role="status">Préparation du match…</p>;

  const indiceDirect = Math.min(lecture.curseur, nbEvenements) - 1;
  const direct = boxScoreAuMoment(resultat.evenements, equipes, indiceDirect, N);
  const visibles = lignes.filter((l) => l.indice < lecture.curseur && l.genre !== 'changement').reverse();
  const derniere = lignes.filter((l) => l.indice < lecture.curseur).at(-1);
  const moment = arret ?? derniere;
  const lignesJoueurs = new Map(direct.equipes[camp].joueurs.map((j) => [j.id, j]));
  const mesDecisions = arret ? decisions.filter((d) => d.arret === arret.numero && d.equipe === camp) : [];
  const adversaire: Camp = camp === 0 ? 1 : 0;

  return (
    <>
      <header className="tableau-score direct" aria-label="Tableau d'affichage">
        {direct.equipes.map((e) => {
          const p = paletteDe(e.id);
          return (
            <div key={e.id} className="camp" style={{ background: p.primary, color: encreSur(p.primary) }}>
              <span className="camp-nom">{e.nom}</span>
              <span className="camp-points" data-testid={`score-${e.id}`}>
                {e.points}
              </span>
            </div>
          );
        })}
        <p className="chrono" role="status">
          {fini ? 'Terminé' : moment ? `${nomDePeriode(moment.periode, N)} · ${chrono(moment.restant)}` : 'Avant le match'}
        </p>
      </header>

      <section className="carte commandes" aria-label="Lecture du match">
        {!arret && !fini && (
          <button type="button" onClick={() => setPauseDemandee(true)} disabled={pauseDemandee}>
            {pauseDemandee ? 'Arrêt au prochain ballon mort…' : 'Demander un arrêt de jeu'}
          </button>
        )}
        {!arret && !fini && (
          <button type="button" onClick={() => setEnLecture((x) => !x)}>
            {enLecture ? 'Pause de l’affichage' : 'Lecture'}
          </button>
        )}
        <span className="boutons" role="group" aria-label="Vitesse">
          {VITESSES.map((v, i) => (
            <button key={v.libelle} type="button" aria-pressed={vitesse === i} onClick={() => setVitesse(i)}>
              {v.libelle}
            </button>
          ))}
        </span>
        {!arret && !fini && (
          <button type="button" onClick={() => sauter(false)}>
            Prochain arrêt de jeu
          </button>
        )}
        {!fini && (
          <button
            type="button"
            onClick={() => {
              setArret(undefined);
              sauter(true);
            }}
          >
            Aller à la fin du match
          </button>
        )}
        <label className="case">
          <input type="checkbox" checked={pauseEntrePeriodes} onChange={(e) => setPauseEntrePeriodes(e.target.checked)} /> Arrêt entre les
          périodes
        </label>
        <label className="case">
          <input type="checkbox" checked={pauseTempsMorts} onChange={(e) => setPauseTempsMorts(e.target.checked)} /> Arrêt aux temps-morts
        </label>
        {fini && (
          <button type="button" className="principal" onClick={() => onTerminer(resultat, decisions)}>
            Voir le box score
          </button>
        )}
        <button type="button" onClick={onRetour}>
          {libelleRetour}
        </button>
      </section>

      {arret && !fini && (
        <section className="carte banc-de-touche" aria-labelledby="titre-arret">
          <h2 id="titre-arret">
            {arret.numero === 0
              ? 'Avant le coup d’envoi'
              : arret.debutDePeriode
                ? `Avant le ${nomDePeriode(arret.periode, N)}`
                : `Arrêt de jeu · ballon pour ${direct.equipes[arret.possession ?? 0].nom}`}
          </h2>
          {message && (
            <p className="avertissement" role="alert">
              {message}
            </p>
          )}

          <fieldset className="plan-de-jeu" disabled={calcul}>
            <legend>Plan de jeu</legend>
            {CHOIX.map(({ cle, libelle }) => (
              <label key={cle}>
                {libelle}
                <select
                  value={arret.plans[camp][cle]}
                  onChange={(e) => void decider({ arret: arret.numero, equipe: camp, genre: 'plan', plan: { [cle]: e.target.value } })}
                >
                  {Object.entries(LIBELLES_PLAN[cle]).map(([valeur, texte]) => (
                    <option key={valeur} value={valeur}>
                      {texte}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>

          <div className="actions-coach">
            <button
              type="button"
              disabled={calcul || !arret.peutTempsMort[camp]}
              onClick={() => void decider({ arret: arret.numero, equipe: camp, genre: 'temps_mort' })}
            >
              Temps-mort ({arret.tempsMortsRestants[camp]} restant{arret.tempsMortsRestants[camp] > 1 ? 's' : ''})
            </button>
            <form
              className="changement"
              onSubmit={(e) => {
                e.preventDefault();
                if (sortant && entrant) void decider({ arret: arret.numero, equipe: camp, genre: 'remplacement', sortant, entrant });
              }}
            >
              <label>
                Sort
                <select value={sortant} onChange={(e) => setSortant(e.target.value)} disabled={calcul || arret.numero === 0}>
                  <option value="">—</option>
                  {arret.surTerrain[camp].map((id) => (
                    <option key={id} value={id}>
                      {lignesJoueurs.get(id)?.nom ?? id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Entre
                <select value={entrant} onChange={(e) => setEntrant(e.target.value)} disabled={calcul || arret.numero === 0}>
                  <option value="">—</option>
                  {arret.joueurs[camp]
                    .filter((j) => !arret.surTerrain[camp].includes(j.id) && !j.exclu && !j.blesse)
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {lignesJoueurs.get(j.id)?.nom ?? j.id} ({j.fraicheur})
                      </option>
                    ))}
                </select>
              </label>
              <button type="submit" disabled={calcul || !sortant || !entrant}>
                Changer
              </button>
            </form>
            {arret.numero === 0 && <p className="aide">Le cinq de départ est choisi par le staff.</p>}
          </div>

          <table className="tableau">
            <caption className="gauche">Votre équipe (fraîcheur sur 100)</caption>
            <thead>
              <tr>
                <th scope="col" className="gauche">
                  Joueur
                </th>
                <th scope="col">Terrain</th>
                <th scope="col">Fraîcheur</th>
                <th scope="col">Fautes</th>
                <th scope="col">Min</th>
                <th scope="col">Pts</th>
              </tr>
            </thead>
            <tbody>
              {[...arret.joueurs[camp]]
                .sort((a, b) => Number(arret.surTerrain[camp].includes(b.id)) - Number(arret.surTerrain[camp].includes(a.id)))
                .map((j) => {
                  const l = lignesJoueurs.get(j.id);
                  return (
                    <tr key={j.id}>
                      <th scope="row" className="gauche">
                        {l ? `${l.numero} · ${l.nom}` : j.id}
                        {j.exclu && <span className="etiquette alerte">exclu</span>}
                        {j.blesse && <span className="etiquette alerte">blessé</span>}
                      </th>
                      <td>{arret.surTerrain[camp].includes(j.id) ? 'oui' : ''}</td>
                      <td>{j.fraicheur}</td>
                      <td>{j.fautes}</td>
                      <td>{l ? minutes(l.dixiemes) : ''}</td>
                      <td>{l?.points ?? 0}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <p className="aide">
            {direct.equipes[adversaire].nom} (staff) : {LIBELLES_PLAN.rythme[arret.plans[adversaire].rythme]},{' '}
            {LIBELLES_PLAN.defense[arret.plans[adversaire].defense]}.
          </p>

          <span className="boutons">
            <button
              type="button"
              className="principal"
              disabled={calcul}
              onClick={() => {
                setArret(undefined);
                setEnLecture(true);
                setMessage(undefined);
              }}
            >
              Reprendre le match
            </button>
            {mesDecisions.length > 0 && (
              <button type="button" disabled={calcul} onClick={() => void annuler()}>
                Annuler mes décisions à cet arrêt
              </button>
            )}
          </span>
        </section>
      )}

      <div className="commente">
        <section className="carte" aria-label="Commentaire">
          <ol className="fil" aria-live="polite">
            {visibles.map((l) => (
              <li key={l.indice} className={l.important ? 'important' : undefined}>
                <span className="fil-temps">
                  {l.periode > N ? `P${l.periode - N}` : `Q${l.periode}`} {chrono(l.restant)}
                </span>
                <span className="fil-score">
                  {l.score[0]}-{l.score[1]}
                </span>
                <span className="fil-texte">{l.texte}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="carte" aria-label="Statistiques en direct">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col" className="gauche">
                  En direct
                </th>
                {direct.equipes.map((e) => (
                  <th key={e.id} scope="col">
                    {e.nom.split(' ').at(-1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Tirs', (t) => `${t.tirsReussis}-${t.tirsTentes} (${pourcentage(t.tirsReussis, t.tirsTentes)})`],
                  ['3 pts', (t) => `${t.troisReussis}-${t.troisTentes}`],
                  ['Lancers', (t) => `${t.lancersReussis}-${t.lancersTentes}`],
                  ['Rebonds', (t) => String(t.rebonds)],
                  ['Passes', (t) => String(t.passes)],
                  ['Pertes', (t) => String(t.pertes)],
                  ['Fautes', (t) => String(t.fautes)],
                ] as const satisfies readonly (readonly [string, (t: (typeof direct.equipes)[0]['totaux']) => string])[]
              ).map(([libelle, f]) => (
                <tr key={libelle}>
                  <th scope="row" className="gauche">
                    {libelle}
                  </th>
                  {direct.equipes.map((e) => (
                    <td key={e.id}>{f(e.totaux)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
