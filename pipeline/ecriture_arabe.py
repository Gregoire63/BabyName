#!/usr/bin/env python3
"""
L'ecriture arabe des prenoms d'origine arabe, pour les fiches publiques.

La Search Console le montre : on cherche « Jad en arabe », « Saad en arabe »,
« Reem signification islam ». La fiche doit donner le mot.

Sources, dans l'ordre :
  1. MANUEL ci-dessous : corrections et prenoms frequents sans source (relus
     un par un). Une valeur vide retire un prenom.
  2. Wiktionnaire francais (data/raw/wiktionary_etym.json) : le mot arabe de
     {{étyl|ar|fr|…}} / {{étylp|ar|fr|…}}.
  3. Wiktionary anglais (data/raw/wiktionary_en.json) : {{bor|…|ar|…}},
     {{der|…|ar|…}}, ar:… dans {{ety}}.

On garde la forme sans voyelles breves (l'usage courant), en lettres arabes
(pas persanes : ی -> ي, ک -> ك). Seuls les prenoms dont l'une des origines
est arabe sont retenus : un mot arabe dans l'etymologie d'un prenom latin
n'est pas « le prenom en arabe ».

Sortie : app/scripts/donnees/ecriture-arabe.json  {"Nour": "نور", ...}
(lu par app/scripts/seo.mjs ; propage aux graphies qui se prononcent pareil).
"""
from __future__ import annotations
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AR = '؀-ۿ'
BREVES = re.compile('[ً-ٰٟـ]')

MANUEL = {
    # corrections des sources (lieu, mot voisin ou erreur de lecture)
    'Amine': 'أمين', 'El-Amine': 'الأمين', 'Lamine': 'الأمين', 'Riyad': 'رياض', 'Saad': 'سعد',
    'Zina': 'زينة', 'Musa': 'موسى', 'Sanaa': 'سناء', 'Nasr': 'نصر', 'Karima': 'كريمة',
    'Saliha': 'صالحة', 'Tahar': 'طاهر', 'Safiya': 'صفية', 'Safia': 'صفية', 'Safya': 'صفية',
    'Dalia': 'داليا', 'Dalhia': 'داليا', 'Zoubir': 'زبير', 'Rayan': 'ريان', 'Rayane': 'ريان',
    'Medina': 'مدينة', 'Zara': '', 'Henda': '', 'Omari': '', 'Zeeshan': '', 'Maryana': '',
    'Iskander': 'إسكندر', 'Iskandar': 'إسكندر',
    # frequents sans source
    'Ambre': 'عنبر', 'Lina': 'لينا', 'Lyna': 'لينا', 'Naël': 'نائل', 'Nael': 'نائل', 'Naïl': 'نائل',
    'Jannah': 'جنة', 'Jennah': 'جنة', 'Janna': 'جنة', 'Haroun': 'هارون', 'Haron': 'هارون',
    'Kassim': 'قاسم', 'Qassim': 'قاسم', 'Yassine': 'ياسين', 'Yacine': 'ياسين',
    'Ilyas': 'إلياس', 'Elyas': 'إلياس', 'Nahel': 'ناهل', 'Nahël': 'ناهل', 'Manel': 'منال',
    'Hana': 'هناء', 'Souleyman': 'سليمان', 'Tasnim': 'تسنيم', 'Tesnim': 'تسنيم', 'Tasnime': 'تسنيم',
    'Kamil': 'كامل', 'Salma': 'سلمى', 'Kenza': 'كنزة', 'Iyad': 'إياد', 'Iyed': 'إياد', 'Jad': 'جاد',
    'Anaya': 'عناية', 'Ishaq': 'إسحاق', 'Ishak': 'إسحاق', 'Joud': 'جود', 'Yara': 'يارا',
    'Layane': 'ليان', 'Layan': 'ليان', 'Hidaya': 'هداية', 'Soumaya': 'سمية', 'Islem': 'إسلام',
    'Isra': 'إسراء', 'Israa': 'إسراء', 'Muhammad': 'محمد', 'Mouhamed': 'محمد', 'Emir': 'أمير',
    'Assil': 'أصيل', 'Meryem': 'مريم', 'Mariame': 'مريم', 'Imrane': 'عمران', 'Esma': 'أسماء',
    'Anis': 'أنيس', 'Saja': 'سجى', 'Sakina': 'سكينة', 'Jassim': 'جاسم', 'Sidra': 'سدرة',
    'Dania': 'دانية', 'Selim': 'سليم', 'Aïda': 'عايدة', 'Malak': 'ملاك', 'Sanad': 'سند',
    'Amani': 'أماني', 'Lila': 'ليلى', 'Lyla': 'ليلى', 'Zayneb': 'زينب', 'Firdaws': 'فردوس',
    'Amjad': 'أمجد', 'Yasser': 'ياسر', 'Junayd': 'جنيد', 'Hiba': 'هبة', 'Safwan': 'صفوان',
    'Zeyd': 'زيد', 'Khalis': 'خالص', 'Reem': 'ريم', 'Ons': 'أنس', 'Nour': 'نور',
}


