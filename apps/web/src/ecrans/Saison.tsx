// Tranche 4 : la saison du General Manager — avancer dans le calendrier, suivre classements, actualités, leaders,
// All-Star Game, Play-In, playoffs et palmarès, et revivre n'importe quel match (même graine, mêmes absents).
// Écran fonctionnel et sobre ; la mise en forme définitive viendra avec le chantier visuel.
import { useMemo, useState } from 'react';
import {
  calculerBilans,
  classer,
  pctBilan,
  prochainMatch,
  retard,
  type Cible,
  type EtatSaison,
  type LigneSaison,
  type ResumeMatch,
} from '@basket-legends/league';
import { effectifs, franchiseDe, paletteDe, structure } from '../donnees';
import { encreSur } from '../format';

type Onglet = 'calendrier' | 'classements' | 'actualites' | 'leaders' | 'all-star' | 'playoffs' | 'palmares';

interface Props {
  etat: EtatSaison;
  enCours: boolean;
  onAvancer: (cible: Cible) => void;
  onRevivre: (m: ResumeMatch, mode: 'rapide' | 'commente') => void;
  /** Tranche 5 : jouer (ou reprendre) le prochain match de la franchise en interactif. */
  onInteractif: () => void;
  onFiche: (joueur: string) => void;
  onQuitter: () => void;
}

const nomEquipe = (id: string): string =>
  id === 'all-star-est'
    ? 'Étoiles de l’Est'
    : id === 'all-star-ouest'
      ? 'Étoiles de l’Ouest'
      : (effectifs.get(id)?.franchise.fictionalName ?? id);
