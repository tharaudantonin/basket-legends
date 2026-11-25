// Tranche 9 : le marché du GM — bureau (propositions, alignements, recommandations du staff), agents libres (free
// agency de l'intersaison et joueurs libres en saison), échanges (vérification selon la CBA, avis de l'IA avec ses
// raisons, « Qu'est-ce qu'il vous faudrait ? »), staff et délégations, composition (cinq de départ et rotation), journal
// des transactions. Écrans fonctionnels et sobres (réponse 20) : la mise en forme viendra avec le chantier visuel.
import { useState } from 'react';
import {
  anneesEchangeables,
  cbaDeLUnivers,
  dateDeLaSaison,
  demandeCourante,
  droitsSurLesChoix,
  noteDuStaff,
  personnalite,
  saisonCourte,
  salaireDeLaSaison,
  type Actif,
  type ActionDuGm,
  type Delegations,
  type DomaineDelegation,
  type EtatSaison,
  type MoyenOffre,
  type NiveauDelegation,
  type PropositionEchange,
  type ReponseDuGm,
} from '@basket-legends/league';
import { donneesMarche, salaires } from '../donnees';
import { dollars } from '../format';
import { equipesActives, nomEquipe, nomJoueur, universActif } from '../vue';

export type Agir = (action: ActionDuGm) => Promise<ReponseDuGm | undefined>;

interface Props {
  etat: EtatSaison;
  enCours: boolean;
  onAction: Agir;
  onFiche: (joueur: string) => void;
}

const M = donneesMarche.modele;
const P0 = salaires.cba;
const dateFr = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Message de retour d'une action (succès, refus, réaction d'agent). */
function Retour({ texte }: { texte?: string }) {
  return texte ? (
    <p className="aide" role="status">
      {texte}
    </p>
  ) : null;
}

// --- Bureau. ---

