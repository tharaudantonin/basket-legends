"""Migration de la tranche 0 (24 novembre 2026) — à exécuter une seule fois.

Ce que fait ce script (docs/DECISIONS_2026-11.md, réponses 2, 5 et 10) :
  1. sauvegarde les 30 effectifs d'origine dans le dossier privé, hors du dépôt ;
  2. donne à chaque joueur un identifiant stable sans nom réel (j0001 à j0523) ;
  3. propose un nom fictif aux mêmes initiales, selon la nationalité (banques de data/noms/banques.json) ;
  4. sort du dépôt le vrai nom (table de correspondance privée) et les notes NBA 2K (fichier privé) ;
  5. range chaque effectif sous l'identifiant canonique de sa franchise (data/franchises.json) ;
  6. écrit les empreintes des vrais noms (data/noms/empreintes.json) pour que le jeu ne les tire jamais.

Lecture : data/rosters/2026-27/*.json (avant migration), data/franchises.json, data/noms/banques.json,
          <prive>/cultures-noms.json et <prive>/celebrites.json.
Écriture : data/rosters/2026-27/<franchise>.json, data/noms/empreintes.json, et dans <prive> :
           correspondance.csv, notes-nba2k27.json, effectifs-avant-tranche0/.

Usage : python -I tools/migrations/2026-11-24-tranche0.py <dossier du dépôt> <dossier privé>
Les vrais noms ne sont lus que depuis les fichiers d'origine ; aucun n'est écrit dans le dépôt.
"""
import csv
import glob
import hashlib
import json
import os
import random
import re
import shutil
import sys
import unicodedata

DEPOT, PRIVE = sys.argv[1], sys.argv[2]
DOSSIER = os.path.join(DEPOT, "data", "rosters", "2026-27")
PARTICULES = {"de", "da", "di", "del", "van", "von", "der", "la", "le", "dos"}
SUFFIXE = re.compile(r",?\s+(Jr\.?|Sr\.?|II|III|IV)$")
INITIALES_SEULES = re.compile(r"^(?:[A-Z]\.){2}$|^[A-Z]{2}$")


def lire_json(chemin):
    with open(chemin, encoding="utf-8") as f:
        return json.load(f)


def ecrire_json(chemin, donnees):
    with open(chemin, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(donnees, ensure_ascii=False, indent=2) + "\n")


