// Tranches 1, 3 et 5 : l'effectif de la franchise (dans l'ordre du staff : cinq de départ, puis rotation) et le lancement
// d'un match, rapide, commenté ou interactif. Un clic sur un joueur ouvre sa fiche.
import { useMemo, useState } from 'react';
import { nouvelleGraine } from '@basket-legends/engine';
import { salaireDeLaSaison } from '@basket-legends/league';
import { effectifDe, equipeDe, franchiseDe, franchises, salaires } from '../donnees';
import { dollars, encreSur, taille } from '../format';

export interface DemandeMatch {
  adversaire: string;
  aDomicile: boolean;
  graine: number;
  /** Présentation : le même match, montré d'un coup, raconté possession par possession, ou dirigé par le coach. */
  mode: 'rapide' | 'commente' | 'interactif';
}

const POSTES: Record<string, string> = {
  G: 'Arrière',
  F: 'Ailier',
  C: 'Pivot',
  'G-F': 'Arrière-ailier',
  'F-G': 'Ailier-arrière',
  'F-C': 'Ailier-pivot',
  'C-F': 'Pivot-ailier',
};

interface Props {
  franchise: string;
  derniere?: DemandeMatch;
  enCours: boolean;
  onRetour: () => void;
  onJouer: (d: DemandeMatch) => void;
  onFiche: (joueur: string) => void;
  onSaison: () => void;
}

