// Tranche 3 : le mode commenté. Le match est déjà simulé (même résultat qu'en mode rapide) : l'écran déroule son
// commentaire possession par possession, avec le score, le chronomètre et les statistiques d'équipe en direct.
// Le rythme d'affichage dépend de l'écran seulement ; il ne touche jamais au match.
import { useEffect, useMemo, useState } from 'react';
import { boxScoreAuMoment, chrono, commenterMatch, nomDePeriode, type EquipeDuMatch, type ResultatMatch } from '@basket-legends/engine';
import { paletteDe, regles } from '../donnees';
import { encreSur, pourcentage } from '../format';

interface Props {
  resultat: ResultatMatch;
  onBoxScore: () => void;
  onRetour: () => void;
}

const VITESSES = [
  { libelle: '×1', delai: 900 },
  { libelle: '×4', delai: 220 },
  { libelle: '×16', delai: 55 },
] as const;

export function EcranCommente({ resultat, onBoxScore, onRetour }: Props) {
  const N = regles.periodesReglementaires;
  const lignes = useMemo(() => commenterMatch(resultat, N), [resultat, N]);
  // Les équipes telles qu'elles ont joué (absents exclus) : le box score les liste dans le même ordre.
  const equipes = useMemo(
    () => resultat.boxScore.equipes.map((e) => ({ id: e.id, nom: e.nom, joueurs: e.joueurs })) as unknown as [EquipeDuMatch, EquipeDuMatch],
    [resultat],
  );
  const [position, setPosition] = useState(0);
  const [enLecture, setEnLecture] = useState(true);
  const [vitesse, setVitesse] = useState(1);
  const [sansChangements, setSansChangements] = useState(true);
  const fini = position >= lignes.length - 1;

  useEffect(() => {
    if (!enLecture || fini) return;
    const minuterie = setTimeout(() => setPosition((p) => Math.min(lignes.length - 1, p + 1)), VITESSES[vitesse]!.delai);
    return () => clearTimeout(minuterie);
  }, [enLecture, fini, position, vitesse, lignes.length]);

  const courante = lignes[position]!;
  const direct = useMemo(() => boxScoreAuMoment(resultat.evenements, equipes, courante.indice, N), [resultat, equipes, courante.indice, N]);
  const visibles = lignes
    .slice(0, position + 1)
    .filter((l) => !sansChangements || l.genre !== 'changement')
    .reverse();

  return (
    <>
      <header className="tableau-score direct" aria-label="Tableau d'affichage">
        {direct.equipes.map((e) => {
          const f = { palette: paletteDe(e.id) };
          return (
            <div key={e.id} className="camp" style={{ background: f.palette.primary, color: encreSur(f.palette.primary) }}>
              <span className="camp-nom">{e.nom}</span>
              <span className="camp-points" data-testid={`score-${e.id}`}>
                {e.points}
              </span>
            </div>
          );
        })}
        <p className="chrono" role="status">
          {fini ? 'Terminé' : `${nomDePeriode(courante.periode, N)} · ${chrono(courante.restant)}`}
        </p>
      </header>

      <section className="carte commandes" aria-label="Lecture du match">
        <button type="button" onClick={() => setEnLecture((x) => !x)} disabled={fini}>
          {enLecture && !fini ? 'Pause' : 'Lecture'}
        </button>
        <span className="boutons" role="group" aria-label="Vitesse">
          {VITESSES.map((v, i) => (
            <button key={v.libelle} type="button" aria-pressed={vitesse === i} onClick={() => setVitesse(i)}>
              {v.libelle}
            </button>
          ))}
        </span>
        <button type="button" onClick={() => setPosition(lignes.length - 1)} disabled={fini}>
          Aller à la fin
        </button>
        <label className="case">
          <input type="checkbox" checked={sansChangements} onChange={(e) => setSansChangements(e.target.checked)} /> Masquer les changements
        </label>
        {fini && (
          <button type="button" className="principal" onClick={onBoxScore}>
            Voir le box score
          </button>
        )}
        <button type="button" onClick={onRetour}>
          Retour à l'effectif
        </button>
      </section>

      <div className="commente">
        <section className="carte" aria-label="Commentaire">
          <ol className="fil" aria-live="polite">
            {visibles.map((l) => (
              <li key={l.indice} className={l.important ? 'important' : undefined}>
                <span className="fil-temps">
                  {l.periode > N ? `P${l.periode - N}` : `Q${l.periode}`} {chrono(l.restant)}
                </span>
                <span className="fil-score">
                  {l.score[0]}-{l.score[1]}
                </span>
                <span className="fil-texte">{l.texte}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="carte" aria-label="Statistiques en direct">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col" className="gauche">
                  En direct
                </th>
                {direct.equipes.map((e) => (
                  <th key={e.id} scope="col">
                    {e.nom.split(' ').at(-1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Tirs', (t) => `${t.tirsReussis}-${t.tirsTentes} (${pourcentage(t.tirsReussis, t.tirsTentes)})`],
                  ['3 pts', (t) => `${t.troisReussis}-${t.troisTentes}`],
                  ['Lancers', (t) => `${t.lancersReussis}-${t.lancersTentes}`],
                  ['Rebonds', (t) => String(t.rebonds)],
                  ['Passes', (t) => String(t.passes)],
                  ['Pertes', (t) => String(t.pertes)],
                  ['Fautes', (t) => String(t.fautes)],
                ] as const satisfies readonly (readonly [string, (t: (typeof direct.equipes)[0]['totaux']) => string])[]
              ).map(([libelle, f]) => (
                <tr key={libelle}>
                  <th scope="row" className="gauche">
                    {libelle}
                  </th>
                  {direct.equipes.map((e) => (
                    <td key={e.id}>{f(e.totaux)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
