// Vérification des données de référence (tranche 0), côté Node : `npm run verifier` et les tests.
// Chaque problème est décrit en français, avec le fichier et l'élément concernés.
import { createHash } from 'node:crypto';
import { initialesDe, normaliserNom, partiesDuNom } from './noms';
import {
  schemaBanques,
  schemaCba,
  schemaChoixDraft,
  schemaEchelleRookies,
  schemaHistoriqueLoterie,
  schemaLoterie,
  schemaModeleDraft,
  schemaContrats,
  schemaEffectif,
  schemaEmpreintes,
  schemaParametresNotes,
  schemaReglagesMatch,
  schemaRegistre,
  schemaRegles,
  schemaSaisonLigue,
  schemaStatistiquesJoueurs,
  schemaStatistiquesLigue,
  schemaVivier,
  type Effectif,
  type Registre,
} from './schemas';

/** Les numéros partagés volontairement, à titre provisoire (docs/DECISIONS_2026-11.md, réponse 10 ; docs/PLAYER_MIRROR.md § 5). */
export const NUMEROS_PARTAGES_ADMIS: Record<string, string[]> = { chicago: ['7'], toronto: ['9'] };

export interface SourcesDonnees {
  /** Contenu de data/franchises.json. */
  registre: unknown;
  /** Contenu texte de data/franchises.csv. */
  csv: string;
  /** Contenu de chaque fichier de data/rosters/2026-27/, par nom de fichier. */
  effectifs: Record<string, unknown>;
  banques: unknown;
  empreintes: unknown;
  /** Tranche 1 : contenu de chaque fichier de data/regles/, par nom de fichier. */
  regles: Record<string, unknown>;
  /** Tranche 1 : contenu de chaque fichier de data/moteur/, par nom de fichier. */
  reglagesMatch: Record<string, unknown>;
  /** Tranche 2 : contenu de data/statistiques/2025-26/, par nom de fichier. */
  statistiques: Record<string, unknown>;
  /** Tranche 2 : contenu de data/modeles/, par nom de fichier. */
  modelesNotes: Record<string, unknown>;
  /** Tranche 4 : contenu de data/ligue/, par nom de fichier. */
  ligue: Record<string, unknown>;
  /** Tranche 6 : contenu de data/cba/ et de data/contrats/, par nom de fichier. */
  cba: Record<string, unknown>;
  contrats: Record<string, unknown>;
  /** Tranche 7 : contenu de data/draft/, par nom de fichier. */
  draft: Record<string, unknown>;
  /** Tranche 7 : contenu de data/vivier/, par nom de fichier. */
  vivier: Record<string, unknown>;
}

export interface Rapport {
  erreurs: string[];
  avertissements: string[];
  joueurs: number;
}

export function empreinte(nom: string): string {
  return createHash('sha256').update(`basket-legends:${normaliserNom(nom)}`, 'utf8').digest('hex');
}

