// Tranche 1 : le box score d'un match rapide.
import type { BoxEquipe, LigneStatistique, ResultatMatch } from '@basket-legends/engine';
import { franchiseDe, regles } from '../donnees';
import { encreSur, minutes, pourcentage, signe } from '../format';

interface Props {
  franchise: string;
  resultat: ResultatMatch;
  enCours: boolean;
  onRejouer: () => void;
  onRetour: () => void;
}

const nomPeriode = (i: number): string => {
  const n = regles.periodesReglementaires;
  return i < n ? `Q${i + 1}` : i === n ? 'Prol.' : `Prol. ${i - n + 1}`;
};

function Cellules({ l }: { l: LigneStatistique }) {
  return (
    <>
      <td>{minutes(l.dixiemes)}</td>
      <td className="note">{l.points}</td>
      <td>
        {l.tirsReussis}-{l.tirsTentes}
      </td>
      <td>
        {l.troisReussis}-{l.troisTentes}
      </td>
      <td>
        {l.lancersReussis}-{l.lancersTentes}
      </td>
      <td>{l.rebondsOffensifs}</td>
      <td>{l.rebondsDefensifs}</td>
      <td>{l.rebonds}</td>
      <td>{l.passes}</td>
      <td>{l.interceptions}</td>
      <td>{l.contres}</td>
      <td>{l.pertes}</td>
      <td>{l.fautes}</td>
      <td>{signe(l.plusMoins)}</td>
    </>
  );
}

function TableEquipe({ e }: { e: BoxEquipe }) {
  const f = franchiseDe(e.id);
  const joueurs = [...e.joueurs].sort((a, b) => Number(b.titulaire) - Number(a.titulaire) || b.dixiemes - a.dixiemes);
  const t = e.totaux;
  return (
    <section className="carte" aria-label={`Statistiques ${e.nom}`}>
      <h2 className="titre-equipe">
        <span className="puce" style={{ background: f.palette.primary }} aria-hidden="true" />
        {e.nom} <span className="score-equipe">{e.points}</span>
      </h2>
      <div className="defilement">
        <table className="tableau box">
          <thead>
            <tr>
              <th scope="col" className="gauche">
                Joueur
              </th>
              <th scope="col" title="Minutes">
                MIN
              </th>
              <th scope="col" title="Points">
                PTS
              </th>
              <th scope="col" title="Tirs réussis-tentés">
                TIRS
              </th>
              <th scope="col" title="Tirs à trois points réussis-tentés">
                3 PTS
              </th>
              <th scope="col" title="Lancers francs réussis-tentés">
                LF
              </th>
              <th scope="col" title="Rebonds offensifs">
                RO
              </th>
              <th scope="col" title="Rebonds défensifs">
                RD
              </th>
              <th scope="col" title="Rebonds">
                REB
              </th>
              <th scope="col" title="Passes décisives">
                PD
              </th>
              <th scope="col" title="Interceptions">
                INT
              </th>
              <th scope="col" title="Contres">
                CTR
              </th>
              <th scope="col" title="Balles perdues">
                BP
              </th>
              <th scope="col" title="Fautes personnelles">
                F
              </th>
              <th scope="col" title="Écart au score avec le joueur sur le terrain">
                +/−
              </th>
            </tr>
          </thead>
          <tbody>
            {joueurs.map((j, i) => (
              <tr key={j.id} className={i === 4 ? 'fin-cinq' : undefined}>
                <th scope="row" className="gauche">
                  {j.nom}
                  {j.titulaire && <span className="etiquette">5</span>}
                  {j.exclu && <span className="etiquette alerte">6 F</span>}
                </th>
                {j.dixiemes > 0 ? (
                  <Cellules l={j} />
                ) : (
                  <td colSpan={14} className="gauche discret">
                    N'a pas joué
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="gauche">
                Équipe
              </th>
              <Cellules l={t} />
            </tr>
            <tr className="discret">
              <th scope="row" className="gauche">
                Réussite
              </th>
              <td />
              <td />
              <td>{pourcentage(t.tirsReussis, t.tirsTentes)}</td>
              <td>{pourcentage(t.troisReussis, t.troisTentes)}</td>
              <td>{pourcentage(t.lancersReussis, t.lancersTentes)}</td>
              <td colSpan={9} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export function EcranBoxScore({ franchise, resultat, enCours, onRejouer, onRetour }: Props) {
  const { boxScore: b } = resultat;
  const [dom, ext] = b.equipes;
  const fDom = franchiseDe(dom.id);
  const fExt = franchiseDe(ext.id);
  const vainqueur = dom.points > ext.points ? dom : ext;
  const victoire = vainqueur.id === franchise;
  return (
    <>
      <header className="tableau-score">
        <div className="camp" style={{ background: fDom.palette.primary, color: encreSur(fDom.palette.primary) }}>
          <span className="camp-lieu">Domicile</span>
          <span className="camp-nom">{dom.nom}</span>
          <span className="camp-points">{dom.points}</span>
        </div>
        <div className="camp" style={{ background: fExt.palette.primary, color: encreSur(fExt.palette.primary) }}>
          <span className="camp-lieu">Extérieur</span>
          <span className="camp-nom">{ext.nom}</span>
          <span className="camp-points">{ext.points}</span>
        </div>
      </header>
      <p className="verdict" role="status">
        {[
          victoire ? 'Victoire' : 'Défaite',
          b.prolongations ? `après ${b.prolongations === 1 ? 'prolongation' : `${b.prolongations} prolongations`}` : '',
          `— ${vainqueur.nom} l'emporte ${Math.max(dom.points, ext.points)} à ${Math.min(dom.points, ext.points)}.`,
        ]
          .filter(Boolean)
          .join(' ')}
      </p>

      <section className="carte" aria-label="Score par période">
        <div className="defilement">
          <table className="tableau periodes">
            <thead>
              <tr>
                <th scope="col" className="gauche">
                  Équipe
                </th>
                {dom.parPeriode.map((_, i) => (
                  <th key={i} scope="col">
                    {nomPeriode(i)}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {[dom, ext].map((e) => (
                <tr key={e.id}>
                  <th scope="row" className="gauche">
                    {e.nom}
                  </th>
                  {e.parPeriode.map((p, i) => (
                    <td key={i}>{p}</td>
                  ))}
                  <td className="note">{e.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <TableEquipe e={dom} />
      <TableEquipe e={ext} />

      <section className="carte actions">
        <p className="aide">
          Graine <strong>{resultat.graine}</strong> · empreinte du box score <code>{resultat.empreinte}</code>
        </p>
        <div className="boutons">
          <button type="button" onClick={onRejouer} disabled={enCours}>
            Rejouer avec la même graine
          </button>
          <button type="button" className="principal" onClick={onRetour}>
            Retour à l'effectif
          </button>
        </div>
      </section>
    </>
  );
}
