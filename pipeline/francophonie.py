#!/usr/bin/env python3
"""
Les prénoms ailleurs en francophonie : Québec, Belgique, Suisse.

Source : data/raw/francophonie_2023_2025.txt, extrait le 2026-10-09 des
fichiers officiels (voir data/raw/PROVENANCE.md). Une ligne par prénom et par
pays, ``prenom;naissances_2023_2025[;naissances_2018_2020]``, en blocs
``#<code>;<total 2023-2025>;<total 2018-2020>`` :

  Q   Québec — Retraite Québec, Banque de prénoms (Données Québec, CC BY 4.0).
      ATTENTION : l'effectif d'un prénom y est le même dans le fichier
      « filles » et dans le fichier « garçons » — c'est le total TOUS SEXES.
      Les prénoms y sont en capitales, sans accents : Léa et Lea partagent
      la même ligne.
  Bf/Bm  Belgique — Statbel, prénoms des nouveau-nés (open data Statbel).
  Cf/Cm  Suisse — OFS, prénoms des nouveau-nés (opendata.swiss, « terms_by »).

Bloc ``#QS`` : le sexe des prénoms québécois, d'après le fichier où ils
figurent sur 2023-2025 (``nom;f`` ou ``nom;m`` ; absent = les deux).

Seuils : un prénom n'est publié qu'à partir de 5 naissances par an (Québec,
Belgique) ; on garde tout ce qui fait au moins 5 naissances sur trois ans.
Absent ne veut donc pas dire jamais donné : la fiche dit « peu ou pas donné ».

Les prénoms donnés là-bas mais PAS en France (absents de l'INSEE 2023-2025)
entrent dans le catalogue : c'est tout l'intérêt pour qui cherche un prénom
peu porté ici. Voir ``nouveaux()``, appelé par build_metrics.py.

Les deux fenêtres sont décalées de cinq ans (2018-2020 → 2023-2025) : la
tendance est la variation annuelle de la PART du prénom dans les naissances,
pas de son effectif, pour ne pas compter la baisse de la natalité comme une
désaffection. Elle n'est donnée qu'au-dessus de SEUIL_TENDANCE naissances,
comme pour l'INSEE.
"""
from __future__ import annotations
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "francophonie_2023_2025.txt"
SEUIL_TENDANCE = 60
ANNEES = (2023, 2025)

SOURCES = [
    {
        "id": "qc", "pays": "Québec", "organisme": "Retraite Québec",
        "jeu": "Banque de prénoms", "licence": "CC BY 4.0",
        "url": "https://www.donneesquebec.ca/recherche/dataset/banque-de-prenoms-filles",
        "annees": list(ANNEES), "par_sexe": False,
        "note": "filles et garçons confondus, accents ignorés",
    },
    {
        "id": "be", "pays": "Belgique", "organisme": "Statbel",
        "jeu": "Prénoms des nouveau-nés", "licence": "Licence open data Statbel",
        "url": "https://statbel.fgov.be/fr/themes/population/noms-et-prenoms/prenoms-filles-et-garcons",
        "annees": list(ANNEES), "par_sexe": True, "note": "",
    },
    {
        "id": "ch", "pays": "Suisse", "organisme": "Office fédéral de la statistique",
        "jeu": "Prénoms des nouveau-nés", "licence": "opendata.swiss, source à citer",
        "url": "https://www.bfs.admin.ch/asset/fr/DF_BEVNAT_PRENOMS_2",
        "annees": list(ANNEES), "par_sexe": True, "note": "",
    },
]


SEXE_QC: dict[str, str] = {}


def cle_qc(label: str) -> str:
    s = unicodedata.normalize("NFD", str(label))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.upper()).strip()


def lire() -> dict[str, dict]:
    """{code: {"T": total, "To": total ancien, "rows": {nom: (n, n_ancien|None, rang)}}}"""
    blocs: dict[str, dict] = {}
    cur = None
    for ligne in RAW.read_text(encoding="utf-8").splitlines():
        if not ligne:
            continue
        if ligne.startswith("#QS"):
            cur = None
            continue
        if ligne.startswith("#"):
            code, t, to = ligne[1:].split(";")
            cur = blocs[code] = {"T": int(t), "To": int(to), "rows": {}, "_ordre": []}
            continue
        if cur is None:                      # bloc QS : nom;sexe
            nom, sx = ligne.split(";")
            SEXE_QC[nom] = sx
            continue
        champs = ligne.split(";")
        n = int(champs[1])
        nv = int(champs[2]) if len(champs) > 2 else None
        cur["rows"][unicodedata.normalize("NFC", champs[0])] = [n, nv, 0]
        cur["_ordre"].append(n)
    # rang « olympique » : deux prénoms à égalité partagent le rang
    for b in blocs.values():
        tri = sorted(b["rows"].values(), key=lambda r: -r[0])
        rang, prec = 0, None
        for i, r in enumerate(tri, 1):
            if r[0] != prec:
                rang, prec = i, r[0]
            r[2] = rang
        del b["_ordre"]
    return blocs


