#!/usr/bin/env python3
"""
Enrichissement GRATUIT depuis le Wiktionnaire ANGLAIS.

Interet decisif : en.wiktionary classe les prenoms dans des categories
"<langue> given names from <langue source>" qui donnent l'ORIGINE ULTIME,
pas la langue d'emprunt. Gabriel y est "from Hebrew", pas "from Latin".
C'est exactement ce que le Wiktionnaire francais ne sait pas donner.

Entree : data/raw/wiktionary_en.json  {"orig": {nom: [langues]}, "etym": {nom: wikitexte}}
Sortie : data/cache/enrich_wiktionary_en.jsonl

Les gloses de en.wiktionary sont en ANGLAIS : elles vont dans un champ
`signification_en` separe, jamais dans `signification`.
"""
from __future__ import annotations
import json, re, sys, unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from wikitexte import en_clair, propre, lire_valeur

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "raw" / "wiktionary_en.json"
OUT = ROOT / "data" / "cache" / "enrich_wiktionary_en.jsonl"
OUT.parent.mkdir(parents=True, exist_ok=True)

LANGUES = {
    "Hebrew": "hébraïque", "Biblical Hebrew": "hébraïque", "Yiddish": "hébraïque",
    "Aramaic": "araméen", "Classical Syriac": "araméen",
    "Arabic": "arabe",
    "Ancient Greek": "grec", "Koine Greek": "grec", "Greek": "grec",
    "Latin": "latin", "Late Latin": "latin", "Medieval Latin": "latin",
    "Vulgar Latin": "latin", "New Latin": "latin", "Romance languages": "latin",
    "Romanian": "latin", "Catalan": "latin",
    "Italian": "italien", "Spanish": "espagnol", "Portuguese": "portugais",
    "French": "français", "Old French": "français", "Middle French": "français",
    "Norman": "français", "Occitan": "français", "Old Occitan": "français",
    "Provençal": "français", "Franco-Provençal": "français",
    "Haitian Creole": "français", "Louisiana Creole": "français",
    "Etruscan": "étrusque",
    "Germanic languages": "germanique", "German": "germanique",
    "Old High German": "germanique", "Frankish": "germanique", "Gothic": "germanique",
    "Dutch": "germanique", "Proto-West Germanic": "germanique",
    "Alemannic German": "germanique", "Afrikaans": "germanique",
    "English": "anglo-saxon", "Old English": "anglo-saxon", "Middle English": "anglo-saxon",
    "Old Norse": "scandinave", "Swedish": "scandinave", "Danish": "scandinave",
    "Norwegian": "scandinave", "Icelandic": "scandinave", "Old Swedish": "scandinave",
    "North Germanic languages": "scandinave",
    "Irish": "celtique", "Old Irish": "celtique", "Welsh": "celtique",
    "Scottish Gaelic": "celtique", "Cornish": "celtique", "Breton": "celtique",
    "Manx": "celtique", "Celtic languages": "celtique", "Goidelic languages": "celtique",
    "Proto-Celtic": "celtique", "Proto-Brythonic": "celtique", "Pictish": "celtique",
    "Slavic languages": "slave", "Russian": "slave", "Polish": "slave",
    "Czech": "slave", "Ukrainian": "slave", "Serbo-Croatian": "slave",
    "Bulgarian": "slave", "Belarusian": "slave", "Macedonian": "slave",
    "Slovene": "slave", "Slovak": "slave",
    "Persian": "persan", "Old Persian": "persan", "Classical Persian": "persan",
    "Iranian Persian": "persan", "Dari": "persan",
    "Turkish": "turc", "Ottoman Turkish": "turc", "Azerbaijani": "turc",
    "Kazakh": "turc", "Tatar": "turc", "Uyghur": "turc",
    "Sanskrit": "indien", "Hindi": "indien", "Urdu": "indien", "Punjabi": "indien",
    "Bengali": "indien", "Tamil": "indien", "Old Tamil": "indien", "Marathi": "indien",
    "Telugu": "indien", "Malayalam": "indien", "Gujarati": "indien",
    "Nepali": "indien", "Sinhalese": "indien", "Manipuri": "indien",
    "Indo-Aryan languages": "indien", "Dravidian languages": "indien",
    "Japanese": "asiatique", "Chinese": "asiatique", "Mandarin": "asiatique",
    "Cantonese": "asiatique", "Korean": "asiatique", "Vietnamese": "asiatique",
    "Thai": "asiatique", "Khmer": "asiatique", "Tibetan": "asiatique",
    "Indonesian": "asiatique", "Cebuano": "asiatique",
    "Swahili": "africain", "Yoruba": "africain", "Igbo": "africain",
    "Shona": "africain", "Amharic": "africain", "Oromo": "africain",
    "Akan": "africain", "Wolof": "africain", "Soninke": "africain",
    "Malagasy": "africain", "Bantu languages": "africain", "Kalenjin": "africain",
    "Hawaiian": "océanien", "Māori": "océanien", "Samoan": "océanien",
    "Polynesian languages": "océanien",
    "Egyptian": "égyptien",
    "Navajo": "amérindien", "Hopi": "amérindien", "Dakota": "amérindien",
    "Chinook": "amérindien", "Chipewyan": "amérindien", "Tewa": "amérindien",
    "Mapudungun": "amérindien", "Tiwi": "amérindien", "Squamish": "amérindien",
    "Basque": "basque", "Armenian": "arménien", "Georgian": "géorgien",
    "Albanian": "albanais", "Chechen": "caucasien",
    "Hungarian": "finno-ougrien", "Finnish": "finno-ougrien", "Estonian": "finno-ougrien",
    "coinages": "moderne-inventé", "constructed languages": "moderne-inventé",
    "Esperanto": "moderne-inventé",
}
# ce qui n'est PAS une origine linguistique
IGNORE = {"surnames", "place names", "month names", "the Bible", "occupations", "Punic"}

