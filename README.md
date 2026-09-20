# Aide au choix de prénom — pipeline de données

## Lancer, dans l'ordre

```bash
python3 pipeline/build_metrics.py          # INSEE -> métriques        (~3 s)
python3 pipeline/merge_wikidata.py         # + langues d'usage         (~5 s)
python3 pipeline/enrich_wiktionary.py      # Wiktionnaire FR : sens        GRATUIT
python3 pipeline/enrich_wiktionary_en.py   # Wiktionnaire EN : origine     GRATUIT
python3 pipeline/merge_enrichissement.py   # -> data/build/prenoms_final.csv
python3 pipeline/test_syllabes.py          # 59/59 attendus
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

## Couverture actuelle (sources gratuites uniquement)

| | catalogue (19 608) | pile (7 667) | pondéré par les naissances |
|---|---|---|---|
| origine | 4 606 (23 %) | 2 810 (37 %) | **79 % / 83 %** |
| signification | 2 244 (11 %) | 1 484 (19 %) | **70 % / 73 %** |

Les 15 002 prénoms sans origine sont massivement la longue traîne (graphies
uniques, prénoms importés récents) : beaucoup de graphies, peu de naissances.
C'est exactement pourquoi la pile et le catalogue ne sont pas la même chose.

## Les trois couches d'enrichissement

`merge_enrichissement.py` superpose, champ par champ, la première source qui
renseigne gagne :

1. **manuel** — `data/cache/enrich_manuel.jsonl`, 800 prénoms saisis et relus
   (les plus fréquents). Prioritaire sur tout le reste.
2. **wiktionnaire-en** — 5 686 entrées. Les catégories `given names from X`
   du Wiktionnaire anglais donnent l'**origine ultime** : Gabriel y est
   « from Hebrew », pas « from Latin ». C'est la source d'origine.
3. **wiktionnaire-fr** — 3 573 entrées. Surtout utile pour les **significations
   en français**, que l'anglais ne peut pas fournir.
4. **llm** — optionnel, payant, vide. Non utilisé.

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

D'où la priorité : manuel > wiktionnaire-en > wiktionnaire-fr.
Les gloses anglaises ne sont jamais mises dans `signification` (qui doit être
en français) mais dans `signification_en`.

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