def depuis_fr(t: str):
    for m in re.finditer(r'\{\{étylp?\|ar\|fr\|([^}]*)\}\}', t):
        parties = m.group(1).split('|')
        mot = next((p[4:] for p in parties if p.startswith('mot=')), None) \
            or next((p for p in parties if '=' not in p and re.search(f'[{AR}]', p)), None)
        if mot and re.fullmatch(f'[{AR}\\s]+', mot):
            return mot
    return None


def depuis_en(t: str):
    for motif in (r'\{\{(?:bor|der|inh)\+?\|[a-z]+\|ar\|([^|}]+)', r':(?:bor|der|inh)\|ar:([^<|}]+)', r'\bar:([^<|}\s]+)'):
        m = re.search(motif, t)
        if m and re.fullmatch(f'[{AR}\\s]+', m.group(1)):
            return m.group(1)
    return None


def propre(s: str) -> str:
    s = BREVES.sub('', s).replace('ی', 'ي').replace('ک', 'ك').replace('ٱ', 'ا')
    return re.sub(r'\s+', ' ', s).strip()


def main():
    fr = json.loads((ROOT / 'data/raw/wiktionary_etym.json').read_text(encoding='utf-8'))
    en = json.loads((ROOT / 'data/raw/wiktionary_en.json').read_text(encoding='utf-8'))['etym']
    cat = json.loads((ROOT / 'app/public/data/catalogue.json').read_text(encoding='utf-8'))
    arabe = cat['origines'].index('arabe')
    c = cat['cols']
    retenus = {c['l'][k] for k in range(cat['n']) if arabe in c['g'][k]}

    sortie, sources = {}, {'manuel': 0, 'wiktionnaire': 0, 'wiktionary': 0}
    for nom in sorted(retenus):
        if nom in MANUEL:
            if MANUEL[nom]:
                sortie[nom] = MANUEL[nom]; sources['manuel'] += 1
            continue
        t = fr.get(nom)
        mot = depuis_fr(t if isinstance(t, str) else json.dumps(t, ensure_ascii=False)) if t else None
        if mot:
            sortie[nom] = propre(mot); sources['wiktionnaire'] += 1; continue
        mot = depuis_en(en[nom]) if nom in en else None
        if mot:
            sortie[nom] = propre(mot); sources['wiktionary'] += 1
    sortie = {k: v for k, v in sortie.items() if v}
    dest = ROOT / 'app/scripts/donnees/ecriture-arabe.json'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(sortie, ensure_ascii=False, indent=0, sort_keys=True) + '\n', encoding='utf-8')
    print(f'{len(sortie)} prenoms sur {len(retenus)} d\'origine arabe ({sources}) -> {dest.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
