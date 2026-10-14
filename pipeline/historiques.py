#!/usr/bin/env python3
"""
Les prénoms que l'INSEE a comptés mais que le catalogue n'a pas.

Le catalogue (export_catalogue.py) ne garde que les prénoms donnés de 2023 à
2025 : c'est la matière du swipe. Josette, Ginette, Raymonde ou Marie-Christine
n'y sont donc pas — 154 035, 131 480, 164 835 et 75 605 naissances depuis 1900.
Ils n'ont rien à faire dans la pile d'un couple qui choisit en 2026, mais leurs
porteuses existent par centaines de milliers et cherchent « Josette
signification » : chacun de ces prénoms a sa fiche publique, que
app/scripts/seo.mjs écrit depuis les naissances INSEE.

Ce que l'INSEE ne dit pas — l'origine et le sens — vient d'ici : les mêmes
sources, dans le même ordre, avec le même repli pour les composés que le
catalogue (merge_enrichissement.py). Un prénom sans aucune donnée n'a pas de
ligne : sa fiche le dira, plutôt que d'inventer.

Sortie : app/scripts/donnees/historiques.json
  {slug de la fiche: {"l": graphie, "g": [origines], "m": sens ou null,
                      "cf": 0 basse, 1 moyenne, 2 haute, ou null}}
"""
from __future__ import annotations
import json, re, sys, unicodedata
from collections import Counter
from pathlib import Path
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from merge_enrichissement import fusionner, completer_composes, slugify, CACHE, SOURCES

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "data" / "raw" / "prenoms_insee_2025_packed.csv"
FINAL = ROOT / "data" / "build" / "prenoms_final.csv"
OUT = ROOT / "app" / "scripts" / "donnees" / "historiques.json"
CONF = ["basse", "moyenne", "haute"]
# Assez de naissances pour qu'une fiche puisse un jour s'y intéresser ; le
# seuil d'une page indexée, lui, est décidé dans seo.mjs (SEUIL_HISTOIRE).
SEUIL = 100


def titlecase_fr(name: str) -> str:
    """MARIE-CHRISTINE -> Marie-Christine (la règle de build_metrics.py)."""
    parts = re.split(r"([- ’'])", name.lower())
    return "".join(p if p in "- ’'" else p.capitalize() for p in parts)


def slug_fiche(s: str) -> str:
    """L'adresse d'une fiche (/prenom/<slug>/), comme seo.mjs la calcule."""
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z]+", "-", s))


def main() -> None:
    catalogue = {slug_fiche(l) for l in pd.read_csv(FINAL)["label"].astype(str)}

    # Les prénoms INSEE hors catalogue, par fiche : graphies et naissances.
    graphies: dict[str, Counter] = {}
    with open(PACK, encoding="utf-8") as fh:
        next(fh)
        for ligne in fh:
            ligne = ligne.rstrip("\n")
            if not ligne:
                continue
            _sx, nom, _y0, vals = ligne.split(";", 3)
            s = slug_fiche(nom)
            if not s or s in catalogue:
                continue
            graphies.setdefault(s, Counter())[nom] += sum(int(v) for v in vals.split(",")) * 5
    retenus = {s: g for s, g in graphies.items() if sum(g.values()) >= SEUIL}

    fusion, confiances, _ = fusionner()
    libelles = {s: titlecase_fr(g.most_common(1)[0][0]) for s, g in retenus.items()}
    completer_composes(libelles.values(), fusion, confiances)

    # La graphie des sources quand elle ne diffère que par les accents : le
    # fichier de l'INSEE écrit souvent SEVERINE, les sources Séverine.
    accentuee: dict[str, str] = {}
    for _nom, fichier in SOURCES:
        f = CACHE / fichier
        if not f.exists():
            continue
        for l in f.read_text(encoding="utf-8").splitlines():
            if l.strip():
                p = json.loads(l)["prenom"]
                accentuee.setdefault(slug_fiche(p), p)

    sortie = {}
    for s, lab in sorted(libelles.items()):
        e = fusion.get(slugify(lab), {})
        org = (e.get("origines") or (None,))[0] or []
        sens = e.get("signification")
        if not org and not sens:
            continue
        a = accentuee.get(s)
        if a and slugify(a) == slugify(lab) and a.replace("-", "").lower() != lab.replace("-", "").lower():
            lab = a
        conf = confiances.get((slugify(lab), sens[1])) if sens else None
        sortie[s] = {"l": lab, "g": list(org)[:3], "m": sens[0] if sens else None,
                     "cf": CONF.index(conf) if conf in CONF else None}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(sortie, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n",
                   encoding="utf-8")
    avec_sens = sum(1 for x in sortie.values() if x["m"])
    print(f"{len(retenus):,} prénoms INSEE hors catalogue (>= {SEUIL} naissances depuis 1900)")
    print(f"  {len(sortie):,} avec une origine ou un sens, dont {avec_sens:,} avec un sens -> {OUT}")


if __name__ == "__main__":
    main()
