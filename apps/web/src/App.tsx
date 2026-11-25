// Tranches 1 à 5 : choisir une franchise → voir l'effectif → jouer un match isolé (rapide, commenté ou interactif) ou
// lancer la saison 2026-27 (calendrier, classements, Play-In, playoffs, palmarès), sauvegardée dans le navigateur ; les
// matchs de sa franchise peuvent s'y jouer en interactif, repris au même point après un rechargement. Tranche 8 : la
// carrière continue saison après saison (intersaison, univers de la partie affiché par les écrans).
import { useEffect, useState } from 'react';
import { nouvelleGraine, type Camp, type DecisionMatch, type EntreeMatch, type ResultatMatch } from '@basket-legends/engine';
import {
  observationsRestantes,
  type Cible,
  type EtatSaison,
  type ResumeMatch,
  type Sauvegarde,
  type ActionDuGm,
  type ReponseDuGm,
} from '@basket-legends/league';
import { ChoixFranchise } from './ecrans/ChoixFranchise';
import { EcranEffectif, type DemandeMatch } from './ecrans/Effectif';
import { EcranBoxScore } from './ecrans/BoxScore';
import { EcranCommente } from './ecrans/Commente';
import { EcranFicheJoueur } from './ecrans/FicheJoueur';
import { EcranSaison } from './ecrans/Saison';
import { EcranInteractif } from './ecrans/Interactif';
import { equipeDe, modeleDraft, regles, reglages } from './donnees';
import {
  actionDansLeMoteur,
  avancerDansLeMoteur,
  avancerDraftDansLeMoteur,
  nouvelleSaisonDansLeMoteur,
  prochainMatchDansLeMoteur,
  rejouerDansLeMoteur,
  saisonSuivanteDansLeMoteur,
  simulerDansLeMoteur,
} from './moteur';
import { charger, enregistrer } from './sauvegarde';
import { activerUnivers } from './vue';

type Ecran =
  | { nom: 'choix' }
  | { nom: 'effectif'; franchise: string; derniere?: DemandeMatch }
  | { nom: 'match'; franchise: string; demande?: DemandeMatch; resultat: ResultatMatch; retour: Ecran }
  | { nom: 'commente'; franchise: string; demande?: DemandeMatch; resultat: ResultatMatch; retour: Ecran }
  | { nom: 'fiche'; joueur: string; resultat?: ResultatMatch; retour: Ecran }
  | { nom: 'saison' }
  /** Tranche 5 : match interactif, isolé (entrée) ou de la saison (résumé du match à jouer). */
  | {
      nom: 'interactif';
      franchise: string;
      camp: Camp;
      demande?: DemandeMatch;
      entree?: EntreeMatch;
      match?: ResumeMatch;
      decisions: DecisionMatch[];
      arret: number;
      retour: Ecran;
    };

