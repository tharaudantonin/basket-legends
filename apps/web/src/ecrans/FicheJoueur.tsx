// Tranche 3 : la fiche joueur (version fonctionnelle et sobre ; la mise en forme définitive viendra avec le chantier
// visuel). Identité fictive, notes du modèle v1, statistiques sourcées 2025-26 par compétition et, quand on vient d'un
// match, son graphique d'adresse tiré du journal.
import { useEffect, useMemo, useState } from 'react';
import { moyennesDuJoueur, schemaStatistiquesJoueurs, type MoyennesJoueur } from '@basket-legends/data';
import { adresseParTranche, coordonnees, tirsDuJoueur, type ResultatMatch, type TrancheTir } from '@basket-legends/engine';
import type { EtatSaison, LigneSaison } from '@basket-legends/league';
import { effectifDe, franchiseDe, franchiseDuJoueur, regles } from '../donnees';
import { encreSur, pourcentage, taille } from '../format';
import { ContratDuJoueur } from './ContratDuJoueur';

interface Props {
  joueur: string;
  /** Le match d'où l'on vient, pour son graphique d'adresse. */
  resultat?: ResultatMatch;
  /** Tranche 4 : la saison en cours, pour les statistiques simulées du joueur. */
  saison?: EtatSaison;
  onRetour: () => void;
}

const LIBELLES_TRANCHES: Record<TrancheTir, string> = {
  cercle: 'Près du cercle (0-3 pieds)',
  trois_dix: '3 à 10 pieds',
  dix_seize: '10 à 16 pieds',
  seize_ligne: '16 pieds à la ligne',
  trois_coin: 'Trois points, coins',
  trois_arc: 'Trois points, arc',
};