/** Lit un CSV dont tous les champs sont entre guillemets (format de data/franchises.csv). */
export function lireCsv(texte: string): Record<string, string>[] {
  const lignes: string[][] = [];
  let champ = '';
  let ligne: string[] = [];
  let entreGuillemets = false;
  const t = texte.replace(/\r\n/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entreGuillemets) {
      if (c === '"' && t[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') entreGuillemets = false;
      else champ += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === ',') {
      ligne.push(champ);
      champ = '';
    } else if (c === '\n') {
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = '';
    } else champ += c;
  }
  if (champ !== '' || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  const [entete, ...corps] = lignes;
  if (!entete) return [];
  return corps.map((l) => Object.fromEntries(entete.map((cle, k) => [cle, l[k] ?? ''])));
}

function messagesZod(fichier: string, resultat: { error?: { issues: { path: PropertyKey[]; message: string }[] } }): string[] {
  return (resultat.error?.issues ?? []).map((i) => `${fichier} : ${i.path.map(String).join('.') || '(racine)'} — ${i.message}`);
}

export function verifierDonnees(sources: SourcesDonnees): Rapport {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  let joueurs = 0;

  // 1. Registre des franchises.
  const registre = schemaRegistre.safeParse(sources.registre);
  if (!registre.success) erreurs.push(...messagesZod('data/franchises.json', registre));
  const franchises: Registre['franchises'] = registre.success ? registre.data.franchises : [];
  const idsFranchises = new Set<string>();
  for (const f of franchises) {
    if (idsFranchises.has(f.id)) erreurs.push(`data/franchises.json : identifiant de franchise en double « ${f.id} »`);
    idsFranchises.add(f.id);
  }
  const nomsFranchises = franchises.map((f) => f.fictionalName);
  if (new Set(nomsFranchises).size !== nomsFranchises.length) erreurs.push('data/franchises.json : deux franchises portent le même nom');

  // 2. Miroir CSV : mêmes franchises, mêmes noms, mêmes palettes que le JSON (le JSON fait foi).
  const lignesCsv = lireCsv(sources.csv);
  if (lignesCsv.length !== franchises.length) erreurs.push(`data/franchises.csv : ${lignesCsv.length} lignes pour ${franchises.length} franchises`);
  for (const f of franchises) {
    const l = lignesCsv.find((x) => x.id === f.id);
    if (!l) {
      erreurs.push(`data/franchises.csv : franchise « ${f.id} » absente`);
      continue;
    }
    const attendu: Record<string, string> = {
      city: f.city,
      referenceClub: f.referenceClub,
      fictionalName: f.fictionalName,
      creativeTerritory: f.creativeTerritory,
      ...f.palette,
    };
    for (const [cle, valeur] of Object.entries(attendu)) {
      if (l[cle] !== valeur) erreurs.push(`data/franchises.csv : « ${f.id} ».${cle} diffère du JSON`);
    }
  }

  // 3. Empreintes des vrais noms.
  const empreintes = schemaEmpreintes.safeParse(sources.empreintes);
  if (!empreintes.success) erreurs.push(...messagesZod('data/noms/empreintes.json', empreintes));
  const interditsComplets = new Set(empreintes.success ? empreintes.data.nomsComplets : []);
  const interditsNoms = new Set(empreintes.success ? empreintes.data.nomsDeFamille : []);

  // 4. Banques de noms.
  const banques = schemaBanques.safeParse(sources.banques);
  if (!banques.success) erreurs.push(...messagesZod('data/noms/banques.json', banques));
  if (banques.success) {
    for (const [culture, c] of Object.entries(banques.data.cultures)) {
      for (const [initiale, noms] of Object.entries(c.noms ?? {})) {
        for (const nom of noms) {
          if (!nom.startsWith(initiale)) erreurs.push(`data/noms/banques.json : « ${nom} » rangé sous ${initiale} (${culture})`);
          if (partiesDuNom(nom).some((p) => interditsNoms.has(empreinte(p))))
            avertissements.push(`data/noms/banques.json : le nom « ${nom} » (${culture}) correspond à un nom réel interdit`);
        }
      }
    }
  }
  const culturesParPays = banques.success ? banques.data.culturesParPays : {};

  // 5. Effectifs.
  const fichiers = Object.keys(sources.effectifs).sort();
  if (fichiers.length !== 30) erreurs.push(`data/rosters/2026-27 : ${fichiers.length} effectifs au lieu de 30`);
  const idsJoueurs = new Set<string>();
  const nomsAffiches = new Set<string>();
  for (const fichier of fichiers) {
    const chemin = `data/rosters/2026-27/${fichier}`;
    const lu = schemaEffectif.safeParse(sources.effectifs[fichier]);
    if (!lu.success) {
      erreurs.push(...messagesZod(chemin, lu));
      continue;
    }
    const e: Effectif = lu.data;
    if (`${e.franchise.id}.json` !== fichier) erreurs.push(`${chemin} : le fichier devrait s'appeler ${e.franchise.id}.json`);
    if (!idsFranchises.has(e.franchise.id)) erreurs.push(`${chemin} : franchise « ${e.franchise.id} » inconnue du registre`);
    const f = franchises.find((x) => x.id === e.franchise.id);
    if (f && f.fictionalName !== e.franchise.fictionalName) erreurs.push(`${chemin} : nom de franchise différent du registre`);
    if (e.roster.playerCount !== e.players.length) erreurs.push(`${chemin} : ${e.players.length} joueurs pour ${e.roster.playerCount} annoncés`);

    const numeros = new Map<string, string[]>();
    for (const j of e.players) {
      joueurs++;
      const ou = `${chemin} : ${j.id}`;
      if (idsJoueurs.has(j.id)) erreurs.push(`${ou} : identifiant en double`);
      idsJoueurs.add(j.id);
      if (nomsAffiches.has(j.fictionalDisplayName)) erreurs.push(`${ou} : nom fictif « ${j.fictionalDisplayName} » déjà porté`);
      nomsAffiches.add(j.fictionalDisplayName);
      const affiche = [j.fictionalFirstName, j.fictionalLastName, j.fictionalSuffix].filter(Boolean).join(' ');
      if (affiche !== j.fictionalDisplayName) erreurs.push(`${ou} : nom affiché incohérent avec prénom, nom et suffixe`);
      if (initialesDe(j.fictionalFirstName, j.fictionalLastName) !== j.fictionalInitials)
        erreurs.push(`${ou} : initiales « ${j.fictionalInitials} » incohérentes avec « ${j.fictionalDisplayName} »`);
      if (interditsComplets.has(empreinte(j.fictionalDisplayName))) erreurs.push(`${ou} : le nom fictif est un nom réel interdit`);
      for (const p of partiesDuNom(j.fictionalLastName)) {
        if (interditsNoms.has(empreinte(p))) erreurs.push(`${ou} : le nom de famille « ${p} » est un nom réel interdit`);
      }
      if (!culturesParPays[j.country]) avertissements.push(`${ou} : pays « ${j.country} » sans culture de noms`);

      // Mensurations : la valeur métrique doit découler de la valeur source.
      const h = j.measurements.height;
      const m = /^(\d)-(\d{1,2})$/.exec(h.sourceValue);
      if (!m) erreurs.push(`${ou} : taille source « ${h.sourceValue} » illisible`);
      else if (Math.round((Number(m[1]) * 12 + Number(m[2])) * 2.54) !== h.heightCm) erreurs.push(`${ou} : conversion de taille incorrecte`);
      const w = j.measurements.weight;
      const kg = w.sourceUnit === 'lb' ? Math.round(w.sourceValue * 0.45359237) : w.sourceValue;
      if (kg !== w.weightKg) erreurs.push(`${ou} : conversion de poids incorrecte`);

      const liste = numeros.get(j.jerseyNumber) ?? [];
      liste.push(j.id);
      numeros.set(j.jerseyNumber, liste);
    }
    for (const [numero, ids] of numeros) {
      if (ids.length < 2) continue;
      const admis = NUMEROS_PARTAGES_ADMIS[e.franchise.id]?.includes(numero);
      const message = `${chemin} : numéro ${numero} porté par ${ids.join(' et ')}`;
      if (admis) avertissements.push(`${message} (provisoire, admis)`);
      else erreurs.push(message);
    }
  }

  // 6. Tranche 1 : règles du match (une par saison) et réglages du moteur.
  if (!Object.keys(sources.regles).length) erreurs.push('data/regles : aucun fichier de règles');
  for (const [fichier, contenu] of Object.entries(sources.regles)) {
    const chemin = `data/regles/${fichier}`;
    const lu = schemaRegles.safeParse(contenu);
    if (!lu.success) {
      erreurs.push(...messagesZod(chemin, lu));
      continue;
    }
    const r = lu.data;
    if (`nba-${r.season.slice(0, 4)}-${r.season.slice(7)}.json` !== fichier) erreurs.push(`${chemin} : le fichier devrait s'appeler nba-${r.season.slice(0, 4)}-${r.season.slice(7)}.json`);
    if (r.status !== 'validated' && r.status !== 'tested' && r.status !== 'implemented')
      avertissements.push(`${chemin} : règles au statut « ${r.status} », pas encore vérifiées contre le règlement officiel`);
    if (r.possessionDebutDePeriode.valeur.length !== r.parametres.periodesReglementaires.valeur)
      erreurs.push(`${chemin} : possessionDebutDePeriode doit donner une valeur par période réglementaire`);
  }
  if (!Object.keys(sources.reglagesMatch).length) erreurs.push('data/moteur : aucun fichier de réglages du match');
  for (const [fichier, contenu] of Object.entries(sources.reglagesMatch)) {
    const chemin = `data/moteur/${fichier}`;
    const lu = schemaReglagesMatch.safeParse(contenu);
    if (!lu.success) {
      erreurs.push(...messagesZod(chemin, lu));
      continue;
    }
    const g = lu.data;
    const somme = g.tirs.repartition.cercle + g.tirs.repartition.miDistance + g.tirs.repartition.troisPoints;
    if (Math.abs(somme - 1) > 1e-9) erreurs.push(`${chemin} : la répartition des tirs doit faire 1 (elle fait ${somme})`);
    if (g.fatigue.seuilRetour < g.fatigue.seuilRemplacement) erreurs.push(`${chemin} : le seuil de retour doit être au moins le seuil de remplacement`);
    if (g.status === 'provisoire-non-calibre') avertissements.push(`${chemin} : réglages provisoires, non calibrés (tranche 2)`);
  }

  // 7. Tranche 2 : statistiques 2025-2026 et modèle de notes.
  const statsJoueurs = schemaStatistiquesJoueurs.safeParse(sources.statistiques['joueurs.json']);
  if (!statsJoueurs.success) erreurs.push(...messagesZod('data/statistiques/2025-26/joueurs.json', statsJoueurs));
  else {
    for (const id of Object.keys(statsJoueurs.data.joueurs)) {
      if (!idsJoueurs.has(id)) erreurs.push(`data/statistiques/2025-26/joueurs.json : ${id} absent des effectifs`);
    }
  }
  const statsLigue = schemaStatistiquesLigue.safeParse(sources.statistiques['ligue.json']);
  if (!statsLigue.success) erreurs.push(...messagesZod('data/statistiques/2025-26/ligue.json', statsLigue));
  else {
    const d = statsLigue.data.tirsParDistance;
    const parts = d.zero_trois_pieds.part + d.trois_dix_pieds.part + d.dix_seize_pieds.part + d.seize_pieds_ligne.part + d.trois_points.part;
    if (Math.abs(parts - 1) > 0.002) erreurs.push(`data/statistiques/2025-26/ligue.json : les parts de tirs par distance font ${parts.toFixed(3)} au lieu de 1`);
  }
  const versions = new Set<string>();
  for (const [fichier, contenu] of Object.entries(sources.modelesNotes)) {
    const lu = schemaParametresNotes.safeParse(contenu);
    if (!lu.success) {
      erreurs.push(...messagesZod(`data/modeles/${fichier}`, lu));
      continue;
    }
    versions.add(lu.data.version);
    if (lu.data.status === 'proposition') avertissements.push(`data/modeles/${fichier} : modèle de notes au statut « proposition », à valider par Antonin`);
  }
  for (const fichier of fichiers) {
    const lu = schemaEffectif.safeParse(sources.effectifs[fichier]);
    if (!lu.success) continue;
    for (const j of lu.data.players) {
      if (j.ratings.correction === 'corrigé par Antonin') continue;
      if (!versions.has(j.ratings.source))
        erreurs.push(`data/rosters/2026-27/${fichier} : ${j.id} a une note de source « ${j.ratings.source} », d'aucun modèle de notes connu`);
    }
  }

  // 8. Tranche 4 : structure de la saison.
  if (!Object.keys(sources.ligue).length) erreurs.push('data/ligue : aucun fichier de saison');
  for (const [fichier, contenu] of Object.entries(sources.ligue)) {
    const chemin = `data/ligue/${fichier}`;
    const lu = schemaSaisonLigue.safeParse(contenu);
    if (!lu.success) {
      erreurs.push(...messagesZod(chemin, lu));
      continue;
    }
    const listees = lu.data.conferences.flatMap((c) => c.divisions.flatMap((d) => d.franchises));
    if (new Set(listees).size !== listees.length) erreurs.push(`${chemin} : une franchise figure dans deux divisions`);
    for (const id of idsFranchises) if (!listees.includes(id)) erreurs.push(`${chemin} : la franchise « ${id} » n'est dans aucune division`);
    for (const id of listees) if (!idsFranchises.has(id)) erreurs.push(`${chemin} : franchise « ${id} » inconnue du registre`);
  }

  // 9. Tranche 6 : paramètres de la CBA et contrats.
  if (!Object.keys(sources.cba).length) erreurs.push('data/cba : aucun fichier de paramètres de la CBA');
  for (const [fichier, contenu] of Object.entries(sources.cba)) {
    const chemin = `data/cba/${fichier}`;
    const lu = schemaCba.safeParse(contenu);
    if (!lu.success) {
      erreurs.push(...messagesZod(chemin, lu));
      continue;
    }
    const P = lu.data.parametres;
    if (!(P.masseMinimale.valeur < P.plafondSalarial.valeur && P.plafondSalarial.valeur < P.seuilTaxe.valeur && P.seuilTaxe.valeur < P.premierApron.valeur && P.premierApron.valeur < P.deuxiemeApron.valeur))
      erreurs.push(`${chemin} : il faut masse minimale < plafond < seuil de taxe < premier apron < second apron`);
    for (const m of P.salaireMaximum.valeur)
      if (Math.abs(m.montant - m.partDuPlafond * P.plafondSalarial.valeur) > 1)
        erreurs.push(`${chemin} : le maximum de ${m.ancienneteMin} ans (${m.montant}) ne vaut pas ${m.partDuPlafond * 100} % du plafond`);
    const mins = P.salaireMinimum.valeur;
    if (mins.some((x, i) => i > 0 && x < mins[i - 1]!)) erreurs.push(`${chemin} : le salaire minimum doit croître avec l'ancienneté`);
    if (P.taxe.valeur.taux.length !== P.taxe.valeur.tauxRecidiviste.length) erreurs.push(`${chemin} : autant de taux récidivistes que de taux`);
  }
  const franchiseDuJoueur = new Map<string, string>();
  for (const e of Object.values(sources.effectifs) as { franchise?: { id?: string }; players?: { id?: string }[] }[])
    for (const j of e.players ?? []) if (j.id) franchiseDuJoueur.set(j.id, e.franchise?.id ?? '');
  if (!Object.keys(sources.contrats).length) erreurs.push('data/contrats : aucun fichier de contrats');
  for (const [fichier, contenu] of Object.entries(sources.contrats)) {
    const chemin = `data/contrats/${fichier}`;
    const lu = schemaContrats.safeParse(contenu);
    if (!lu.success) {
      erreurs.push(...messagesZod(chemin, lu));
      continue;
    }
    const c = lu.data;
    for (const id of franchiseDuJoueur.keys()) if (!c.joueurs[id]) erreurs.push(`${chemin} : aucun contrat pour le joueur ${id}`);
    for (const id of Object.keys(c.joueurs)) if (!franchiseDuJoueur.has(id)) erreurs.push(`${chemin} : joueur ${id} absent des effectifs`);
    for (const id of idsFranchises) if (!c.equipes[id]) erreurs.push(`${chemin} : situation salariale absente pour « ${id} »`);
    for (const [id, x] of Object.entries(c.joueurs)) {
      if (x.type === 'standard' && !x.salaires.length) erreurs.push(`${chemin} : contrat standard sans salaire pour ${id}`);
      if (x.type !== 'standard' && x.salaires.length) erreurs.push(`${chemin} : ${id} n'a pas de contrat standard mais a des salaires`);
      if (x.type === 'non-releve') avertissements.push(`${chemin} : contrat de ${id} non relevé`);
    }
    const effectifs = new Map<string, { standard: number; twoWay: number }>();
    for (const [id, x] of Object.entries(c.joueurs)) {
      const e = effectifs.get(franchiseDuJoueur.get(id) ?? '') ?? { standard: 0, twoWay: 0 };
      if (x.type === 'standard') e.standard++;
      if (x.type === 'two-way') e.twoWay++;
      effectifs.set(franchiseDuJoueur.get(id) ?? '', e);
    }
    for (const [equipe, e] of effectifs)
      if (e.standard > 15 || e.twoWay > 3) erreurs.push(`${chemin} : ${equipe} a ${e.standard} contrats standard et ${e.twoWay} two-way`);
  }

  // 10. Tranche 7 : Draft (loterie, historique, propriété des choix, modèle des prospects, échelle des rookies).
  const attendus = ['loterie-2027-2029.json', 'historique-loterie.json', 'modele-draft.json', 'echelle-rookies.json'];
  for (const f of attendus) if (!(f in sources.draft)) erreurs.push(`data/draft : fichier ${f} absent`);
  const equipeConnue = (chemin: string, id: string) => {
    if (!idsFranchises.has(id)) erreurs.push(`${chemin} : franchise « ${id} » inconnue du registre`);
  };
  for (const [fichier, contenu] of Object.entries(sources.draft)) {
    const chemin = `data/draft/${fichier}`;
    if (fichier.startsWith('loterie-')) {
      const lu = schemaLoterie.safeParse(contenu);
      if (!lu.success) {
        erreurs.push(...messagesZod(chemin, lu));
        continue;
      }
      const total = lu.data.categories.reduce((s, c) => s + c.equipes, 0);
      if (total !== lu.data.choixTires) erreurs.push(`${chemin} : ${total} équipes dans les catégories pour ${lu.data.choixTires} choix tirés`);
      for (const c of lu.data.categories)
        if (c.plancher < 1 || c.plancher > lu.data.choixTires) erreurs.push(`${chemin} : plancher ${c.plancher} hors des choix tirés (${c.id})`);
      if (lu.data.statut !== 'valide') avertissements.push(`${chemin} : règles de la loterie à recouper (table officielle des probabilités)`);
    } else if (fichier === 'historique-loterie.json') {
      const lu = schemaHistoriqueLoterie.safeParse(contenu);
      if (!lu.success) erreurs.push(...messagesZod(chemin, lu));
      else for (const annee of Object.values(lu.data.drafts)) for (const id of Object.keys(annee)) equipeConnue(chemin, id);
    } else if (fichier.startsWith('choix-')) {
      const lu = schemaChoixDraft.safeParse(contenu);
      if (!lu.success) {
        erreurs.push(...messagesZod(chemin, lu));
        continue;
      }
      for (const tour of Object.values(lu.data.tours))
        for (const r of tour) {
          for (const m of r.membres) if ('original' in m) equipeConnue(chemin, m.original);
          if (r.condition) equipeConnue(chemin, r.condition.original);
          for (const liste of [...Object.values(r.attributions), ...Object.values(r.attributionsSinon ?? {})])
            for (const a of liste)
              for (const b of [a.beneficiaire, a.sinon]) if (b !== undefined && !b.startsWith('@')) equipeConnue(chemin, b);
          for (const [n, liste] of Object.entries(r.attributions))
            if (liste.length !== Number(n)) erreurs.push(`${chemin} : « ${r.description} » prévoit ${liste.length} attribution(s) pour ${n} choix`);
        }
      if (lu.data.statut !== 'valide') avertissements.push(`${chemin} : propriété des choix à recouper (${lu.data.ecarts.length} écart(s) noté(s))`);
    } else if (fichier === 'modele-draft.json') {
      const lu = schemaModeleDraft.safeParse(contenu);
      if (!lu.success) {
        erreurs.push(...messagesZod(chemin, lu));
        continue;
      }
      const n = lu.data.classe.note;
      if (n.min < 40 || n.max > 67) erreurs.push(`${chemin} : les notes des prospects doivent rester entre 40 et 67 (décision du 24/11/2026)`);
      if (lu.data.scouting.observationsDuConsensus > lu.data.scouting.observationsMax)
        erreurs.push(`${chemin} : le consensus dépasse le plafond d'observations`);
    } else if (fichier === 'echelle-rookies.json') {
      const lu = schemaEchelleRookies.safeParse(contenu);
      if (!lu.success) {
        erreurs.push(...messagesZod(chemin, lu));
        continue;
      }
      lu.data.rangs.forEach((r, i) => {
        if (r.rang !== i + 1) erreurs.push(`${chemin} : rang ${r.rang} à la position ${i + 1}`);
        if (r.montants.some((m, k) => k > 0 && m < r.montants[k - 1]!)) erreurs.push(`${chemin} : salaires décroissants au rang ${r.rang}`);
        if (i > 0 && r.montants[0]! > lu.data.rangs[i - 1]!.montants[0]!) erreurs.push(`${chemin} : le rang ${r.rang} gagne plus que le rang ${r.rang - 1}`);
      });
    } else erreurs.push(`${chemin} : fichier inattendu`);
  }

  // 11. Tranche 7 : vivier de joueurs générés (noms originaux, identifiants uniques, échelle 40-67).
  if (!Object.keys(sources.vivier).length) erreurs.push('data/vivier : aucun fichier de vivier');
  const empreintesLues = schemaEmpreintes.safeParse(sources.empreintes);
  const complets = new Set(empreintesLues.success ? empreintesLues.data.nomsComplets : []);
  const famillesInterdites = new Set(empreintesLues.success ? empreintesLues.data.nomsDeFamille : []);
  const nomsDuSnapshot = new Set<string>();
  for (const e of Object.values(sources.effectifs) as { players?: { fictionalFirstName?: string; fictionalLastName?: string }[] }[])
    for (const j of e.players ?? []) nomsDuSnapshot.add(normaliserNom(`${j.fictionalFirstName} ${j.fictionalLastName}`));
  for (const [fichier, contenu] of Object.entries(sources.vivier)) {
    const chemin = `data/vivier/${fichier}`;
    const lu = schemaVivier.safeParse(contenu);
    if (!lu.success) {
      erreurs.push(...messagesZod(chemin, lu));
      continue;
    }
    const ids = new Set<string>();
    const noms = new Set<string>();
    for (const j of lu.data.joueurs) {
      const complet = `${j.prenom} ${j.nom}`;
      if (ids.has(j.id)) erreurs.push(`${chemin} : identifiant en double ${j.id}`);
      ids.add(j.id);
      if (noms.has(normaliserNom(complet))) erreurs.push(`${chemin} : nom en double « ${complet} »`);
      noms.add(normaliserNom(complet));
      if (nomsDuSnapshot.has(normaliserNom(complet))) erreurs.push(`${chemin} : ${j.id} porte le nom d'un joueur du snapshot`);
      if (complets.has(empreinte(complet)) || partiesDuNom(j.nom).some((p) => famillesInterdites.has(empreinte(p))))
        erreurs.push(`${chemin} : ${j.id} porte un nom réel interdit`);
      if (j.potentiel < j.note) erreurs.push(`${chemin} : ${j.id} a un potentiel inférieur à sa note`);
    }
    if (lu.data.statut !== 'valide') avertissements.push(`${chemin} : vivier au statut « proposition », à valider par Antonin`);
  }

  return { erreurs, avertissements, joueurs };
}
