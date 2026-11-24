// Vérification des données de référence (tranche 0), côté Node : `npm run verifier` et les tests.
// Chaque problème est décrit en français, avec le fichier et l'élément concernés.
import { createHash } from 'node:crypto';
import { initialesDe, normaliserNom, partiesDuNom } from './noms';
import { schemaBanques, schemaEffectif, schemaEmpreintes, schemaReglagesMatch, schemaRegistre, schemaRegles, type Effectif, type Registre } from './schemas';

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

  return { erreurs, avertissements, joueurs };
}
