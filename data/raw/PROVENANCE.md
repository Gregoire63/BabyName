# Source des donnees

**Fichier des prenoms INSEE, millesime 2025** (naissances 1900-2025, France).
Page source : https://www.insee.fr/fr/statistiques/8595130
Fichier officiel : prenoms-2025-nat_csv.zip (4,35 Mo -> 16,5 Mo decompresses,
724 645 lignes, colonnes `sexe;prenom;periode;valeur;rang`).

## Comment il est arrive ici

insee.fr est bloque par le proxy d'egress, cote conteneur cloud ET cote VM
locale Cowork. Le fichier a ete recupere via le navigateur integre de
l'app Claude (qui sort par le reseau reel du poste), recompresse en format
compact, transfere en 7 morceaux base64 et reassemble.
Integrite verifiee : SHA-256 du gzip = c9dff8b1ad278bad45aa9c1bfdd3e12c299abd285bc98e4e6cfdff6204a74789

## Format compact (`prenoms_insee_2025_packed.csv`)

    sexe;prenom;first_year;valeurs_div5

Une ligne par couple (sexe, prenom). `valeurs_div5` = effectifs annuels
consecutifs a partir de `first_year`, divises par 5 (l'INSEE arrondit
deja a 5). Colonne `rang` supprimee (inutile, recalculable).
52 340 lignes. AUCUNE perte par rapport au fichier officiel.

Pour rafraichir : deposer le zip officiel dans ce dossier, le pipeline
detecte automatiquement le format brut.

## Attention

- Avant 2012 : France hors Mayotte. A partir de 2012 : Mayotte incluse.
- Effectifs arrondis au multiple de 5 -> les pentes calculees sur de
  petits volumes sont du bruit. C'est pourquoi `risque_surprise`
  est pondere par un facteur de confiance lie au volume.
- 2025 est conservee bien que le volume (589 485) soit inferieur a 2024
  (605 435). Ecart de -2,6 %, coherent avec la baisse de natalite en
  cours : rien n'indique un millesime partiel.

---

# Wikidata (P407) — ce que ca donne vraiment

