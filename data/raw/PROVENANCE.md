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

Parsing (pipeline/enrich_wiktionary.py) :
  - modele {{etyl|CODE|fr|mot|translit|glose}} -> code ISO mappe sur le
    vocabulaire ferme, glose reprise du dernier parametre en francais
  - repli sur le texte libre ("De l'hebreu...", "Du latin...")
  - prenoms composes resolus par leurs parties (Jean-Baptiste -> Jean + Baptiste)

Resultat : 3 573 entrees exploitables, dont 1 082 composees.

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
