#!/usr/bin/env python3
"""
Enrichissement GRATUIT depuis le Wiktionnaire francais (CC BY-SA).
Ni cle API, ni service payant.

Entree : data/raw/wiktionary_etym.json   {"Gabriel": "<wikitexte etymologie>", ...}
Sortie : data/cache/enrich_wiktionary.jsonl  (meme format que l'enrichissement LLM)

Le Wiktionnaire encode l'etymologie avec {{etyl|CODE|fr|mot|translit|glose}}.
Le code langue est exploitable de facon fiable ; la glose l'est moins, d'ou
le champ `confiance`.
"""
from __future__ import annotations
import json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "raw" / "wiktionary_etym.json"
OUT = ROOT / "data" / "cache" / "enrich_wiktionary.jsonl"
OUT.parent.mkdir(parents=True, exist_ok=True)

# codes ISO utilises par {{etyl}} -> vocabulaire ferme
CODES = {
    "he": "hébraïque", "hbo": "hébraïque", "yi": "hébraïque",
    "arc": "araméen", "syc": "araméen",
    "ar": "arabe", "arz": "arabe", "ary": "arabe",
    "ber": "berbère", "kab": "berbère", "shi": "berbère", "zgh": "berbère",
    "fa": "persan", "peo": "persan", "pal": "persan", "ku": "persan",
    "tr": "turc", "ota": "turc", "az": "turc", "tk": "turc", "uz": "turc",
    "grc": "grec", "el": "grec", "gkm": "grec",
    "la": "latin", "ML.": "latin", "LL.": "latin", "VL.": "latin",
    "it": "italien", "es": "espagnol", "pt": "portugais",
    "ro": "latin", "ca": "latin", "gl": "latin", "sc": "latin", "co": "français",
    "fr": "français", "fro": "français", "frm": "français", "oc": "français",
    "pcd": "français", "wa": "français", "nrf": "français",
    "ett": "étrusque",
    "de": "germanique", "goh": "germanique", "gem": "germanique",
    "gmw": "germanique", "frk": "germanique", "got": "germanique",
    "nl": "germanique", "gml": "germanique", "dum": "germanique",
    "lb": "germanique", "gsw": "germanique", "fy": "germanique",
    "en": "anglo-saxon", "ang": "anglo-saxon", "enm": "anglo-saxon", "sco": "anglo-saxon",
    "non": "scandinave", "sv": "scandinave", "da": "scandinave",
    "no": "scandinave", "is": "scandinave", "fo": "scandinave",
    "br": "celtique", "ga": "celtique", "gd": "celtique", "cy": "celtique",
    "cel": "celtique", "kw": "celtique", "gv": "celtique", "xtg": "celtique",
    "ru": "slave", "pl": "slave", "uk": "slave", "cs": "slave", "sk": "slave",
    "sl": "slave", "sr": "slave", "hr": "slave", "bg": "slave", "sla": "slave",
    "cu": "slave", "be": "slave", "mk": "slave", "sh": "slave",
    "lv": "balte", "lt": "balte",
    "eu": "basque", "hy": "arménien", "ka": "géorgien", "sq": "albanais",
    "fi": "finno-ougrien", "et": "finno-ougrien", "hu": "finno-ougrien", "se": "finno-ougrien",
    "sa": "indien", "hi": "indien", "ur": "indien", "bn": "indien",
    "ta": "indien", "pa": "indien", "gu": "indien", "mr": "indien",
    "te": "indien", "si": "indien", "ne": "indien", "pi": "indien",
    "zh": "asiatique", "ja": "asiatique", "ko": "asiatique", "vi": "asiatique",
    "th": "asiatique", "km": "asiatique", "id": "asiatique", "ms": "asiatique",
    "tl": "asiatique", "yue": "asiatique", "mn": "asiatique",
    "sw": "africain", "wo": "africain", "yo": "africain", "am": "africain",
    "ha": "africain", "mg": "africain", "ig": "africain", "zu": "africain",
    "bm": "africain", "ff": "africain", "so": "africain", "ti": "africain",
    "af": "africain", "ee": "africain", "ln": "africain", "sn": "africain",
    "haw": "océanien", "mi": "océanien", "ty": "océanien", "sm": "océanien", "fj": "océanien",
    "egy": "égyptien", "cop": "égyptien",
    "nah": "amérindien", "qu": "amérindien", "gn": "amérindien", "iu": "amérindien",
}