def tendance(n: int, nv: int | None, T: int, To: int) -> float | None:
    if nv is None or n < SEUIL_TENDANCE or nv <= 0:
        return None
    return round(((n / T) / (nv / To)) ** (1 / 5) * 100 - 100, 1)


def stats(labels: list[str], sexes: list[str]) -> tuple[list, list, dict]:
    """Une entrée par prénom du catalogue : None, ou [qc, be, ch] où chaque
    pays vaut 0 (absent ou sous le seuil) ou [naissances, rang|None, tendance|None]."""
    b = lire()
    sources = [dict(s) for s in SOURCES]
    totaux = {"qc": b["Q"]["T"], "be": {"f": b["Bf"]["T"], "m": b["Bm"]["T"]},
              "ch": {"f": b["Cf"]["T"], "m": b["Cm"]["T"]}}
    for s in sources:
        s["total"] = totaux[s["id"]]

    def un(bloc, nom):
        r = b[bloc]["rows"].get(nom)
        if not r:
            return None
        return [r[0], r[2], tendance(r[0], r[1], b[bloc]["T"], b[bloc]["To"])]

    def par_sexe(pays, nom, sexe):
        if sexe in ("f", "m"):
            return un(pays + sexe, nom) or 0
        # prénom mixte dans l'INSEE : on additionne, sans rang (il n'a pas de sens)
        f, m = un(pays + "f", nom), un(pays + "m", nom)
        if not f and not m:
            return 0
        n = (f[0] if f else 0) + (m[0] if m else 0)
        return [n, None, None]

    out, nb = [], {"qc": 0, "be": 0, "ch": 0}
    for label, sexe in zip(labels, sexes):
        nom = unicodedata.normalize("NFC", str(label))
        qc = un("Q", cle_qc(nom)) or 0
        be = par_sexe("B", nom, sexe)
        ch = par_sexe("C", nom, sexe)
        for k, v in (("qc", qc), ("be", be), ("ch", ch)):
            nb[k] += bool(v)
        out.append([qc, be, ch] if (qc or be or ch) else None)
    return out, sources, nb


def nouveaux(prenoms_insee) -> list[dict]:
    """Les prénoms donnés au Québec, en Belgique ou en Suisse mais absents de
    l'INSEE 2023-2025. Une entrée par graphie : label, naissances filles et
    garçons (là-bas, tous pays additionnés) et le plus gros effectif d'un
    seul pays (qui décide de la pile, comme `births_recent` pour l'INSEE).

    Belgique et Suisse donnent la graphie exacte (accents compris) : elle
    l'emporte. Le Québec n'écrit qu'en capitales sans accents : un prénom
    québécois n'entre que si aucune graphie déjà connue ne s'y ramène.
    """
    b = lire()
    insee = {unicodedata.normalize("NFC", str(x)).upper() for x in prenoms_insee}
    insee_qc = {cle_qc(x) for x in prenoms_insee}
    cand: dict[str, dict] = {}
    for pays in ("B", "C"):
        for sx in ("f", "m"):
            for nom, (n, _nv, _r) in b[pays + sx]["rows"].items():
                cle = nom.upper()
                if cle in insee:
                    continue
                c = cand.setdefault(cle, {"label": nom, "f": 0, "m": 0, "par_pays": {}})
                c[sx] += n
                c["par_pays"][pays] = c["par_pays"].get(pays, 0) + n
    connus = insee_qc | {cle_qc(c["label"]) for c in cand.values()}
    for nom, (n, _nv, _r) in b["Q"]["rows"].items():
        if nom in connus:
            continue
        sx = SEXE_QC.get(nom, "fm")
        c = cand.setdefault(nom, {"label": nom.title(), "f": 0, "m": 0, "par_pays": {}, "qc": True})
        if sx == "fm":
            c["f"] += n / 2; c["m"] += n / 2
        else:
            c[sx] += n
        c["par_pays"]["Q"] = n
    for c in cand.values():
        c["max"] = max(c["par_pays"].values())
    return list(cand.values())


if __name__ == "__main__":
    b = lire()
    for code, v in b.items():
        print(f"{code:3} {len(v['rows']):5} prénoms, {v['T']:,} naissances {ANNEES[0]}-{ANNEES[1]}")
