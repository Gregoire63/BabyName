# Aide au choix de prénom — pipeline de données

## Lancer, dans l'ordre

```bash
python3 pipeline/build_metrics.py          # INSEE -> métriques        (~3 s)
python3 pipeline/merge_wikidata.py         # + langues d'usage         (~5 s)
python3 pipeline/enrich_wiktionary.py      # Wiktionnaire FR : sens        GRATUIT
python3 pipeline/enrich_wiktionary_en.py   # Wiktionnaire EN : origine     GRATUIT
python3 pipeline/merge_enrichissement.py   # -> data/build/prenoms_final.csv
python3 pipeline/export_catalogue.py       # -> app/public/data/catalogue.json(.gz)
python3 pipeline/test_syllabes.py          # 59/59 attendus
python3 pipeline/test_phonetique.py        # 47/47 attendus
python3 pipeline/test_wikitexte.py         # les gloses qui ont fini sur une carte
```

Tout ce qui précède est **gratuit** : aucune clé, aucun service payant.
`enrich_llm.py` est optionnel et ne sert qu'à combler les trous (voir plus bas).

## Deux étages : le catalogue et la pile

`build_metrics.py` garde **tout ce que l'INSEE publie sur 2023-2025**, soit
19 608 prénoms — l'INSEE n'en dit pas davantage, son plancher est à 5
naissances (les effectifs sont arrondis au multiple de 5). Le catalogue est
donc le panorama complet, et la recherche de l'app trouve n'importe quoi.

En dessous de `SEUIL_PILE = 20` naissances sur trois ans, les prénoms portent
`rare = True`. Ce n'est pas un rejet, c'est un aveu : à ce volume, la pente,
le risque d'explosion et l'originalité ne mesurent plus que l'arrondi de
l'INSEE. L'app les sort donc du swipe par défaut — 11 941 cartes de plus
noieraient les 7 667 qui portent 94,6 % des naissances — et une case à cocher
les fait entrer pour qui veut ratisser large.

## Couverture actuelle

| | avant `enrich_claude` | après | pondéré par les naissances |
|---|---|---|---|
| origine | 4 606 (23 %) | **9 145 (47 %)** | 79 % → **93 %** |
| signification | 2 244 (11 %) | **6 658 (34 %)** | 70 % → **84 %** |

Le saut vient de `data/cache/enrich_claude.jsonl` : les 6 189 prénoms de la
pile qui avaient un trou, traités par Claude en session, avec le prompt système
d'`enrich_llm.py` — aucune clé API, aucun coût à l'appel.

`data/cache/enrich_claude_complement.jsonl` (27 septembre 2026, 372 prénoms)
fait le même travail pour les prénoms dont le « sens » venait en fait d'une
lecture fautive du Wiktionnaire : de la syntaxe (Masha « {{transliterator »,
Philippe « chevaux]] ») ou le mot source pris pour un sens (Nicolas
« Nicolaus », Éric « Eiríkr », Céline « Coelina »). 46 d'entre eux restent
sans sens, exprès : étymologie discutée (Sofiane, Corentin) ou création
moderne (Anaé).

## Une carte par prononciation

Nelya, Nélya, Nélia, Nelia, Nëlya : cinq cartes pour une seule décision.
`pipeline/phonetique.py` donne à chaque prénom une clé de prononciation, et le
groupe de swipe est le couple **(clé, sexe)** — Maël et Maëlle se disent pareil
mais ne sont pas le même prénom. Résultat : **19 608 prénoms pour 11 498
prononciations**, et la pile passe de 7 667 à 4 935 cartes (−36 %).

Le biais est assumé et il est écrit en haut du module : **sous-regrouper
plutôt que sur-regrouper**. Fusionner deux prénoms qui sonnent différemment
supprime un choix réel ; les laisser séparés ne fait que conserver l'existant.

Conséquence sur la méthode : on ne fait pas de transcription phonétique
complète, on neutralise seulement ce qui ne s'entend pas — accents, h, lettres
doublées, y/i, k/c/qu, ph/f, tréma, e muet final. Une première version
réinterprétait les digrammes (« ai » → è, « en » → nasale) et ses plus gros
groupes étaient **faux** : Ella avec Ayla, Eden avec Ayden, Eden avec Edem. La
règle « ai se dit è » est vraie en français et fausse pour Ayla, Kayla, Layna —
c'est-à-dire précisément la longue traîne qu'on voulait ranger.