export function Bureau({ etat, enCours, onAction }: Props) {
  const [retour, setRetour] = useState<string>();
  const messages = [...(etat.bureau ?? [])].reverse();
  return (
    <section className="carte" aria-label="Bureau">
      <h2>Bureau</h2>
      <p className="aide">Propositions des autres GM, feuilles d’offre sur vos agents libres restreints, recommandations de votre staff.</p>
      <Retour texte={retour} />
      {!messages.length && <p>Aucun message pour l’instant.</p>}
      <ul className="liste-actualites">
        {messages.map((m) => (
          <li key={m.id}>
            <p>
              <strong>{m.titre}</strong> · {dateFr(m.date)}
              {m.statut && m.statut !== 'ouvert' && (
                <span className="etiquette">{{ accepte: 'accepté', refuse: 'refusé', expire: 'expiré' }[m.statut]}</span>
              )}
            </p>
            <p>{m.texte}</p>
            {m.statut === 'ouvert' && m.action && (
              <p>
                <button
                  type="button"
                  className="principal"
                  disabled={enCours}
                  onClick={async () => setRetour((await onAction({ genre: 'bureau', id: m.id, accepter: true }))?.message)}
                >
                  {m.action.type === 'alignement' ? 'S’aligner' : 'Accepter'}
                </button>{' '}
                <button
                  type="button"
                  disabled={enCours}
                  onClick={async () => setRetour((await onAction({ genre: 'bureau', id: m.id, accepter: false }))?.message)}
                >
                  {m.action.type === 'alignement' ? 'Laisser partir' : 'Refuser'}
                </button>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- Agents libres. ---

const MOYENS: [MoyenOffre, string][] = [
  ['bird', 'Droits de Bird'],
  ['early-bird', 'Droits Early Bird'],
  ['non-bird', 'Droits Non-Bird'],
  ['espace', 'Espace salarial'],
  ['mid-level', 'Mid-level (non contribuable)'],
  ['mid-level-contribuable', 'Mid-level contribuable'],
  ['mid-level-espace', 'Mid-level (équipe sous le plafond)'],
  ['biannuelle', 'Exception bi-annuelle'],
  ['minimum', 'Salaire minimum'],
];

function FormulaireOffre({ etat, joueur, enCours, onAction, defaut }: { joueur: string; defaut: number } & Props) {
  const a = etat.intersaison?.agents[joueur];
  const [salaire, setSalaire] = useState(Math.round(defaut / 1e5) / 10);
  const [duree, setDuree] = useState(a?.duree ?? 2);
  const [hausse, setHausse] = useState(5);
  const [moyen, setMoyen] = useState<MoyenOffre>(a?.ancienne === etat.franchise && a.droits ? a.droits : 'espace');
  const [retour, setRetour] = useState<string>();
  const offre = { joueur, equipe: etat.franchise, salaire: Math.round(salaire * 1e6), duree, hausse: hausse / 100, moyen };
  return (
    <div className="formulaire-offre">
      <label>
        Salaire (M$) <input type="number" min={0} step={0.1} value={salaire} onChange={(e) => setSalaire(Number(e.target.value))} />
      </label>{' '}
      <label>
        Saisons <input type="number" min={1} max={5} value={duree} onChange={(e) => setDuree(Number(e.target.value))} />
      </label>{' '}
      <label>
        Hausse (%) <input type="number" min={0} max={8} value={hausse} onChange={(e) => setHausse(Number(e.target.value))} />
      </label>{' '}
      <label>
        Moyen{' '}
        <select value={moyen} onChange={(e) => setMoyen(e.target.value as MoyenOffre)}>
          {MOYENS.map(([m, l]) => (
            <option key={m} value={m}>
              {l}
            </option>
          ))}
        </select>
      </label>{' '}
      <button
        type="button"
        className="principal"
        disabled={enCours}
        onClick={async () => setRetour((await onAction({ genre: 'offre', offre }))?.agent?.texte)}
      >
        Faire l’offre
      </button>
      <Retour texte={retour} />
    </div>
  );
}

export function AgentsLibres(props: Props) {
  const { etat, enCours, onAction, onFiche } = props;
  const [ouvert, setOuvert] = useState<string>();
  const [retour, setRetour] = useState<string>();
  const I = etat.intersaison;
  const u = universActif();
  const Sc = saisonCourte(u.saison);
  if (!I || etat.phase !== 'intersaison') return <JoueursLibres {...props} />;
  const journee = I.journee;
  const agents = Object.values(I.agents)
    .filter((a) => u.joueurs[a.joueur])
    .sort((a, b) => u.joueurs[b.joueur]!.note - u.joueurs[a.joueur]!.note);
  const miens = agents.filter((a) => a.ancienne === etat.franchise);
  const mesOffres = I.offres.filter((o) => o.equipe === etat.franchise);
  return (
    <section className="carte" aria-label="Free agency">
      <h2>
        Free agency · journée {journee} sur {I.journees}
      </h2>
      <p className="aide">
        Faites vos offres ; à la fin de chaque journée, chaque agent libre choisit la meilleure selon sa personnalité (argent, victoire,
        rôle, fidélité — traits générés, pas relevés), si elle atteint sa demande, qui baisse au fil des journées. Un agent libre restreint
        qui signe ailleurs vous laisse deux jours pour vous aligner (bureau).
      </p>
      <p>
        <button
          type="button"
          className="principal"
          disabled={enCours || !!I.terminee}
          onClick={async () => setRetour((await onAction({ genre: 'journee' }))?.message ?? `Journée ${journee + 1} jouée.`)}
        >
          Journée suivante
        </button>{' '}
        <button
          type="button"
          disabled={enCours || !!I.terminee}
          onClick={async () => setRetour((await onAction({ genre: 'terminer-intersaison' }))?.message)}
        >
          Terminer la free agency (camp, début de saison)
        </button>
      </p>
      <Retour texte={retour} />
      {miens.length > 0 && (
        <>
          <h3>Vos agents libres</h3>
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col" className="gauche">
                  Joueur
                </th>
                <th scope="col">Note</th>
                <th scope="col">Âge</th>
                <th scope="col">Droits</th>
                <th scope="col">Demande</th>
                <th scope="col" className="gauche">
                  Décisions (journée 0)
                </th>
              </tr>
            </thead>
            <tbody>
              {miens.map((a) => {
                const renonce = I.renonces[etat.franchise]?.includes(a.joueur) ?? false;
                return (
                  <tr key={a.joueur}>
                    <th scope="row" className="gauche">
                      <button type="button" className="lien" onClick={() => onFiche(a.joueur)}>
                        {nomJoueur(a.joueur)}
                      </button>
                    </th>
                    <td className="note">{u.joueurs[a.joueur]!.note}</td>
                    <td>{u.joueurs[a.joueur]!.age}</td>
                    <td>
                      {a.droits ?? '—'}
                      {a.restreint && ` · restreint (offre qualificative ${dollars(a.offreQualificative ?? 0)})`}
                    </td>
                    <td>{dollars(demandeCourante(M, a, journee + 1))}</td>
                    <td className="gauche">
                      <label>
                        <input
                          type="checkbox"
                          disabled={enCours || journee > 0}
                          checked={renonce}
                          onChange={(e) => void onAction({ genre: 'renoncer', joueur: a.joueur, renoncer: e.target.checked })}
                        />{' '}
                        Renoncer aux droits
                      </label>{' '}
                      <label>
                        <input
                          type="checkbox"
                          disabled={enCours || journee > 0}
                          checked={a.restreint}
                          onChange={(e) => void onAction({ genre: 'qualificative', joueur: a.joueur, tendre: e.target.checked })}
                        />{' '}
                        Offre qualificative
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      {mesOffres.length > 0 && (
        <>
          <h3>Vos offres de la journée</h3>
          <ul>
            {mesOffres.map((o) => (
              <li key={o.joueur}>
                {nomJoueur(o.joueur)} : {o.duree} saison(s), {dollars(o.salaire)} ({o.moyen}){' '}
                <button type="button" disabled={enCours} onClick={() => void onAction({ genre: 'retirer-offre', joueur: o.joueur })}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>Agents libres ({agents.length})</h3>
      <div className="defilement">
        <table className="tableau">
          <thead>
            <tr>
              <th scope="col" className="gauche">
                Joueur
              </th>
              <th scope="col">Poste</th>
              <th scope="col">Âge</th>
              <th scope="col">Note</th>
              <th scope="col">Demande du jour</th>
              <th scope="col">Saisons</th>
              <th scope="col" className="gauche">
                Quitte
              </th>
              <th scope="col" className="gauche">
                Personnalité (générée)
              </th>
              <th scope="col">Offre</th>
            </tr>
          </thead>
          <tbody>
            {agents.slice(0, 120).map((a) => {
              const j = u.joueurs[a.joueur]!;
              const p = personnalite(M, a.joueur, etat.graine);
              const d = demandeCourante(M, a, journee + 1);
              return [
                <tr key={a.joueur}>
                  <th scope="row" className="gauche">
                    <button type="button" className="lien" onClick={() => onFiche(a.joueur)}>
                      {j.nom}
                    </button>
                  </th>
                  <td>{j.poste}</td>
                  <td>{j.age}</td>
                  <td className="note">{j.note}</td>
                  <td>{dollars(d)}</td>
                  <td>{a.duree}</td>
                  <td className="gauche">
                    {a.ancienne ? nomEquipe(a.ancienne) : '—'}
                    {a.restreint ? ' (restreint)' : ''}
                  </td>
                  <td className="gauche">
                    argent {p.argent} · victoire {p.victoire} · rôle {p.role} · fidélité {p.fidelite}
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={enCours || !!I.terminee}
                      onClick={() => setOuvert(ouvert === a.joueur ? undefined : a.joueur)}
                    >
                      {ouvert === a.joueur ? 'Fermer' : 'Offre…'}
                    </button>
                  </td>
                </tr>,
                ouvert === a.joueur && (
                  <tr key={`${a.joueur}-offre`}>
                    <td colSpan={9} className="gauche">
                      <FormulaireOffre {...props} joueur={a.joueur} defaut={d} />
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      {I.signatures.length > 0 && (
        <>
          <h3>Signatures</h3>
          <ul>
            {[...I.signatures]
              .reverse()
              .slice(0, 40)
              .map((s) => (
                <li key={`${s.joueur}-${s.equipe}`}>
                  J{s.journee} · {nomJoueur(s.joueur)} → {nomEquipe(s.equipe)} : {s.duree} saison(s), {dollars(s.salaire)}
                </li>
              ))}
          </ul>
        </>
      )}
      <p className="aide">
        Saison {Sc.replace('-', '–')} · plafond {dollars(cbaDeLUnivers(P0, u).plafondSalarial)}.
      </p>
    </section>
  );
}

/** En saison : les joueurs libres hors NBA que le GM peut signer (une ou deux saisons). */
function JoueursLibres({ etat, enCours, onAction, onFiche }: Props) {
  const u = universActif();
  const [retour, setRetour] = useState<string>();
  const libres = Object.keys(u.horsNba)
    .filter((j) => u.horsNba[j] === 'libre' && u.joueurs[j])
    .sort((a, b) => u.joueurs[b]!.note - u.joueurs[a]!.note)
    .slice(0, 60);
  const P = cbaDeLUnivers(P0, u);
  return (
    <section className="carte" aria-label="Joueurs libres">
      <h2>Joueurs libres</h2>
      <p className="aide">
        Signature en saison (pendant la saison régulière) : contrat d’une saison au salaire minimum ou avec l’espace et les exceptions qui
        vous restent.
      </p>
      <Retour texte={retour} />
      <table className="tableau">
        <thead>
          <tr>
            <th scope="col" className="gauche">
              Joueur
            </th>
            <th scope="col">Poste</th>
            <th scope="col">Âge</th>
            <th scope="col">Note</th>
            <th scope="col">Signer</th>
          </tr>
        </thead>
        <tbody>
          {libres.map((j) => (
            <tr key={j}>
              <th scope="row" className="gauche">
                <button type="button" className="lien" onClick={() => onFiche(j)}>
                  {u.joueurs[j]!.nom}
                </button>
              </th>
              <td>{u.joueurs[j]!.poste}</td>
              <td>{u.joueurs[j]!.age}</td>
              <td className="note">{u.joueurs[j]!.note}</td>
              <td>
                <button
                  type="button"
                  disabled={enCours || etat.phase !== 'reguliere'}
                  onClick={async () =>
                    setRetour((await onAction({ genre: 'signer-libre', joueur: j, salaire: P.salaireMinimum[0]!, duree: 1 }))?.message)
                  }
                >
                  Au minimum
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// --- Échanges. ---

const cleActif = (a: Actif) => (a.type === 'joueur' ? a.id : `${a.annee}-${a.tour}-${a.original}`);

export function Echanges({ etat, enCours, onAction, onFiche }: Props) {
  const u = universActif();
  const P = cbaDeLUnivers(P0, u);
  const Sc = saisonCourte(u.saison);
  const autres = equipesActives()
    .filter((e) => e !== etat.franchise)
    .sort((a, b) => nomEquipe(a).localeCompare(nomEquipe(b), 'fr'));
  const [partenaire, setPartenaire] = useState(autres[0]!);
  const [choix, setChoix] = useState<[Actif[], Actif[]]>([[], []]);
  const [reponse, setReponse] = useState<ReponseDuGm>();
  const draftFaite = etat.phase === 'terminee';
  const annees = anneesEchangeables(P, u, draftFaite);
  const actifs = (e: string): Actif[] => {
    const vus = new Set<string>();
    const choixDe = droitsSurLesChoix(u, e, annees)
      .map((d): Actif => ({ type: 'choix', annee: d.annee, tour: d.tour, original: d.original }))
      .filter((a) => (vus.has(cleActif(a)) ? false : (vus.add(cleActif(a)), true)));
    return [...(u.effectifs[e] ?? []).map((id): Actif => ({ type: 'joueur', id })), ...choixDe];
  };
  const proposition: PropositionEchange = { equipes: [etat.franchise, partenaire], actifs: choix };
  const basculer = (i: 0 | 1, a: Actif) => {
    const k = cleActif(a);
    const liste = choix[i].some((x) => cleActif(x) === k) ? choix[i].filter((x) => cleActif(x) !== k) : [...choix[i], a];
    setChoix(i === 0 ? [liste, choix[1]] : [choix[0], liste]);
    setReponse(undefined);
  };
  const limite = dateDeLaSaison(donneesMarche.saisonDeReference, etat.saison, donneesMarche.dates.dateLimiteEchanges);
  const libelle = (a: Actif) =>
    a.type === 'joueur'
      ? `${nomJoueur(a.id)} (${u.joueurs[a.id]?.note ?? '?'}, ${u.joueurs[a.id]?.age ?? '?'} ans) · ${u.contrats[a.id]?.type === 'two-way' ? 'two-way' : dollars(salaireDeLaSaison(u.contrats[a.id], Sc))}`
      : `${a.annee}, ${a.tour === 1 ? '1er' : '2e'} tour${a.original !== partenaire && a.original !== etat.franchise ? ` (de ${nomEquipe(a.original)})` : ''}`;
  const total = (l: Actif[]) => l.reduce((t, a) => t + (a.type === 'joueur' ? salaireDeLaSaison(u.contrats[a.id], Sc) : 0), 0);
  const colonne = (i: 0 | 1, e: string) => (
    <fieldset className="colonne-echange">
      <legend>
        {nomEquipe(e)} cède ({dollars(total(choix[i]))})
      </legend>
      {actifs(e).map((a) => (
        <label key={cleActif(a)} className="ligne-actif">
          <input type="checkbox" checked={choix[i].some((x) => cleActif(x) === cleActif(a))} onChange={() => basculer(i, a)} /> {libelle(a)}
          {a.type === 'joueur' && (
            <button type="button" className="lien" onClick={() => onFiche(a.id)} aria-label={`Fiche de ${nomJoueur(a.id)}`}>
              fiche
            </button>
          )}
        </label>
      ))}
    </fieldset>
  );
  return (
    <section className="carte" aria-label="Échanges">
      <h2>Échanges</h2>
      <p className="aide">
        Correspondance des salaires selon la CBA (niveau de chaque équipe après l’échange), aprons, choix sur sept ans, règle Stepien.{' '}
        {limite && `Date limite : ${dateFr(limite)}.`}
      </p>
      <label>
        Partenaire{' '}
        <select
          value={partenaire}
          onChange={(e) => {
            setPartenaire(e.target.value);
            setChoix([[], []]);
            setReponse(undefined);
          }}
        >
          {autres.map((e) => (
            <option key={e} value={e}>
              {nomEquipe(e)}
            </option>
          ))}
        </select>
      </label>
      <div className="echange">
        {colonne(0, etat.franchise)}
        {colonne(1, partenaire)}
      </div>
      <p>
        <button
          type="button"
          disabled={enCours}
          onClick={async () => setReponse(await onAction({ genre: 'echange-evaluer', proposition }))}
        >
          Vérifier
        </button>{' '}
        <button
          type="button"
          className="principal"
          disabled={enCours}
          onClick={async () => {
            const r = await onAction({ genre: 'echange-proposer', proposition });
            setReponse(r);
            if (r?.avis?.accepte) setChoix([[], []]);
          }}
        >
          Proposer
        </button>{' '}
        <button
          type="button"
          disabled={enCours || !choix[1].length}
          onClick={async () => {
            const r = await onAction({ genre: 'ce-qu-il-faudrait', proposition });
            setReponse(r);
            if (r?.proposition) setChoix([r.proposition.actifs[0], r.proposition.actifs[1]]);
          }}
        >
          Qu’est-ce qu’il vous faudrait ?
        </button>
      </p>
      {reponse && (
        <div role="status" className="avis">
          {reponse.message && <p>{reponse.message}</p>}
          {reponse.verdict && !reponse.verdict.legal && (
            <ul>
              {reponse.verdict.motifs.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {reponse.verdict?.legal && <p>L’échange respecte la CBA.</p>}
          {reponse.avis && (
            <ul>
              {reponse.avis.raisons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// --- Staff, délégations, composition. ---

const DOMAINES: [DomaineDelegation, string][] = [
  ['draft', 'Draft'],
  ['agentsLibres', 'Agents libres'],
  ['prolongations', 'Prolongations'],
  ['echanges', 'Échanges'],
  ['rotation', 'Cinq de départ et rotation'],
];
const NIVEAUX: [NiveauDelegation, string][] = [
  ['gm', 'Je décide'],
  ['propose', 'Le staff propose'],
  ['staff', 'Le staff décide'],
];
const POSTES = {
  entraineur: 'Entraîneur principal',
  developpement: 'Développement',
  recruteur: 'Recrutement',
  medical: 'Médical',
} as const;

export function Staff({ etat, enCours, onAction, onFiche }: Props) {
  const u = universActif();
  const [retour, setRetour] = useState<string>();
  const [etaler, setEtaler] = useState(false);
  const staff = u.staff?.[etat.franchise];
  const d: Delegations = etat.delegations ?? {
    draft: 'gm',
    agentsLibres: 'propose',
    prolongations: 'propose',
    echanges: 'propose',
    rotation: 'staff',
  };
  const effectif = u.effectifs[etat.franchise] ?? [];
  const ordreStaff = [...effectif].sort((a, b) => (u.joueurs[b]?.note ?? 0) - (u.joueurs[a]?.note ?? 0));
  const ordre = etat.compositionManuelle?.filter((j) => effectif.includes(j)) ?? ordreStaff;
  const manuel = d.rotation === 'gm' && !!etat.compositionManuelle;
  const deplacer = (i: number, delta: number) => {
    const o = [...ordre];
    const j = i + delta;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j]!, o[i]!];
    void onAction({ genre: 'composition', ordre: o });
  };
  return (
    <>
      <section className="carte" aria-label="Staff">
        <h2>Staff</h2>
        <p className="aide">
          Effets bornés et de moyenne nulle : le recruteur rend vos rapports de Draft plus ou moins précis, le médical raccourcit ou allonge
          les absences, le développement aide les joueurs de 25 ans au plus ; l’entraîneur fixe le plan de jeu de l’équipe.
        </p>
        <Retour texte={retour} />
        {staff && (
          <ul>
            {(Object.keys(POSTES) as (keyof typeof POSTES)[]).map((p) => (
              <li key={p}>
                <strong>{POSTES[p]}</strong> : {staff[p].nom} ({staff[p].age} ans) · {noteDuStaff(staff[p])}
                {staff[p].preferences &&
                  ` · rythme ${staff[p].preferences!.rythme}, défense ${staff[p].preferences!.defense}, 3 pts ${staff[p].preferences!.troisPoints}`}
              </li>
            ))}
          </ul>
        )}
        <h3>Staff libre</h3>
        <table className="tableau">
          <thead>
            <tr>
              <th scope="col" className="gauche">
                Nom
              </th>
              <th scope="col">Poste</th>
              <th scope="col">Âge</th>
              <th scope="col">Compétence</th>
              <th scope="col">Engager</th>
            </tr>
          </thead>
          <tbody>
            {[...(u.staffLibre ?? [])]
              .sort((a, b) => a.poste.localeCompare(b.poste) || noteDuStaff(b) - noteDuStaff(a))
              .map((m) => (
                <tr key={m.id}>
                  <th scope="row" className="gauche">
                    {m.nom}
                  </th>
                  <td>{POSTES[m.poste]}</td>
                  <td>{m.age}</td>
                  <td className="note">{noteDuStaff(m)}</td>
                  <td>
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={async () => setRetour((await onAction({ genre: 'staff', membre: m.id }))?.message)}
                    >
                      Engager
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
      <section className="carte" aria-label="Délégations">
        <h2>Délégations</h2>
        <table className="tableau">
          <tbody>
            {DOMAINES.map(([dom, libelle]) => (
              <tr key={dom}>
                <th scope="row" className="gauche">
                  {libelle}
                </th>
                <td>
                  <select
                    aria-label={`Délégation : ${libelle}`}
                    value={d[dom]}
                    disabled={enCours}
                    onChange={async (e) =>
                      setRetour(
                        (await onAction({ genre: 'delegations', delegations: { ...d, [dom]: e.target.value as NiveauDelegation } }))
                          ?.message,
                      )
                    }
                  >
                    {NIVEAUX.filter(([n]) => dom !== 'rotation' || n !== 'propose').map(([n, l]) => (
                      <option key={n} value={n}>
                        {l}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="carte" aria-label="Composition">
        <h2>Composition</h2>
        <p className="aide">
          {manuel
            ? 'Vous composez l’équipe : les cinq premiers sont titulaires, les suivants entrent dans cet ordre.'
            : 'Le staff compose l’équipe (meilleur joueur par poste).'}{' '}
          <button
            type="button"
            disabled={enCours}
            onClick={async () => setRetour((await onAction({ genre: 'composition', ordre: manuel ? null : ordre }))?.message)}
          >
            {manuel ? 'Rendre la composition au staff' : 'Composer moi-même'}
          </button>{' '}
          <label>
            <input type="checkbox" checked={etaler} onChange={(e) => setEtaler(e.target.checked)} /> Étaler l’argent mort en cas de coupe
          </label>
        </p>
        <ol>
          {ordre.map((j, i) => (
            <li key={j}>
              {i === 5 && <hr />}
              <button type="button" className="lien" onClick={() => onFiche(j)}>
                {nomJoueur(j)}
              </button>{' '}
              ({u.joueurs[j]?.poste}, {u.joueurs[j]?.note}
              {u.contrats[j]?.type === 'two-way' ? ', two-way' : ''}){' '}
              {manuel && (
                <>
                  <button type="button" disabled={enCours || i === 0} onClick={() => deplacer(i, -1)} aria-label={`Monter ${nomJoueur(j)}`}>
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={enCours || i === ordre.length - 1}
                    onClick={() => deplacer(i, 1)}
                    aria-label={`Descendre ${nomJoueur(j)}`}
                  >
                    ↓
                  </button>{' '}
                </>
              )}
              <button
                type="button"
                disabled={enCours}
                onClick={async () => {
                  if (window.confirm(`Couper ${nomJoueur(j)} ? Son salaire garanti restant deviendra de l’argent mort.`))
                    setRetour((await onAction({ genre: 'couper', joueur: j, etaler }))?.message);
                }}
              >
                Couper
              </button>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

// --- Journal. ---

/** Les identifiants de franchise d'un texte du journal remplacés par leurs noms (les plus longs d'abord). */
function avecNoms(texte: string): string {
  let t = texte;
  for (const e of [...equipesActives()].sort((a, b) => b.length - a.length))
    t = t.replace(new RegExp(`(?<![a-z0-9-])${e}(?![a-z0-9-])`, 'g'), nomEquipe(e));
  return t;
}

export function Journal({ etat }: { etat: EtatSaison }) {
  const u = universActif();
  const journal = [...(u.journal ?? [])].reverse();
  return (
    <section className="carte" aria-label="Transactions">
      <h2>Transactions de la saison</h2>
      <p className="aide">
        {etat.marche ? `${etat.marche.echanges} échange(s), ${etat.marche.signatures} signature(s) cette saison.` : ''}
      </p>
      {!journal.length && <p>Aucune transaction pour l’instant.</p>}
      <ul>
        {journal.slice(0, 200).map((t, i) => (
          <li key={`${t.date}-${i}`}>
            {dateFr(t.date)} · {avecNoms(t.texte)}
          </li>
        ))}
      </ul>
    </section>
  );
}
