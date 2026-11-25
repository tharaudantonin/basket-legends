// Tranche 7 : le vivier, joueurs originaux hors NBA : en développement (profil G League) ou libres. Tranche 8 : la liste
// suit la carrière (prospects non draftés, joueurs coupés ou en fin de contrat, retraites). Pas encore de franchise : la
// free agency arrive en tranche 9 et la G League en tranche 10 ; en attendant, les équipes complètent leur effectif
// avec les meilleurs d'entre eux à chaque intersaison (règle provisoire).
import { useMemo, useState } from 'react';
import { taille } from '../format';
import { vivier } from '../donnees';
import { universActif } from '../vue';

type Filtre = 'tous' | 'developpement' | 'libre';
const STATUTS = { developpement: 'En développement', libre: 'Libre' } as const;

export function Vivier() {
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const u = universActif();
  const tous = useMemo(() => Object.entries(u.horsNba).map(([id, statut]) => ({ ...u.joueurs[id]!, statut })), [u]);
  const joueurs = useMemo(
    () => tous.filter((j) => filtre === 'tous' || j.statut === filtre).sort((a, b) => b.note - a.note || a.id.localeCompare(b.id)),
    [tous, filtre],
  );
  return (
    <section className="carte" aria-label="Vivier">
      <h2>Joueurs hors NBA ({tous.length})</h2>
      <p className="aide">
        Joueurs originaux générés pour la carrière, sans franchise (free agency en tranche 9). Au départ, échelle hors NBA de 40 à 67 ;
        ensuite, chacun progresse ou décline avec l’âge. Modèle du vivier au statut « {vivier.statut} ».
      </p>
      <nav className="onglets" aria-label="Filtre du vivier">
        {(['tous', 'developpement', 'libre'] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filtre === f} onClick={() => setFiltre(f)}>
            {f === 'tous' ? 'Tous' : STATUTS[f]}
          </button>
        ))}
      </nav>
      <div className="defilement">
        <table className="tableau">
          <thead>
            <tr>
              <th scope="col" className="gauche">
                Joueur
              </th>
              <th scope="col" className="gauche">
                Statut
              </th>
              <th scope="col">Âge</th>
              <th scope="col">Poste</th>
              <th scope="col">Taille</th>
              <th scope="col" className="gauche">
                Pays
              </th>
              <th scope="col">Note</th>
              <th scope="col">Tech.</th>
              <th scope="col">Phys.</th>
              <th scope="col">Mental</th>
              <th scope="col">Tact.</th>
            </tr>
          </thead>
          <tbody>
            {joueurs.map((j) => (
              <tr key={j.id}>
                <th scope="row" className="gauche">
                  {j.nom}
                </th>
                <td className="gauche">{STATUTS[j.statut]}</td>
                <td>{j.age}</td>
                <td>{j.poste}</td>
                <td>{taille(j.tailleCm)}</td>
                <td className="gauche">{j.pays ?? '—'}</td>
                <td className="note">{j.note}</td>
                <td>{j.familles.technique}</td>
                <td>{j.familles.physique}</td>
                <td>{j.familles.mental}</td>
                <td>{j.familles.tactique}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
