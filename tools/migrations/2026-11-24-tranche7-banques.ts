// Migration de la tranche 7 (24 novembre 2026) — banques de noms pour les joueurs générés.
//
// Les banques de la tranche 0 ont été faites pour renommer les 523 joueurs du snapshot (mêmes initiales) : certaines
// cultures n'y ont qu'un ou deux noms (chinois, japonais, turc : 1 prénom × 1 nom), ce qui ne suffit pas à générer une
// centaine de prospects par an et le vivier. Cette migration ajoute des prénoms et des noms courants de chaque culture
// (listes écrites pour le jeu, choix du modèle) et une table `culturesParPaysGeneration` pour les pays dont la culture
// du snapshot ne convient pas à la génération (Grèce : noms grecs ; Nigeria et Cameroun : noms nigérians et
// camerounais au lieu de la banque commune d'Afrique de l'Ouest).
//
// Garde-fous : un nom dont une partie correspond à l'empreinte d'un nom de famille réel interdit
// (data/noms/empreintes.json) n'est pas ajouté ; les noms déjà présents ne sont pas dupliqués. Le jeu refait le contrôle
// sur le nom complet à chaque tirage. Les listes existantes gardent leur ordre ; les ajouts viennent à la suite.
//
// Sortie : data/noms/banques.json (mis à jour). Usage : npx tsx tools/migrations/2026-11-24-tranche7-banques.ts [dépôt]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normaliserNom, partiesDuNom } from '../../packages/data/src/noms';

const depot = process.argv[2] ?? process.cwd();
const chemin = join(depot, 'data/noms/banques.json');
const banques = JSON.parse(readFileSync(chemin, 'utf8')) as {
  culturesParPays: Record<string, { prenoms: string; noms: string }>;
  culturesParPaysGeneration?: Record<string, { prenoms: string; noms: string }>;
  cultures: Record<string, { prenoms?: Record<string, string[]>; noms?: Record<string, string[]> }>;
  [cle: string]: unknown;
};
const empreintes = JSON.parse(readFileSync(join(depot, 'data/noms/empreintes.json'), 'utf8')) as { nomsDeFamille: string[] };
const familles = new Set(empreintes.nomsDeFamille);
const empreinte = (nom: string) => createHash('sha256').update(`basket-legends:${normaliserNom(nom)}`, 'utf8').digest('hex');

const liste = (texte: string) => texte.trim().split(/\s*,\s*/);

