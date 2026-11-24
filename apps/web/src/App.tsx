// Tranche 0 : écran témoin qui prouve que l'application lit et valide les données de référence.
// Le choix de franchise jouable arrive à la tranche 1.
import { schemaRegistre } from '@basket-legends/data';
import registreBrut from '../../../data/franchises.json';

const registre = schemaRegistre.parse(registreBrut);

export function App() {
  return (
    <main className="page">
      <header>
        <h1>Basket Legends</h1>
        <p>Les 30 franchises de la ligue (saison {registre.snapshot.season}).</p>
      </header>
      <ul className="franchises">
        {registre.franchises.map((f) => (
          <li key={f.id} className="franchise">
            <span className="pastilles" aria-hidden="true">
              {Object.values(f.palette).map((couleur) => (
                <span key={couleur} className="pastille" style={{ background: couleur }} />
              ))}
            </span>
            <span className="nom">{f.fictionalName}</span>
            <span className="ville">{f.city}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
