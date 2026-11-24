// Tranche 8 : l'histoire de la carrière — saisons jouées (champion, finaliste, MVP, bilan de sa franchise), changements
// de franchise et grands retraités. Écran fonctionnel et sobre ; la mise en forme viendra avec le chantier visuel.
import type { EtatSaison } from '@basket-legends/league';
import { nomJoueur, universActif } from '../vue';

interface Props {
  etat: EtatSaison;
  onFiche: (joueur: string) => void;
}

export function Histoire({ etat, onFiche }: Props) {
  const archives = [...(etat.archives ?? [])].reverse();
  const u = universActif();
  const grands = Object.entries(u.retraites)
    .filter(([, r]) => r.noteMax >= 85)
    .sort(([, a], [, b]) => b.noteMax - a.noteMax || a.nom.localeCompare(b.nom))
    .slice(0, 20);
  const lien = (id: string | undefined) =>
    id ? (
      <button type="button" className="lien" onClick={() => onFiche(id)}>
        {nomJoueur(id)}
      </button>
    ) : (
      '—'
    );

  return (
    <section className="carte" aria-label="Histoire">
      <h2>Saisons jouées</h2>
      {!archives.length ? (
        <p className="aide">
          Aucune saison terminée pour l’instant. À la fin de la saison et de la Draft, « Passer à la saison suivante » fait vieillir et
          progresser les joueurs, décide des retraites et des contrats, puis lance la saison suivante.
        </p>
      ) : (
        <div className="defilement">
          <table className="tableau" data-testid="histoire">
            <thead>
              <tr>
                <th scope="col" className="gauche">
                  Saison
                </th>
                <th scope="col" className="gauche">
                  Champion
                </th>
                <th scope="col" className="gauche">
                  Finaliste
                </th>
                <th scope="col" className="gauche">
                  MVP
                </th>
                <th scope="col">Votre bilan</th>
                <th scope="col">Retraites</th>
              </tr>
            </thead>
            <tbody>
              {archives.map((a) => {
                const b = a.bilans[a.franchise];
                return (
                  <tr key={a.saison}>
                    <th scope="row" className="gauche">
                      {a.saison.replace('-', '–')}
                    </th>
                    <td className="gauche">{a.noms[a.champion] ?? a.champion}</td>
                    <td className="gauche">{a.noms[a.finaliste] ?? a.finaliste}</td>
                    <td className="gauche">{lien(a.palmares.mvp)}</td>
                    <td>{b ? `${b[0]}-${b[1]}` : '—'}</td>
                    <td>{a.retraites.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {archives.some((a) => a.demenagement) && (
        <>
          <h2>Changements de franchise</h2>
          <ul>
            {archives
              .filter((a) => a.demenagement)
              .map((a) => (
                <li key={a.saison}>
                  Après la saison {a.saison.replace('-', '–')} : {a.demenagement!.de} deviennent {a.demenagement!.vers} (histoire et
                  palmarès conservés).
                </li>
              ))}
          </ul>
        </>
      )}
      {grands.length > 0 && (
        <>
          <h2>Grands retraités</h2>
          <ul>
            {grands.map(([id, r]) => (
              <li key={id}>
                {lien(id)} : retraite à {r.age} ans après la saison {r.saison.replace('-', '–')}, meilleure note {r.noteMax}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
