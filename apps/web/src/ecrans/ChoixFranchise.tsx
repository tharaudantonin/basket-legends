// Tranche 1 : le choix de la franchise dirigée (le joueur est son General Manager).
import { franchises, registre } from '../donnees';
import { encreSur } from '../format';

export function ChoixFranchise({ onChoisir }: { onChoisir: (id: string) => void }) {
  const triees = [...franchises].sort((a, b) => a.fictionalName.localeCompare(b.fictionalName, 'fr'));
  return (
    <>
      <header className="entete">
        <h1>Basket Legends</h1>
        <p>Choisissez la franchise que vous dirigerez en tant que General Manager — saison {registre.snapshot.season}.</p>
      </header>
      <ul className="franchises">
        {triees.map((f) => (
          <li key={f.id}>
            <button type="button" className="franchise" style={{ borderLeftColor: f.palette.primary }} onClick={() => onChoisir(f.id)}>
              <span className="monogramme" aria-hidden="true" style={{ background: f.palette.primary, color: encreSur(f.palette.primary) }}>
                {f.fictionalName.split(' ').at(-1)?.[0]}
              </span>
              <span className="nom">{f.fictionalName}</span>
              <span className="ville">{f.city}</span>
              <span className="pastilles" aria-hidden="true">
                {Object.values(f.palette).map((couleur) => (
                  <span key={couleur} className="pastille" style={{ background: couleur }} />
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
