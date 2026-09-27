#!/usr/bin/env python3
"""
Assemble le CSV final en superposant les sources d'enrichissement,
champ par champ. La premiere source qui renseigne un champ gagne (dans
l'ordre de SOURCES, sauf pour les champs d'ORDRE_CHAMP : le sens).

Ordre : manuel > wiktionnaire (EN puis FR) > claude > llm
  - manuel       : saisi a la main, relu          (data/cache/enrich_manuel.jsonl)
  - wiktionnaire : gratuit, source citable        (data/cache/enrich_wiktionary*.jsonl)
  - claude       : bouche les trous, relu         (data/cache/enrich_claude*.jsonl)
  - llm          : optionnel, payant              (data/cache/enrich_llm.jsonl)
Pour le sens : manuel > claude > wiktionnaire FR (voir ORDRE_CHAMP).

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
# "claude" passe APRES les deux wiktionnaires, et c'est deliberé : le
# Wiktionnaire est mecanique et citable, Claude est un jugement. Claude ne
# remplit donc que les trous, il n'ecrase aucune valeur sourcee.
SOURCES = [("manuel", "enrich_manuel.jsonl"),
           ("wiktionnaire-en", "enrich_wiktionary_en.jsonl"),
           ("wiktionnaire-fr", "enrich_wiktionary.jsonl"),
           ("claude", "enrich_claude.jsonl"),
           # le meme travail, pour les prenoms dont le « sens » etait en fait le
           # mot source du Wiktionnaire (Nicolas « Nicolaus ») : voir
           # enrich_wiktionary.py, glose()
           ("claude", "enrich_claude_complement.jsonl"),
           ("llm", "enrich_llm.jsonl")]
# Exception pour le SENS : Claude passe devant le Wiktionnaire francais.
# La glose du Wiktionnaire est celle du MOT SOURCE (Vincentius -> « vainquant »,
# Irène -> « la déesse Eiréné »), Claude a ecrit le sens du PRENOM, et ce
# travail a ete relu (enrich_claude_relecture.md). Pour les origines, la source
# citable garde la main.
ORDRE_CHAMP: dict[str, list[str]] = {
    "signification": ["manuel", "wiktionnaire-en", "claude", "wiktionnaire-fr", "llm"],
}
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
    confiances: dict[tuple[str, str], str] = {}
    compte = {}
    # {slug: {source: [entrees]}} : une source peut avoir deux graphies
    # du meme slug (Eric, Éric), qui se completent champ par champ.
    entrees: dict[str, dict[str, list[dict]]] = {}
    for nom, fichier in SOURCES:
        f = CACHE / fichier
        compte.setdefault(nom, 0)
        if not f.exists():
            continue
        n = 0
        for ligne in f.read_text(encoding="utf-8").splitlines():
            if not ligne.strip():
                continue
            e = json.loads(ligne)
            sl = slugify(e["prenom"])
            entrees.setdefault(sl, {}).setdefault(nom, []).append(e)
            n += 1
            # La confiance qualifie la SIGNIFICATION, pas le prenom : on la
            # retient par source, et on ne gardera que celle de la source qui
            # a fini par fournir le sens affiche.
            if e.get("confiance"):
                confiances[(sl, nom)] = e["confiance"]
        compte[nom] += n
    ordre_defaut = list(dict.fromkeys(nom for nom, _ in SOURCES))
    for sl, par_source in entrees.items():
        cible = fusion.setdefault(sl, {})
        for c in CHAMPS:
            valeur = next(((e.get(c), nom) for nom in ORDRE_CHAMP.get(c, ordre_defaut)
                           for e in par_source.get(nom, ()) if not vide(e.get(c))), None)
            if valeur:
                cible[c] = valeur

    # Repli pour les prenoms composes absents des sources (Jean-Baptiste, Marie-Rose) :
    # on prend l'union des origines de leurs parties.
    for lab in d["label"].astype(str):
        sl = slugify(lab)
        if fusion.get(sl, {}).get("origines"):
            continue
        if not re.search(r"[- ]", lab):
            continue
        org, sens, conf = [], [], []
        for part in re.split(r"[- ]", lab):
            sp = slugify(part)
            e = fusion.get(sp, {})
            for o in (e.get("origines", (None,))[0] or []):
                if o not in org:
                    org.append(o)
            sg = e.get("signification")
            if sg and sg[0]:
                sens.append(f"{part} : {sg[0]}")
                conf.append(confiances.get((sp, sg[1])))
        if org:
            cible = fusion.setdefault(sl, {})
            cible["origines"] = (org[:3], "composé")
            if sens and "signification" not in cible:
                cible["signification"] = (" + ".join(sens)[:120], "composé")
                # Un compose ne vaut pas mieux que sa partie la plus douteuse.
                rang = {"basse": 0, "moyenne": 1, "haute": 2}
                connus = [c for c in conf if c in rang]
                if connus and len(connus) == len(conf):
                    confiances[(sl, "composé")] = min(connus, key=lambda c: rang[c])
                else:
                    confiances[(sl, "composé")] = "moyenne"

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

    # Une etymologie probable affichee comme un fait, c'est un mensonge poli.
    # On remonte donc jusqu'a la fiche la confiance de la source qui a donne
    # le sens -- et l'app dira "sens probable" quand elle n'est pas haute.
    def confiance(label):
        sl = slugify(label)
        src = source(label, "signification")
        return confiances.get((sl, src)) if src else None
    d["confiance"] = d["label"].map(confiance)

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
    print("\nconfiance du sens affiche :")
    print(d["confiance"].value_counts(dropna=False).to_string())
    print("\norigine par source :")
    print(d["src_origines"].value_counts(dropna=False).to_string())
    print("\ntop familles :")
    print(d[d["origines"] != ""]["origines"].str.split("|").explode()
          .value_counts().head(12).to_string())


if __name__ == "__main__":
    main()
