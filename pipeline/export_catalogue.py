#!/usr/bin/env python3
"""
Exporte le catalogue pour EMBARQUEMENT dans l'app.

Le catalogue est en lecture seule et ne bouge qu'a la prochaine publication
INSEE : il n'a rien a faire dans une base. Format colonnaire + dictionnaires,
pour que le gzip du CDN fasse le reste.

Sortie : app/public/data/catalogue.json
"""
from __future__ import annotations
import json, gzip, io
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "build" / "prenoms_final.csv"
PACK = ROOT / "data" / "raw" / "prenoms_insee_2025_packed.csv"
AN0, AN1 = 1986, 2025          # fenetre de la courbe affichee dans la fiche
SEUIL_SERIE = 60               # en dessous, la courbe n'est que du bruit d'arrondi
OUT = ROOT / "app" / "public" / "data" / "catalogue.json"
OUT.parent.mkdir(parents=True, exist_ok=True)

SEXE = ["f", "m", "fm"]
CONF = ["basse", "moyenne", "haute"]


def series_par_prenom() -> dict[str, list[float]]:
    """Courbe de popularite (pour 10 000 naissances) sur AN0..AN1.

    Elle n'est pas dans prenoms_final.csv : on la recalcule depuis le fichier
    compact. Reservee aux prenoms d'un certain volume, sinon on affiche une
    courbe en dents de scie qui ne reflete que l'arrondi a 5 de l'INSEE.
    """
    annees = list(range(AN0, AN1 + 1))
    brut: dict[str, dict[int, int]] = {}
    total: dict[int, int] = {a: 0 for a in annees}
    with open(PACK, encoding="utf-8") as fh:
        next(fh)
        for ligne in fh:
            ligne = ligne.rstrip("\n")
            if not ligne:
                continue
            _sx, nom, y0, vals = ligne.split(";", 3)
            y0 = int(y0)
            cible = brut.setdefault(nom, {})
            for i, v in enumerate(vals.split(",")):
                an = y0 + i
                if AN0 <= an <= AN1:
                    n = int(v) * 5
                    if n:
                        cible[an] = cible.get(an, 0) + n
                        total[an] += n
    return {
        nom: [round(par.get(a, 0) / total[a] * 10_000, 1) if total[a] else 0.0 for a in annees]
        for nom, par in brut.items()
    }