const court = (id: string): string => nomEquipe(id).split(' ').slice(1).join(' ') || nomEquipe(id);
const nomJoueur = (id: string | undefined): string => {
  if (!id) return '—';
  for (const e of effectifs.values()) {
    const j = e.players.find((p) => p.id === id);
    if (j) return j.fictionalDisplayName;
  }
  return id;
};
const dateFr = (d: string): string =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const pct3 = (x: number): string => x.toFixed(3).replace(/^0/, '');
const decimale = (x: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const PHASES: Record<EtatSaison['phase'], string> = {
  reguliere: 'Saison régulière',
  'play-in': 'Play-In',
  playoffs: 'Playoffs',
  terminee: 'Saison terminée',
};

function Joueur({ id, onFiche }: { id: string; onFiche: (j: string) => void }) {
  return (
    <button type="button" className="lien" onClick={() => onFiche(id)}>
      {nomJoueur(id)}
    </button>
  );
}

export function EcranSaison({ etat, enCours, onAvancer, onRevivre, onInteractif, onFiche, onQuitter }: Props) {
  const [onglet, setOnglet] = useState<Onglet>('calendrier');
  const [seulementMonEquipe, setSeulementMonEquipe] = useState(false);
  const f = franchiseDe(etat.franchise);
  const bilans = useMemo(() => calculerBilans(structure, etat.matchs), [etat.matchs]);
  const classements = useMemo(() => classer(structure, bilans, etat.graine), [bilans, etat.graine]);
  const moi = bilans[etat.franchise]!;
  const prochain = prochainMatch(etat);
  const fini = etat.phase === 'terminee';
  const matchParId = useMemo(() => new Map(etat.matchs.map((m) => [m.id, m])), [etat.matchs]);

  const onglets: [Onglet, string][] = [
    ['calendrier', 'Calendrier'],
    ['classements', 'Classements'],
    ['actualites', 'Actualités'],
    ['leaders', 'Leaders'],
    ['all-star', 'All-Star'],
    ['playoffs', 'Play-In et playoffs'],
    ['palmares', 'Palmarès'],
  ];

  return (
    <>
      <header
        className="bandeau"
        style={{ background: f.palette.primary, color: encreSur(f.palette.primary), borderBottomColor: f.palette.accent }}
      >
        <button type="button" className="retour" onClick={onQuitter}>
          ← Accueil
        </button>
        <h1>
          {f.fictionalName} · {etat.saison.replace('-', '–')}
        </h1>
        <p role="status">
          {PHASES[etat.phase]} · {dateFr(etat.date)} · bilan {moi.victoires}-{moi.defaites}
          {prochain &&
            ` · prochain match : ${prochain.domicile === etat.franchise ? `${court(prochain.exterieur)} à domicile` : `à ${court(prochain.domicile)}`} le ${dateFr(prochain.date)}`}
        </p>
      </header>

      <section className="carte commandes" aria-label="Avancer dans la saison">
        {(
          [
            ['jour', 'Jour suivant'],
            ['semaine', 'Une semaine'],
            ['all-star', 'Jusqu’au All-Star Game'],
            ['fin-reguliere', 'Fin de la saison régulière'],
            ['fin', 'Jusqu’au titre'],
          ] as [Cible, string][]
        ).map(([cible, libelle]) => (
          <button
            key={cible}
            type="button"
            className={cible === 'jour' ? 'principal' : undefined}
            disabled={
              enCours ||
              fini ||
              (cible === 'all-star' && (Boolean(etat.allStar) || etat.phase !== 'reguliere')) ||
              (cible === 'fin-reguliere' && etat.phase !== 'reguliere')
            }
            onClick={() => onAvancer(cible)}
          >
            {libelle}
          </button>
        ))}
        {!fini && (
          <button type="button" disabled={enCours} onClick={onInteractif}>
            {etat.matchInteractif ? 'Reprendre le match interactif' : 'Prochain match en interactif'}
          </button>
        )}
        {enCours && <span className="aide">Simulation…</span>}
      </section>

      <nav className="onglets" aria-label="Rubriques de la saison">
        {onglets.map(([id, libelle]) => (
          <button key={id} type="button" aria-pressed={onglet === id} onClick={() => setOnglet(id)}>
            {libelle}
          </button>
        ))}
      </nav>

      {onglet === 'calendrier' && (
        <section className="carte" aria-label="Calendrier">
          <div className="defilement">
            <table className="tableau">
              <thead>
                <tr>
                  <th scope="col" className="gauche">
                    Date
                  </th>
                  <th scope="col" className="gauche">
                    Adversaire
                  </th>
                  <th scope="col">Résultat</th>
                  <th scope="col">Revivre</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...etat.calendrier.flatMap((j) =>
                    j.matchs
                      .filter((m) => m.domicile === etat.franchise || m.exterieur === etat.franchise)
                      .map((m) => ({ date: j.date, ...m, joue: matchParId.get(m.id) })),
                  ),
                  ...etat.matchs
                    .filter(
                      (m) =>
                        m.nature !== 'reguliere' &&
                        m.nature !== 'all-star' &&
                        (m.domicile === etat.franchise || m.exterieur === etat.franchise),
                    )
                    .map((m) => ({ ...m, joue: m })),
                ].map((m) => {
                  const aDomicile = m.domicile === etat.franchise;
                  const r = m.joue;
                  const gagne = r ? r.score[0] > r.score[1] === aDomicile : undefined;
                  return (
                    <tr key={m.id}>
                      <td className="gauche">{dateFr(m.date)}</td>
                      <td className="gauche">
                        {aDomicile ? 'contre' : 'à'} {nomEquipe(aDomicile ? m.exterieur : m.domicile)}
                        {r && r.nature !== 'reguliere' && (
                          <span className="etiquette">{r.nature === 'play-in' ? 'Play-In' : 'Playoffs'}</span>
                        )}
                      </td>
                      <td>
                        {r
                          ? `${gagne ? 'V' : 'D'} ${r.score[aDomicile ? 0 : 1]}-${r.score[aDomicile ? 1 : 0]}${r.prolongations ? ' (prol.)' : ''}`
                          : '—'}
                      </td>
                      <td>
                        {r && (
                          <span className="boutons">
                            <button type="button" onClick={() => onRevivre(r, 'rapide')}>
                              Box score
                            </button>
                            <button type="button" onClick={() => onRevivre(r, 'commente')}>
                              Commenté
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {onglet === 'classements' &&
        structure.conferences.map((c) => {
          const liste = classements.conferences[c.id]!;
          const premier = bilans[liste[0]!]!;
          return (
            <section key={c.id} className="carte" aria-label={`Classement ${c.nom}`}>
              <h2>{c.nom}</h2>
              <div className="defilement">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col" className="gauche">
                        Équipe
                      </th>
                      <th scope="col">V</th>
                      <th scope="col">D</th>
                      <th scope="col">%</th>
                      <th scope="col" title="Écart au premier, en matchs">
                        Écart
                      </th>
                      <th scope="col">Dom.</th>
                      <th scope="col">Ext.</th>
                      <th scope="col">Conf.</th>
                      <th scope="col">Série</th>
                      <th scope="col">10 der.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liste.map((e, i) => {
                      const b = bilans[e]!;
                      const rang = i + 1;
                      const zone =
                        rang <= structure.playIn.qualifiesDirects
                          ? 'qualifie'
                          : rang <= structure.playIn.rangsDuPlayIn[1]
                            ? 'play-in'
                            : undefined;
                      return (
                        <tr key={e} className={[zone, e === etat.franchise ? 'mon-equipe' : ''].filter(Boolean).join(' ') || undefined}>
                          <td>{rang}</td>
                          <th scope="row" className="gauche">
                            <span className="puce" style={{ background: paletteDe(e).primary }} aria-hidden="true" /> {nomEquipe(e)}
                            {classements.vainqueursDivision.includes(e) && <span className="etiquette">Div.</span>}
                          </th>
                          <td>{b.victoires}</td>
                          <td>{b.defaites}</td>
                          <td>{pct3(pctBilan(b))}</td>
                          <td>{i === 0 ? '—' : decimale(retard(premier, b))}</td>
                          <td>
                            {b.domicile[0]}-{b.domicile[1]}
                          </td>
                          <td>
                            {b.exterieur[0]}-{b.exterieur[1]}
                          </td>
                          <td>
                            {b.conference[0]}-{b.conference[1]}
                          </td>
                          <td>{b.serie > 0 ? `${b.serie} V` : b.serie < 0 ? `${-b.serie} D` : '—'}</td>
                          <td>
                            {b.dixDerniers[0]}-{b.dixDerniers[1]}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="aide">
                1 à {structure.playIn.qualifiesDirects} : qualifiés pour les playoffs ; {structure.playIn.rangsDuPlayIn[0]} à{' '}
                {structure.playIn.rangsDuPlayIn[1]} : Play-In. Départages : critères NBA.
              </p>
            </section>
          );
        })}

      {onglet === 'actualites' && (
        <section className="carte" aria-label="Actualités">
          <label className="case">
            <input type="checkbox" checked={seulementMonEquipe} onChange={(e) => setSeulementMonEquipe(e.target.checked)} /> Seulement mon
            équipe
          </label>
          {etat.actualites.length === 0 && <p className="aide">Aucune actualité : la saison n'a pas commencé.</p>}
          <ol className="actualites">
            {[...etat.actualites]
              .reverse()
              .filter((a) => !seulementMonEquipe || a.equipes.includes(etat.franchise))
              .slice(0, 150)
              .map((a) => {
                const m = a.match !== undefined ? matchParId.get(a.match) : undefined;
                return (
                  <li key={a.id} className={`importance-${a.importance}`}>
                    <p className="actualite-date">{dateFr(a.date)}</p>
                    <h3>{a.titre}</h3>
                    <p>{a.texte}</p>
                    {m && (
                      <button type="button" onClick={() => onRevivre(m, 'commente')}>
                        Revivre en commenté
                      </button>
                    )}
                  </li>
                );
              })}
          </ol>
        </section>
      )}

      {onglet === 'leaders' && <Leaders etat={etat} onFiche={onFiche} />}

      {onglet === 'all-star' && (
        <section className="carte" aria-label="All-Star Game">
          {!etat.allStar ? (
            <p className="aide">
              Le All-Star Game se joue après 60 % de la saison régulière (vote simulé : fans 50 %, joueurs 25 %, médias 25 %).
            </p>
          ) : (
            <>
              {structure.conferences.map((c) => (
                <div key={c.id}>
                  <h2>{c.nom}</h2>
                  <p>
                    <strong>Titulaires :</strong>{' '}
                    {etat.allStar!.titulaires[c.id]!.map((j, i) => (
                      <span key={j}>
                        {i > 0 && ', '}
                        <Joueur id={j} onFiche={onFiche} />
                      </span>
                    ))}
                  </p>
                  <p>
                    <strong>Remplaçants :</strong>{' '}
                    {etat.allStar!.remplacants[c.id]!.map((j, i) => (
                      <span key={j}>
                        {i > 0 && ', '}
                        <Joueur id={j} onFiche={onFiche} />
                      </span>
                    ))}
                  </p>
                </div>
              ))}
              {etat.allStar.resultat !== undefined &&
                (() => {
                  const m = matchParId.get(etat.allStar!.resultat!)!;
                  return (
                    <p>
                      {nomEquipe(m.domicile)} {m.score[0]} – {m.score[1]} {nomEquipe(m.exterieur)} · MVP : {nomJoueur(etat.allStar!.mvp)}{' '}
                      <button type="button" onClick={() => onRevivre(m, 'commente')}>
                        Revivre en commenté
                      </button>
                    </p>
                  );
                })()}
            </>
          )}
        </section>
      )}

      {onglet === 'playoffs' && (
        <section className="carte" aria-label="Play-In et playoffs">
          {!etat.playIn ? (
            <p className="aide">
              Le Play-In (7e à 10e de chaque conférence) suit la saison régulière, puis viennent les playoffs (séries au meilleur des sept
              matchs).
            </p>
          ) : (
            <>
              <h2>Play-In</h2>
              <ul>
                {etat.playIn.flatMap((p) =>
                  p.matchs.map((x, i) => {
                    const r = x.resultat !== undefined ? matchParId.get(x.resultat) : undefined;
                    return (
                      <li key={`${p.conference}-${i}`}>
                        {nomEquipe(x.domicile)} – {nomEquipe(x.exterieur)} : {r ? `${r.score[0]}-${r.score[1]}` : 'à jouer'}
                      </li>
                    );
                  }),
                )}
              </ul>
              {(etat.series ?? []).length > 0 && (
                <>
                  <h2>Playoffs</h2>
                  {[1, 2, 3, 4].map((tour) => {
                    const series = etat.series!.filter((s) => s.tour === tour);
                    if (!series.length) return null;
                    return (
                      <div key={tour}>
                        <h3>
                          {tour === 4 || series[0]!.conference === null
                            ? 'Finale'
                            : tour === 3
                              ? 'Finales de conférence'
                              : tour === 2
                                ? 'Demi-finales de conférence'
                                : 'Premier tour'}
                        </h3>
                        <ul>
                          {series.map((s) => (
                            <li key={s.id}>
                              ({s.teteHaut}) {nomEquipe(s.haut)} {s.victoires[0]} – {s.victoires[1]} {nomEquipe(s.bas)} ({s.teteBas})
                              {s.vainqueur && ` · ${court(s.vainqueur)} qualifié`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
        </section>
      )}

      {onglet === 'palmares' && (
        <section className="carte" aria-label="Palmarès">
          {!etat.palmares ? (
            <p className="aide">
              Le palmarès est décerné à la fin des playoffs (règle des 65 matchs pour le MVP, le défenseur, la progression et les équipes
              All-NBA).
            </p>
          ) : (
            <>
              <p className="champion">
                🏆 {nomEquipe(etat.palmares.champion)}, champion {etat.saison.replace('-', '–')}
              </p>
              <dl className="palmares">
                {(
                  [
                    ['MVP des finales', etat.palmares.mvpFinale],
                    ['MVP de la saison', etat.palmares.mvp],
                    ['Défenseur de l’année', etat.palmares.defenseur],
                    ['Rookie de l’année', etat.palmares.rookie],
                    ['Sixième homme', etat.palmares.sixiemeHomme],
                    ['Joueur ayant le plus progressé', etat.palmares.progression],
                  ] as [string, string | undefined][]
                ).map(([titre, id]) => (
                  <div key={titre}>
                    <dt>{titre}</dt>
                    <dd>{id ? <Joueur id={id} onFiche={onFiche} /> : '—'}</dd>
                  </div>
                ))}
              </dl>
              {etat.palmares.allNba.map((eq, i) => (
                <p key={i}>
                  <strong>{i === 0 ? '1re' : `${i + 1}e`} équipe All-NBA :</strong>{' '}
                  {eq.map((j, k) => (
                    <span key={j}>
                      {k > 0 && ', '}
                      <Joueur id={j} onFiche={onFiche} />
                    </span>
                  ))}
                </p>
              ))}
            </>
          )}
        </section>
      )}
    </>
  );
}

function Leaders({ etat, onFiche }: { etat: EtatSaison; onFiche: (j: string) => void }) {
  const lignes = Object.entries(etat.statistiques).filter(([, t]) => t.matchs >= Math.min(20, Math.max(1, Math.floor(etat.jour / 8))));
  const categories: [string, (t: LigneSaison) => number][] = [
    ['Points', (t) => t.points / t.matchs],
    ['Rebonds', (t) => (t.rebondsOffensifs + t.rebondsDefensifs) / t.matchs],
    ['Passes', (t) => t.passes / t.matchs],
    ['Interceptions', (t) => t.interceptions / t.matchs],
    ['Contres', (t) => t.contres / t.matchs],
  ];
  if (!lignes.length) return <p className="carte aide">Aucun match joué.</p>;
  return (
    <section className="carte leaders" aria-label="Leaders statistiques">
      {categories.map(([titre, f]) => (
        <div key={titre}>
          <h2>{titre} par match</h2>
          <ol>
            {[...lignes]
              .sort(([a, ta], [b, tb]) => f(tb) - f(ta) || (a < b ? -1 : 1))
              .slice(0, 10)
              .map(([id, t]) => (
                <li key={id}>
                  <Joueur id={id} onFiche={onFiche} /> ({court(t.equipe)}) — {decimale(f(t))}
                </li>
              ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
