#!/usr/bin/env python3
"""
Construit la table de metriques par prenom a partir du fichier des prenoms INSEE.

Entree : data/raw/*.zip ou data/raw/*.csv (separateur ';')
  - millesime 2025+ : SEXE;PRENOM;PERIODE;VALEUR;RANG
  - millesimes <=2024 : sexe;preusuel;annais;nombre
Sortie : data/build/prenoms_metrics.csv

Une ligne par prenom (pas par couple prenom/sexe).
"""
from __future__ import annotations
import re, sys, zipfile, unicodedata
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
BUILD = ROOT / "data" / "build"
BUILD.mkdir(parents=True, exist_ok=True)

RECENT_WINDOW = 3     # annees pour la frequence "actuelle"
SEUIL_PILE = 20       # en dessous : prenom marque "rare", hors pile de swipe
TREND_WINDOW = 10     # annees pour la pente
PARTIAL_RATIO = 0.60  # une annee sous 60% de la precedente = millesime incomplet


# ---------------------------------------------------------------- chargement
def find_source() -> Path:
    """Priorite au format compact (packed) ; sinon CSV/ZIP brut INSEE."""
    packed = sorted(RAW.glob("*packed*.csv"))
    if packed:
        return packed[0]
    csvs = sorted(RAW.glob("*.csv"))
    if csvs:
        return csvs[0]
    zips = sorted(RAW.glob("*.zip"))
    if not zips:
        sys.exit(f"Aucun .csv ni .zip dans {RAW}")
    with zipfile.ZipFile(zips[0]) as z:
        inner = [n for n in z.namelist() if n.lower().endswith(".csv")]
        if not inner:
            sys.exit(f"Pas de CSV dans {zips[0].name}")
        z.extract(inner[0], RAW)
    return RAW / inner[0]


def load_packed(path: Path) -> pd.DataFrame:
    """sexe;prenom;first_year;valeurs_div5  ->  format long."""
    sexes, noms, annees, nombres = [], [], [], []
    with open(path, encoding="utf-8") as fh:
        next(fh)
        for line in fh:
            line = line.rstrip("\n")
            if not line:
                continue
            sx, nom, y0, vals = line.split(";", 3)
            sx, y0 = int(sx), int(y0)
            for i, v in enumerate(vals.split(",")):
                v = int(v)
                if v:
                    sexes.append(sx); noms.append(nom)
                    annees.append(y0 + i); nombres.append(v * 5)
    return pd.DataFrame({"sexe": sexes, "prenom": noms,
                         "annee": annees, "nombre": nombres})


def load(path: Path) -> pd.DataFrame:
    with open(path, encoding="utf-8") as fh:
        header = fh.readline().strip().lower()
    if "valeurs_div5" in header:
        print("format : compact (packed)")
        return load_packed(path)

    print("format : INSEE brut")
    df = pd.read_csv(path, sep=";", dtype=str, encoding="utf-8", on_bad_lines="warn")
    cols = {c.strip().lower(): c for c in df.columns}

    def pick(*names):
        for n in names:
            if n in cols:
                return cols[n]
        sys.exit(f"Colonne introuvable parmi {names}. Colonnes vues: {list(df.columns)}")

    out = pd.DataFrame({
        "sexe":   df[pick("sexe")],
        "prenom": df[pick("prenom", "preusuel")],
        "annee":  df[pick("periode", "annais")],
        "nombre": df[pick("valeur", "nombre")],
    })
    out = out[~out["prenom"].isna()]
    out["prenom"] = out["prenom"].str.strip()
    out = out[~out["prenom"].str.upper().str.startswith("_")]
    out = out[out["annee"].str.fullmatch(r"\d{4}", na=False)]
    out["annee"] = out["annee"].astype(int)
    out["sexe"] = pd.to_numeric(out["sexe"], errors="coerce")
    out["nombre"] = pd.to_numeric(out["nombre"], errors="coerce").fillna(0)
    out = out[out["sexe"].isin([1, 2])]
    out["sexe"] = out["sexe"].astype(int)
    return out


# ---------------------------------------------------------------- typographie
def titlecase_fr(name: str) -> str:
    parts = re.split(r"([- ’'])", name.lower())
    return "".join(p if p in "- ’'" else p.capitalize() for p in parts)


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


VOWELS = set("aeiouyàâäéèêëîïôöùûüÿœ")
TREMA = set("ëïü")
# noyaux vocaliques multi-lettres, du plus long au plus court
NUCLEI = ("eau", "oeu", "aient", "ai", "ei", "au", "ou", "oi", "eu",
          "ui", "ay", "oy", "ea", "ie", "ye", "aa")
# attaques obstruante+liquide : forcent la dierese (Ga-bri-el vs Pierre)
CLUSTERS = {"br","cr","dr","fr","gr","pr","tr","vr","bl","cl","fl","gl","pl"}