Deux exceptions valent d'être connues : les consonnes finales sont **toutes
gardées** (Lucas se dit /lykas/ mais Thomas /tɔma/, aucune règle ne les
sépare), et le e final après n ou m ne se tait pas, il **dénasalise** — Manon
n'est pas Manone, Jean n'est pas Jeanne.

`pipeline/test_phonetique.py` tient les deux listes : ce qui doit être
regroupé, et ce qui ne doit surtout pas l'être. La seconde compte davantage.

## La confiance, et pourquoi elle est affichée

Chaque entrée porte une `confiance` (haute / moyenne / basse) qui qualifie **la
signification**, pas le prénom. `merge_enrichissement.py` ne retient que celle
de la source qui a effectivement fourni le sens affiché, et un prénom composé
ne vaut pas mieux que sa partie la plus douteuse. `export_catalogue.py` la
transporte dans la colonne `cf`, et l'app écrit « sens probable » sur la carte
et une mise en garde sur la fiche dès qu'elle n'est pas haute.

Ce n'est pas de la coquetterie. Une relecture adversariale de 110 entrées tirées
au sort (`data/cache/enrich_claude_relecture.md`) a trouvé **4 fautes graves et
12 moyennes** — sens faux, chaînes d'origines inversées, confiance trop
généreuse — toutes corrigées depuis. Elle a aussi établi le point qui compte :
**aucune étymologie n'avait été fabriquée** pour un prénom de pure invention.
Le risque résiduel n'est donc pas l'invention mais l'approximation, et la bonne
réponse à l'approximation est de la dire.

Les prénoms sans origine restent massivement la longue traîne (graphies uniques,
prénoms importés récents) : beaucoup de graphies, peu de naissances. C'est
exactement pourquoi la pile et le catalogue ne sont pas la même chose.

## Les trois couches d'enrichissement

`merge_enrichissement.py` superpose, champ par champ, la première source qui
renseigne gagne :

1. **manuel** — `data/cache/enrich_manuel.jsonl`, 800 prénoms saisis et relus
   (les plus fréquents). Prioritaire sur tout le reste.
2. **wiktionnaire-en** — 5 686 entrées. Les catégories `given names from X`
   du Wiktionnaire anglais donnent l'**origine ultime** : Gabriel y est
   « from Hebrew », pas « from Latin ». C'est la source d'origine.
3. **wiktionnaire-fr** — 2 528 entrées. Surtout utile pour les **significations
   en français**, que l'anglais ne peut pas fournir — mais seulement le vrai
   sens du modèle (`sens=` ou 3e paramètre de `{{étyl}}`), jamais le mot source
   ni sa translittération, et seulement la ligne « prénom » d'une page qui
   décrit aussi une commune ou un sigle (Olaf). Voir `pipeline/wikitexte.py`.
4. **claude** — `data/cache/enrich_claude.jsonl` (6 189 prénoms) et
   `enrich_claude_complement.jsonl` (372), écrits en session par Claude, sans
   clé API. Placé **après** les deux wiktionnaires pour l'origine : le
   Wiktionnaire est citable, Claude est un jugement. **Sauf pour le sens** :
   la glose du Wiktionnaire est celle du mot source (Vincentius → « vainquant »),
   Claude a écrit celui du prénom, relu (`ORDRE_CHAMP` dans la fusion).
5. **llm** — optionnel, payant, vide. Non utilisé : `enrich_claude` fait le
   même travail sans appel facturé.

Chaque champ garde sa source dans `src_origines` / `src_signification` :
on peut invalider une couche entière sans tout refaire.

## Pourquoi deux Wiktionnaires

Le Wiktionnaire **français** donne l'étymon **immédiat** : `Nathan` → latin,
`Alexa` → anglo-saxon. C'est la langue à laquelle le français a emprunté le
prénom, pas sa racine. Sur les 274 prénoms où il croisait la couche manuelle,
il divergeait dans **48 %** des cas, toujours dans ce sens.

Le Wiktionnaire **anglais** classe les prénoms dans des catégories
`<langue> given names from <langue source>`, qui remontent à l'origine réelle.
`Gabriel` y est simultanément `from Hebrew`, `from Ancient Greek` et
`from Latin` : la chaîne complète. Le parseur les ordonne par profondeur
(hébraïque avant latin) via une table de rangs.

