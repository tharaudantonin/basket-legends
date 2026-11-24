// Tranche 6 : la masse salariale. Pour sa franchise : contrats, repères de la CBA (plafond, taxe, aprons), exceptions,
// taxe estimée et un contrôle de signature ; pour la ligue : la situation des 30 équipes. Mise en forme sobre : le rendu
// définitif viendra avec le chantier visuel.
import { useMemo, useState } from 'react';
import {
  LIBELLES_MOYEN,
  LIBELLES_NIVEAU,
  controlerEquipe,
  salaireMinimum,
  saisonCourte,
  situationEquipe,
  verifierSignature,
  type ContratJoueur,
  type DemandeSignature,
  type MoyenDeSignature,
} from '@basket-legends/league';
import { effectifs, fichierCba, salaires } from '../donnees';
import { dollars } from '../format';

const joueursDe = (equipe: string): string[] => effectifs.get(equipe)?.players.map((p) => p.id) ?? [];
const nomDe = (equipe: string): string => effectifs.get(equipe)?.franchise.fictionalName ?? equipe;

export const LIBELLES_TYPE: Record<ContratJoueur['type'], string> = {
  standard: 'Standard',
  'two-way': 'Two-way',
  'non-releve': 'Non relevé',
};

/** Les saisons couvertes par au moins un contrat de la liste, dans l'ordre. */
function saisonsDe(contrats: (ContratJoueur | undefined)[]): string[] {
  return [...new Set(contrats.flatMap((c) => c?.salaires.map((s) => s.saison) ?? []))].sort();
}

/** Un salaire et son option éventuelle (J : option du joueur ; E : option de l'équipe). */
export function Salaire({ c, saison }: { c: ContratJoueur | undefined; saison: string }) {
  const s = c?.salaires.find((x) => x.saison === saison);
  if (!s) return <>–</>;
  return (
    <>
      {dollars(s.montant)}
      {s.option && (
        <abbr className="etiquette" title={s.option === 'joueur' ? 'Option du joueur' : "Option de l'équipe"}>
          {s.option === 'joueur' ? 'J' : 'E'}
        </abbr>
      )}
    </>
  );
}

interface Props {
  franchise: string;
  onFiche: (joueur: string) => void;
}