const AJOUTS: Record<string, { prenoms?: string; noms?: string }> = {
  francais: {
    noms: `Bernard, Dubois, Durand, Lefebvre, Moreau, Laurent, Simon, Michel, Leroy, Roux, Bertrand, Morel, Fournier, Girard,
      Bonnet, Dupont, Lambert, Fontaine, Rousseau, Vincent, Faure, Mercier, Blanc, Guérin, Boyer, Garnier, Chevalier, Legrand,
      Gauthier, Perrin, Robin, Clément, Morin, Roussel, Mathieu, Masson, Marchand, Duval, Dumont, Lemaire, Noël, Dufour,
      Meunier, Brun, Blanchard, Giraud, Joly, Rivière, Brunet, Gaillard, Barbier, Arnaud, Carpentier, Renaud, Picard, Royer`,
  },
  'senegal-guinee': {
    prenoms: `Mamadou, Moussa, Ibrahima, Abdoulaye, Cheikh, Ousmane, Modou, Babacar, Pape, Saliou, Alioune, Mouhamed, Lamine,
      Souleymane, Assane, Malick, Seydou, Khadim, Serigne, Amadou, Boubacar, Djibril, Fallou, Ismaïla, Mbaye, Omar, Thierno,
      Youssou, Aliou, Demba`,
  },
  'afrique-ouest-centre': {
    noms: `Diop, Ndiaye, Fall, Sow, Diallo, Faye, Sarr, Gueye, Mbaye, Cissé, Sy, Touré, Kane, Diouf, Seck, Thiam, Niang, Ndao,
      Camara, Konaté, Keïta, Traoré, Coulibaly, Sylla, Barry, Bah, Baldé, Kouyaté, Ndour, Mbodj, Sène, Diagne, Wade, Dieng,
      Sall, Badji, Mendy, Sagna, Diatta, Goudiaby`,
  },
  nigeria: {
    prenoms: `Chinedu, Emeka, Obinna, Tunde, Femi, Segun, Chukwuemeka, Ifeanyi, Ikenna, Kelechi, Uchenna, Olumide, Babatunde,
      Chidi, Nnamdi, Oluwaseun, Tobenna, Kayode, Ayodele, Dapo, Kunle, Gbenga, Nonso, Ebuka, Somto, Chibuzor, Ugo, Tochukwu,
      Damilare, Folarin`,
    noms: `Okonkwo, Eze, Nwosu, Okeke, Adeyemi, Ogunleye, Balogun, Olawale, Nwachukwu, Obi, Uche, Okoro, Ibe, Onyeka, Ajayi,
      Akinola, Ojo, Bello, Abubakar, Danjuma, Ekong, Udoh, Akpan, Emenike, Nnadi, Ogbonna, Chukwu, Iwu, Amadi, Oyelaran`,
  },
  cameroun: {
    noms: `Mbarga, Atangana, Essomba, Fouda, Owona, Ndongo, Ngono, Nkodo, Bella, Ateba, Manga, Abessolo, Edzoa, Mballa, Nanga,
      Ondoa, Tsala, Zambo, Biya, Eyenga, Mvondo, Ngah, Ella, Oyono, Kouam, Tchoupo, Fotso, Kamga, Nana, Wandji`,
  },
  hispanique: {
    prenoms: `Alejandro, Pablo, Sergio, Javier, Diego, Carlos, Daniel, Mario, Adrián, Álvaro, Iván, Jorge, Hugo, Rubén, Marcos,
      Raúl, Víctor, Alberto, Fernando, Ignacio, Gonzalo, Joaquín, Mateo, Nicolás, Santiago, Tomás, Andrés, Miguel, Óscar, Íñigo`,
    noms: `García, Fernández, López, Martínez, Sánchez, Pérez, Gómez, Jiménez, Ruiz, Hernández, Díaz, Moreno, Álvarez, Romero,
      Alonso, Gutiérrez, Navarro, Torres, Domínguez, Vázquez, Ramos, Gil, Ramírez, Serrano, Blanco, Molina, Morales, Suárez,
      Ortega, Delgado, Castro, Ortiz, Rubio, Marín, Sanz, Iglesias, Medina, Garrido, Cortés, Castillo, Lozano, Guerrero, Cano,
      Prieto, Méndez, Cruz, Calvo, Gallego`,
  },
  lusophone: {
    prenoms: `João, Pedro, Lucas, Gabriel, Rafael, Matheus, Guilherme, Felipe, Bruno, Thiago, Gustavo, Rodrigo, Leonardo,
      Vinícius, Caio, Eduardo, Marcelo, André, Ricardo, Fábio, Henrique, Renato, Leandro, Paulo, Davi`,
    noms: `Silva, Santos, Oliveira, Souza, Rodrigues, Ferreira, Alves, Pereira, Lima, Gomes, Costa, Ribeiro, Martins, Carvalho,
      Almeida, Lopes, Soares, Fernandes, Vieira, Barbosa, Rocha, Dias, Nascimento, Andrade, Moreira, Nunes, Marques, Machado,
      Mendes, Freitas, Cardoso, Teixeira, Araújo, Pinto, Correia, Monteiro, Moura, Cavalcanti, Batista, Campos`,
  },
  germanique: {
    prenoms: `Lukas, Jonas, Leon, Finn, Paul, Felix, Maximilian, Tim, Jan, Niklas, Moritz, Tobias, Julian, Florian, Sebastian,
      Philipp, Fabian, Simon, Dominik, Marcel, Johannes, Benedikt, Malte, Henrik, Lennart, Till, Nils, Jannik, Matthias, Lars`,
    noms: `Müller, Schmidt, Schneider, Fischer, Weber, Meyer, Wagner, Becker, Schulz, Hoffmann, Koch, Richter, Klein, Wolf,
      Schröder, Neumann, Schwarz, Zimmermann, Braun, Krüger, Hofmann, Hartmann, Lange, Schmitt, Werner, Krause, Meier,
      Lehmann, Köhler, Maier, Herrmann, König, Walter, Mayer, Huber, Kaiser, Fuchs, Peters, Lang, Scholz`,
  },
  balkans: {
    prenoms: `Nikola, Marko, Stefan, Luka, Filip, Aleksandar, Nemanja, Miloš, Dušan, Vuk, Uroš, Lazar, Ognjen, Bogdan,
      Mihajlo, Petar, Dragan, Zoran, Ivan, Ante, Mario, Dario, Tomislav, Josip, Mateo, Karlo, Domagoj, Matej, Borna, Lovro`,
    noms: `Petrović, Jovanović, Nikolić, Marković, Đorđević, Stojanović, Ilić, Stanković, Pavlović, Popović, Kovačević,
      Todorović, Ristić, Lazić, Simić, Radovanović, Mitrović, Živković, Janković, Horvat, Kovač, Babić, Marić, Jurić, Novak,
      Kovačić, Knežević, Vuković, Matić, Tomić, Blažević, Grgić, Pavić, Božić, Perić, Šarić, Lovrić, Radić, Vidović, Rajić`,
  },
  baltique: {
    prenoms: `Mantas, Tomas, Rokas, Arnas, Paulius, Mindaugas, Karolis, Deividas, Ignas, Marius, Dovydas, Gytis, Justas, Edgaras,
      Martynas, Matas, Kristaps, Rihards, Dāvis, Artūrs, Jānis, Roberts, Andris, Rolands, Kaspars, Mārtiņš, Edgars, Toms`,
    noms: `Kazlauskas, Petrauskas, Jankauskas, Stankevičius, Vasiliauskas, Žukauskas, Butkus, Paulauskas, Urbonas, Kavaliauskas,
      Navickas, Ramanauskas, Savickas, Rimkus, Mockus, Bernotas, Jurgaitis, Balčiūnas, Kairys, Bērziņš, Kalniņš, Ozoliņš,
      Liepiņš, Krūmiņš, Zariņš, Kļaviņš, Vītols, Jansons, Lapsa, Celms, Ābols, Rozenbergs`,
  },
  grec: {
    prenoms: `Georgios, Dimitrios, Konstantinos, Nikolaos, Panagiotis, Vasileios, Christos, Athanasios, Michail, Evangelos,
      Spyridon, Antonios, Stavros, Alexandros, Petros, Theodoros, Kyriakos, Ilias, Stefanos, Emmanouil, Angelos, Charalampos,
      Apostolos, Sotirios, Lefteris`,
    noms: `Papadopoulos, Papadakis, Georgiou, Nikolaidis, Konstantinidis, Dimitriou, Ioannidis, Karagiannis, Vlachos, Antoniou,
      Makris, Oikonomou, Alexiou, Christodoulou, Athanasiou, Vasileiou, Lambrou, Michailidis, Panagiotopoulos, Stavrou,
      Kyriakidis, Theodorou, Raptis, Galanis, Kostopoulos, Mavridis, Tsakalidis, Zervas, Anagnostou, Drakopoulos`,
  },
  turc: {
    prenoms: `Mehmet, Mustafa, Ahmet, Emre, Burak, Can, Cem, Deniz, Efe, Emir, Furkan, Kerem, Mert, Onur, Ozan, Serkan, Tolga,
      Uğur, Yusuf, Barış, Berk, Caner, Doruk, Eren, Kaan, Oğuz, Sarp, Tuna, Volkan, Alper`,
    noms: `Yılmaz, Kaya, Demir, Şahin, Çelik, Yıldız, Yıldırım, Öztürk, Aydın, Özdemir, Arslan, Doğan, Kılıç, Aslan, Çetin, Kara,
      Koç, Kurt, Özkan, Şimşek, Polat, Erdem, Korkmaz, Aksoy, Tekin, Güneş, Bozkurt, Acar, Taş, Karaca`,
  },
  italien: {
    prenoms: `Alessandro, Lorenzo, Matteo, Andrea, Francesco, Leonardo, Riccardo, Tommaso, Davide, Gabriele, Federico, Simone,
      Luca, Marco, Giacomo, Niccolò, Edoardo, Pietro, Stefano, Michele, Filippo, Giovanni, Daniele, Emanuele, Paolo`,
    noms: `Rossi, Russo, Ferrari, Esposito, Bianchi, Romano, Colombo, Ricci, Marino, Greco, Bruno, Gallo, Conti, De Luca,
      Mancini, Giordano, Rizzo, Lombardi, Moretti, Barbieri, Fontana, Santoro, Mariani, Rinaldi, Caruso, Ferrara, Galli,
      Martini, Leone, Longo, Gentile, Martinelli, Vitale, Lombardo, Serra, Coppola, De Santis, Marchetti`,
  },
  japonais: {
    prenoms: `Haruto, Yuto, Sota, Yuki, Hayato, Ren, Kaito, Riku, Takumi, Daiki, Kenta, Shota, Ryo, Kazuki, Yusuke, Naoki,
      Takeshi, Koki, Tatsuya, Sho, Ryota, Kenji, Makoto, Hiroki, Shun`,
    noms: `Sato, Suzuki, Takahashi, Tanaka, Watanabe, Ito, Yamamoto, Nakamura, Kobayashi, Kato, Yoshida, Yamada, Sasaki,
      Yamaguchi, Matsumoto, Inoue, Kimura, Hayashi, Shimizu, Yamazaki, Mori, Abe, Ikeda, Hashimoto, Ishikawa, Ogawa, Okada,
      Goto, Hasegawa, Fujita`,
  },
  chinois: {
    prenoms: `Zihao, Haoran, Yuxuan, Junjie, Tianyu, Zhiwei, Jiahao, Mingze, Yichen, Zhenyu, Wenbo, Hongyu, Jianguo, Xiaolong,
      Shuo, Yifan, Kaiwen, Boyang, Ruiqi, Zeyu, Hao, Jun, Lei, Tao, Peng`,
    noms: `Wang, Li, Zhang, Liu, Chen, Yang, Huang, Zhao, Wu, Zhou, Xu, Sun, Ma, Zhu, Hu, Guo, He, Lin, Gao, Luo, Zheng, Liang,
      Xie, Song, Tang, Han, Feng, Deng, Cao, Peng`,
  },
};

