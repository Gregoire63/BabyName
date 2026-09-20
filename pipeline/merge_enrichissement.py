#!/usr/bin/env python3
"""
Assemble le CSV final en superposant les sources d'enrichissement,
champ par champ. La premiere source qui renseigne un champ gagne.

Ordre : manuel > wiktionnaire > llm
  - manuel       : saisi a la main, relu          (data/cache/enrich_manuel.jsonl)
  - wiktionnaire : gratuit, source citable        (data/cache/enrich_wiktionary.jsonl)
  - llm          : optionnel, payant              (data/cache/enrich_llm.jsonl)

Chaque champ garde la trace de sa source (colonnes src_*), pour pouvoir
auditer ou invalider une source entiere sans tout refaire.
"""
from __future__ import annotations
import json, re, unicodedata
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
BUILD, CACHE = ROOT / "data" / "build", ROOT / "data" / "cache"
# Ordre = priorite. Le wiktionnaire EN passe AVANT le FR pour les origines :
# il classe par origine ultime (Gabriel = hebraique), la ou le FR donne la
# langue d'emprunt (Gabriel = latin). Voir data/raw/PROVENANCE.md.
SOURCES = [("manuel", "enrich_manuel.jsonl"),
           ("wiktionnaire-en", "enrich_wiktionary_en.jsonl"),
           ("wiktionnaire-fr", "enrich_wiktionary.jsonl"),
           ("llm", "enrich_llm.jsonl")]
CHAMPS = ["origines", "signification", "signification_en", "objet_marque",
          "objet_marque_note", "diminutifs", "charge_epellation"]


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z]", "", s.lower())


def vide(v) -> bool:
    return v is None or v == "" or v == [] or (isinstance(v, float) and pd.isna(v))


def main() -> None:
    d = pd.read_csv(BUILD / "prenoms_enrichi.csv")

    # {slug: {champ: (valeur, source)}}
    fusion: dict[str, dict] = {}
    compte = {}
    for nom, fichier in SOURCES:
        f = CACHE / fichier
        if not f.exists():
            compte[nom] = 0
            continue
        n = 0
        for ligne in f.read_text(encoding="utf-8").splitlines():
            if not ligne.strip():
                continue
            e = json.loads(ligne)
            sl = slugify(e["prenom"])
            cible = fusion.setdefault(sl, {})
            n += 1
            for c in CHAMPS:
                if c in cible:            # deja renseigne par une source prioritaire
                    continue
                v = e.get(c)
                if not vide(v):
                    cible[c] = (v, nom)
        compte[nom] = n

    # Repli pour les prenoms composes absents des sources (Jean-Baptiste, Marie-Rose) :
    # on prend l'union des origines de leurs parties.
    for lab in d["label"].astype(str):
        sl = slugify(lab)
        if fusion.get(sl, {}).get("origines"):
            continue
        if not re.search(r"[- ]", lab):
            continue
        org, sens = [], []
        for part in re.split(r"[- ]", lab):
            e = fusion.get(slugify(part), {})
            for o in (e.get("origines", (None,))[0] or []):
                if o not in org:
                    org.append(o)
            sg = e.get("signification")
            if sg and sg[0]:
                sens.append(f"{part} : {sg[0]}")
        if org:
            cible = fusion.setdefault(sl, {})
            cible["origines"] = (org[:3], "composé")
            if sens and "signification" not in cible:
                cible["signification"] = (" + ".join(sens)[:120], "composé")

    def prendre(label, champ, defaut=None):
        e = fusion.get(slugify(label), {}).get(champ)
        return defaut if e is None else e[0]

    def source(label, champ):
        e = fusion.get(slugify(label), {}).get(champ)
        return None if e is None else e[1]

    d["origines"] = d["label"].map(lambda s: "|".join(prendre(s, "origines", [])))
    d["signification"] = d["label"].map(lambda s: prendre(s, "signification"))
    d["signification_en"] = d["label"].map(lambda s: prendre(s, "signification_en"))
    d["objet_marque"] = d["label"].map(lambda s: bool(prendre(s, "objet_marque", False)))
    d["objet_marque_note"] = d["label"].map(lambda s: prendre(s, "objet_marque_note"))
    d["diminutifs"] = d["label"].map(lambda s: "|".join(prendre(s, "diminutifs", [])))
    d["charge_epellation"] = d["label"].map(lambda s: prendre(s, "charge_epellation"))
    d["src_origines"] = d["label"].map(lambda s: source(s, "origines"))
    d["src_signification"] = d["label"].map(lambda s: source(s, "signification"))

    out = BUILD / "prenoms_final.csv"
    d.to_csv(out, index=False, encoding="utf-8")

    n = len(d)
    w = d["births_recent"].fillna(0)
    print("entrees lues par source :", compte)
    print(f"\n{n:,} prenoms -> {out}")
    ao = (d["origines"] != "").sum()
    asg = d["signification"].notna().sum()
    print(f"  avec origine      : {ao:,} ({100*ao/n:.1f} %)"
          f"   pondere naissances : {w[d['origines'] != ''].sum()/w.sum()*100:.1f} %")
    print(f"  avec signification: {asg:,} ({100*asg/n:.1f} %)"
          f"   pondere naissances : {w[d['signification'].notna()].sum()/w.sum()*100:.1f} %")
    print("\norigine par source :")
    print(d["src_origines"].value_counts(dropna=False).to_string())
    print("\ntop familles :")
    print(d[d["origines"] != ""]["origines"].str.split("|").explode()
          .value_counts().head(12).to_string())


if __name__ == "__main__":
    main()
