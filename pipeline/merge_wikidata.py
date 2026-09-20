#!/usr/bin/env python3
"""
Joint l'enrichissement Wikidata sur la table de metriques.

Entrees : data/raw/wikidata_prenoms.json  [{"n": "Gabriel", "l": "Q9288"}, ...]
          data/raw/wikidata_langues.json  {"Q9288": "hebreu", ...}
Sortie  : data/build/prenoms_enrichi.csv
"""
from __future__ import annotations
import json, re, unicodedata
from collections import defaultdict
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW, BUILD = ROOT / "data" / "raw", ROOT / "data" / "build"

# Wikidata donne la LANGUE D'USAGE (P407), pas l'etymologie.
# On la replie sur des familles d'origine lisibles par un parent.
# Regles ordonnees par sous-chaine : plus robuste qu'un dictionnaire exact,
# Wikidata multipliant les variantes ("arabe algerien", "anglais britannique"...).
REGLES = [
    ("hébreu", "hébraïque"), ("yiddish", "hébraïque"), ("judéo", "hébraïque"),
    ("arabe", "arabe"),
    ("berbère", "berbère"), ("kabyle", "berbère"), ("tamazight", "berbère"),
    ("chaoui", "berbère"), ("tachelhit", "berbère"),
    ("turc", "turc"), ("azéri", "turc"), ("ouzbek", "turc"), ("kazakh", "turc"),
    ("persan", "persan"), ("kurde", "persan"), ("pachto", "persan"), ("tadjik", "persan"),
    ("grec", "grec"),
    ("latin", "latin"), ("italien", "latin"), ("espagnol", "latin"),
    ("portugais", "latin"), ("roumain", "latin"), ("catalan", "latin"),
    ("galicien", "latin"), ("sarde", "latin"), ("sicilien", "latin"),
    ("napolitain", "latin"), ("vénitien", "latin"), ("ladin", "latin"),
    ("français", "français"), ("occitan", "français"), ("corse", "français"),
    ("picard", "français"), ("wallon", "français"), ("normand", "français"),
    ("allemand", "germanique"), ("néerlandais", "germanique"),
    ("flamand", "germanique"), ("frison", "germanique"),
    ("luxembourgeois", "germanique"), ("alémanique", "germanique"),
    ("anglais", "anglo-saxon"), ("écossais", "anglo-saxon"), ("scots", "anglo-saxon"),
    ("suédois", "scandinave"), ("norvégien", "scandinave"), ("danois", "scandinave"),
    ("islandais", "scandinave"), ("féroïen", "scandinave"), ("norrois", "scandinave"),
    ("finnois", "finno-ougrien"), ("estonien", "finno-ougrien"),
    ("hongrois", "finno-ougrien"), ("same", "finno-ougrien"),
    ("breton", "celtique"), ("gallois", "celtique"), ("irlandais", "celtique"),
    ("gaélique", "celtique"), ("cornique", "celtique"), ("mannois", "celtique"),
    ("russe", "slave"), ("polonais", "slave"), ("ukrainien", "slave"),
    ("tchèque", "slave"), ("slovaque", "slave"), ("slovène", "slave"),
    ("serbe", "slave"), ("croate", "slave"), ("bulgare", "slave"),
    ("macédonien", "slave"), ("biélorusse", "slave"), ("bosniaque", "slave"),
    ("letton", "balte"), ("lituanien", "balte"),
    ("basque", "basque"),
    ("arménien", "arménien"), ("géorgien", "caucasien"),
    ("tchétchène", "caucasien"), ("ossète", "caucasien"),
    ("albanais", "albanais"),
    ("sanskrit", "indien"), ("hindi", "indien"), ("tamoul", "indien"),
    ("pendjabi", "indien"), ("ourdou", "indien"), ("bengali", "indien"),
    ("gujarati", "indien"), ("marathi", "indien"), ("télougou", "indien"),
    ("cingalais", "indien"), ("népalais", "indien"), ("saraiki", "indien"),
    ("japonais", "asiatique"), ("chinois", "asiatique"), ("coréen", "asiatique"),
    ("vietnamien", "asiatique"), ("mandarin", "asiatique"), ("thaï", "asiatique"),
    ("khmer", "asiatique"), ("indonésien", "asiatique"), ("malais", "asiatique"),
    ("tagalog", "asiatique"), ("cantonais", "asiatique"),
    ("swahili", "africain"), ("wolof", "africain"), ("yoruba", "africain"),
    ("amharique", "africain"), ("haoussa", "africain"), ("malgache", "africain"),
    ("igbo", "africain"), ("zoulou", "africain"), ("bambara", "africain"),
    ("peul", "africain"), ("soninké", "africain"), ("lingala", "africain"),
    ("somali", "africain"), ("tigrigna", "africain"), ("akan", "africain"),
    ("afrikaans", "africain"), ("éwé", "africain"), ("kikuyu", "africain"),
    ("hawaïen", "océanien"), ("maori", "océanien"), ("tahitien", "océanien"),
    ("samoan", "océanien"), ("fidjien", "océanien"),
]


def famille(label: str) -> str | None:
    l = label.lower()
    for cle, fam in REGLES:
        if cle in l:
            return fam
    if "multilingue" in l or "plusieurs" in l:
        return None          # aucune information
    return l                 # on garde le brut plutot que de perdre l'info


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z]", "", s.lower())


def main() -> None:
    d = pd.read_csv(BUILD / "prenoms_metrics.csv")

    noms = json.loads((RAW / "wikidata_prenoms.json").read_text(encoding="utf-8"))
    langues = json.loads((RAW / "wikidata_langues.json").read_text(encoding="utf-8"))

    par_slug: dict[str, set] = defaultdict(set)
    vus: set[str] = set()
    for e in noms:
        sl = slugify(e["n"])
        if not sl:
            continue
        vus.add(sl)
        qid = e.get("l")
        if qid:
            lab = langues.get(qid)
            if lab:
                fam = famille(lab)
                if fam:
                    par_slug[sl].add(fam)

    d["langues_usage"] = d["slug"].map(
        lambda s: "|".join(sorted(par_slug.get(slugify(s), ()))))
    d["wikidata_connu"] = d["slug"].map(lambda s: slugify(s) in vus)

    n = len(d)
    couvert_nom = int(d["wikidata_connu"].sum())
    couvert_org = int((d["langues_usage"] != "").sum())
    # ponderee par les naissances : c'est ce qui compte vraiment pour l'usage
    w = d["births_recent"].fillna(0)
    pond = float(w[d["langues_usage"] != ""].sum() / w.sum() * 100)

    out = BUILD / "prenoms_enrichi.csv"
    d.to_csv(out, index=False, encoding="utf-8")

    print(f"{n:,} prenoms")
    print(f"  presents dans Wikidata : {couvert_nom:,}  ({100*couvert_nom/n:.1f} %)")
    print(f"  avec >=1 langue d'usage: {couvert_org:,}  ({100*couvert_org/n:.1f} %)")
    print(f"  couverture ponderee par les naissances : {pond:.1f} %")
    print(f"\n-> {out}")
    top = (d[d["langues_usage"] != ""]["langues_usage"].str.split("|").explode()
           .value_counts().head(15))
    print("\nfamilles de langues d'usage les plus frequentes :")
    print(top.to_string())
    print("\nsans langue d'usage, les plus courants :")
    print(d[d["langues_usage"] == ""].nlargest(12, "births_recent")
          [["label", "sexe", "births_recent", "wikidata_connu"]].to_string(index=False))


if __name__ == "__main__":
    main()
