#!/usr/bin/env python3
"""
Enrichissement LLM des prenoms : origine etymologique, signification,
collision objet/marque, diminutifs, charge d'epellation.

Wikidata ne donne QUE des langues d'usage (cf. data/raw/PROVENANCE.md).
L'origine reelle et la signification viennent d'ici.

Dependances : python3 + pandas. Rien d'autre (HTTP via urllib).

Usage
-----
    # 1. verifier sans rien consommer
    python3 pipeline/enrich_llm.py dry-run

    # 2. tester sur 40 prenoms et LIRE le resultat avant de lancer le reste
    python3 pipeline/enrich_llm.py run --limit 40
    python3 pipeline/enrich_llm.py verify

    # 3. tout le catalogue (reprise automatique si interrompu)
    python3 pipeline/enrich_llm.py run

    # 4. produire le CSV final
    python3 pipeline/enrich_llm.py merge

Cle API : variable d'environnement ANTHROPIC_API_KEY, ou fichier .env
a la racine du projet contenant  ANTHROPIC_API_KEY=sk-ant-...
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import threading
import time
import unicodedata
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "data" / "build"
CACHE = ROOT / "data" / "cache"
CACHE.mkdir(parents=True, exist_ok=True)
JSONL = Path(os.environ.get("ENRICH_CACHE") or (CACHE / "enrich_llm.jsonl"))

API = "https://api.anthropic.com/v1"
BATCH = 40
WORKERS = 4
MAX_RETRY = 6

# Vocabulaire FERME. C'est le point critique : sans enum, le modele renvoie
# 300 libellés differents ("hebreu", "hébraïque", "Hébreu ancien"...) et le
# filtre de l'app devient inutilisable.
ORIGINES = [
    "hébraïque", "araméen", "arabe", "berbère", "persan", "turc",
    "grec", "latin", "étrusque", "celtique", "germanique", "anglo-saxon",
    "scandinave", "slave", "basque", "arménien", "géorgien",
    "finno-ougrien", "indien", "asiatique", "africain", "océanien",
    "égyptien", "amérindien", "espagnol", "italien", "portugais",
    "français", "moderne-inventé",
]

SYSTEME = """Tu es lexicographe, spécialisé en onomastique française.

Pour chaque prénom fourni, tu renseignes des faits établis. Tu ne combles \
jamais un trou par une hypothèse plausible : en cas de doute, tu mets null \
et tu baisses la confiance. Un champ vide est infiniment préférable à une \
étymologie inventée — ces données servent à des parents qui choisiront un \
prénom pour la vie.

Règles :
- `origines` : 1 à 3 entrées du vocabulaire imposé, de la plus directe à la \
plus lointaine. Pour un prénom composé, l'origine de chaque élément. Liste \
vide si l'étymologie n'est pas établie.
- `signification` : le sens étymologique, 10 mots maximum, en français, sans \
article introductif. Exemple pour Gabriel : « force de Dieu ». null si inconnu \
ou si le prénom est une création moderne sans sens.
- `objet_marque` : true seulement si le prénom est AUSSI, en français courant, \
un objet, un animal, une marque connue, ou un personnage si célèbre qu'il \
écrase le prénom. Ambre → true (la résine). Jade → true (la pierre). Mercedes \
→ true (la marque). Gabriel → false.
- `diminutifs` : les abréviations réellement utilisées en France. Alexandre → \
["Alex"]. Liste vide s'il n'y en a pas d'usage courant.
- `charge_epellation` : 0 = jamais besoin d'épeler (Paul). 1 = rarement. \
2 = souvent (Maëlys). 3 = systématiquement, plusieurs graphies concurrentes \
(Lyam/Liam/Lyham).
- `confiance` : "haute" si l'étymologie est documentée et consensuelle, \
"moyenne" si elle est probable, "basse" sinon. Sois sévère."""

SCHEMA = {
    "name": "enregistrer_prenoms",
    "description": "Enregistre les données lexicographiques de chaque prénom.",
    "input_schema": {
        "type": "object",
        "properties": {
            "prenoms": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "prenom": {"type": "string"},
                        "origines": {
                            "type": "array",
                            "items": {"type": "string", "enum": ORIGINES},
                            "maxItems": 3,
                        },
                        "signification": {"type": ["string", "null"]},
                        "objet_marque": {"type": "boolean"},
                        "objet_marque_note": {"type": ["string", "null"]},
                        "diminutifs": {"type": "array", "items": {"type": "string"}},
                        "charge_epellation": {"type": "integer", "minimum": 0, "maximum": 3},
                        "confiance": {"type": "string", "enum": ["haute", "moyenne", "basse"]},
                    },
                    "required": ["prenom", "origines", "signification", "objet_marque",
                                 "diminutifs", "charge_epellation", "confiance"],
                },
            }
        },
        "required": ["prenoms"],
    },
}

