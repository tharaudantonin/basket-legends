// Tranche 7 : la Draft du General Manager. Pendant la saison, il scoute la classe : chaque prospect est vu à travers
// les rapports de son staff (une estimation et une fourchette à 90 %), jamais selon ses vraies notes ; il répartit ses
// observations pour resserrer les fourchettes. À la fin de la saison : résultat de la loterie 3-2-1, ordre des 60 choix
// (avec les choix échangés), puis la soirée de Draft, où il choisit à chacun de ses rangs ou délègue à son staff.
// Écran fonctionnel et sobre ; la mise en forme définitive viendra avec le chantier visuel.
import { useMemo, useState } from 'react';
import {
  observationsDe,
  observationsRestantes,
  prochainChoix,
  rapport,
  rapportDuConsensus,
  type EtatSaison,
  type Estimation,
  type Prospect,
} from '@basket-legends/league';
import { fichierLoterie, modeleDraft, reglesLoterie } from '../donnees';
import { abreviationEquipe as abreviation, nomEquipe, salairesActifs } from '../vue';
import { dollars, taille } from '../format';

interface Props {
  etat: EtatSaison;
  enCours: boolean;
  /** Ajoute (ou retire) des observations du GM sur un prospect. */
  onObserver: (prospect: string, delta: number) => void;
  onDeleguer: (delegue: boolean) => void;
  /** Fait les choix jusqu'au prochain choix du GM ; avec un prospect, le GM le choisit à son rang en cours. */
  onAvancerDraft: (prospect?: string) => void;
}

const fourchette = (e: Estimation) => `${e.valeur} (${e.bas}–${e.haut})`;
const ORIGINES: Record<Prospect['origine'], string> = { universite: 'Université', international: 'International', 'g-league': 'G League' };
const CATEGORIES = Object.fromEntries(fichierLoterie.categories.map((c) => [c.id, c]));
const LIBELLES_CATEGORIES: Record<string, string> = {
  releguees: 'Trois pires bilans',
  'non-qualifiees': 'Non qualifiée',
  'play-in-9-10': 'Play-In (9e-10e)',
  'perdants-7-8': 'Play-In (perdant 7-8)',
};

type Tri = 'consensus' | 'staff';

