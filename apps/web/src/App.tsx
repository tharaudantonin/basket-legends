// Tranches 1 et 3 : choisir une franchise → voir l'effectif → simuler un match (rapide ou commenté, même moteur, même
// résultat) → lire le box score → ouvrir la fiche d'un joueur.
import { useState } from 'react';
import type { ResultatMatch } from '@basket-legends/engine';
import { ChoixFranchise } from './ecrans/ChoixFranchise';
import { EcranEffectif, type DemandeMatch } from './ecrans/Effectif';
import { EcranBoxScore } from './ecrans/BoxScore';
import { EcranCommente } from './ecrans/Commente';
import { EcranFicheJoueur } from './ecrans/FicheJoueur';
import { equipeDe, regles, reglages } from './donnees';
import { simulerDansLeMoteur } from './moteur';

type Ecran =
  | { nom: 'choix' }
  | { nom: 'effectif'; franchise: string; derniere?: DemandeMatch }
  | { nom: 'match'; franchise: string; demande: DemandeMatch; resultat: ResultatMatch }
  | { nom: 'commente'; franchise: string; demande: DemandeMatch; resultat: ResultatMatch }
  | { nom: 'fiche'; joueur: string; resultat?: ResultatMatch; retour: Ecran };

export function App() {
  const [ecran, setEcran] = useState<Ecran>({ nom: 'choix' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string>();

  const jouer = async (franchise: string, demande: DemandeMatch) => {
    setEnCours(true);
    setErreur(undefined);
    try {
      const [domicile, exterieur] = demande.aDomicile ? [franchise, demande.adversaire] : [demande.adversaire, franchise];
      const resultat = await simulerDansLeMoteur({
        graine: demande.graine,
        domicile: equipeDe(domicile),
        exterieur: equipeDe(exterieur),
        regles,
        reglages,
      });
      setEcran({ nom: demande.mode === 'commente' ? 'commente' : 'match', franchise, demande, resultat });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <main className="page">
      {erreur && (
        <p className="erreur" role="alert">
          Le match n'a pas pu être simulé : {erreur}
        </p>
      )}
      {ecran.nom === 'choix' && <ChoixFranchise onChoisir={(franchise) => setEcran({ nom: 'effectif', franchise })} />}
      {ecran.nom === 'effectif' && (
        <EcranEffectif
          franchise={ecran.franchise}
          derniere={ecran.derniere}
          enCours={enCours}
          onRetour={() => setEcran({ nom: 'choix' })}
          onJouer={(demande) => void jouer(ecran.franchise, demande)}
          onFiche={(joueur) => setEcran({ nom: 'fiche', joueur, retour: ecran })}
        />
      )}
      {ecran.nom === 'commente' && (
        <EcranCommente
          resultat={ecran.resultat}
          onBoxScore={() => setEcran({ ...ecran, nom: 'match' })}
          onRetour={() => setEcran({ nom: 'effectif', franchise: ecran.franchise, derniere: ecran.demande })}
        />
      )}
      {ecran.nom === 'match' && (
        <EcranBoxScore
          franchise={ecran.franchise}
          resultat={ecran.resultat}
          enCours={enCours}
          onRejouer={() => void jouer(ecran.franchise, { ...ecran.demande, mode: 'rapide' })}
          onRetour={() => setEcran({ nom: 'effectif', franchise: ecran.franchise, derniere: ecran.demande })}
          onFiche={(joueur) => setEcran({ nom: 'fiche', joueur, resultat: ecran.resultat, retour: ecran })}
        />
      )}
      {ecran.nom === 'fiche' && (
        <EcranFicheJoueur joueur={ecran.joueur} resultat={ecran.resultat} onRetour={() => setEcran(ecran.retour)} />
      )}
    </main>
  );
}
