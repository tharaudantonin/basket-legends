// Tranche 6 : le contrat d'un joueur sur sa fiche (salaires par saison, options, garanti, ancienneté, draft).
import { salaireMinimum, salaireMaximum } from '@basket-legends/league';
import { salaires } from '../donnees';
import { dollars } from '../format';
import { LIBELLES_TYPE, Salaire } from './MasseSalariale';

export function ContratDuJoueur({ joueur }: { joueur: string }) {
  const c = salaires.contrats[joueur];
  if (!c) return null;
  const P = salaires.cba;
  return (
    <section className="carte" aria-labelledby="titre-contrat">
      <h2 id="titre-contrat">Contrat</h2>
      <p>
        {LIBELLES_TYPE[c.type]}
        {c.type === 'two-way' &&
          ` : ${dollars(P.salaireTwoWay)} en 2026-27, hors masse salariale ; ni Play-In ni playoffs, ${P.matchsMaxTwoWay} matchs au plus`}
        {c.anciennete !== null && ` · ${c.anciennete} saison${c.anciennete > 1 ? 's' : ''} NBA`}
        {c.draft ? ` · drafté en ${c.draft.annee} (${c.draft.tour === 1 ? '1er' : '2e'} tour, ${c.draft.rang}e choix)` : ' · non drafté'}
      </p>
      {c.salaires.length > 0 && (
        <table className="tableau">
          <thead>
            <tr>
              {c.salaires.map((s) => (
                <th key={s.saison} scope="col">
                  {s.saison}
                </th>
              ))}
              <th scope="col">Garanti</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {c.salaires.map((s) => (
                <td key={s.saison}>
                  <Salaire c={c} saison={s.saison} />
                </td>
              ))}
              <td>{c.garanti ? dollars(c.garanti) : '–'}</td>
            </tr>
          </tbody>
        </table>
      )}
      {c.anciennete !== null && (
        <p className="aide">
          Pour un nouveau contrat en 2026-27 : minimum {dollars(salaireMinimum(P, c.anciennete))}, maximum{' '}
          {dollars(salaireMaximum(P, c.anciennete))}.{c.note ? ` ${c.note.charAt(0).toUpperCase()}${c.note.slice(1)}.` : ''}
        </p>
      )}
    </section>
  );
}