# repli sur le texte libre ("De l'hébreu...", "Du latin...")
MOTS = [
    ("hébreu", "hébraïque"), ("hébraïque", "hébraïque"), ("yiddish", "hébraïque"),
    ("araméen", "araméen"), ("arabe", "arabe"),
    ("berbère", "berbère"), ("kabyle", "berbère"),
    ("persan", "persan"), ("perse", "persan"), ("kurde", "persan"),
    ("turc", "turc"), ("ottoman", "turc"),
    ("grec", "grec"), ("latin", "latin"), ("étrusque", "étrusque"),
    ("italien", "italien"), ("espagnol", "espagnol"), ("portugais", "portugais"),
    ("catalan", "latin"), ("roumain", "latin"), ("occitan", "français"),
    ("français", "français"), ("gaulois", "celtique"), ("breton", "celtique"),
    ("gallois", "celtique"), ("irlandais", "celtique"), ("gaélique", "celtique"),
    ("celtique", "celtique"), ("celte", "celtique"),
    ("germanique", "germanique"), ("allemand", "germanique"),
    ("néerlandais", "germanique"), ("francique", "germanique"), ("gotique", "germanique"),
    ("anglais", "anglo-saxon"), ("anglo-saxon", "anglo-saxon"), ("écossais", "anglo-saxon"),
    ("norrois", "scandinave"), ("suédois", "scandinave"), ("danois", "scandinave"),
    ("norvégien", "scandinave"), ("islandais", "scandinave"), ("scandinave", "scandinave"),
    ("russe", "slave"), ("polonais", "slave"), ("slave", "slave"), ("serbe", "slave"),
    ("tchèque", "slave"), ("bulgare", "slave"), ("croate", "slave"),
    ("letton", "balte"), ("lituanien", "balte"),
    ("basque", "basque"), ("arménien", "arménien"), ("géorgien", "géorgien"),
    ("albanais", "albanais"),
    ("hongrois", "finno-ougrien"), ("finnois", "finno-ougrien"), ("estonien", "finno-ougrien"),
    ("sanskrit", "indien"), ("hindi", "indien"), ("tamoul", "indien"), ("indien", "indien"),
    ("japonais", "asiatique"), ("chinois", "asiatique"), ("coréen", "asiatique"),
    ("vietnamien", "asiatique"),
    ("swahili", "africain"), ("wolof", "africain"), ("bambara", "africain"),
    ("peul", "africain"), ("africain", "africain"), ("malgache", "africain"),
    ("hawaïen", "océanien"), ("maori", "océanien"), ("tahitien", "océanien"),
    ("égyptien", "égyptien"), ("copte", "égyptien"),
]

ETYL = re.compile(r"\{\{(?:étyl|etyl|étylp)\|([^|}]+)\|([^|}]*)((?:\|[^|}]*)*)\}\}")


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z]", "", s.lower())


def nettoyer(t: str) -> str:
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", t, flags=re.S)
    t = re.sub(r"<ref[^>]*/>", "", t)
    t = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", t)
    t = t.replace("'''", "").replace("''", "")
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def glose(params: list[str], titre: str = "") -> str | None:
    autres = set()
    """Dernier parametre de {{etyl}} qui ressemble a du francais courant."""
    nets = [nettoyer(x) for x in params]
    for i, p in enumerate(reversed(nets)):
        autres = {slugify(x) for j, x in enumerate(nets) if j != len(nets) - 1 - i and x}
        if not p or "=" in p:
            continue
        if len(p) < 3 or len(p) > 90:
            continue
        # doit contenir des lettres latines et au moins une minuscule
        if not re.search(r"[a-zàâäéèêëîïôöùûüç]", p):
            continue
        if re.search(r"[Ͱ-῿֐-ࣿ一-鿿]", p):
            continue          # grec/hebreu/arabe/CJK : c'est le mot source
        if p.lower() in ("fr", "m", "f", "mf"):
            continue
        # "Alan -> Alan" : l'etymon recopie, pas une signification
        if titre and slugify(p) == slugify(titre):
            continue
        # ... ni un autre parametre du meme modele (le mot source translittere)
        if slugify(p) in autres:
            continue
        return p
    return None