export function App() {
  const [ecran, setEcran] = useState<Ecran>({ nom: 'choix' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const [sauvegarde, setSauvegarde] = useState<Sauvegarde>();
  // Tranche 8 : les écrans montrent l'univers de la saison enregistrée (celui des données pour la première saison).
  activerUnivers(sauvegarde?.etat.univers);

  useEffect(() => {
    charger()
      .then(setSauvegarde)
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : String(e)));
  }, []);

  const tache = async (action: () => Promise<void>) => {
    setEnCours(true);
    setErreur(undefined);
    try {
      await action();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnCours(false);
    }
  };

  const jouer = (franchise: string, demande: DemandeMatch) =>
    tache(async () => {
      const [domicile, exterieur] = demande.aDomicile ? [franchise, demande.adversaire] : [demande.adversaire, franchise];
      const entree: EntreeMatch = {
        graine: demande.graine,
        domicile: equipeDe(domicile),
        exterieur: equipeDe(exterieur),
        regles,
        reglages,
      };
      const retour: Ecran = { nom: 'effectif', franchise, derniere: demande };
      if (demande.mode === 'interactif') {
        setEcran({ nom: 'interactif', franchise, camp: demande.aDomicile ? 0 : 1, demande, entree, decisions: [], arret: 0, retour });
        return;
      }
      const resultat = await simulerDansLeMoteur(entree);
      setEcran({ nom: demande.mode === 'commente' ? 'commente' : 'match', franchise, demande, resultat, retour });
    });

  const garder = async (etat: EtatSaison) => setSauvegarde(await enregistrer(etat, sauvegarde));

  const commencerSaison = (franchise: string) =>
    tache(async () => {
      if (sauvegarde && !window.confirm('Une partie est déjà enregistrée : la remplacer par une nouvelle saison ?')) return;
      const etat = await nouvelleSaisonDansLeMoteur(nouvelleGraine(Date.now()), franchise);
      setSauvegarde(await enregistrer(etat));
      setEcran({ nom: 'saison' });
    });

  const avancer = (cible: Cible) =>
    tache(async () => {
      if (!sauvegarde) return;
      await garder(await avancerDansLeMoteur(sauvegarde.etat, cible));
    });

  /** Tranche 5 : le prochain match de la franchise, en interactif (ou la reprise du match interactif enregistré). */
  const jouerInteractif = () =>
    tache(async () => {
      if (!sauvegarde) return;
      const etat = sauvegarde.etat;
      const match = await prochainMatchDansLeMoteur(etat);
      if (!match) throw new Error('Votre franchise ne joue pas au prochain jour de la saison.');
      const repris = etat.matchInteractif?.id === match.id ? etat.matchInteractif : undefined;
      const decisions = repris?.decisions ?? [];
      const arret = repris?.arret ?? 0;
      if (!repris) await garder({ ...etat, matchInteractif: { id: match.id, decisions, arret } });
      setEcran({
        nom: 'interactif',
        franchise: etat.franchise,
        camp: match.domicile === etat.franchise ? 0 : 1,
        match,
        decisions,
        arret,
        retour: { nom: 'saison' },
      });
    });

  /** Fin d'un match interactif de la saison : la saison joue ce jour, avec les décisions du coach (même match). */
  const terminerInteractif = (match: ResumeMatch, decisions: DecisionMatch[], resultat: ResultatMatch) =>
    tache(async () => {
      if (!sauvegarde) return;
      const etat = await avancerDansLeMoteur({ ...sauvegarde.etat, matchInteractif: { id: match.id, decisions, arret: 0 } }, 'jour');
      await garder(etat);
      const joue = etat.matchs.find((m) => m.id === match.id);
      if (joue && joue.empreinte !== resultat.empreinte) throw new Error('Le match enregistré diffère du match joué : signalez ce défaut.');
      setEcran({ nom: 'match', franchise: etat.franchise, resultat, retour: { nom: 'saison' } });
    });

  /** Tranche 7 : observations du GM sur un prospect (dans la limite de son budget et du plafond par prospect). */
  const observer = (prospect: string, delta: number) =>
    tache(async () => {
      const draft = sauvegarde?.etat.draft;
      if (!sauvegarde || !draft || draft.terminee) return;
      const M = modeleDraft.scouting;
      const actuel = draft.observations[prospect] ?? 0;
      const voulu = Math.max(0, Math.min(actuel + delta, M.observationsMax - M.observationsParDefaut));
      if (voulu - actuel > observationsRestantes(M, draft.observations)) return;
      const observations = { ...draft.observations, [prospect]: voulu };
      if (!voulu) delete observations[prospect];
      await garder({ ...sauvegarde.etat, draft: { ...draft, observations } });
    });

  const deleguer = (delegue: boolean) =>
    tache(async () => {
      const draft = sauvegarde?.etat.draft;
      if (!sauvegarde || !draft) return;
      await garder({ ...sauvegarde.etat, draft: { ...draft, delegue } });
    });

  const avancerDraft = (prospect?: string) =>
    tache(async () => {
      if (!sauvegarde) return;
      await garder(await avancerDraftDansLeMoteur(sauvegarde.etat, prospect));
    });

  /** Tranche 8 : intersaison (progression, retraites, contrats, effectifs) et saison suivante. */
  const saisonSuivante = () =>
    tache(async () => {
      if (!sauvegarde) return;
      await garder(await saisonSuivanteDansLeMoteur(sauvegarde.etat));
    });

  /** Tranche 9 : une action du GM (marché, intersaison, staff, composition, délégations) ; rend la réponse à afficher. */
  const agir = async (action: ActionDuGm): Promise<ReponseDuGm | undefined> => {
    let reponse: ReponseDuGm | undefined;
    await tache(async () => {
      if (!sauvegarde) return;
      reponse = await actionDansLeMoteur(sauvegarde.etat, action);
      const lecture = action.genre === 'echange-evaluer' || action.genre === 'ce-qu-il-faudrait' || action.genre === 'offre-reaction';
      if (!lecture) await garder(reponse.etat);
    });
    return reponse;
  };

  const revivre = (m: ResumeMatch, mode: 'rapide' | 'commente') =>
    tache(async () => {
      if (!sauvegarde) return;
      const resultat = await rejouerDansLeMoteur(sauvegarde.etat, m);
      setEcran({
        nom: mode === 'commente' ? 'commente' : 'match',
        franchise: sauvegarde.etat.franchise,
        resultat,
        retour: { nom: 'saison' },
      });
    });

  return (
    <main className="page">
      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}
      {ecran.nom === 'choix' && (
        <ChoixFranchise
          onChoisir={(franchise) => setEcran({ nom: 'effectif', franchise })}
          sauvegarde={sauvegarde}
          onReprendre={() => setEcran({ nom: 'saison' })}
        />
      )}
      {ecran.nom === 'effectif' && (
        <EcranEffectif
          franchise={ecran.franchise}
          derniere={ecran.derniere}
          enCours={enCours}
          onRetour={() => setEcran({ nom: 'choix' })}
          onJouer={(demande) => void jouer(ecran.franchise, demande)}
          onFiche={(joueur) => setEcran({ nom: 'fiche', joueur, retour: ecran })}
          onSaison={() => void commencerSaison(ecran.franchise)}
        />
      )}
      {ecran.nom === 'saison' && sauvegarde && (
        <EcranSaison
          etat={sauvegarde.etat}
          enCours={enCours}
          onAvancer={(cible) => void avancer(cible)}
          onRevivre={(m, mode) => void revivre(m, mode)}
          onInteractif={() => void jouerInteractif()}
          onFiche={(joueur) => setEcran({ nom: 'fiche', joueur, retour: ecran })}
          onQuitter={() => setEcran({ nom: 'choix' })}
          onObserver={(p, d) => void observer(p, d)}
          onDeleguer={(d) => void deleguer(d)}
          onAvancerDraft={(p) => void avancerDraft(p)}
          onSaisonSuivante={() => void saisonSuivante()}
          onAction={agir}
        />
      )}
      {ecran.nom === 'interactif' && (
        <EcranInteractif
          key={String(ecran.entree?.graine ?? ecran.match?.id)}
          camp={ecran.camp}
          decisionsInitiales={ecran.decisions}
          arretInitial={ecran.arret}
          libelleRetour={ecran.match ? 'Retour à la saison' : 'Retour à l’effectif'}
          simuler={(decisions) =>
            ecran.match
              ? rejouerDansLeMoteur(sauvegarde!.etat, { ...ecran.match, decisions }, { arrets: true })
              : simulerDansLeMoteur({ ...ecran.entree!, decisions }, { arrets: true })
          }
          onProgression={
            ecran.match
              ? (decisions, arret) => {
                  if (sauvegarde) void garder({ ...sauvegarde.etat, matchInteractif: { id: ecran.match!.id, decisions, arret } });
                }
              : undefined
          }
          onTerminer={(resultat, decisions) => {
            if (ecran.match) void terminerInteractif(ecran.match, decisions, resultat);
            else setEcran({ nom: 'match', franchise: ecran.franchise, demande: ecran.demande, resultat, retour: ecran.retour });
          }}
          onRetour={() => setEcran(ecran.retour)}
        />
      )}
      {ecran.nom === 'commente' && (
        <EcranCommente
          resultat={ecran.resultat}
          onBoxScore={() => setEcran({ ...ecran, nom: 'match' })}
          onRetour={() => setEcran(ecran.retour)}
        />
      )}
      {ecran.nom === 'match' && (
        <EcranBoxScore
          franchise={ecran.franchise}
          resultat={ecran.resultat}
          enCours={enCours}
          onRejouer={ecran.demande ? () => void jouer(ecran.franchise, { ...ecran.demande!, mode: 'rapide' }) : undefined}
          onRetour={() => setEcran(ecran.retour)}
          onFiche={(joueur) => setEcran({ nom: 'fiche', joueur, resultat: ecran.resultat, retour: ecran })}
        />
      )}
      {ecran.nom === 'fiche' && (
        <EcranFicheJoueur
          joueur={ecran.joueur}
          resultat={ecran.resultat}
          saison={sauvegarde?.etat}
          onRetour={() => setEcran(ecran.retour)}
        />
      )}
    </main>
  );
}
