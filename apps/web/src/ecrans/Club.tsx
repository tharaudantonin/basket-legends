// Tranche 10 : la vie du club — propriétaire (objectif, confiance, rendez-vous, bilan, carrière du GM), vestiaire
// (moral, rôle, tempérament, demandes d'échange, assignations en G League), messages à choix, contrats en cours de
// saison (two-way, 10 jours, exception de difficulté), G League (classements, phases finales, équipe affiliée).
// Écrans fonctionnels et sobres (réponse 20) : la mise en forme viendra avec le chantier visuel.
import { useState } from 'react';
import {
  bilansGLeague,
  dateDansLaSaison,
  effectifGLeague,
  libelleObjectif,
  moralDe,
  roleDe,
  temperamentDe,
  type EtatSaison,
  type MatchGLeague,
  type Role,
} from '@basket-legends/league';
import { donneesClub, salaires, structure } from '../donnees';
import { nomEquipe, universActif } from '../vue';
import type { Agir } from './Marche';

interface Props {
  etat: EtatSaison;
  enCours: boolean;
  onAction: Agir;
  onFiche: (joueur: string) => void;
}

const MC = donneesClub.modele;
const P = salaires.cba;
const dateFr = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const PROFILS = { exigeant: 'exigeant', patient: 'patient', ambitieux: 'ambitieux (tolère la taxe)' };
const ROLES: Record<Role, string> = { titulaire: 'Titulaire', rotation: 'Rotation', banc: 'Fin de banc' };
const TEMPERAMENTS = { meneur: 'meneur', calme: 'calme', sanguin: 'sanguin', discret: 'discret' };
const EXPEDITEURS = { adjoint: 'Votre adjoint', proprietaire: 'Le propriétaire', recrutement: 'Le recrutement' };

function Retour({ texte }: { texte?: string }) {
  return texte ? (
    <p className="aide" role="status">
      {texte}
    </p>
  ) : null;
}

/** Les décisions qui attendent le GM : offres d'emploi après un licenciement, projet de déménagement. */
export function DecisionsDuClub({ etat, enCours, onAction }: Omit<Props, 'onFiche'>) {
  const [retour, setRetour] = useState<string>();
  const L = etat.club?.licenciement;
  const D = etat.club?.demenagement;
  if (!L && D?.statut !== 'ouvert') return <Retour texte={retour} />;
  return (
    <section className="carte commandes" aria-label="Décisions du club">
      {L && (
        <>
          <h2>Vous êtes licencié</h2>
          <p>Le propriétaire s’est séparé de vous. Ces franchises vous proposent un poste de GM : choisissez la vôtre pour continuer.</p>
          <p>
            {L.offres.map((e) => (
              <button
                key={e}
                type="button"
                className="principal"
                disabled={enCours}
                onClick={async () => setRetour((await onAction({ genre: 'offre-emploi', franchise: e }))?.message)}
              >
                Rejoindre {nomEquipe(e)}
              </button>
            ))}
          </p>
        </>
      )}
      {D?.statut === 'ouvert' && (
        <>
          <h2>Projet de déménagement</h2>
          <p>
            Le propriétaire envisage de déménager la franchise à {D.ville} : elle deviendrait {D.nom}, en gardant son histoire et son
            palmarès. Sans réponse avant le début de la saison, le projet est abandonné.
          </p>
          <p>
            <button
              type="button"
              disabled={enCours}
              onClick={async () => setRetour((await onAction({ genre: 'demenagement', accepter: true }))?.message)}
            >
              Accepter le déménagement
            </button>{' '}
            <button
              type="button"
              disabled={enCours}
              onClick={async () => setRetour((await onAction({ genre: 'demenagement', accepter: false }))?.message)}
            >
              Refuser
            </button>
          </p>
        </>
      )}
      <Retour texte={retour} />
    </section>
  );
}

