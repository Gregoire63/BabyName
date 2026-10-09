#!/usr/bin/env python3
"""
Les prénoms dans tous les pays dont les statistiques sont libres et complètes.

Entrées :
  data/raw/pays/<code>.txt              un fichier par pays (format ci-dessous)
  data/raw/francophonie_2023_2025.txt   Québec, Belgique, Suisse (francophonie.py)
  data/build/prenoms_final.csv          le catalogue (INSEE + prénoms d'ailleurs)

Format d'un fichier pays (extraits le 2026-10-09, voir data/raw/PROVENANCE.md) :
  #pays=<code>;nom=…;organisme=…;jeu=…;licence=…;url=…;annees=a0-a1;ancien=b0-b1;seuil=…;casse=originale|majuscules
  #f;<naissances fenêtre récente>;<naissances fenêtre ancienne>
  Prenom;n;nold
  #m;…

Sorties (app/public/data/pays/) :
  index.json        la liste des pays, leurs sources, totaux, années, notes
  <code>.json(.gz)  une ligne par prénom : [label, sexe, n, rang, tendance, nouveau(, nb_car, nb_syllabes)]
                    sexe 0 = fille, 1 = garçon, 2 = tous sexes (Québec)
                    label = la graphie du CATALOGUE quand le prénom y est (même
                    graphie, ou même graphie sans accents), sinon celle du pays
                    et nouveau = 1 : l'app le crée quand ce pays est choisi.

Chargés à la demande par l'app : rien ne grossit le catalogue.
"""
from __future__ import annotations
import gzip, json, re, sys, unicodedata
from pathlib import Path
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
import francophonie
from build_metrics import titlecase_fr, syllables_fr, strip_accents

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "pays"
FINAL = ROOT / "data" / "build" / "prenoms_final.csv"
OUT = ROOT / "app" / "public" / "data" / "pays"
SEUIL_TENDANCE = 60

# Ordre d'affichage, regroupement, et ce qu'il faut dire de chaque source.
PAYS = {
    "fr":     ("France", "Francophonie", ""),
    "be":     ("Belgique", "Francophonie", ""),
    "ch":     ("Suisse", "Francophonie", ""),
    "qc":     ("Québec", "Francophonie", "filles et garçons confondus, accents ignorés"),
    "ca-on":  ("Ontario", "Amérique du Nord", ""),
    "ca-bc":  ("Colombie-Britannique", "Amérique du Nord", "dernières données publiées : 2021-2023"),
    "us":     ("États-Unis", "Amérique du Nord", ""),
    "gb-eaw": ("Angleterre et pays de Galles", "Europe", ""),
    "gb-sct": ("Écosse", "Europe", "accents non publiés"),
    "gb-nir": ("Irlande du Nord", "Europe", "accents non publiés"),
    "ie":     ("Irlande", "Europe", ""),
    "at":     ("Autriche", "Europe", ""),
    "se":     ("Suède", "Europe", "dernières données publiées : 2020-2022"),
    "no":     ("Norvège", "Europe", "liste partielle : prénoms portés par au moins 200 personnes"),
    "pl":     ("Pologne", "Europe", "premier prénom seulement"),
    "lv":     ("Lettonie", "Europe", ""),
    "nz":     ("Nouvelle-Zélande", "Océanie", "quelques macrons perdus par la source"),
}
# Le sigle du badge (l'organisme complet est dans l'info-bulle).
SIGLE = {"fr": "INSEE", "be": "Statbel", "ch": "OFS", "qc": "Retraite Québec", "ca-on": "ServiceOntario",
         "ca-bc": "BC Vital Statistics", "us": "SSA", "gb-eaw": "ONS", "gb-sct": "NRS", "gb-nir": "NISRA",
         "ie": "CSO", "at": "Statistik Austria", "se": "SCB", "no": "SSB", "pl": "PESEL", "lv": "CSB",
         "nz": "DIA"}
# Israël (il.txt) est extrait mais pas proposé : le CBS ne publie que la
# graphie hébraïque, sans translittération — rien à montrer sur une carte.
EXCLUS = {"il"}
# La Lettonie compte les enfants de moins d'un an au 1er janvier : l'année
# publiée N, ce sont les naissances de N-1.
DECALAGE = {"lv": -1}


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", str(s)).strip()


def cle_sans_accent(s: str) -> str:
    s = strip_accents(nfc(s)).lower()
    s = s.replace("’", "'")
    return re.sub(r"[\s\-]+", "-", s).strip("-")


def lire_pays(chemin: Path) -> dict:
    meta, blocs, cur = {}, {}, None
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        if not ligne:
            continue
        if ligne.startswith("#pays="):
            for champ in ligne[1:].split(";"):
                k, _, v = champ.partition("=")
                meta[k] = v
            continue
        if ligne.startswith("#"):
            sx, t, to = ligne[1:].split(";")
            cur = blocs[sx] = {"T": int(t), "To": int(to or 0), "rows": []}
            continue
        nom, n, nv = (ligne.split(";") + [""])[:3]
        if not n.strip().isdigit():          # ligne d'en-tête « Prenom;n;nold »
            continue
        cur["rows"].append((nfc(nom), int(n), int(nv) if nv.strip() else None))
    return {"meta": meta, "blocs": blocs}


