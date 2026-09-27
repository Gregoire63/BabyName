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
import csv, json, re, sys, unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from wikitexte import modeles, en_clair, propre, MARQUE_W

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "raw" / "wiktionary_etym.json"
OUT = ROOT / "data" / "cache" / "enrich_wiktionary.jsonl"
# tous les prenoms INSEE : pour reconnaitre un equivalent donne comme sens
METRICS = ROOT / "data" / "build" / "prenoms_metrics.csv"
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

ETYL = ("étyl", "etyl", "étylp")

# Les prenoms connus (titres du Wiktionnaire + prenoms INSEE) : pour
# reconnaitre l'equivalent d'un autre prenom (Georgi -> « Georges ») donne en
# guise de sens.
NOMS: set[str] = set()
# ... sauf quand ce prenom est aussi le nom commun qui fait le sens.
NOMS_COMMUNS = {"lune", "ange", "soleil", "etoile", "aurore", "victoire", "rose", "fleur",
                "perle", "colombe", "paix", "grace", "esperance", "constance", "prudence",
                "clemence", "patience", "celeste", "marine", "ocean", "terre"}
# Noms communs que le Wiktionnaire ecrit avec une majuscule (Amélie : « Force »).
MINUSCULE = NOMS_COMMUNS | {"force"}


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


def _valide(p: str, autres: list[str], titre: str) -> str | None:
    """Une glose candidate qui ressemble a du francais courant, ou None."""
    if not p or len(p) < 3 or len(p) > 90:
        return None
    # doit contenir des lettres latines et au moins une minuscule
    if not re.search(r"[a-zàâäéèêëîïôöùûüç]", p):
        return None
    if re.search(r"[Ͱ-῿֐-ࣿ一-鿿]", p):
        return None           # grec/hebreu/arabe/CJK : c'est le mot source
    if p.lower() in ("fr", "m", "f", "mf"):
        return None
    # "Alan -> Alan" : l'etymon recopie, pas une signification
    if titre and slugify(p) == slugify(titre):
        return None
    # ... ni un autre parametre du meme modele (le mot source translittere)
    if slugify(p) in {slugify(x) for x in autres if x}:
        return None
    # « Georges » pour Georgi : l'equivalent francais, pas un sens
    if (" " not in p.strip() and p.strip()[:1].isupper() and slugify(p) in NOMS
            and slugify(p) not in NOMS_COMMUNS):
        return None
    if " " not in p.strip() and slugify(p) in MINUSCULE:
        p = p.strip()[:1].lower() + p.strip()[1:]
    return propre(p)


def glose(libres: list[str], nommes: dict[str, str], titre: str = "") -> str | None:
    """Le sens de l'etymon : {{étyl|code|fr|mot|translittération|sens}}.

    Seulement `sens=` ou le TROISIEME parametre libre. On prenait « le dernier
    parametre qui ressemble a du francais » : c'etait le plus souvent le mot
    source ou sa translitteration, et la carte affichait Nicolas « Nicolaus »,
    Éric « Eiríkr », Céline « Coelina », Ulysse « Oulíxēs ». Un modele a deux
    ou trois parametres ne donne pas de sens, et c'est tres bien ainsi.
    """
    if nommes.get("sens"):
        g = _valide(en_clair(nommes["sens"]), [], titre)
        if g:
            return g
    nets = [en_clair(x) for x in libres]
    return _valide(nets[2], nets[:2], titre) if len(nets) > 2 else None


ETIQUETTE = re.compile(r"^:\s*(?:\{\{(?:term|lien-ancre-étym\|fr)\|([^}]*)\}\}|''\(([^)]*)\)''|\(''([^']*)''\))", re.I)


def lignes_du_prenom(texte: str) -> str:
    """Une page peut decrire plusieurs choses : le prenom, une commune, un
    sigle (Olaf : « Office européen de lutte antifraude »). Quand une ligne
    est etiquetee « prénom », on ne lit que celle-la (ou celles-la)."""
    garde = []
    for ligne in texte.split("\n"):
        m = ETIQUETTE.match(ligne)
        if m and "prénom" in (m.group(1) or m.group(2) or m.group(3) or "").lower():
            garde.append(ligne)
    return "\n".join(garde) if garde else texte


# Hors modele, une glose se reconnait a sa tournure : « dérivé de laurus
# (« laurier ») », « mot germain signifiant « noble » ». Pas n'importe quelle
# citation : « Prénom d'un personnage de « La Jérusalem délivrée » » n'est
# pas un sens.
GLOSE_TEXTE = re.compile(r"\(\s*«\s*([^»(]{3,80}?)\s*»\s*\)|signifi\w*\s+«\s*([^»]{3,80}?)\s*»")


def analyser(titre: str, texte: str) -> dict | None:
    brut = lignes_du_prenom(texte)
    origines, gl = [], None

    for nom, libres, nommes in modeles(brut):
        if nom not in ETYL or len(libres) < 2 or not libres[0].strip():
            continue
        code = libres[0].strip()
        fam = CODES.get(code) or CODES.get(code.lower())
        if fam and fam not in origines:
            origines.append(fam)
        if gl is None:
            gl = glose(libres[2:], nommes, titre)

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
        m = GLOSE_TEXTE.search(en_clair(brut, marquer_w=True))
        g = next((x for x in m.groups() if x), None) if m else None
        if g and MARQUE_W not in g:        # un {{w|…}} : un titre, un nom propre
            gl = _valide(g.strip(), [], titre)

    if not origines and not gl:
        return None

    return {
        "prenom": titre,
        "origines": origines[:3],
        "signification": gl,
        "objet_marque": None,          # le Wiktionnaire ne le dit pas
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

    NOMS.update(slugify(t) for t in data)
    if METRICS.exists():
        with open(METRICS, encoding="utf-8") as fh:
            NOMS.update(slugify(r["label"]) for r in csv.DictReader(fh))
    # passe 1 : etymologies directes
    resolus: dict[str, dict] = {}
    restants: dict[str, str] = {}
    for titre, texte in data.items():
        r = analyser(titre, texte)
        if r is None:
            restants[titre] = texte
        else:
            resolus[slugify(titre)] = r

    # passe 2 : prenoms derives (« composé de Maëlle et de -line »), resolus
    # par leurs parties -- pour l'ORIGINE seulement.
    #   - Les composes a trait d'union (Jean-Pierre) ne passent plus ici : la
    #     fusion (merge_enrichissement.py) les assemble a partir des MEILLEURES
    #     donnees de chaque partie (manuel, Claude...), pas des seules gloses
    #     du Wiktionnaire.
    #   - Pas de sens : « Line : aux cheveux de lin » pour Maëline donnait au
    #     suffixe -line le sens du prenom Line.
    composes = 0
    for titre, texte in list(restants.items()):
        if re.search(r"[- ]", titre):
            continue
        m = COMPOSE.search(nettoyer(texte))
        parties = [x for x in (m.groups() if m else ()) if x] if m else []
        org = []
        for part in parties:
            e = resolus.get(slugify(part))
            if not e:
                continue
            for o in e["origines"]:
                if o not in org:
                    org.append(o)
        if org:
            resolus[slugify(titre)] = {
                "prenom": titre, "origines": org[:3],
                "signification": None,
                "objet_marque": None, "objet_marque_note": None,
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