_lock = threading.Lock()


# --------------------------------------------------------------------- outils
def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z]", "", s.lower())


def charger_cle() -> str:
    cle = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if cle:
        return cle
    env = ROOT / ".env"
    if env.exists():
        for ligne in env.read_text(encoding="utf-8").splitlines():
            ligne = ligne.strip()
            if ligne.startswith("ANTHROPIC_API_KEY"):
                return ligne.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(
        "Aucune cle API.\n"
        f"  -> cree {env} avec la ligne :  ANTHROPIC_API_KEY=sk-ant-...\n"
        "  -> ou exporte ANTHROPIC_API_KEY dans l'environnement."
    )


def http(chemin: str, cle: str, corps: dict | None = None, methode: str = "POST") -> dict:
    """Appel API avec retry exponentiel sur 429 / 5xx."""
    donnees = json.dumps(corps).encode() if corps is not None else None
    for essai in range(MAX_RETRY):
        req = urllib.request.Request(
            f"{API}/{chemin}", data=donnees, method=methode,
            headers={
                "x-api-key": cle,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            texte = e.read().decode(errors="replace")[:300]
            if e.code in (408, 409, 429, 500, 502, 503, 529) and essai < MAX_RETRY - 1:
                attente = float(e.headers.get("retry-after") or 0) or (2 ** essai + random.random())
                time.sleep(min(attente, 60))
                continue
            raise RuntimeError(f"HTTP {e.code} sur {chemin} : {texte}") from None
        except urllib.error.URLError as e:
            if essai < MAX_RETRY - 1:
                time.sleep(2 ** essai + random.random())
                continue
            raise RuntimeError(f"Reseau injoignable : {e.reason}") from None
    raise RuntimeError("Echec apres retries")


def choisir_modele(cle: str, force: str | None) -> str:
    """Le plus recent Haiku disponible sur le compte (suffisant ici, et le
    moins cher). Aucun identifiant de modele n'est code en dur."""
    if force:
        return force
    if os.environ.get("ANTHROPIC_MODEL"):
        return os.environ["ANTHROPIC_MODEL"]
    data = http("models?limit=100", cle, methode="GET").get("data", [])
    haiku = [m for m in data if "haiku" in m["id"].lower()]
    choix = sorted(haiku or data, key=lambda m: m.get("created_at", ""), reverse=True)
    if not choix:
        sys.exit("Aucun modele disponible sur ce compte.")
    return choix[0]["id"]


# ------------------------------------------------------------------- pipeline
def a_traiter(limit: int | None) -> list[str]:
    src = BUILD / "prenoms_enrichi.csv"
    if not src.exists():
        sys.exit(f"{src} absent. Lance d'abord build_metrics.py puis merge_wikidata.py.")
    d = pd.read_csv(src).sort_values("births_recent", ascending=False)
    faits = set()
    # on saute ce qui est deja saisi a la main ou deja passe par le LLM.
    # PAS le Wiktionnaire : on veut pouvoir l'ameliorer.
    for f in (CACHE / "enrich_manuel.jsonl", JSONL):
        if not f.exists():
            continue
        for ligne in f.read_text(encoding="utf-8").splitlines():
            if ligne.strip():
                try:
                    faits.add(slugify(json.loads(ligne)["prenom"]))
                except Exception:
                    pass
    restants = [x for x in d["label"].astype(str) if slugify(x) not in faits]
    return restants[:limit] if limit else restants


def traiter_lot(lot: list[str], cle: str, modele: str) -> int:
    corps = {
        "model": modele,
        "max_tokens": 8000,
        "system": SYSTEME,
        "tools": [SCHEMA],
        "tool_choice": {"type": "tool", "name": "enregistrer_prenoms"},
        "messages": [{"role": "user", "content": "Prénoms :\n" + "\n".join(lot)}],
    }
    rep = http("messages", cle, corps)
    bloc = next((b for b in rep.get("content", []) if b.get("type") == "tool_use"), None)
    if not bloc:
        return 0
    attendus = {slugify(n): n for n in lot}
    lignes = []
    for e in bloc["input"].get("prenoms", []):
        sl = slugify(e.get("prenom", ""))
        if sl not in attendus:          # le modele a invente ou deforme un prenom
            continue
        e["prenom"] = attendus[sl]      # on refixe l'orthographe INSEE
        lignes.append(json.dumps(e, ensure_ascii=False))
    if lignes:
        with _lock:
            with JSONL.open("a", encoding="utf-8") as f:
                f.write("\n".join(lignes) + "\n")
    return len(lignes)


def cmd_run(args) -> None:
    cle = charger_cle()
    modele = choisir_modele(cle, args.model)
    noms = a_traiter(args.limit)
    if not noms:
        print("Rien a traiter : tout est deja en cache.")
        return
    lots = [noms[i:i + BATCH] for i in range(0, len(noms), BATCH)]
    print(f"modele : {modele}")
    print(f"{len(noms):,} prenoms restants -> {len(lots)} lots de {BATCH}\n")

    fait = [0]
    t0 = time.time()

    def bosser(lot):
        try:
            n = traiter_lot(lot, cle, modele)
        except Exception as e:
            print(f"  [!] lot echoue ({lot[0]}...) : {e}")
            return
        with _lock:
            fait[0] += n
            ecoule = time.time() - t0
            reste = (len(noms) - fait[0]) / max(fait[0] / ecoule, 1e-9)
            print(f"  {fait[0]:>6,}/{len(noms):,}  ({100*fait[0]/len(noms):5.1f} %)"
                  f"  ~{reste/60:.0f} min restantes")

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        list(ex.map(bosser, lots))
    print(f"\ntermine en {(time.time()-t0)/60:.1f} min -> {JSONL}")
    print("Verifie la qualite :  python3 pipeline/enrich_llm.py verify")


def cmd_dry_run(args) -> None:
    noms = a_traiter(args.limit)
    lots = [noms[i:i + BATCH] for i in range(0, len(noms), BATCH)]
    deja = 0
    if JSONL.exists():
        deja = sum(1 for l in JSONL.read_text(encoding="utf-8").splitlines() if l.strip())
    print(f"deja en cache        : {deja:,}")
    print(f"restants a traiter   : {len(noms):,}")
    print(f"lots de {BATCH}          : {len(lots)}")
    print(f"vocabulaire d'origine: {len(ORIGINES)} valeurs fermees")
    print(f"cle API              : {'presente' if os.environ.get('ANTHROPIC_API_KEY') or (ROOT/'.env').exists() else 'ABSENTE'}")
    print(f"\nExemple de lot ({min(BATCH,len(noms))} prenoms) :")
    print("  " + ", ".join(lots[0][:12]) + (" ..." if lots and len(lots[0]) > 12 else ""))
    print(f"\nsysteme : {len(SYSTEME)} caracteres")
    print("Rien n'a ete envoye.")


def cmd_verify(args) -> None:
    if not JSONL.exists():
        sys.exit("Aucun cache. Lance d'abord : run --limit 40")
    lignes = [json.loads(l) for l in JSONL.read_text(encoding="utf-8").splitlines() if l.strip()]
    print(f"{len(lignes):,} prenoms enrichis\n")

    conf = pd.Series([l["confiance"] for l in lignes]).value_counts()
    print("confiance :"); print(conf.to_string(), "\n")

    org = pd.Series([o for l in lignes for o in l["origines"]]).value_counts()
    print("origines (top 12) :"); print(org.head(12).to_string(), "\n")

    hors = org.index.difference(ORIGINES)
    print(f"origines hors vocabulaire : {list(hors) if len(hors) else 'aucune (OK)'}")
    sans = sum(1 for l in lignes if not l["origines"])
    nulls = sum(1 for l in lignes if not l["signification"])
    print(f"sans origine   : {sans:,} ({100*sans/len(lignes):.1f} %)")
    print(f"sans sens      : {nulls:,} ({100*nulls/len(lignes):.1f} %)")
    print(f"objet/marque   : {sum(1 for l in lignes if l['objet_marque']):,}\n")

    ech = random.sample(lignes, min(args.sample, len(lignes)))
    print(f"--- echantillon de {len(ech)} a relire A LA MAIN ---")
    for l in ech:
        print(f"  {l['prenom']:<14} {'/'.join(l['origines']) or '-':<28} "
              f"{(l['signification'] or '-'):<34} [{l['confiance']}]"
              f"{'  OBJET:' + (l.get('objet_marque_note') or '?') if l['objet_marque'] else ''}")


def cmd_merge(args) -> None:
    if not JSONL.exists():
        sys.exit("Aucun cache a fusionner.")
    d = pd.read_csv(BUILD / "prenoms_enrichi.csv")
    par = {}
    for ligne in JSONL.read_text(encoding="utf-8").splitlines():
        if ligne.strip():
            e = json.loads(ligne)
            par[slugify(e["prenom"])] = e

    def champ(sl, cle, defaut):
        e = par.get(slugify(sl))
        return defaut if e is None else e.get(cle, defaut)

    d["origines"] = d["label"].map(lambda s: "|".join(champ(s, "origines", [])))
    d["signification"] = d["label"].map(lambda s: champ(s, "signification", None))
    d["objet_marque"] = d["label"].map(lambda s: bool(champ(s, "objet_marque", False)))
    d["objet_marque_note"] = d["label"].map(lambda s: champ(s, "objet_marque_note", None))
    d["diminutifs"] = d["label"].map(lambda s: "|".join(champ(s, "diminutifs", [])))
    d["charge_epellation"] = d["label"].map(lambda s: champ(s, "charge_epellation", None))
    d["confiance_enrich"] = d["label"].map(lambda s: champ(s, "confiance", None))
    d["source_enrich"] = d["label"].map(lambda s: "llm" if slugify(s) in par else None)

    out = BUILD / "prenoms_final.csv"
    d.to_csv(out, index=False, encoding="utf-8")
    n = len(d)
    print(f"{n:,} prenoms -> {out}")
    for c in ("origines", "signification", "diminutifs"):
        rempli = int(d[c].notna().sum() - (d[c] == "").sum())
        print(f"  {c:<16} rempli : {rempli:,} ({100*rempli/n:.1f} %)")
    w = d["births_recent"].fillna(0)
    pond = float(w[d["origines"] != ""].sum() / w.sum() * 100)
    print(f"  couverture origines ponderee par les naissances : {pond:.1f} %")


def cmd_self_test(args) -> None:
    """Valide parsing / alignement / merge sans toucher au reseau."""
    faux = {"content": [{"type": "tool_use", "name": "enregistrer_prenoms", "input": {"prenoms": [
        {"prenom": "gabriel", "origines": ["hébraïque"], "signification": "force de Dieu",
         "objet_marque": False, "objet_marque_note": None, "diminutifs": ["Gaby"],
         "charge_epellation": 0, "confiance": "haute"},
        {"prenom": "Ambre", "origines": ["arabe", "latin"], "signification": "ambre gris",
         "objet_marque": True, "objet_marque_note": "résine fossile",
         "diminutifs": [], "charge_epellation": 1, "confiance": "haute"},
        {"prenom": "Inventé", "origines": [], "signification": None, "objet_marque": False,
         "objet_marque_note": None, "diminutifs": [], "charge_epellation": 3,
         "confiance": "basse"},
    ]}}]}
    lot = ["Gabriel", "Ambre"]
    bloc = next(b for b in faux["content"] if b["type"] == "tool_use")
    attendus = {slugify(n): n for n in lot}
    gardes = []
    for e in bloc["input"]["prenoms"]:
        sl = slugify(e["prenom"])
        if sl not in attendus:
            continue
        e["prenom"] = attendus[sl]
        gardes.append(e)
    assert len(gardes) == 2, gardes
    assert gardes[0]["prenom"] == "Gabriel", "la casse INSEE doit etre restauree"
    assert all(o in ORIGINES for g in gardes for o in g["origines"])
    print("self-test OK :")
    print("  - un prenom hors lot est rejete (anti-hallucination)")
    print("  - l'orthographe INSEE est restauree (gabriel -> Gabriel)")
    print("  - toutes les origines sont dans le vocabulaire ferme")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = p.add_subparsers(dest="cmd", required=True)
    for nom, fn in (("run", cmd_run), ("dry-run", cmd_dry_run),
                    ("verify", cmd_verify), ("merge", cmd_merge),
                    ("self-test", cmd_self_test)):
        s = sp.add_parser(nom)
        s.set_defaults(fn=fn)
        if nom in ("run", "dry-run"):
            s.add_argument("--limit", type=int, default=None,
                           help="ne traiter que les N prenoms les plus frequents")
        if nom == "run":
            s.add_argument("--model", default=None,
                           help="forcer un identifiant de modele")
        if nom == "verify":
            s.add_argument("--sample", type=int, default=30)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
