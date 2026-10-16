#!/usr/bin/env python3
"""
Exporte l'HISTORIQUE des prénoms que le catalogue ne porte pas.

Le catalogue (export_catalogue.py) ne garde que les prénoms donnés sur les
trois dernières années publiées : c'est le panorama de ce qu'on choisit
aujourd'hui. Une liste peut pourtant y ajouter un prénom qui n'y est pas —
celui d'une arrière-grand-mère (Jeannine), une graphie ancienne (Jerome, sans
ses accents), un prénom inventé. Sa carte n'a alors rien du catalogue.

Ce fichier lui donne ce qui existe : pour chaque prénom que l'INSEE publie
depuis 1900 et que le catalogue n'a pas, ses naissances par décennie, filles
et garçons, et ses première et dernière années. Rien d'estimé, rien de
lissé : des sommes de ce que l'INSEE publie. L'app ne le charge que lorsqu'une
de ses listes porte un prénom ajouté.

Format : en colonnes, comme le catalogue — 239 Ko compressés, contre 260
en dictionnaire et 272 en tableaux complets (mesuré) :
  {"v": 1, "source": ..., "decennies": [1900, ..., 2020], "unite": 5,
   "noms": ["AALIYAH", ...], "f": [...], "m": [...], "a": [[1912, 1998], ...]}
  - `noms` : l'écriture INSEE (majuscules, accents quand l'INSEE en a), triée ;
  - `f` / `m`, filles / garçons, au même rang : 0 si aucune naissance, sinon
    [d, v_d, v_d+1, ...] — d l'index de la première décennie non nulle, puis
    les naissances de chaque décennie jusqu'à la dernière non nulle, DIVISÉES
    PAR `unite` (l'INSEE publie par multiples de 5 : un chiffre de moins
    par nombre) ;
  - `a` : première et dernière années où il est publié ;
  - la décennie 2020 ne compte que 2020-2025.

Plus d'un tiers ne pèse que 5 naissances en 125 ans. On les garde : sans
eux, l'app dirait « absent des chiffres de l'INSEE » d'un prénom qui y est.

Sortie : app/public/data/historique.json.gz (seule la version compressée est
servie ; l'app sait qu'elle peut manquer et ne prétend alors rien).
"""
from __future__ import annotations
import gzip, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "data" / "raw" / "prenoms_insee_2025_packed.csv"
CATALOGUE = ROOT / "app" / "public" / "data" / "catalogue.json"
OUT = ROOT / "app" / "public" / "data" / "historique.json.gz"
AN0 = 1900
# Les trois dernières années : celles du catalogue. Un prénom qui y a une
# naissance est DANS le catalogue (build_metrics.py garde tout ce qui a au
# moins une naissance récente) ; s'il en manquait un ici, c'est que les deux
# fichiers ne sont plus du même millésime.
RECENTES = 3


def main() -> None:
    cat = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    # Le catalogue retrouve l'INSEE par l'écriture en majuscules
    # (export_catalogue.py fait de même pour ses courbes).
    connus = {str(l).upper() for l in cat["cols"]["l"]}

    par_nom: dict[str, list[dict[int, int]]] = {}   # nom -> [filles, garçons] : an -> naissances/5
    der_an = AN0
    with open(PACK, encoding="utf-8") as fh:
        next(fh)
        for ligne in fh:
            ligne = ligne.rstrip("\n")
            if not ligne:
                continue
            sx, nom, y0, vals = ligne.split(";", 3)
            if nom.startswith("_"):
                continue
            # INSEE : 1 garçon, 2 fille
            cote = 0 if sx == "2" else 1
            serie = par_nom.setdefault(nom, [{}, {}])[cote]
            for i, v in enumerate(vals.split(",")):
                v = int(v)
                if v:
                    an = int(y0) + i
                    serie[an] = serie.get(an, 0) + v
                    der_an = max(der_an, an)

    decennies = list(range(AN0, der_an + 1 - der_an % 10 + 1, 10))
    recentes = range(der_an - RECENTES + 1, der_an + 1)

    def par_decennie(serie: dict[int, int]):
        if not serie:
            return 0
        d = [0] * len(decennies)
        for an, v in serie.items():
            d[(an - AN0) // 10] += v
        i0 = next(i for i, v in enumerate(d) if v)
        i1 = max(i for i, v in enumerate(d) if v)
        return [i0, *d[i0:i1 + 1]]

    noms, filles, garcons, annees = [], [], [], []
    recents_hors_catalogue = []
    for nom in sorted(par_nom):
        if nom in connus:
            continue
        f, m = par_nom[nom]
        ans = [*f, *m]
        if not ans:
            continue
        if any(a in recentes for a in ans):
            recents_hors_catalogue.append(nom)
        noms.append(nom)
        filles.append(par_decennie(f))
        garcons.append(par_decennie(m))
        annees.append([min(ans), max(ans)])

    if recents_hors_catalogue:
        sys.exit(f"{len(recents_hors_catalogue)} prénoms donnés en {recentes.start}-{recentes.stop - 1} "
                 f"manquent au catalogue ({', '.join(recents_hors_catalogue[:8])}…) : "
                 "le catalogue n'est pas du même millésime que le fichier INSEE.")

    doc = {
        "v": 1,
        "source": "INSEE, fichier des prénoms, millésime 2025",
        "decennies": decennies,
        "unite": 5,
        "noms": noms, "f": filles, "m": garcons, "a": annees,
    }
    txt = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    with gzip.GzipFile(filename="", mode="wb", fileobj=OUT.open("wb"), compresslevel=9, mtime=0) as fz:
        fz.write(txt.encode())

    total = [sum(sum(x[1:]) for x in (f, m) if x) * 5 for f, m in zip(filles, garcons)]
    print(f"{len(noms):,} prénoms hors catalogue, {decennies[0]}-{der_an} -> {OUT.relative_to(ROOT)}")
    print(f"  {len(txt) / 1e6:.2f} Mo de JSON, {OUT.stat().st_size / 1e3:.0f} Ko compressés")
    for i in sorted(range(len(noms)), key=total.__getitem__, reverse=True)[:12]:
        print(f"  {noms[i]:<14} {total[i]:>9,} naissances ({annees[i][0]}-{annees[i][1]})")


if __name__ == "__main__":
    main()
