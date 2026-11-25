// Tranches 1 et 4 : le choix de la franchise dirigée (le joueur est son General Manager), ou la reprise de la partie
// enregistrée.
import type { Sauvegarde } from '@basket-legends/league';
import { franchiseDe, franchises, registre } from '../donnees';
import { encreSur } from '../format';

interface Props {
  onChoisir: (id: string) => void;
  sauvegarde?: Sauvegarde;
  onReprendre: () => void;
}

const PHASES = {
  intersaison: 'intersaison',
  reguliere: 'saison régulière',
  'play-in': 'Play-In',
  playoffs: 'playoffs',
  terminee: 'saison terminée',
} as const;

export function ChoixFranchise({ onChoisir, sauvegarde, onReprendre }: Props) {
  const triees = [...franchises].sort((a, b) => a.fictionalName.localeCompare(b.fictionalName, 'fr'));
  return (
    <>
      <header className="entete">
        <h1>Basket Legends</h1>
        <p>Choisissez la franchise que vous dirigerez en tant que General Manager — saison {registre.snapshot.season}.</p>
      </header>
      {sauvegarde && (
        <section className="carte" aria-labelledby="titre-reprendre">
          <h2 id="titre-reprendre">Partie en cours</h2>
          <p>
            {franchiseDe(sauvegarde.etat.franchise).fictionalName} · saison {sauvegarde.etat.saison.replace('-', '–')} ·{' '}
            {PHASES[sauvegarde.etat.phase]} · {sauvegarde.etat.matchs.filter((m) => m.nature === 'reguliere').length} matchs joués dans la
            ligue · enregistrée le {new Date(sauvegarde.modifieLe).toLocaleString('fr-FR')}
          </p>
          <button type="button" className="principal" onClick={onReprendre}>
            Reprendre la partie
          </button>
        </section>
      )}
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