def analyser(titre: str, texte: str) -> dict | None:
    brut = texte
    origines, gl = [], None

    for m in ETYL.finditer(brut):
        code = m.group(1).strip()
        fam = CODES.get(code) or CODES.get(code.lower())
        if fam and fam not in origines:
            origines.append(fam)
        if gl is None:
            params = [p for p in m.group(3).split("|") if p != ""]
            gl = glose(params, titre)

    if len(origines) > 1:
        origines.reverse()          # origine la plus profonde en premier

    src = "étyl"
    if not origines:
        src = "texte"
        bas = nettoyer(brut).lower()
        for mot, fam in MOTS:
            if re.search(r"\b" + re.escape(mot), bas) and fam not in origines:
                origines.append(fam)
                if len(origines) >= 3:
                    break

    if gl is None:
        m = re.search(r"[«\"]\s*([^»\"]{3,80})\s*[»\"]", nettoyer(brut))
        if m:
            gl = m.group(1).strip()
            m2 = re.search(r"signifiant\s+(.{3,60})", nettoyer(brut))

    if not origines and not gl:
        return None

    return {
        "prenom": titre,
        "origines": origines[:3],
        "signification": gl,
        "objet_marque": False,          # le Wiktionnaire ne le dit pas
        "objet_marque_note": None,
        "diminutifs": [],
        "charge_epellation": None,
        "confiance": "haute" if src == "étyl" and origines else
                     ("moyenne" if origines else "basse"),
        "source": "wiktionnaire",
    }


COMPOSE = re.compile(
    r"(?:\{\{composé de\|([^|}]+)\|([^|}]+)|composé de\s+([\wÀ-ÿ'-]+)\s+et\s+(?:de\s+)?([\wÀ-ÿ'-]+))",
    re.I)


def main() -> None:
    if not SRC.exists():
        sys.exit(f"{SRC} absent.")
    data = json.loads(SRC.read_text(encoding="utf-8"))

    # passe 1 : etymologies directes
    resolus: dict[str, dict] = {}
    restants: dict[str, str] = {}
    for titre, texte in data.items():
        r = analyser(titre, texte)
        if r is None:
            restants[titre] = texte
        else:
            resolus[slugify(titre)] = r

    # passe 2 : prenoms composes, resolus par leurs parties
    composes = 0
    for titre, texte in list(restants.items()):
        m = COMPOSE.search(nettoyer(texte))
        parties = [x for x in (m.groups() if m else ()) if x] if m else []
        if not parties and ("-" in titre or " " in titre):
            parties = re.split(r"[- ]", titre)
        org, sens = [], []
        for part in parties:
            e = resolus.get(slugify(part))
            if not e:
                continue
            for o in e["origines"]:
                if o not in org:
                    org.append(o)
            if e["signification"]:
                sens.append(f"{part} : {e['signification']}")
        if org:
            resolus[slugify(titre)] = {
                "prenom": titre, "origines": org[:3],
                "signification": " + ".join(sens)[:120] or None,
                "objet_marque": False, "objet_marque_note": None,
                "diminutifs": [], "charge_epellation": None,
                "confiance": "moyenne", "source": "wiktionnaire-composé",
            }
            composes += 1
            del restants[titre]

    lignes = [json.dumps(r, ensure_ascii=False) for r in resolus.values()]
    OUT.write_text("\n".join(lignes) + "\n", encoding="utf-8")

    stats = {}
    for r in resolus.values():
        stats[r["confiance"]] = stats.get(r["confiance"], 0) + 1
    print(f"{len(data):,} pages avec etymologie")
    print(f"  exploitables      : {len(lignes):,}   (inexploitables : {len(restants):,})")
    print(f"  dont composes     : {composes:,}")
    print(f"  confiance         : {stats}")
    print(f"-> {OUT}")

    print("\nechantillon :")
    for nom in ("Gabriel", "Alan", "Alexa", "Alessandra", "Jean-Baptiste",
                "Marie-Claire", "Adhémar", "Abdalmasih", "Nathan", "Chloé"):
        e = resolus.get(slugify(nom))
        if e:
            print(f"  {e['prenom']:<16} {'/'.join(e['origines']) or '-':<26} {e['signification'] or '-'}")


if __name__ == "__main__":
    main()