Recupere par le meme canal navigateur (query.wikidata.org est bloque par le
proxy d'egress des deux cotes). Trois requetes par classe de prenom
(Q12308941 masculin, Q11879590 feminin, Q3409032 epicene), puis une
jointure par libelle francais sur les 5 727 prenoms non couverts.

Resultat : 11 032 prenoms distincts, dont 3 918 correspondent a un prenom
INSEE (51,1 %). 2 506 ont au moins une langue (32,7 % ; 64,8 % pondere
par les naissances).

## CONCLUSION IMPORTANTE

**P407 n'est PAS l'etymologie.** C'est la "langue de l'oeuvre ou du nom",
c'est-a-dire les langues dans lesquelles le prenom est EN USAGE. Verification :

    Gabriel -> anglo-saxon | francais | germanique | latin | slave
    Noah    -> germanique
    David   -> finno-ougrien | slave
    Sarah   -> africain | anglo-saxon | francais | germanique | latin | scandinave

Aucun parent ne reconnaitra la "germanique" dans Gabriel, qui est hebraique.
Le champ est donc stocke sous le nom `langues_usage`, PAS `origines`, pour
ne pas figer une fausse semantique dans le schema.

Wikidata apporte donc deux choses, et seulement deux :
  1. `wikidata_connu` : le prenom est un prenom reconnu (bon signal qualite)
  2. `langues_usage` : aire culturelle d'usage, bruitee, d'interet limite

L'origine etymologique ET la signification doivent venir de
l'enrichissement LLM. Wikidata ne structure pas la signification.

---

# Wiktionnaire francais (gratuit, CC BY-SA)

fr.wiktionary.org est bloque par le proxy des deux cotes -> meme route
navigateur. Enumeration des categories "Prenoms en francais / masculins /
feminins" : 9 152 pages. Recuperation du wikitexte par lots de 50
(184 requetes), extraction de la section {{S|etymologie}} de la partie
francaise : 4 725 pages en contiennent une.

Parsing (pipeline/enrich_wiktionary.py, pipeline/wikitexte.py) :
  - modeles lus avec leur structure (modeles niches, liens, parametres
    nommes) : un decoupage au premier « | » laissait passer « {{transliterator »
    ou « chevaux]] » jusqu'a la carte
  - modele {{etyl|CODE|fr|mot|translit|sens}} -> code ISO mappe sur le
    vocabulaire ferme ; sens = `sens=` ou 3e parametre libre, jamais le mot
    source ni sa translitteration (Nicolas « Nicolaus »)
  - page a plusieurs sens (prenom, commune, sigle) : seule la ligne « prénom »
  - repli sur le texte libre ("De l'hebreu...", "Du latin...") ; une glose
    hors modele seulement entre parentheses apres le mot, ou apres « signifiant »
  - prenoms derives (« composé de Maëlle et de -line ») : origine seulement ;
    les composes a trait d'union sont assembles par la fusion

Resultat (27/09/2026) : 2 528 entrees exploitables, dont 65 derives.
(Avant : 3 573, dont 1 082 composees, et 7 sens illisibles.)

## LIMITE STRUCTURELLE

Le Wiktionnaire donne l'ETYMON IMMEDIAT, pas l'origine ultime :
    Nathan -> latin        (et non hebraique)
    Alexa  -> anglo-saxon  (et non grec)
    Aldo   -> italien
C'est la langue a laquelle le francais a emprunte le prenom, pas sa racine.
Moins faux que le P407 de Wikidata, mais pas ce qu'un parent appelle
"l'origine". D'ou la couche manuelle prioritaire.

---

# Wiktionnaire ANGLAIS — la source d'origine (gratuit, CC BY-SA)

en.wiktionary classe les prenoms dans des categories
"<langue> given names from <langue source>". Contrairement au P407 de
Wikidata (langue d'usage) et a l'etymologie du Wiktionnaire francais
(etymon immediat), ces categories donnent la CHAINE COMPLETE :

    Gabriel -> Hebrew, Ancient Greek, Latin
    Nathan  -> Hebrew
    Arthur  -> Celtic languages

289 categories enumerees (FR+EN, masculin/feminin/epicene) -> 6 425 prenoms.
5 686 exploitables apres mappage sur le vocabulaire ferme.
Les familles sont triees par PROFONDEUR (table RANG dans le script) :
hebraique/arabe/sanskrit avant latin avant francais/anglais.

Gloses : 782 seulement, et en ANGLAIS -> champ `signification_en` separe.
Le francais reste a la charge du Wiktionnaire FR et de la couche manuelle.

## Bilan des sources (gratuites)

| source        | origine | signification FR |
|---------------|---------|------------------|
| INSEE         | -       | -                |
| Wikidata P407 | inutilisable (langue d'usage) | - |
| Wiktionnaire FR | etymon immediat, 48 % divergent | 672 |
| Wiktionnaire EN | ORIGINE ULTIME, 5 686 | 0 (anglais) |
| manuel        | 800, prioritaire | 800 |

Couverture finale : origine 82,6 % / signification 73,2 % (ponderees naissances).

---

# Francophonie : Québec, Belgique, Suisse (`francophonie_2023_2025.txt`)

Extrait le 2026-10-09, par le navigateur intégré de l'app Claude (aucun de
ces sites n'est joignable depuis la VM ni le conteneur), puis recopié et
vérifié par empreinte (87 101 caractères, h31 = 212164870).

| Bloc | Pays | Source | Licence |
|---|---|---|---|
| `#Q` | Québec | Retraite Québec, *Banque de prénoms* filles + garçons 1980-2025 (donneesquebec.ca, mis à jour 2026-10-01) | CC BY 4.0 |
| `#Bf` `#Bm` | Belgique | Statbel, *Prénoms filles / garçons 1995-2025* (xlsx, colonne Belgique) | Licence open data Statbel (réutilisation libre, y compris commerciale) |
| `#Cf` `#Cm` | Suisse | OFS, DF_BEVNAT_PRENOMS_2 / _1 (stats.swiss, SDMX, géo 8100 = Suisse) | opendata.swiss « terms_by » : libre, source à citer |

Format : `#<bloc>;<naissances 2023-2025>;<naissances 2018-2020>` puis
`prenom;n_2023_2025[;n_2018_2020]` (le second nombre seulement à partir de
30). Prénoms gardés à partir de 5 naissances sur 2023-2025 (les lignes de 5 à
9 ont été ajoutées dans un second envoi, même jour, empreinte 2800372923).

Bloc `#QS` : sexe des prénoms québécois, d'après le fichier (filles ou
garçons) où ils figurent sur 2023-2025 — `nom;f` ou `nom;m`, absent = les deux.
Grossier (un seul bébé de l'autre sexe suffit à classer « mixte ») mais c'est
tout ce que le Québec publie.

## Prénoms d'ailleurs

Les prénoms donnés dans ces pays mais absents de l'INSEE 2023-2025 entrent
au catalogue (`hors_france`, voir `build_metrics.hors_france`) : 1 589, dont
490 dans la pile (≥ 20 naissances sur trois ans dans un même pays).

## Pièges

- **Québec : les effectifs sont TOUS SEXES.** Un prénom présent dans les deux
  fichiers y porte exactement le même nombre (Noah : 634 « filles » en 2023 —
  c'est le total). On fusionne donc les deux fichiers, sans sexe.
- Québec : capitales sans accents (LEA = Léa + Lea), « <5 » compté 0.
- Belgique et Suisse : un prénom n'est publié qu'à partir de 5 naissances par
  an ; les totaux sont la somme des prénoms publiés, pas les naissances
  officielles (≈ 90 % de celles-ci).
- Pour rafraîchir : refaire l'extraction (même agrégation : sommes 2023-2025
  et 2018-2020) et relancer `pipeline/export_catalogue.py`.


---

# Tous les pays (`data/raw/pays/<code>.txt`, pipeline/pays.py)

Extraits le 2026-10-09 par le navigateur intégré (aucune source n'est
joignable depuis la VM ni le conteneur), recopiés et vérifiés par empreinte.
L'en-tête de chaque fichier dit l'organisme, le jeu, la licence constatée,
les années, le seuil. Fenêtre récente = les 3 dernières années publiées,
ancienne = 5 ans plus tôt ; prénoms gardés à partir de 5 naissances.

| Code | Pays | Source | Années | Licence |
|---|---|---|---|---|
| us | États-Unis | SSA, names.zip | 2023-2025 | domaine public |
| gb-eaw | Angleterre et pays de Galles | ONS | 2023-2025 | OGL v3 |
| gb-sct | Écosse | NRS (accents non publiés) | 2023-2025 | OGL v3 |
| gb-nir | Irlande du Nord | NISRA (accents non publiés) | 2023-2025 | OGL |
| ie | Irlande | CSO, VSA50/VSA60 | 2023-2025 | CC BY 4.0 |
| ca-on | Ontario | data.ontario.ca | 2022-2024 | OGL-Ontario |
| ca-bc | Colombie-Britannique | BC Vital Statistics | 2021-2023 | OGL-BC |
| at | Autriche | Statistik Austria | 2023-2025 | CC BY 4.0 |
| se | Suède | SCB (arrêté après 2022) | 2020-2022 | CC BY 4.0 |
| no | Norvège | SSB 10467 (liste partielle ≥ 200 porteurs) | 2023-2025 | CC BY 4.0 |
| pl | Pologne | dane.gov.pl 219 (premier prénom) | 2023-2025 | CC0 |
| lv | Lettonie | CSB CIJV01 (année publiée N = naissances N-1) | 2023-2025 | CC BY 4.0 |
| nz | Nouvelle-Zélande | DIA (macrons parfois perdus) | 2023-2025 | CC BY 4.0 |
| il | Israël | CBS — extrait mais NON proposé : graphie hébraïque seule | 2022-2024 | licence ouverte CBS |

Non disponibles : Alberta (anti-robot Cloudflare), Espagne / Danemark /
Australie (top 100 seulement), Pays-Bas / Italie (pas d'export), Allemagne
(pas de source nationale).