def normaliser(texte):
    """Forme comparable d'un nom : sans accents, minuscules, lettres et espaces seulement, sans suffixe."""
    t = SUFFIXE.sub("", texte)
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    t = re.sub(r"[^a-z ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def empreinte(texte):
    return hashlib.sha256(("basket-legends:" + normaliser(texte)).encode("utf-8")).hexdigest()


def decouper(nom):
    """Prénom, mots du nom de famille, suffixe."""
    m = SUFFIXE.search(nom)
    suffixe = None
    if m:
        s = m.group(1)
        suffixe = "Jr." if s.startswith("Jr") else ("Sr." if s.startswith("Sr") else s)
        nom = nom[: m.start()]
    mots = nom.split()
    return mots[0], mots[1:], suffixe


def initiales(prenom, mots_nom):
    lettres = []
    for p in prenom.replace("-", " ").split():
        if INITIALES_SEULES.match(prenom):
            lettres += [c for c in prenom if c.isalpha()]
            break
        lettres.append(p[0].upper())
    for mot in mots_nom:
        if mot.lower() in PARTICULES:
            continue
        for partie in mot.split("-"):
            lettres.append(partie[0].upper())
    return "".join(lettres)


def graine(*cles):
    return int(hashlib.sha256("|".join(cles).encode("utf-8")).hexdigest()[:12], 16)


def main():
    banques = lire_json(os.path.join(DEPOT, "data", "noms", "banques.json"))
    cultures = banques["cultures"]
    par_pays = banques["culturesParPays"]
    franchises = lire_json(os.path.join(DEPOT, "data", "franchises.json"))["franchises"]
    id_par_nom = {f["fictionalName"]: f["id"] for f in franchises}
    surcharges = lire_json(os.path.join(PRIVE, "cultures-noms.json"))
    culture_nom_reel = {n: c for c, noms in surcharges["nomsDeFamille"].items() for n in noms}
    culture_prenom_joueur = surcharges["prenomsParJoueur"]
    celebrites = lire_json(os.path.join(PRIVE, "celebrites.json"))

    fichiers = sorted(glob.glob(os.path.join(DOSSIER, "*.json")))
    assert len(fichiers) == 30, f"30 effectifs attendus, {len(fichiers)} trouvés"
    effectifs = []
    for chemin in fichiers:
        d = lire_json(chemin)
        if any("sourceName" not in p for p in d["players"]):
            raise SystemExit("Migration déjà faite : les effectifs n'ont plus de vrais noms. Rien n'est modifié.")
        fid = id_par_nom[d["franchise"]["fictionalName"]]
        effectifs.append((fid, chemin, d))
    effectifs.sort(key=lambda e: e[0])

    # 1. Sauvegarde privée des fichiers d'origine.
    sauvegarde = os.path.join(PRIVE, "effectifs-avant-tranche0")
    os.makedirs(sauvegarde, exist_ok=True)
    for _, chemin, _ in effectifs:
        shutil.copy2(chemin, os.path.join(sauvegarde, os.path.basename(chemin)))

    joueurs = [(fid, p) for fid, _, d in effectifs for p in d["players"]]
    vrais_complets = {normaliser(p["sourceName"]) for _, p in joueurs}
    vrais_mots = set()
    for _, p in joueurs:
        prenom, mots, _ = decouper(p["sourceName"])
        for mot in mots:
            for partie in mot.split("-"):
                vrais_mots.add(normaliser(partie))
    interdits_complets = vrais_complets | {normaliser(n) for n in celebrites["nomsComplets"]}
    interdits_noms = vrais_mots | {normaliser(n) for n in celebrites["nomsDeFamille"]}

    def banque(culture, sorte, cle):
        return cultures.get(culture, {}).get(sorte, {}).get(cle, [])

    def candidats(culture, sorte, cle):
        liste = banque(culture, sorte, cle)
        if not liste and culture != "anglo":
            liste = banque("anglo", sorte, cle)
        return liste

    # 2. Noms de famille : un même vrai nom donne toujours le même nom fictif ; deux vrais noms différents, deux noms fictifs différents.
    nom_fictif = {}
    utilises = set()
    alertes = []

    def traduire_nom(partie, culture):
        cle_reelle = normaliser(partie)
        if cle_reelle in nom_fictif:
            return nom_fictif[cle_reelle]
        if partie.startswith("Mc"):
            cle = "Mc"
        elif partie.startswith("O'"):
            cle = "O'"
        else:
            cle = partie[0].upper()
        liste = candidats(culture, "noms", cle)
        if cle in ("Mc", "O'") and not liste:
            liste = candidats(culture, "noms", partie[0].upper())
        ordre = sorted(liste)
        random.Random(graine("nom", cle_reelle)).shuffle(ordre)
        libres = [n for n in ordre if normaliser(n) not in interdits_noms and normaliser(n) not in utilises]
        if not libres:
            libres = [n for n in ordre if normaliser(n) not in interdits_noms]
            alertes.append(f"banque {culture}/{cle} épuisée : nom fictif réutilisé")
        assert libres, f"aucun nom libre pour l'initiale {cle} ({culture})"
        choix = libres[0]
        nom_fictif[cle_reelle] = choix
        utilises.add(normaliser(choix))
        return choix

    correspondance = []
    notes_2k = {}
    complets_utilises = set()
    nouveaux = {}
    numero = 0
    for fid, chemin, d in effectifs:
        liste = []
        for p in d["players"]:
            numero += 1
            nid = f"j{numero:04d}"
            reel = p["sourceName"]
            pays = p["country"]
            prenom_reel, mots_reels, suffixe = decouper(reel)
            cult = par_pays[pays]
            cult_prenom = culture_prenom_joueur.get(reel, cult["prenoms"])

            # Nom de famille, mot par mot (particules et traits d'union gardés).
            mots_fictifs = []
            cultures_nom = []
            for mot in mots_reels:
                if mot.lower() in PARTICULES:
                    mots_fictifs.append(mot)
                    continue
                parties = []
                for partie in mot.split("-"):
                    c = culture_nom_reel.get(partie, culture_nom_reel.get(mot, cult["noms"]))
                    cultures_nom.append(c)
                    parties.append(traduire_nom(partie, c))
                mots_fictifs.append("-".join(parties))
            nom = " ".join(mots_fictifs)

            # Prénom : initiales conservées telles quelles, sinon tirage dans la banque.
            if INITIALES_SEULES.match(prenom_reel):
                prenom = prenom_reel
            else:
                parties_prenom = []
                for k, partie in enumerate(prenom_reel.split("-")):
                    liste_prenoms = sorted(candidats(cult_prenom, "prenoms", partie[0].upper()))
                    assert liste_prenoms, f"aucun prénom en {partie[0]} ({cult_prenom})"
                    random.Random(graine("prenom", nid, str(k))).shuffle(liste_prenoms)
                    for essai in liste_prenoms:
                        if normaliser(essai) == normaliser(partie):
                            continue
                        candidat = "-".join(parties_prenom + [essai])
                        complet = normaliser(f"{candidat} {nom}")
                        if k == len(prenom_reel.split("-")) - 1 and (complet in interdits_complets or complet in complets_utilises):
                            continue
                        parties_prenom.append(essai)
                        break
                    else:
                        raise SystemExit(f"aucun prénom possible pour {nid}")
                prenom = "-".join(parties_prenom)
            affiche = f"{prenom} {nom}" + (f" {suffixe}" if suffixe else "")
            complet = normaliser(affiche)
            assert complet not in interdits_complets, nid
            assert complet not in complets_utilises, nid
            complets_utilises.add(complet)
            ini = initiales(prenom, mots_fictifs)
            assert ini == initiales(prenom_reel, mots_reels), f"initiales différentes pour {nid}"

            correspondance.append({
                "id": nid, "franchiseId": fid, "ancienId": p["id"], "nomReel": reel, "nomFictif": affiche,
                "culturePrenom": cult_prenom, "cultureNom": "+".join(dict.fromkeys(cultures_nom)) or "-",
            })
            notes = p.get("notes") or {}
            if "nba2k27" in notes:
                notes_2k[nid] = notes["nba2k27"]
            notes_restantes = {k: v for k, v in notes.items() if k != "nba2k27"} or None

            ratings = dict(p["ratings"])
            ratings["source"] = "provisional"
            ratings["status"] = "provisional-pending-rating-model-v1"
            ratings["note"] = "Valeurs provisoires du 18/11/2026, alignées sur une référence tierce privée ; à remplacer par le modèle de notes v1 (docs/DECISIONS_2026-11.md, réponse 2)."

            nouveau = {}
            for cle, valeur in p.items():
                if cle == "id":
                    nouveau["id"] = nid
                elif cle == "sourceName":
                    continue
                elif cle == "fictionalDisplayName":
                    nouveau["fictionalDisplayName"] = affiche
                    nouveau["fictionalFirstName"] = prenom
                    nouveau["fictionalLastName"] = nom
                    nouveau["fictionalSuffix"] = suffixe
                elif cle == "fictionalInitials":
                    nouveau["fictionalInitials"] = ini
                    nouveau["nameStatus"] = "proposed-pending-review"
                elif cle == "ratings":
                    nouveau["ratings"] = ratings
                elif cle == "notes":
                    nouveau["notes"] = notes_restantes
                else:
                    nouveau[cle] = valeur
            liste.append(nouveau)
        nouveaux[fid] = (chemin, d, liste)

    # 3. Écriture des effectifs sous l'identifiant canonique.
    for fid, (chemin, d, liste) in nouveaux.items():
        sortie = {
            "schemaVersion": 2,
            "datasetId": "basket-legends-rosters-2026-27",
            "snapshot": {"season": "2026-2027", "date": "2026-11-17", "timezone": "America/New_York", "status": "approved"},
            "franchise": {**d["franchise"], "id": fid},
            "roster": d["roster"],
            "provenance": {
                **d["provenance"],
                "names": "Noms fictifs aux mêmes initiales, proposés le 24/11/2026 et à relire (nameStatus). La table de correspondance avec les vrais noms est gardée hors du dépôt.",
                "ratings": "Notes et attributs provisoires ; les notes NBA 2K ont été retirées du dépôt le 24/11/2026.",
            },
            "units": d["units"],
            "players": liste,
        }
        os.remove(chemin)
        ecrire_json(os.path.join(DOSSIER, f"{fid}.json"), sortie)

    # 4. Fichiers privés.
    with open(os.path.join(PRIVE, "correspondance.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(correspondance[0].keys()))
        w.writeheader()
        w.writerows(correspondance)
    ecrire_json(os.path.join(PRIVE, "notes-nba2k27.json"), {"description": "Privé. Notes NBA 2K27 relevées le 17-18/11/2026, banc d'essai seulement (réponse 2 du 24/11/2026). Clés : identifiants des joueurs.", "notes": notes_2k})

    # 5. Empreintes des vrais noms (dépôt).
    ecrire_json(os.path.join(DEPOT, "data", "noms", "empreintes.json"), {
        "schemaVersion": 1,
        "description": "Empreintes SHA-256 des vrais noms à ne jamais produire : joueurs réels du snapshot et personnes connues. Aucun nom en clair.",
        "normalisation": "sha256('basket-legends:' + nom sans accents, en minuscules, lettres et espaces seulement, sans suffixe Jr./II/III)",
        "nomsComplets": sorted({empreinte(n) for _, p in joueurs for n in [p["sourceName"]]} | {empreinte(n) for n in celebrites["nomsComplets"]}),
        "nomsDeFamille": sorted({hashlib.sha256(("basket-legends:" + m).encode("utf-8")).hexdigest() for m in interdits_noms}),
    })

    print(f"{numero} joueurs migrés, {len(nom_fictif)} noms de famille fictifs, {len(notes_2k)} notes 2K sorties")
    for a in sorted(set(alertes)):
        print("ALERTE", a)


if __name__ == "__main__":
    main()