function Proprietaire({ etat }: { etat: EtatSaison }) {
  const u = universActif();
  const C = u.club;
  const p = C?.proprietaires[etat.franchise];
  const o = etat.club?.objectifs[etat.franchise];
  const b = etat.club?.bilan?.[etat.franchise];
  if (!C || !p)
    return <p className="aide">La vie du club commence à la saison suivante de cette partie (ou dès le début d’une nouvelle partie).</p>;
  const profil = MC.proprietaire.profils[p.profil];
  return (
    <section className="carte" aria-label="Propriétaire">
      <h2>Le propriétaire</h2>
      <p>
        Profil : <strong>{PROFILS[p.profil]}</strong> (généré
        {etat.univers?.equipes[etat.franchise]?.recidiviste ? ', hérité du miroir : récidiviste de la taxe' : ''}). Taxe de luxe acceptée :{' '}
        {(profil.toleranceTaxe / 1e6).toLocaleString('fr-FR')} M$.
      </p>
      <p>
        Confiance : <meter min={0} max={100} low={profil.seuil} high={profil.seuil + 20} optimum={80} value={p.confiance} />{' '}
        <strong>{Math.round(p.confiance)}/100</strong> (licenciement sous {profil.seuil}). Votre réputation : {Math.round(C.reputation)}
        /100.
      </p>
      {o && (
        <p>
          Objectif {etat.saison.replace('-', '–')} : <strong>{libelleObjectif(o)}</strong> ({o.rangForce}e rang attendu dans la ligue au
          début de la saison). Rendez-vous tenus : {etat.club!.rendezVous}/{MC.proprietaire.rendezVous.length}.
        </p>
      )}
      {b && (
        <p>
          Bilan de fin de saison : objectif <strong>{b.tenu ? 'tenu' : 'manqué'}</strong>, confiance {b.confiance}/100
          {b.licencie ? ' — licencié.' : '.'}
        </p>
      )}
      <p className="aide">
        Votre carrière :{' '}
        {C.parcours
          .map(
            (x) =>
              `${nomEquipe(x.franchise)} (${x.de.slice(0, 4)}${x.jusqua ? `–${x.jusqua.slice(5, 9)}` : ''}${x.fin === 'licencie' ? ', licencié' : ''})`,
          )
          .join(' ; ')}
        .
      </p>
    </section>
  );
}