const decimale = (x: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (x: number | null) => (x === null ? '–' : `${decimale(100 * x)} %`);

/** Les statistiques sourcées sont chargées à la demande (le fichier pèse plusieurs centaines de ko). */
function useMoyennes(id: string): MoyennesJoueur[] | undefined {
  const [moyennes, setMoyennes] = useState<MoyennesJoueur[]>();
  useEffect(() => {
    let actif = true;
    void import('../../../../data/statistiques/2025-26/joueurs.json').then((m) => {
      if (actif) setMoyennes(moyennesDuJoueur(schemaStatistiquesJoueurs.parse(m.default), id));
    });
    return () => {
      actif = false;
    };
  }, [id]);
  return moyennes;
}

/** Demi-terrain schématique, en pieds (illustration : seules la ligne à trois points et la zone restreinte viennent des règles). */
function GraphiqueAdresse({ resultat, joueur }: { resultat: ResultatMatch; joueur: string }) {
  const tirs = useMemo(() => tirsDuJoueur(resultat.evenements, joueur), [resultat, joueur]);
  const tranches = adresseParTranche(tirs);
  const panier = 5.25; // distance dessinée du fond au centre du panier
  const arc = regles.ligneATroisPointsPieds;
  const coin = 22;
  const yCoin = panier + Math.sqrt(arc * arc - coin * coin);
  return (
    <div className="adresse">
      <svg
        viewBox="-25 0 50 35"
        role="img"
        aria-label={`Graphique d'adresse : ${tirs.filter((t) => t.reussi).length} tirs réussis sur ${tirs.length}`}
      >
        <rect x="-25" y="0" width="50" height="35" className="parquet" />
        <path d={`M ${-coin} 0 L ${-coin} ${yCoin} A ${arc} ${arc} 0 0 0 ${coin} ${yCoin} L ${coin} 0`} className="ligne" />
        <rect x="-8" y="0" width="16" height="19" className="ligne" />
        <path
          d={`M -${regles.zoneRestreintePieds} ${panier} A ${regles.zoneRestreintePieds} ${regles.zoneRestreintePieds} 0 0 0 ${regles.zoneRestreintePieds} ${panier}`}
          className="ligne"
        />
        <circle cx="0" cy={panier} r="0.75" className="ligne" />
        {tirs.map((t) => {
          const { x, y } = coordonnees(t.position);
          const cy = panier + y;
          return t.reussi ? (
            <circle key={t.indice} cx={x} cy={cy} r="0.7" className="tir-reussi" />
          ) : (
            <path
              key={t.indice}
              d={`M ${x - 0.6} ${cy - 0.6} L ${x + 0.6} ${cy + 0.6} M ${x + 0.6} ${cy - 0.6} L ${x - 0.6} ${cy + 0.6}`}
              className="tir-manque"
            />
          );
        })}
      </svg>
      <table className="tableau">
        <thead>
          <tr>
            <th scope="col" className="gauche">
              Zone
            </th>
            <th scope="col">Réussis</th>
            <th scope="col">%</th>
          </tr>
        </thead>
        <tbody>
          {tranches.map((t) => (
            <tr key={t.tranche}>
              <th scope="row" className="gauche">
                {LIBELLES_TRANCHES[t.tranche]}
              </th>
              <td>
                {t.reussis}-{t.tentes}
              </td>
              <td>{pourcentage(t.reussis, t.tentes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EcranFicheJoueur({ joueur, resultat, saison, onRetour }: Props) {
  const franchise = franchiseDuJoueur(joueur);
  const f = franchiseDe(franchise);
  const j = effectifDe(franchise).players.find((x) => x.id === joueur);
  const moyennes = useMoyennes(joueur);
  if (!j) return <p className="erreur">Joueur inconnu : {joueur}</p>;
  const r = j.ratings as typeof j.ratings & { calculation?: string };
  const aJoueCeMatch = resultat?.boxScore.equipes.some((e) => e.joueurs.some((x) => x.id === joueur && x.dixiemes > 0));

  return (
    <>
      <header
        className="bandeau"
        style={{ background: f.palette.primary, color: encreSur(f.palette.primary), borderBottomColor: f.palette.accent }}
      >
        <button type="button" className="retour" onClick={onRetour}>
          ← Retour
        </button>
        <h1>{j.fictionalDisplayName}</h1>
        <p>
          N° {j.jerseyNumber} · {f.fictionalName} · {taille(j.measurements.height.heightCm)}, {j.measurements.weight.weightKg} kg
        </p>
      </header>

      <section className="carte" aria-labelledby="titre-notes">
        <h2 id="titre-notes">Notes</h2>
        <p className="notes-joueur">
          <span className="note-globale">{j.ratings.overall}</span> Technique {j.attributes.technique} · Physique {j.attributes.physical} ·
          Mental {j.attributes.mental} · Tactique {j.attributes.tactical}
        </p>
        {r.calculation && <p className="aide">{r.calculation}</p>}
      </section>

      <ContratDuJoueur joueur={joueur} />

      {resultat && aJoueCeMatch && (
        <section className="carte" aria-labelledby="titre-adresse">
          <h2 id="titre-adresse">Graphique d'adresse du match</h2>
          <GraphiqueAdresse resultat={resultat} joueur={joueur} />
        </section>
      )}

      {saison && (saison.statistiques[joueur] || saison.statistiquesPlayoffs[joueur]) && (
        <section className="carte" aria-labelledby="titre-saison">
          <h2 id="titre-saison">Saison {saison.saison.replace('-', '–')} (simulée)</h2>
          <div className="defilement">
            <table className="tableau">
              <thead>
                <tr>
                  <th scope="col" className="gauche">
                    Phase
                  </th>
                  <th scope="col">MJ</th>
                  <th scope="col">MIN</th>
                  <th scope="col">PTS</th>
                  <th scope="col">REB</th>
                  <th scope="col">PD</th>
                  <th scope="col">TIRS</th>
                  <th scope="col">3 PTS</th>
                  <th scope="col">LF</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Saison régulière', saison.statistiques[joueur]],
                    ['Playoffs', saison.statistiquesPlayoffs[joueur]],
                  ] as [string, LigneSaison | undefined][]
                )
                  .filter((x): x is [string, LigneSaison] => Boolean(x[1]?.matchs))
                  .map(([libelle, t]) => (
                    <tr key={libelle}>
                      <th scope="row" className="gauche">
                        {libelle}
                      </th>
                      <td>{t.matchs}</td>
                      <td>{decimale(t.dixiemes / 600 / t.matchs)}</td>
                      <td className="note">{decimale(t.points / t.matchs)}</td>
                      <td>{decimale((t.rebondsOffensifs + t.rebondsDefensifs) / t.matchs)}</td>
                      <td>{decimale(t.passes / t.matchs)}</td>
                      <td>{pourcentage(t.tirsReussis, t.tirsTentes)}</td>
                      <td>{pourcentage(t.troisReussis, t.troisTentes)}</td>
                      <td>{pourcentage(t.lancersReussis, t.lancersTentes)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {(saison.blessures[joueur] ?? 0) > 0 && (
            <p className="avertissement">Blessé : encore {saison.blessures[joueur]} match(s) d'absence.</p>
          )}
        </section>
      )}

      <section className="carte" aria-labelledby="titre-stats">
        <h2 id="titre-stats">Statistiques réelles de référence</h2>
        {moyennes === undefined ? (
          <p className="aide">Chargement…</p>
        ) : moyennes.length === 0 ? (
          <p className="aide">Aucune statistique NBA relevée pour ce joueur (recrue ou joueur sans match) : rien n'est inventé.</p>
        ) : (
          <div className="defilement">
            <table className="tableau">
              <thead>
                <tr>
                  <th scope="col" className="gauche">
                    Compétition
                  </th>
                  <th scope="col">MJ</th>
                  <th scope="col">MIN</th>
                  <th scope="col">PTS</th>
                  <th scope="col">REB</th>
                  <th scope="col">PD</th>
                  <th scope="col">INT</th>
                  <th scope="col">CTR</th>
                  <th scope="col">BP</th>
                  <th scope="col">TIRS</th>
                  <th scope="col">3 PTS</th>
                  <th scope="col">LF</th>
                </tr>
              </thead>
              <tbody>
                {moyennes.map((m) => (
                  <tr key={m.competition}>
                    <th scope="row" className="gauche">
                      {m.libelle}
                    </th>
                    <td>{m.matchs}</td>
                    <td>{decimale(m.minutes)}</td>
                    <td className="note">{decimale(m.points)}</td>
                    <td>{decimale(m.rebonds)}</td>
                    <td>{decimale(m.passes)}</td>
                    <td>{decimale(m.interceptions)}</td>
                    <td>{decimale(m.contres)}</td>
                    <td>{decimale(m.pertes)}</td>
                    <td>{pct(m.pctTirs)}</td>
                    <td>{pct(m.pctTrois)}</td>
                    <td>{pct(m.pctLancers)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="aide">
              Moyennes par match recalculées à partir des totaux. Sources :{' '}
              {[...new Map(moyennes.map((m) => [m.source.url, m.source])).values()].map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ', '}
                  <a href={s.url} rel="noreferrer" target="_blank">
                    {s.fournisseur}
                  </a>
                </span>
              ))}
              .
            </p>
          </div>
        )}
      </section>
    </>
  );
}