D'où la priorité : manuel > wiktionnaire-en > wiktionnaire-fr pour l'origine ;
manuel > claude > wiktionnaire-fr pour le sens. Les composés à trait d'union
(Jean-Pierre) sont assemblés par la fusion, à partir du meilleur de chaque
partie. Le Wiktionnaire ne dit rien des homonymes : `objet_marque` y vaut
`None` (inconnu), plus `False`, qui masquait 109 homonymes relevés par Claude
(Fleur, Olivier, Avril, Leïa…).
Les gloses anglaises ne sont jamais mises dans `signification` (qui doit être
en français) mais dans `signification_en`.

## Courbes, barres et tendance

L'INSEE arrondit chaque effectif annuel à 5. `export_catalogue.py` en tire
trois règles :

- `SEUIL_TENDANCE = 60` naissances en trois ans : en dessous, la pente n'est
  que ce bruit d'arrondi. L'app n'affiche pas de pourcentage par an mais le
  nombre de bébés (« ≈ 18 »). Le seuil part dans le catalogue
  (`seuil_tendance`) : l'app et les pages publiques le lisent là.
- `SEUIL_PIC = 60` naissances dans une année : une courbe se juge à son
  sommet, pas à ses trois dernières années. Aurélie (11 310 naissances en
  1986, une cinquantaine en trois ans aujourd'hui) a sa courbe : c'est elle
  qui raconte le prénom.
- `BARRES = (2011, 2025)` : les prénoms de la pile sans courbe ont leurs
  naissances année par année (colonne `nb`, divisées par 5), dessinées en
  barres. Chaque carte de la pile a donc sa courbe ou ses barres.

## Clé API (optionnel, payant)

`enrich_llm.py` a besoin d'une clé. Crée `.env` à la racine du projet :

```
ANTHROPIC_API_KEY=sk-ant-...
```

Le modèle n'est pas codé en dur : le script interroge `/v1/models` et prend
le Haiku le plus récent du compte. Forçable avec `--model` ou `ANTHROPIC_MODEL`.

## Reprise

`run` écrit au fur et à mesure dans `data/cache/enrich_llm.jsonl` et saute
ce qui y est déjà. Coupe-le quand tu veux, relance : il repart où il en était.
Pour tout refaire, vide le fichier (`> data/cache/enrich_llm.jsonl`).
Pour un essai isolé : `ENRICH_CACHE=/tmp/essai.jsonl python3 pipeline/enrich_llm.py run --limit 40`.

Le cache `enrich_manuel.jsonl` contient **493 prénoms renseignés à la main** (les plus fréquents, 63 % des naissances).
Ils ne seront pas réinterrogés. Relis-les : ils fixent le niveau de qualité attendu.

## Ce qui est fiable, et ce qui ne l'est pas

| Champ | Source | Confiance |
|---|---|---|
| `freq_recent_p10k`, `trend_pct_an`, `peak_year` | INSEE | factuel |
| `nb_syllabes` | heuristique maison | ~93 %, diérèses ambiguës |
| `originalite`, `risque_surprise` | calculés | conventions documentées dans le script |
| `wikidata_connu` | Wikidata | factuel |
| `langues_usage` | Wikidata P407 | **langue d'usage, PAS l'étymologie** |
| `origines`, `signification` | LLM | à relire — `confiance_enrich` dit quoi vérifier |

Détail dans `data/raw/PROVENANCE.md`.

## Garde-fous du script d'enrichissement

- Vocabulaire d'origines **fermé** (29 valeurs, imposé par le schéma d'outil).
  Sans ça le modèle renvoie « hebreu / hébraïque / Hébreu ancien » et le filtre
  de l'app devient inutilisable.
- Un prénom renvoyé qui n'était pas dans le lot est **rejeté** (anti-hallucination).
- L'orthographe INSEE est restaurée (le modèle renvoie parfois `gabriel`).
- Chaque entrée porte une `confiance` ; le prompt impose `null` plutôt qu'une
  étymologie plausible mais inventée.
- `python3 pipeline/enrich_llm.py self-test` vérifie ces trois règles sans réseau.

## À noter

Les variantes accentuées partagent un slug (`Léa`/`Lea`, `Émile`/`Emile`,
`Inès`/`Ines`) : une entrée du cache remplit plusieurs lignes du CSV.
105 entrées → 132 lignes renseignées.
