// Tranches 1 à 4 : choisir une franchise → voir l'effectif → jouer un match isolé (rapide ou commenté) ou lancer la
// saison 2026-27 (calendrier, classements, Play-In, playoffs, palmarès), sauvegardée dans le navigateur.
import { useEffect, useState } from 'react';
import { nouvelleGraine, type ResultatMatch } from '@basket-legends/engine';
import type { Cible, EtatSaison, ResumeMatch, Sauvegarde } from '@basket-legends/league';
import { ChoixFranchise } from './ecrans/ChoixFranchise';
import { EcranEffectif, type DemandeMatch } from './ecrans/Effectif';
import { EcranBoxScore } from './ecrans/BoxScore';
import { EcranCommente } from './ecrans/Commente';
import { EcranFicheJoueur } from './ecrans/FicheJoueur';
import { EcranSaison } from './ecrans/Saison';
import { equipeDe, regles, reglages } from './donnees';
import { avancerDansLeMoteur, nouvelleSaisonDansLeMoteur, rejouerDansLeMoteur, simulerDansLeMoteur } from './moteur';
import { charger, enregistrer } from './sauvegarde';

type Ecran =
  | { nom: 'choix' }
  | { nom: 'effectif'; franchise: string; derniere?: DemandeMatch }
  | { nom: 'match'; franchise: string; demande?: DemandeMatch; resultat: ResultatMatch; retour: Ecran }
  | { nom: 'commente'; franchise: string; demande?: DemandeMatch; resultat: ResultatMatch; retour: Ecran }
  | { nom: 'fiche'; joueur: string; resultat?: ResultatMatch; retour: Ecran }
  | { nom: 'saison' };

export function App() {
  const [ecran, setEcran] = useState<Ecran>({ nom: 'choix' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const [sauvegarde, setSauvegarde] = useState<Sauvegarde>();

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
      const resultat = await simulerDansLeMoteur({
        graine: demande.graine,
        domicile: equipeDe(domicile),
        exterieur: equipeDe(exterieur),
        regles,
        reglages,
      });
      const retour: Ecran = { nom: 'effectif', franchise, derniere: demande };
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
          onFiche={(joueur) => setEcran({ nom: 'fiche', joueur, retour: ecran })}
          onQuitter={() => setEcran({ nom: 'choix' })}
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