function Messages({ etat, enCours, onAction }: Omit<Props, 'onFiche'>) {
  const [retour, setRetour] = useState<string>();
  const messages = [...(etat.club?.messages ?? [])].reverse();
  return (
    <section className="carte" aria-label="Messages du vestiaire">
      <h2>Messages</h2>
      <p className="aide">
        Sans réponse au bout de {MC.vestiaire.messages.delai} jours, la réponse par défaut s’applique. Une même réponse peut bien ou mal
        tourner.
      </p>
      <Retour texte={retour} />
      {!messages.length && <p>Aucun message cette saison.</p>}
      <ul className="liste-actualites">
        {messages.map((m) => (
          <li key={m.id}>
            <p>
              <strong>{m.titre}</strong> · {EXPEDITEURS[m.de]} · {dateFr(m.date)}
              {m.reponse !== undefined && <span className="etiquette">{m.parDefaut ? 'réponse par défaut' : 'répondu'}</span>}
            </p>
            <p>{m.texte}</p>
            {m.reponse === undefined ? (
              <p>
                {m.choix.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={enCours}
                    onClick={async () => setRetour((await onAction({ genre: 'club-message', id: m.id, choix: i }))?.message)}
                  >
                    {c}
                  </button>
                ))}
              </p>
            ) : (
              <p className="aide">
                Votre réponse : {m.choix[m.reponse]} — {m.resultat}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Vestiaire({ etat, enCours, onAction, onFiche }: Props) {
  const u = universActif();
  const [retour, setRetour] = useState<string>();
  const effectif = (u.effectifs[etat.franchise] ?? []).slice().sort((a, b) => (u.joueurs[b]?.note ?? 0) - (u.joueurs[a]?.note ?? 0));
  if (!u.club) return null;
  const groupe = effectif.filter((j) => !u.club!.assignes[j]);
  const moyen = groupe.reduce((s, j) => s + moralDe(MC, u.club, j), 0) / Math.max(1, groupe.length);
  const ancienneteMax = MC.gLeague.assignationAncienneteMax;
  return (
    <section className="carte" aria-label="Vestiaire">
      <h2>Le vestiaire</h2>
      <p>
        Moral du groupe : <strong>{Math.round(moyen)}/100</strong>. Le moral suit les résultats et le temps de jeu face au rôle de chacun ;
        il pèse un peu sur la réussite au tir en match, sur les prolongations et sur les demandes d’échange. Tempéraments et personnalités
        sont générés.
      </p>
      <Retour texte={retour} />
      <table className="tableau">
        <thead>
          <tr>
            <th scope="col" className="gauche">
              Joueur
            </th>
            <th scope="col">Note</th>
            <th scope="col">Moral</th>
            <th scope="col">Rôle</th>
            <th scope="col">Tempérament</th>
            <th scope="col">Situation</th>
            <th scope="col">Promettre un rôle</th>
            <th scope="col">G League</th>
          </tr>
        </thead>
        <tbody>
          {effectif.map((j) => {
            const x = u.joueurs[j]!;
            const c = u.contrats[j];
            const promis = u.club!.roles[j];
            const assigne = !!u.club!.assignes[j];
            const assignable = c?.type === 'standard' && !c.dixJours && (c.anciennete ?? 0) <= ancienneteMax;
            return (
              <tr key={j}>
                <th scope="row" className="gauche">
                  <button type="button" className="lien" onClick={() => onFiche(j)}>
                    {x.nom}
                  </button>
                </th>
                <td className="note">{x.note}</td>
                <td>{Math.round(moralDe(MC, u.club, j))}</td>
                <td>
                  {ROLES[roleDe(MC, u, etat.franchise, j)]}
                  {promis ? ' (promis)' : ''}
                </td>
                <td>{TEMPERAMENTS[temperamentDe(MC, x, etat.graine)]}</td>
                <td>
                  {[
                    u.club!.demandes[j] ? 'demande un échange' : '',
                    c?.type === 'two-way' ? 'two-way' : '',
                    c?.dixJours ? `10 jours (n° ${c.dixJours.numero}${c.dixJours.hardship ? ', difficulté' : ''})` : '',
                    assigne ? 'en G League' : '',
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </td>
                <td>
                  <select
                    aria-label={`Rôle promis à ${x.nom}`}
                    value={promis ?? ''}
                    disabled={enCours}
                    onChange={async (ev) =>
                      setRetour((await onAction({ genre: 'role', joueur: j, role: (ev.target.value || null) as Role | null }))?.message)
                    }
                  >
                    <option value="">Aucun</option>
                    <option value="titulaire">Titulaire</option>
                    <option value="rotation">Rotation</option>
                    <option value="banc">Fin de banc</option>
                  </select>
                </td>
                <td>
                  {assigne ? (
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={async () => setRetour((await onAction({ genre: 'assigner', joueur: j, assigner: false }))?.message)}
                    >
                      Rappeler
                    </button>
                  ) : assignable ? (
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={async () => setRetour((await onAction({ genre: 'assigner', joueur: j, assigner: true }))?.message)}
                    >
                      Assigner
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
    </section>
  );
}

function ContratsEnSaison({ etat, enCours, onAction, onFiche }: Props) {
  const u = universActif();
  const [retour, setRetour] = useState<string>();
  const mien = u.effectifs[etat.franchise] ?? [];
  const twoWay = mien.filter((j) => u.contrats[j]?.type === 'two-way');
  const dixJours = mien.filter((j) => u.contrats[j]?.dixJours);
  const libres = Object.keys(u.horsNba)
    .filter((j) => u.joueurs[j])
    .sort((a, b) => u.joueurs[b]!.note - u.joueurs[a]!.note)
    .slice(0, 40);
  const D = P.dixJours;
  const agir = async (a: Parameters<Agir>[0]) => setRetour((await onAction(a))?.message);
  return (
    <section className="carte" aria-label="Contrats en cours de saison">
      <h2>Contrats en cours de saison</h2>
      <p className="aide">
        Contrats de 10 jours à partir du {dateFr(dateDansLaSaison(etat.saison, D.premierJour))} (salaire minimum au prorata,{' '}
        {D.parJoueurEtEquipe} au plus par joueur avec la même équipe) ; exception de difficulté avec 15 contrats standard et au moins{' '}
        {P.hardship.blessesMin} blessés absents depuis {P.hardship.matchsManquesMin} matchs et pour deux semaines ; two-way jusqu’au{' '}
        {dateFr(dateDansLaSaison(etat.saison, P.twoWayEnSaison.dateLimiteSignature))} (limite de matchs au prorata), convertibles jusqu’à la
        fin de la saison régulière. Règles sourcées (Hoops Rumors).
      </p>
      <Retour texte={retour} />
      {(twoWay.length > 0 || dixJours.length > 0) && (
        <ul>
          {twoWay.map((j) => (
            <li key={j}>
              {u.joueurs[j]!.nom} (two-way, {etat.statistiques[j]?.matchs ?? 0}/{u.contrats[j]!.limiteMatchs ?? P.matchsMaxTwoWay} matchs
              NBA){' '}
              <button
                type="button"
                disabled={enCours || etat.phase !== 'reguliere'}
                onClick={() => void agir({ genre: 'convertir', joueur: j })}
              >
                Convertir en contrat standard
              </button>
            </li>
          ))}
          {dixJours.map((j) => (
            <li key={j}>
              {u.joueurs[j]!.nom} (10 jours n° {u.contrats[j]!.dixJours!.numero}, jusqu’au {dateFr(u.contrats[j]!.dixJours!.fin)}){' '}
              <button type="button" disabled={enCours} onClick={() => void agir({ genre: 'garder-dix-jours', joueur: j })}>
                Garder jusqu’à la fin de la saison
              </button>
            </li>
          ))}
        </ul>
      )}
      <table className="tableau">
        <thead>
          <tr>
            <th scope="col" className="gauche">
              Joueur hors NBA
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
                  onClick={() => void agir({ genre: 'dix-jours', joueur: j, hardship: false })}
                >
                  10 jours
                </button>{' '}
                <button
                  type="button"
                  disabled={enCours || etat.phase !== 'reguliere'}
                  onClick={() => void agir({ genre: 'dix-jours', joueur: j, hardship: true })}
                >
                  10 jours (difficulté)
                </button>{' '}
                <button
                  type="button"
                  disabled={enCours || etat.phase !== 'reguliere'}
                  onClick={() => void agir({ genre: 'two-way', joueur: j })}
                >
                  Two-way
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Club(props: Props) {
  return (
    <>
      <Proprietaire etat={props.etat} />
      <Messages {...props} />
      <Vestiaire {...props} />
      <ContratsEnSaison {...props} />
    </>
  );
}

// --- G League. ---

const PHASES_GL: Record<MatchGLeague['phase'], string> = {
  'tip-off': 'Tip-Off Tournament',
  showcase: 'Winter Showcase',
  reguliere: 'Saison régulière',
  playoffs: 'Playoffs',
};

export function GLeague({ etat, onFiche }: Pick<Props, 'etat' | 'onFiche'>) {
  const u = universActif();
  const G = etat.club?.gLeague;
  const [phase, setPhase] = useState<'tip-off' | 'reguliere'>(
    G?.matchs.some((m) => m.phase === 'reguliere' && m.score) ? 'reguliere' : 'tip-off',
  );
  if (!G) return <p className="aide">La G League commence à la saison suivante de cette partie (ou dès le début d’une nouvelle partie).</p>;
  const b = bilansGLeague(G, phase);
  const stats = G.statistiques;
  const affiliee = effectifGLeague(u, etat.franchise)
    .filter((j) => u.joueurs[j])
    .sort((a, c) => (u.joueurs[c]?.note ?? 0) - (u.joueurs[a]?.note ?? 0));
  const finales = G.matchs.filter((m) => (m.phase === 'showcase' || m.phase === 'playoffs') && m.score);
  const parMatch = (x: number, n: number) =>
    n ? (x / n).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : '—';
  return (
    <>
      <section className="carte" aria-label="G League">
        <h2>G League</h2>
        <p className="aide">
          30 équipes affiliées, une par franchise. Saison simulée en accéléré : bilans et statistiques estimés, sans match possession par
          possession. Vos two-way, vos joueurs assignés et des joueurs hors NBA y jouent ; ceux qui jouent assez progressent un peu plus.
        </p>
        <p>
          {G.vainqueurShowcase && <>Vainqueur du Winter Showcase : {nomEquipe(G.vainqueurShowcase)}. </>}
          {G.champion && <>Champion de G League : {nomEquipe(G.champion)}.</>}
          {!G.vainqueurShowcase && !G.champion && (
            <>
              Matchs joués : {G.matchs.filter((m) => m.score).length} sur {G.matchs.length}.
            </>
          )}
        </p>
        <p>
          <button type="button" aria-pressed={phase === 'tip-off'} onClick={() => setPhase('tip-off')}>
            {PHASES_GL['tip-off']}
          </button>{' '}
          <button type="button" aria-pressed={phase === 'reguliere'} onClick={() => setPhase('reguliere')}>
            {PHASES_GL.reguliere}
          </button>
        </p>
        {structure.conferences.map((c) => {
          const equipes = c.divisions
            .flatMap((d) => d.franchises)
            .sort((x, y) => {
              const [vx, dx, px] = b[x] ?? [0, 0, 0];
              const [vy, dy, py] = b[y] ?? [0, 0, 0];
              return vy / Math.max(1, vy + dy) - vx / Math.max(1, vx + dx) || py - px;
            });
          return (
            <table key={c.id} className="tableau">
              <caption>{c.nom}</caption>
              <thead>
                <tr>
                  <th scope="col">Rang</th>
                  <th scope="col" className="gauche">
                    Équipe affiliée
                  </th>
                  <th scope="col">V</th>
                  <th scope="col">D</th>
                  <th scope="col">Diff.</th>
                </tr>
              </thead>
              <tbody>
                {equipes.map((e, i) => (
                  <tr key={e} className={e === etat.franchise ? 'moi' : undefined}>
                    <td>{i + 1}</td>
                    <th scope="row" className="gauche">
                      {nomEquipe(e)}
                    </th>
                    <td>{b[e]?.[0] ?? 0}</td>
                    <td>{b[e]?.[1] ?? 0}</td>
                    <td>{b[e]?.[2] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
        {finales.length > 0 && (
          <>
            <h3>Phases finales</h3>
            <ul>
              {finales.map((m, i) => (
                <li key={i}>
                  {PHASES_GL[m.phase]}, tour {m.tour}
                  {m.finale ? ' (finale)' : ''} · {dateFr(m.date)} : {nomEquipe(m.domicile)} {m.score![0]} – {m.score![1]}{' '}
                  {nomEquipe(m.exterieur)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="carte" aria-label="Votre équipe affiliée">
        <h2>Votre équipe affiliée</h2>
        <table className="tableau">
          <thead>
            <tr>
              <th scope="col" className="gauche">
                Joueur
              </th>
              <th scope="col">Statut</th>
              <th scope="col">Âge</th>
              <th scope="col">Note</th>
              <th scope="col">Matchs</th>
              <th scope="col">Min</th>
              <th scope="col">Pts</th>
              <th scope="col">Reb</th>
              <th scope="col">Pd</th>
            </tr>
          </thead>
          <tbody>
            {affiliee.map((j) => {
              const l = stats[j];
              const c = u.contrats[j];
              return (
                <tr key={j}>
                  <th scope="row" className="gauche">
                    <button type="button" className="lien" onClick={() => onFiche(j)}>
                      {u.joueurs[j]!.nom}
                    </button>
                  </th>
                  <td>{c?.type === 'two-way' ? 'two-way' : c ? 'assigné' : 'hors NBA'}</td>
                  <td>{u.joueurs[j]!.age}</td>
                  <td className="note">{u.joueurs[j]!.note}</td>
                  <td>{l?.matchs ?? 0}</td>
                  <td>{parMatch(l?.minutes ?? 0, l?.matchs ?? 0)}</td>
                  <td>{parMatch(l?.points ?? 0, l?.matchs ?? 0)}</td>
                  <td>{parMatch(l?.rebonds ?? 0, l?.matchs ?? 0)}</td>
                  <td>{parMatch(l?.passes ?? 0, l?.matchs ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