export function MasseSalariale({ franchise, onFiche }: Props) {
  const P = salaires.cba;
  const saison = saisonCourte(salaires.saison);
  const situations = useMemo(
    () => [...effectifs.keys()].map((e) => situationEquipe(salaires, e, joueursDe(e))).sort((a, b) => b.masse - a.masse),
    [],
  );
  const s = situations.find((x) => x.equipe === franchise)!;
  const controle = controlerEquipe(salaires, s);
  const joueurs = effectifs.get(franchise)!.players;
  const contrats = joueurs
    .map((j) => ({ j, c: salaires.contrats[j.id] }))
    .sort(
      (a, b) =>
        (b.c?.salaires.find((x) => x.saison === saison)?.montant ?? 0) - (a.c?.salaires.find((x) => x.saison === saison)?.montant ?? 0),
    );
  const saisons = saisonsDe(contrats.map((x) => x.c)).slice(0, 5);
  const reperes: [string, number, string][] = [
    ['Masse minimale', P.masseMinimale, fichierCba.parametres.masseMinimale.definition],
    ['Plafond salarial', P.plafondSalarial, fichierCba.parametres.plafondSalarial.definition],
    ['Seuil de taxe', P.seuilTaxe, fichierCba.parametres.seuilTaxe.definition],
    ['Premier apron', P.premierApron, fichierCba.parametres.premierApron.definition],
    ['Second apron', P.deuxiemeApron, fichierCba.parametres.deuxiemeApron.definition],
  ];

  // Contrôle d'une signature (pédagogique : il n'y a pas encore de joueurs libres à signer).
  const [demande, setDemande] = useState<DemandeSignature>({
    type: 'standard',
    salaire: salaireMinimum(P, 3),
    anciennete: 3,
    moyen: 'minimum',
    duree: 1,
  });
  const verdict = verifierSignature(salaires, s, demande);
  const modifier = (d: Partial<DemandeSignature>) => setDemande((x) => ({ ...x, ...d }));

  return (
    <>
      <section className="carte" aria-labelledby="titre-masse">
        <h2 id="titre-masse">Masse salariale {saison}</h2>
        <p role="status" data-testid="situation-salariale">
          {dollars(s.masse)} · {LIBELLES_NIVEAU[s.niveau]}
          {s.espace > 0 ? ` · espace ${dollars(s.espace)}` : ''}
          {s.taxe > 0 ? ` · taxe de luxe estimée ${dollars(s.taxe)}${s.recidiviste ? ' (récidiviste)' : ''}` : ''}
          {s.plafondStrict ? ` · plafond strict au ${s.plafondStrict === 'premier' ? 'premier' : 'second'} apron` : ''}
        </p>
        <p className="aide">
          {s.effectif.standard} contrats standard sur {P.contratsStandardMax}, {s.effectif.twoWay} two-way sur {P.contratsTwoWayMax}
          {s.effectif.nonReleve ? `, ${s.effectif.nonReleve} joueur(s) sans contrat relevé` : ''}. La taxe se paie sur la masse de fin de
          saison régulière.
        </p>
        {[...controle.erreurs, ...controle.avertissements].map((m) => (
          <p key={m} className="avertissement">
            {m}
          </p>
        ))}
        <table className="tableau">
          <caption className="gauche">Repères de la CBA</caption>
          <thead>
            <tr>
              <th scope="col" className="gauche">
                Repère
              </th>
              <th scope="col">Montant</th>
              <th scope="col">Marge</th>
            </tr>
          </thead>
          <tbody>
            {reperes.map(([libelle, montant, definition]) => (
              <tr key={libelle}>
                <th scope="row" className="gauche" title={definition}>
                  {libelle}
                </th>
                <td>{dollars(montant)}</td>
                <td>{dollars(montant - s.masse, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="carte" aria-labelledby="titre-contrats">
        <h2 id="titre-contrats">Contrats</h2>
        <div className="defilement">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col" className="gauche">
                  Joueur
                </th>
                <th scope="col">Contrat</th>
                <th scope="col" title="Saisons depuis la première saison NBA">
                  Anc.
                </th>
                {saisons.map((x) => (
                  <th key={x} scope="col">
                    {x}
                  </th>
                ))}
                <th scope="col">Garanti</th>
              </tr>
            </thead>
            <tbody>
              {contrats.map(({ j, c }) => (
                <tr key={j.id}>
                  <th scope="row" className="gauche">
                    <button type="button" className="lien" onClick={() => onFiche(j.id)}>
                      {j.fictionalDisplayName}
                    </button>
                  </th>
                  <td>{c ? LIBELLES_TYPE[c.type] : '–'}</td>
                  <td>{c?.anciennete ?? '–'}</td>
                  {saisons.map((x) => (
                    <td key={x}>
                      {c?.type === 'two-way' && x === saison ? dollars(P.salaireTwoWay) + ' *' : <Salaire c={c} saison={x} />}
                    </td>
                  ))}
                  <td>{c?.garanti ? dollars(c.garanti) : '–'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="gauche" colSpan={3}>
                  Autres charges (joueurs libérés, montants imputés)
                </th>
                <td>{dollars(s.autresCharges)}</td>
                <td colSpan={saisons.length}></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="aide">
          J : option du joueur ; E : option de l'équipe. * Salaire two-way, hors masse salariale. Source : Basketball-Reference, Hoops
          Rumors et SalarySwish, relevés le 24/11/2026.
        </p>
      </section>

      <section className="carte" aria-labelledby="titre-exceptions">
        <h2 id="titre-exceptions">Moyens de signer</h2>
        <ul>
          {s.exceptions.map((e) => (
            <li key={e.moyen}>
              {LIBELLES_MOYEN[e.moyen]} : {e.moyen === 'minimum' ? 'selon l’ancienneté du joueur' : `jusqu'à ${dollars(e.montantMax)}`}
              {e.declenche ? ` (plafond strict au ${e.declenche === 'premier' ? 'premier' : 'second'} apron)` : ''}
            </li>
          ))}
        </ul>
        <p className="aide">Droits selon la masse actuelle ; l'usage déjà fait des exceptions en 2026-27 n'est pas relevé.</p>

        <form className="formulaire-match" aria-label="Contrôler une signature" onSubmit={(e) => e.preventDefault()}>
          <label>
            Contrat
            <select value={demande.type} onChange={(e) => modifier({ type: e.target.value as DemandeSignature['type'] })}>
              <option value="standard">Standard</option>
              <option value="two-way">Two-way</option>
            </select>
          </label>
          <label>
            Moyen
            <select value={demande.moyen} onChange={(e) => modifier({ moyen: e.target.value as MoyenDeSignature })}>
              {Object.entries(LIBELLES_MOYEN).map(([m, l]) => (
                <option key={m} value={m}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Salaire (dollars)
            <input
              type="number"
              min={0}
              step={1000}
              value={demande.salaire}
              onChange={(e) => modifier({ salaire: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <label>
            Ancienneté
            <input
              type="number"
              min={0}
              max={25}
              value={demande.anciennete}
              onChange={(e) => modifier({ anciennete: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <label>
            Durée (saisons)
            <input
              type="number"
              min={1}
              max={5}
              value={demande.duree}
              onChange={(e) => modifier({ duree: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </label>
        </form>
        <p role="status" data-testid="verdict-signature" className={verdict.autorise ? undefined : 'avertissement'}>
          {verdict.autorise
            ? `Signature possible : ${dollars(verdict.impute)} imputés, masse portée à ${dollars(verdict.masseApres)}.`
            : `Signature impossible. ${verdict.motifs.join(' ')}`}
        </p>
      </section>

      <section className="carte" aria-labelledby="titre-ligue-salaires">
        <h2 id="titre-ligue-salaires">Masses salariales de la ligue</h2>
        <div className="defilement">
          <table className="tableau" aria-label="Masses salariales des 30 équipes">
            <thead>
              <tr>
                <th scope="col" className="gauche">
                  Équipe
                </th>
                <th scope="col">Masse</th>
                <th scope="col">Espace</th>
                <th scope="col" className="gauche">
                  Niveau
                </th>
                <th scope="col">Taxe estimée</th>
                <th scope="col">Plafond strict</th>
              </tr>
            </thead>
            <tbody>
              {situations.map((x) => (
                <tr key={x.equipe} className={x.equipe === franchise ? 'fin-cinq' : undefined}>
                  <th scope="row" className="gauche">
                    {nomDe(x.equipe)}
                  </th>
                  <td>{dollars(x.masse)}</td>
                  <td>{x.espace > 0 ? dollars(x.espace) : '–'}</td>
                  <td className="gauche">{LIBELLES_NIVEAU[x.niveau]}</td>
                  <td>
                    {x.taxe ? dollars(x.taxe) : '–'}
                    {x.recidiviste && x.taxe ? ' (R)' : ''}
                  </td>
                  <td>{x.plafondStrict === 'premier' ? '1er apron' : x.plafondStrict === 'deuxieme' ? '2e apron' : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="aide">(R) : barème récidiviste. Masses et plafonds stricts publiés par SalarySwish au 24/11/2026.</p>
      </section>
    </>
  );
}