def syllables_fr(name: str) -> int:
    """Compte les noyaux vocaliques. Heuristique : ~90% juste sur les prenoms FR,
    les diphtongues ambigues (Juliette, Lucien) restent discutables."""
    total = 0
    for word in re.split(r"[- ’']", name.lower()):
        if not word:
            continue
        nuclei, i = 0, 0
        while i < len(word):
            c = word[i]
            if c not in VOWELS:
                i += 1
                continue
            # un trema ouvre toujours un nouveau noyau (Ra-pha-el, Ma-el)
            if c in TREMA:
                nuclei += 1
                i += 1
                continue
            matched = None
            for d in NUCLEI:
                if word[i:i + len(d)] == d and not (len(d) > 1 and word[i + 1] in TREMA):
                    matched = d
                    break
            if matched in ("ie", "ea") and i >= 2 and word[i - 2:i] in CLUSTERS:
                matched = None                      # dierese forcee
            if matched:
                nuclei += 1
                i += len(matched)
            else:
                nuclei += 1
                i += 1
        # -e / -es final muet (pas apres voyelle : Lea, Zoe gardent leur noyau)
        if len(word) > 2:
            tail = word[-2:] if word.endswith("es") else word[-1:]
            if tail in ("e", "es") and word[-len(tail) - 1] not in VOWELS:
                nuclei -= 1
        total += max(nuclei, 1)
    return max(total, 1)