const GENERATION: Record<string, { prenoms: string; noms: string }> = {
  Greece: { prenoms: 'grec', noms: 'grec' },
  Nigeria: { prenoms: 'nigeria', noms: 'nigeria' },
  Cameroon: { prenoms: 'francais', noms: 'cameroun' },
};

/** Lettre de rangement : la première lettre telle quelle, accent compris (règle de data/noms/banques.json). */
const initiale = (nom: string) => nom.charAt(0);

let ajoutes = 0;
let refuses = 0;
for (const [culture, ajouts] of Object.entries(AJOUTS)) {
  const c = (banques.cultures[culture] ??= {});
  for (const genre of ['prenoms', 'noms'] as const) {
    const texte = ajouts[genre];
    if (!texte) continue;
    const parInitiale = (c[genre] ??= {});
    const deja = new Set(Object.values(parInitiale).flat().map(normaliserNom));
    for (const nom of liste(texte)) {
      if (deja.has(normaliserNom(nom))) continue;
      if (genre === 'noms' && partiesDuNom(nom).some((p) => familles.has(empreinte(p)))) {
        refuses++;
        continue;
      }
      (parInitiale[initiale(nom)] ??= []).push(nom);
      deja.add(normaliserNom(nom));
      ajoutes++;
    }
  }
}
banques.culturesParPaysGeneration = GENERATION;
banques.description =
  'Banques de prénoms et de noms fictifs de Basket Legends, par culture. Servent au renommage des joueurs du snapshot (mêmes initiales) et à la génération des joueurs futurs (complétées à la tranche 7 ; `culturesParPaysGeneration` remplace la culture d’un pays pour la génération). Aucun nom de ces listes ne doit reprendre un joueur réel : le contrôle se fait par les empreintes de data/noms/empreintes.json.';
writeFileSync(chemin, `${JSON.stringify(banques, null, 2)}\n`);
console.log(`${ajoutes} noms ajoutés, ${refuses} noms de famille écartés (empreinte d'un nom réel).`);