def main() -> None:
    d = pd.read_csv(SRC)
    d = d.sort_values("births_recent", ascending=False).reset_index(drop=True)

    # Groupes de prononciation : une carte pour Nelya + Nelia + Nelya. Le
    # groupe est (prononciation, sexe) — Maël et Maëlle se disent pareil mais
    # ne sont pas le meme prenom. On exporte un index, pas la cle : 19 608
    # chaines valent 120 Ko de plus pour rien.
    cles = list(dict.fromkeys(zip(d["prononciation"].fillna(""), d["sexe"])))
    gidx = {k: i for i, k in enumerate(cles)}

    # dictionnaire des origines -> index
    origines = sorted({o for s in d["origines"].fillna("") for o in s.split("|") if o})
    oidx = {o: i for i, o in enumerate(origines)}

    def enc_org(s):
        if not isinstance(s, str) or not s:
            return []
        return [oidx[o] for o in s.split("|") if o in oidx]

    def enc_dim(s):
        return s.split("|") if isinstance(s, str) and s else []

    series = series_par_prenom()
    def enc_serie(label, n):
        # on ne retient la courbe que pour les prenoms suffisamment nombreux
        return series.get(str(label).upper()) if n >= SEUIL_SERIE else None

    cols = {
        # identite
        "l": d["label"].tolist(),
        "gp": [gidx[(p, s)] for p, s in zip(d["prononciation"].fillna(""), d["sexe"])],
        "s": [SEXE.index(x) for x in d["sexe"]],
        "u": [round(float(x), 2) for x in d["unisexe_ratio"].fillna(0)],
        # frequence
        "f": [round(float(x), 2) for x in d["freq_recent_p10k"].fillna(0)],
        "n": [int(x) for x in d["births_recent"].fillna(0)],
        "t": [round(float(x), 1) for x in d["trend_pct_an"].fillna(0)],
        "p": [int(x) if pd.notna(x) else 0 for x in d["peak_year"]],
        "o": [round(float(x), 0) for x in d["originalite"].fillna(0)],
        "r": [round(float(x), 0) for x in d["risque_surprise"].fillna(0)],
        "rv": [int(bool(x)) for x in d["revival_emergent"].fillna(False)],
        # rare : effectif trop faible pour que les metriques veuillent dire
        # quelque chose. Present dans le catalogue, hors pile de swipe par defaut.
        "q": [int(bool(x)) for x in d["rare"].fillna(False)],
        # forme
        "c": [int(x) for x in d["nb_car"].fillna(0)],
        "y": [int(x) for x in d["nb_syllabes"].fillna(0)],
        "k": [int(bool(x)) for x in d["compose"].fillna(False)],
        "i": d["initiale"].fillna("").tolist(),
        "e": d["finale"].fillna("").tolist(),
        # sens
        "g": [enc_org(x) for x in d["origines"].fillna("")],
        "m": [x if isinstance(x, str) else None for x in d["signification"]],
        # Confiance dans le SENS affiche : 0 basse, 1 moyenne, 2 haute, null
        # si aucun sens. Une etymologie probable montree comme un fait, c'est
        # un mensonge poli : la fiche le dit.
        "cf": [CONF.index(x) if x in CONF else None for x in d["confiance"]],
        "me": [x if isinstance(x, str) else None for x in d["signification_en"]],
        "ob": [int(bool(x)) for x in d["objet_marque"].fillna(False)],
        "obn": [x if isinstance(x, str) else None for x in d["objet_marque_note"]],
        "dm": [enc_dim(x) for x in d["diminutifs"].fillna("")],
        # courbe 1986-2025, pour 10 000 naissances ; null si trop peu de volume
        "sr": [enc_serie(l, n) for l, n in zip(d["label"], d["births_recent"].fillna(0))],
    }

    doc = {
        "version": 1,
        "source": "INSEE fichier des prénoms, millésime 2025",
        "n": len(d),
        "origines": origines,
        "sexe": SEXE,
        "confiance": CONF,
        "champs": {
            "l": "label", "s": "sexe", "u": "unisexe_ratio", "f": "freq_p10k",
            "n": "naissances_3ans", "t": "tendance_pct_an", "p": "pic_annee",
            "o": "originalite", "r": "risque_surprise", "rv": "revival_emergent",
            "q": "rare",
            "c": "nb_car", "y": "nb_syllabes", "k": "compose", "i": "initiale",
            "e": "finale", "gp": "groupe_prononciation",
            "g": "origines", "m": "signification",
            "cf": "confiance_sens",
            "me": "signification_en", "ob": "objet_marque",
            "obn": "objet_marque_note", "dm": "diminutifs", "sr": "serie_p10k",
        },
        "serie_annees": [AN0, AN1],
        "cols": cols,
    }

    txt = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(txt, encoding="utf-8")

    # Version pre-compressee : c'est elle qui part en production. Le navigateur
    # la decompresse avec DecompressionStream. Meme poids reseau qu'un .json
    # servi gzip par le CDN, mais un artefact de deploiement 6x plus petit.
    gz = OUT.with_suffix(".json.gz")
    with gzip.GzipFile(filename="", mode="wb", fileobj=gz.open("wb"), compresslevel=9, mtime=0) as f:
        f.write(txt.encode())

    avec_serie = sum(1 for x in cols["sr"] if x)
    rares = sum(cols["q"])
    groupes = len(set(cols["gp"]))
    sens = sum(1 for x in cols["m"] if x)
    sur = sum(1 for x in cols["cf"] if x == 2)
    print(f"{len(d):,} prenoms ({len(d)-rares:,} dans la pile, {rares:,} rares), "
          f"{len(origines)} origines, {avec_serie:,} courbes")
    print(f"  {groupes:,} groupes de prononciation "
          f"({len(d)-groupes:,} cartes en moins, -{(1-groupes/len(d))*100:.0f} %)")
    print(f"  {sens:,} avec un sens, dont {sur:,} en confiance haute")
    print(f"  brut : {len(txt)/1024:.0f} Ko  ({OUT.name})")
    print(f"  gzip : {gz.stat().st_size/1024:.0f} Ko  ({gz.name})  <- deploye")


if __name__ == "__main__":
    main()