def depuis_francophonie() -> dict:
    """Québec, Belgique, Suisse au même format que les fichiers pays."""
    b = francophonie.lire()
    out = {}
    src = {s["id"]: s for s in francophonie.SOURCES}
    for code, blocs in (("qc", {"x": "Q"}), ("be", {"f": "Bf", "m": "Bm"}), ("ch", {"f": "Cf", "m": "Cm"})):
        s = src[code]
        out[code] = {
            "meta": {"pays": code, "organisme": s["organisme"], "jeu": s["jeu"], "licence": s["licence"],
                     "url": s["url"], "annees": "2023-2025", "ancien": "2018-2020",
                     "seuil": "5 naissances par an", "casse": "majuscules" if code == "qc" else "originale"},
            "blocs": {sx: {"T": b[k]["T"], "To": b[k]["To"],
                           "rows": [(nom, r[0], r[1]) for nom, r in b[k]["rows"].items()]}
                      for sx, k in blocs.items()},
        }
    return out


def main() -> None:
    d = pd.read_csv(FINAL)
    d["n"] = d["births_recent"].fillna(0).astype(int)
    exact: dict[str, str] = {}
    sans: dict[str, tuple[int, str]] = {}
    for label, n in zip(d["label"].astype(str), d["n"]):
        exact.setdefault(nfc(label).lower(), label)
        k = cle_sans_accent(label)
        if k not in sans or n > sans[k][0]:
            sans[k] = (n, label)

    def associer(nom: str) -> str | None:
        return exact.get(nom.lower()) or (sans.get(cle_sans_accent(nom)) or (0, None))[1]

    sources = depuis_francophonie()
    for f in sorted(RAW.glob("*.txt")):
        code = f.stem
        if code in EXCLUS:
            continue
        sources[code] = lire_pays(f)

    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    # La France vient du catalogue lui-même.
    fr = d[~d.get("hors_france", False).fillna(False).astype(bool)]
    index.append({
        "code": "fr", "nom": "France", "groupe": "Francophonie", "catalogue": True, "sigle": "INSEE",
        "organisme": "INSEE", "jeu": "Fichier des prénoms, millésime 2025", "licence": "Licence ouverte Etalab 2.0",
        "url": "https://www.insee.fr/fr/statistiques/8595130", "annees": [2023, 2025], "seuil": "3 naissances par an",
        "par_sexe": True, "note": "",
        "total": {"f": int(fr["births_f"].fillna(0).sum()), "m": int(fr["births_m"].fillna(0).sum())},
    })

    for code, (nom_fr, groupe, note) in PAYS.items():
        if code == "fr" or code not in sources:
            continue
        src = sources[code]
        meta = src["meta"]
        a0, a1 = (int(x) for x in meta["annees"].split("-"))
        dec = DECALAGE.get(code, 0)
        lignes = []
        total = {}
        for sx_code, bloc in src["blocs"].items():
            sx = {"f": 0, "m": 1, "x": 2}[sx_code]
            total[sx_code] = bloc["T"]
            agg: dict[tuple[str, int], list] = {}
            for nom, n, nv in bloc["rows"]:
                if not nom or n < 5:
                    continue
                if meta.get("casse") == "majuscules" or nom.isupper():
                    nom = titlecase_fr(nom)
                lab = associer(nom)
                cle = (lab or nom, sx)
                a = agg.setdefault(cle, [lab is None, 0, None])
                a[1] += n
                if nv is not None:
                    a[2] = (a[2] or 0) + nv
            rangees = sorted(agg.items(), key=lambda kv: -kv[1][1])
            rang, prec = 0, None
            for i, ((lab, sx), (nouveau, n, nv)) in enumerate(rangees, 1):
                if n != prec:
                    rang, prec = i, n
                t = None
                if nv and n >= SEUIL_TENDANCE and bloc["To"]:
                    t = round(((n / bloc["T"]) / (nv / bloc["To"])) ** (1 / 5) * 100 - 100, 1)
                ligne = [lab, sx, n, rang, t, int(nouveau)]
                if nouveau:
                    ligne += [len(re.sub(r"[- ’']", "", lab)), syllables_fr(lab)]
                lignes.append(ligne)
        nouveaux = sum(l[5] for l in lignes)
        doc = {"code": code, "lignes": lignes}
        txt = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
        (OUT / f"{code}.json").write_text(txt, encoding="utf-8")
        with gzip.GzipFile(filename="", mode="wb", fileobj=(OUT / f"{code}.json.gz").open("wb"),
                           compresslevel=9, mtime=0) as g:
            g.write(txt.encode())
        par_sexe = "x" not in total
        index.append({
            "code": code, "nom": nom_fr, "groupe": groupe, "catalogue": False, "sigle": SIGLE.get(code, code),
            "organisme": meta.get("organisme", ""), "jeu": meta.get("jeu", ""),
            "licence": meta.get("licence", ""), "url": meta.get("url", "").split(" ")[0],
            "annees": [a0 + dec, a1 + dec], "seuil": meta.get("seuil", ""),
            "par_sexe": par_sexe, "note": note,
            "total": {"f": total.get("f", 0), "m": total.get("m", 0)} if par_sexe else total["x"],
            "prenoms": len(lignes), "nouveaux": nouveaux,
        })
        print(f"{code:7} {nom_fr:30} {len(lignes):6,} prénoms ({nouveaux:6,} absents du catalogue)  "
              f"gzip {(OUT / f'{code}.json.gz').stat().st_size/1024:5.0f} Ko")

    (OUT / "index.json").write_text(json.dumps({"version": 1, "pays": index}, ensure_ascii=False, indent=1),
                                    encoding="utf-8")
    print(f"{len(index)} pays -> {OUT / 'index.json'}")


if __name__ == "__main__":
    main()