export function EcranEffectif({ franchise, derniere, enCours, onRetour, onJouer, onFiche, onSaison }: Props) {
  const f = franchiseDe(franchise);
  const effectif = effectifDe(franchise);
  const equipe = useMemo(() => equipeDe(franchise), [franchise]);
  const parId = new Map(effectif.players.map((j) => [j.id, j]));
  const adversaires = franchises.filter((x) => x.id !== franchise).sort((a, b) => a.fictionalName.localeCompare(b.fictionalName, 'fr'));

  const [adversaire, setAdversaire] = useState(derniere?.adversaire ?? adversaires[0]?.id ?? '');
  const [aDomicile, setADomicile] = useState(derniere?.aDomicile ?? true);
  const [graine, setGraine] = useState(() => derniere?.graine ?? nouvelleGraine(Date.now()));

  return (
    <>
      <header
        className="bandeau"
        style={{ background: f.palette.primary, color: encreSur(f.palette.primary), borderBottomColor: f.palette.accent }}
      >
        <button type="button" className="retour" onClick={onRetour}>
          ← Changer de franchise
        </button>
        <h1>{f.fictionalName}</h1>
        <p>
          Effectif {effectif.snapshot.season} · {effectif.players.length} joueurs
        </p>
      </header>

      <section className="carte" aria-labelledby="titre-carriere">
        <h2 id="titre-carriere">Carrière</h2>
        <p>
          Dirigez {f.fictionalName} pendant la saison {effectif.snapshot.season} : 82 matchs, All-Star Game, Play-In, playoffs et palmarès.
        </p>
        <button type="button" className="principal" disabled={enCours} onClick={onSaison}>
          Commencer la saison
        </button>
      </section>

      <section className="carte" aria-labelledby="titre-match">
        <h2 id="titre-match">Match</h2>
        <form
          className="formulaire-match"
          onSubmit={(e) => {
            e.preventDefault();
            const bouton = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            const mode = bouton?.value === 'commente' ? 'commente' : bouton?.value === 'interactif' ? 'interactif' : 'rapide';
            onJouer({ adversaire, aDomicile, graine, mode });
          }}
        >
          <label>
            Adversaire
            <select value={adversaire} onChange={(e) => setAdversaire(e.target.value)}>
              {adversaires.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.fictionalName}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Lieu</legend>
            <label>
              <input type="radio" name="lieu" checked={aDomicile} onChange={() => setADomicile(true)} /> À domicile
            </label>
            <label>
              <input type="radio" name="lieu" checked={!aDomicile} onChange={() => setADomicile(false)} /> À l'extérieur
            </label>
          </fieldset>
          <label>
            Graine
            <span className="graine">
              <input
                type="number"
                min={0}
                max={4294967295}
                value={graine}
                onChange={(e) => setGraine(Math.max(0, Math.min(4294967295, Math.floor(Number(e.target.value) || 0))))}
              />
              <button type="button" onClick={() => setGraine(nouvelleGraine(Date.now()))}>
                Nouvelle
              </button>
            </span>
          </label>
          <span className="boutons">
            <button type="submit" name="mode" value="rapide" className="principal" disabled={enCours}>
              {enCours ? 'Simulation…' : 'Jouer le match'}
            </button>
            <button type="submit" name="mode" value="commente" disabled={enCours}>
              Match commenté
            </button>
            <button type="submit" name="mode" value="interactif" disabled={enCours}>
              Match interactif
            </button>
          </span>
        </form>
        <p className="aide">
          Même graine, mêmes équipes, même lieu : même match, au point près — en rapide comme en commenté. En interactif, le match change
          selon vos décisions ; sans décision, c’est le même match.
        </p>
      </section>

      <section className="carte" aria-labelledby="titre-effectif">
        <h2 id="titre-effectif">Effectif</h2>
        <p className="avertissement">
          Notes du modèle v1, calculées sur les statistiques 2025-26. Une note suivie d'un astérisque est estimée sans statistique NBA
          (recrue ou joueur sans match). Noms fictifs proposés, à relire. Cinq de départ et rotation choisis par le staff.
        </p>
        <div className="defilement">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col">Rôle</th>
                <th scope="col">N°</th>
                <th scope="col" className="gauche">
                  Joueur
                </th>
                <th scope="col" className="gauche">
                  Poste
                </th>
                <th scope="col">Taille</th>
                <th scope="col">Poids</th>
                <th scope="col">Note</th>
                <th scope="col" title="Technique">
                  TEC
                </th>
                <th scope="col" title="Physique">
                  PHY
                </th>
                <th scope="col" title="Mental">
                  MEN
                </th>
                <th scope="col" title="Tactique">
                  TAC
                </th>
                <th scope="col">Salaire 2026-27</th>
              </tr>
            </thead>
            <tbody>
              {equipe.joueurs.map((jm, i) => {
                const j = parId.get(jm.id);
                if (!j) return null;
                return (
                  <tr key={j.id} className={i === 4 ? 'fin-cinq' : undefined}>
                    <td>{i < 5 ? 'Titulaire' : i < 10 ? 'Rotation' : 'Banc'}</td>
                    <td>{j.jerseyNumber}</td>
                    <th scope="row" className="gauche">
                      <button type="button" className="lien" onClick={() => onFiche(j.id)}>
                        {j.fictionalDisplayName}
                      </button>
                    </th>
                    <td className="gauche">{POSTES[j.sourcePosition] ?? j.sourcePosition}</td>
                    <td>{taille(j.measurements.height.heightCm)}</td>
                    <td>{j.measurements.weight.weightKg} kg</td>
                    <td className="note" title={String(j.ratings.calculation ?? '')}>
                      {j.ratings.overall}
                      {j.ratings.status === 'a-priori' && <span aria-label=" (estimée sans statistique)">*</span>}
                    </td>
                    <td>{j.attributes.technique}</td>
                    <td>{j.attributes.physical}</td>
                    <td>{j.attributes.mental}</td>
                    <td>{j.attributes.tactical}</td>
                    <td>
                      {salaires.contrats[j.id]?.type === 'two-way' ? (
                        <span className="etiquette">two-way</span>
                      ) : salaires.contrats[j.id]?.type === 'standard' ? (
                        dollars(salaireDeLaSaison(salaires.contrats[j.id], '2026-27'))
                      ) : (
                        '–'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