# l'origine la plus profonde en premier : les langues de transmission passent apres
RANG = {
    "hébraïque": 0, "araméen": 0, "arabe": 0, "égyptien": 0, "indien": 0,
    "persan": 0, "grec": 1, "étrusque": 1, "celtique": 1, "basque": 1,
    "arménien": 1, "géorgien": 1, "caucasien": 1, "africain": 1, "asiatique": 1,
    "océanien": 1, "amérindien": 1, "turc": 1, "albanais": 1, "finno-ougrien": 1,
    "germanique": 2, "slave": 2, "scandinave": 2,
    "latin": 3, "italien": 4, "espagnol": 4, "portugais": 4,
    "français": 5, "anglo-saxon": 5, "moderne-inventé": 6,
}

# Les gloses de en.wiktionary vivent a plusieurs endroits :
#   |t=lady, princess        |lit=masters, princes
#   {{bor+|en|grc|word||young green shoot}}   (5e parametre, 4e vide)
#   root meaning "noble"
# Les deux premiers se lisent comme des valeurs de parametre ENTIERES : une
# regex qui s'arretait au premier « | » coupait t=[[w:Keturah|Keturah]] en
# « [[w:Keturah », qui finissait sur la fiche.
PARAMETRES = [re.compile(r"\|\s*t\s*="), re.compile(r"\|\s*lit\s*=")]
GLOSE = [
    re.compile(r"\|\|([^|}{\n]{3,90})\}\}"),
    re.compile(u"meaning\\s+[\u201c\"\u2018]([^\u201d\"\u2019]{3,90})[\u201d\"\u2019]"),
    re.compile(r"meaning\s+([a-z][a-z \-,]{3,60})(?:[.,;]|$)"),
]

# mots-outils qui trahissent une fausse glose
REJET = re.compile(r"^(tree|text|id|pos|sc|g|alt|nocat|lit|t|\d+)$|^-$|=")


def candidats(txt: str):
    """Les gloses possibles, dans l'ordre de preference."""
    for rx in PARAMETRES:
        for m in rx.finditer(txt):
            yield lire_valeur(txt, m.end())
    for rx in GLOSE:
        for m in rx.finditer(txt):
            yield m.group(1)


def glose_propre(g: str) -> str | None:
    g = en_clair(g)
    g = re.sub(r"[\u201c\u201d\u2018\u2019]", "", g)
    g = re.sub(r"\s+", " ", g).strip(" .,;:|")
    if not g or REJET.match(g) or "=" in g:
        return None
    if not re.search(r"[a-zA-Z]", g):
        return None
    if re.search(r"[\u0370-\u1FFF\u0590-\u08FF\u4E00-\u9FFF]", g):
        return None
    return propre(g)

def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z]", "", s.lower())


def nettoyer(t: str) -> str:
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", t, flags=re.S)
    t = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", t)
    t = t.replace("'''", "").replace("''", "")
    return re.sub(r"\s+", " ", t).strip()


def main() -> None:
    if not SRC.exists():
        sys.exit(f"{SRC} absent.")
    data = json.loads(SRC.read_text(encoding="utf-8"))
    orig, etym = data.get("orig", {}), data.get("etym", {})

    lignes, sans_origine, inconnues = [], 0, {}
    for nom, langues in orig.items():
        fams = []
        for l in langues:
            if l in IGNORE:
                continue
            f = LANGUES.get(l)
            if f is None:
                inconnues[l] = inconnues.get(l, 0) + 1
                continue
            if f not in fams:
                fams.append(f)
        if not fams:
            sans_origine += 1
            continue
        fams.sort(key=lambda f: RANG.get(f, 9))

        gl = None
        txt = etym.get(nom)
        if txt:
            for c in candidats(txt):
                g = glose_propre(c)
                if g and slugify(g) != slugify(nom):
                    gl = g
                    break

        lignes.append(json.dumps({
            "prenom": nom, "origines": fams[:3],
            "signification": None,           # les gloses EN ne vont PAS ici
            "signification_en": gl,
            "objet_marque": None, "objet_marque_note": None,
            "diminutifs": [], "charge_epellation": None,
            "confiance": "haute" if RANG.get(fams[0], 9) <= 2 else "moyenne",
            "source": "wiktionnaire-en",
        }, ensure_ascii=False))

    OUT.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    print(f"{len(orig):,} prenoms categorises")
    print(f"  exploitables      : {len(lignes):,}")
    print(f"  sans origine utile: {sans_origine:,}")
    print(f"  avec glose EN     : {sum(1 for l in lignes if json.loads(l)['signification_en']):,}")
    if inconnues:
        top = sorted(inconnues.items(), key=lambda x: -x[1])[:10]
        print(f"  langues non mappees: {top}")
    print(f"-> {OUT}")


if __name__ == "__main__":
    main()