export function EcranDraft({ etat, enCours, onObserver, onDeleguer, onAvancerDraft }: Props) {
  const draft = etat.draft;
  const [tri, setTri] = useState<Tri>('consensus');
  const M = modeleDraft.scouting;
  const pris = useMemo(() => new Map(Object.entries(draft?.selections ?? {}).map(([rang, p]) => [p, Number(rang)])), [draft?.selections]);
  const lignes = useMemo(() => {
    if (!draft) return [];
    return draft.classe
      .map((p) => ({
        p,
        consensus: rapportDuConsensus(M, etat.graine, p),
        staff: rapport(M, etat.graine, etat.franchise, p, observationsDe(M, draft.observations, p.id)),
      }))
      .sort((a, b) =>
        tri === 'consensus'
          ? b.consensus.potentiel.valeur + b.consensus.note.valeur - (a.consensus.potentiel.valeur + a.consensus.note.valeur)
          : b.staff.potentiel.valeur + b.staff.note.valeur - (a.staff.potentiel.valeur + a.staff.note.valeur),
      );
  }, [draft, etat.graine, etat.franchise, tri, M]);

  if (!draft) return <p className="aide">Pas de Draft dans cette partie (sauvegarde d’une version précédente du jeu).</p>;

  const restantes = observationsRestantes(M, draft.observations);
  const enCoursDeChoix = draft.choix ? prochainChoix(draft) : undefined;
  const aMoi = enCoursDeChoix?.detenteur === etat.franchise && !draft.delegue;
  const mesChoix = (draft.choix ?? []).filter((c) => c.detenteur === etat.franchise);
  const nomProspect = (id: string) => {
    const p = draft.classe.find((x) => x.id === id);
    return p ? `${p.prenom} ${p.nom}` : id;
  };

  return (
    <>
      <section className="carte" aria-label={`Draft ${draft.annee}`}>
        <h2>Draft {draft.annee}</h2>
        <p className="aide">
          Les notes des prospects ne sont jamais connues avec certitude : chaque valeur est l’estimation de votre staff, avec une fourchette
          à 90 %. Observer un prospect resserre la fourchette (jusqu’à {M.observationsMax} observations). Le consensus est celui de la
          presse. {draft.terminee ? '' : `Observations restantes : ${restantes} sur ${M.budgetObservations}.`}
        </p>
        {!draft.choix && <p>La loterie aura lieu à la fin de la saison ; vous pouvez scouter la classe d’ici là.</p>}
        {draft.choix && !draft.terminee && (
          <div className="commandes">
            <label className="case">
              <input type="checkbox" checked={Boolean(draft.delegue)} disabled={enCours} onChange={(e) => onDeleguer(e.target.checked)} />{' '}
              Mon staff choisit pour moi
            </label>
            {!aMoi && (
              <button type="button" className="principal" disabled={enCours} onClick={() => onAvancerDraft()}>
                {draft.delegue ? 'Lancer la Draft jusqu’au bout' : 'Avancer jusqu’à mon prochain choix'}
              </button>
            )}
            {aMoi && (
              <p role="status">
                À vous de choisir : choix n° {enCoursDeChoix!.rang}
                {enCoursDeChoix!.original !== etat.franchise && ` (choix de ${nomEquipe(enCoursDeChoix!.original)})`}. Cliquez sur « Choisir
                » dans la classe.
              </p>
            )}
            {mesChoix.length === 0 && <p className="aide">Vous n’avez aucun choix cette année.</p>}
          </div>
        )}
      </section>

      {draft.loterie && (
        <section className="carte" aria-label="Loterie">
          <h2>Loterie {draft.annee} (règle 3-2-1)</h2>
          <p className="aide">
            Seize équipes :{' '}
            {fichierLoterie.categories
              .map((c) => `${LIBELLES_CATEGORIES[c.id]!.toLowerCase()} ${c.boules} boule${c.boules > 1 ? 's' : ''}`)
              .join(', ')}
            . Les trois pires bilans ne choisissent pas après le {CATEGORIES['releguees']?.plancher}e rang. Mécanisme du tirage à recouper
            avec la table officielle.
            {draft.loterie.tiragesRefaits > 0 &&
              ` ${draft.loterie.tiragesRefaits} tirage(s) refait(s) à cause des limites de choix consécutifs.`}
          </p>
          <div className="defilement">
            <table className="tableau">
              <thead>
                <tr>
                  <th scope="col">Choix</th>
                  <th scope="col" className="gauche">
                    Équipe
                  </th>
                  <th scope="col" className="gauche">
                    Catégorie
                  </th>
                  <th scope="col">Boules</th>
                  <th scope="col">Rang au bilan</th>
                </tr>
              </thead>
              <tbody>
                {draft.loterie.ordre.map((e, i) => {
                  const p = draft.loterie!.participants.find((x) => x.equipe === e)!;
                  return (
                    <tr key={e} className={e === etat.franchise ? 'moi' : undefined}>
                      <td>{i + 1}</td>
                      <td className="gauche">{nomEquipe(e)}</td>
                      <td className="gauche">{LIBELLES_CATEGORIES[p.categorie]}</td>
                      <td>{CATEGORIES[p.categorie]?.boules}</td>
                      <td>{p.rangBilan}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="aide">
            Règles : {reglesLoterie.id}. Ensuite : {fichierLoterie.apresLaLoterie}
          </p>
        </section>
      )}

      {draft.choix && (
        <section className="carte" aria-label="Ordre des choix">
          <h2>Ordre des choix</h2>
          <div className="defilement">
            <table className="tableau">
              <thead>
                <tr>
                  <th scope="col">Rang</th>
                  <th scope="col" className="gauche">
                    Équipe
                  </th>
                  <th scope="col" className="gauche">
                    Choix d’origine
                  </th>
                  <th scope="col" className="gauche">
                    Sélection
                  </th>
                  <th scope="col">Salaire 1re saison</th>
                </tr>
              </thead>
              <tbody>
                {draft.choix.map((c) => {
                  const choisi = draft.selections[String(c.rang)];
                  const recrue = draft.recrues?.find((r) => r.rang === c.rang);
                  return (
                    <tr key={c.rang} className={c.detenteur === etat.franchise ? 'moi' : undefined}>
                      <td>
                        {c.rang}
                        {c.rang === 31 && <span className="etiquette">2e tour</span>}
                      </td>
                      <td className="gauche">{nomEquipe(c.detenteur)}</td>
                      <td className="gauche">{c.original === c.detenteur ? '—' : `via ${abreviation(c.original)}`}</td>
                      <td className="gauche">{choisi ? nomProspect(choisi) : c === enCoursDeChoix && aMoi ? 'À vous de choisir' : '—'}</td>
                      <td>{recrue?.salaires ? dollars(recrue.salaires[0]!) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {draft.recrues?.[0] && (
            <p className="aide">
              Salaires du 1er tour : échelle des rookies à 120 %, rapportée au plafond{' '}
              {draft.recrues[0].plafond.provisoire
                ? `${salairesActifs().saison} (provisoire : le plafond ${draft.annee}-${draft.annee + 1} n’est pas encore dans les données)`
                : draft.recrues[0].plafond.saison}
              . Deux saisons garanties, puis deux options de l’équipe.
            </p>
          )}
        </section>
      )}

      <section className="carte" aria-label="Classe de la Draft">
        <h2>Classe {draft.annee}</h2>
        <nav className="onglets" aria-label="Tri de la classe">
          <button type="button" aria-pressed={tri === 'consensus'} onClick={() => setTri('consensus')}>
            Consensus de la presse
          </button>
          <button type="button" aria-pressed={tri === 'staff'} onClick={() => setTri('staff')}>
            Rapports de mon staff
          </button>
        </nav>
        <div className="defilement">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col" className="gauche">
                  Prospect
                </th>
                <th scope="col">Âge</th>
                <th scope="col">Poste</th>
                <th scope="col">Taille</th>
                <th scope="col" className="gauche">
                  Origine
                </th>
                <th scope="col">Note (staff)</th>
                <th scope="col">Potentiel (staff)</th>
                <th scope="col">Potentiel (presse)</th>
                <th scope="col">Observations</th>
                <th scope="col">Draft</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(({ p, consensus, staff }, i) => {
                const rangPris = pris.get(p.id);
                const demandees = draft.observations[p.id] ?? 0;
                return (
                  <tr key={p.id} className={rangPris ? 'discret' : undefined}>
                    <td>{i + 1}</td>
                    <th scope="row" className="gauche">
                      {p.prenom} {p.nom}
                    </th>
                    <td>{p.age}</td>
                    <td>{p.poste}</td>
                    <td>{taille(p.tailleCm)}</td>
                    <td className="gauche">
                      {ORIGINES[p.origine]} · {p.pays}
                    </td>
                    <td>{fourchette(staff.note)}</td>
                    <td>{fourchette(staff.potentiel)}</td>
                    <td>{fourchette(consensus.potentiel)}</td>
                    <td>
                      <span className="boutons">
                        <button
                          type="button"
                          aria-label={`Retirer une observation de ${p.prenom} ${p.nom}`}
                          disabled={enCours || draft.terminee || demandees === 0}
                          onClick={() => onObserver(p.id, -1)}
                        >
                          −
                        </button>
                        <span>{staff.observations}</span>
                        <button
                          type="button"
                          aria-label={`Observer ${p.prenom} ${p.nom}`}
                          disabled={enCours || draft.terminee || restantes <= 0 || staff.observations >= M.observationsMax}
                          onClick={() => onObserver(p.id, 1)}
                        >
                          +
                        </button>
                      </span>
                    </td>
                    <td>
                      {rangPris ? (
                        `n° ${rangPris}`
                      ) : aMoi ? (
                        <button type="button" className="principal" disabled={enCours} onClick={() => onAvancerDraft(p.id)}>
                          Choisir
                        </button>
                      ) : (
                        '—'
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