# ---------------------------------------------------------------- metriques
def main() -> None:
    src = find_source()
    print(f"source : {src.name}")
    df = load(src)
    print(f"{len(df):,} lignes retenues  |  {df['annee'].min()}-{df['annee'].max()}")

    # Toutes les annees sont conservees (choix explicite).
    # Les metriques travaillent sur des PARTS (pour 10 000 naissances de l'annee),
    # donc une annee partielle reste exploitable ; seule sa variance est plus forte.
    per_year = df.groupby("annee")["nombre"].sum().sort_index()
    last = int(per_year.index[-1])
    ratio = per_year.iloc[-1] / per_year.iloc[-2]
    if ratio < PARTIAL_RATIO:
        print(f"[!] {last} semble partielle ({per_year.iloc[-1]:,.0f} nais. vs "
              f"{per_year.iloc[-2]:,.0f} en {per_year.index[-2]}, ratio {ratio:.2f}) "
              f"-- CONSERVEE, mais le bruit sur les prenoms rares y est plus fort.")
    print(f"derniere annee : {last}")
    print("\nvolume par annee (10 dernieres) :")
    for y, v in per_year.tail(10).items():
        print(f"  {y}  {v:>10,.0f}")

    # frequence pour 10 000 naissances, par an
    df = df.merge(per_year.rename("total_annee"), left_on="annee", right_index=True)
    df["freq"] = df["nombre"] / df["total_annee"] * 10_000

    by_name_year = df.groupby(["prenom", "annee"], as_index=False).agg(
        nombre=("nombre", "sum"), freq=("freq", "sum"))

    recent_years = list(range(last - RECENT_WINDOW + 1, last + 1))
    trend_years = list(range(last - TREND_WINDOW + 1, last + 1))

    rec = (by_name_year[by_name_year["annee"].isin(recent_years)]
           .groupby("prenom").agg(freq_recent_p10k=("freq", "mean"),
                                  births_recent=("nombre", "sum")))

    # pente : OLS sur log(freq + eps) des TREND_WINDOW dernieres annees
    tw = by_name_year[by_name_year["annee"].isin(trend_years)].copy()
    full = (pd.MultiIndex.from_product([tw["prenom"].unique(), trend_years],
                                       names=["prenom", "annee"]).to_frame(index=False))
    tw = full.merge(tw, on=["prenom", "annee"], how="left").fillna({"freq": 0.0, "nombre": 0})
    tw["logf"] = np.log(tw["freq"] + 0.05)
    x = np.array(trend_years, dtype=float)
    x = x - x.mean()
    denom = (x ** 2).sum()
    piv = tw.pivot(index="prenom", columns="annee", values="logf")[trend_years]
    slope = (piv.values * x).sum(axis=1) / denom
    trend = pd.Series((np.exp(slope) - 1) * 100, index=piv.index, name="trend_pct_an")

    # pic historique
    idx = by_name_year.groupby("prenom")["freq"].idxmax()
    peak = (by_name_year.loc[idx, ["prenom", "annee", "freq"]]
            .rename(columns={"annee": "peak_year", "freq": "peak_freq_p10k"})
            .set_index("prenom"))

    tot = by_name_year.groupby("prenom").agg(
        births_total=("nombre", "sum"),
        first_year=("annee", "min"),
        last_year=("annee", "max"))

    sex = (df[df["annee"].isin(recent_years)]
           .pivot_table(index="prenom", columns="sexe", values="nombre",
                        aggfunc="sum", fill_value=0))
    for s in (1, 2):
        if s not in sex.columns:
            sex[s] = 0
    sex = sex.rename(columns={1: "births_m", 2: "births_f"})[["births_m", "births_f"]]
    tot_s = (sex["births_m"] + sex["births_f"]).replace(0, np.nan)
    sex["unisexe_ratio"] = (sex.min(axis=1) / tot_s * 2).fillna(0).clip(0, 1)
    sex["sexe"] = np.where(sex["unisexe_ratio"] >= 0.35, "fm",
                    np.where(sex["births_m"] >= sex["births_f"], "m", "f"))

    m = (tot.join(rec, how="left").join(trend, how="left")
            .join(peak, how="left").join(sex, how="left"))
    # On garde TOUT ce que l'INSEE publie sur la fenetre recente : le catalogue
    # doit etre le panorama complet, la recherche doit pouvoir trouver Caelis.
    # Mais en dessous de SEUIL_PILE les effectifs sont du bruit d'arrondi (l'INSEE
    # arrondit a 5) : pente, risque et originalite n'y veulent plus rien dire, et
    # 12 000 cartes de plus noieraient le swipe. Ces prenoms sont marques "rare"
    # et l'app les sort de la pile par defaut -- sans jamais les sortir du catalogue.
    m = m[m["births_recent"].fillna(0) >= 1]
    m["rare"] = m["births_recent"].fillna(0) < SEUIL_PILE
    m = m.reset_index()

    # typographie & forme
    m["label"] = m["prenom"].map(titlecase_fr)
    m["slug"] = m["prenom"].map(lambda s: strip_accents(s).lower())
    m["nb_car"] = m["prenom"].str.replace(r"[- ’']", "", regex=True).str.len()
    m["nb_syllabes"] = m["label"].map(syllables_fr)
    m["compose"] = m["prenom"].str.contains(r"[- ]", regex=True)
    m["initiale"] = m["slug"].str[0].str.upper()
    m["finale"] = m["slug"].str[-1]

    # scores derives ------------------------------------------------------
    f = m["freq_recent_p10k"].clip(lower=0.01)
    t = m["trend_pct_an"].fillna(0)

    # ORIGINALITE : echelle log ABSOLUE (pas un percentile : un percentile
    # bouge des qu'on change le corpus et ne veut rien dire pour l'utilisateur).
    # 0 = aussi courant que le no1 (~80 p10k), 100 = quasi inexistant (0.01 p10k).
    HI = np.log10(80.0)
    LO = np.log10(0.01)
    m["originalite"] = (100 * (HI - np.log10(f)) / (HI - LO)).clip(0, 100).round(1)

    # RISQUE SURPRISE : proba que le prenom soit devenu banal dans 5 ans.
    # Trois facteurs multiplicatifs :
    #   rising  - la pente, plafonnee (au-dela de 25 %/an c'est deja sature)
    #   conf    - confiance liee au VOLUME : l'INSEE arrondit a 5, donc une
    #             pente calculee sur 80 naissances est du bruit, pas un signal
    #   marge   - il n'y a "surprise" que si le prenom parait encore original
    rising = (t.clip(0, 25) / 25)
    conf = m["births_recent"].fillna(0) / (m["births_recent"].fillna(0) + 150)
    marge = m["originalite"] / 100
    m["risque_surprise"] = (100 * rising * conf * (0.35 + 0.65 * marge)).round(1)

    # Prenom de grand-mere qui revient.
    m["is_revival"] = (m["peak_year"] <= 1970) & (t > 5) & (f > 0.5)
    # ... et qui n'est PAS encore redevenu courant : la vraie zone de decouverte.
    m["revival_emergent"] = m["is_revival"] & (f < 5)

    cols = ["label", "slug", "sexe", "unisexe_ratio", "births_m", "births_f",
            "births_recent", "births_total", "freq_recent_p10k", "trend_pct_an",
            "peak_year", "peak_freq_p10k", "is_revival", "revival_emergent", "originalite",
            "risque_surprise", "nb_car", "nb_syllabes", "compose", "initiale",
            "finale", "first_year", "last_year", "rare"]
    m = m[cols].sort_values("freq_recent_p10k", ascending=False)
    for c in ("freq_recent_p10k", "trend_pct_an", "peak_freq_p10k", "unisexe_ratio"):
        m[c] = m[c].round(3)

    out = BUILD / "prenoms_metrics.csv"
    m.to_csv(out, index=False, encoding="utf-8")
    print(f"\n{len(m):,} prenoms -> {out}")
    print(m.head(15).to_string(index=False))


if __name__ == "__main__":
    main()
