#!/usr/bin/env python3
"""
Les gloses du Wiktionnaire, cas par cas : ceux qui ont fini sur une carte.
Lance : python3 pipeline/test_wikitexte.py

Chaque cas est un vrai wikitexte du Wiktionnaire (raccourci), et chacun a
produit un jour un « sens » faux : de la syntaxe (Masha « {{transliterator »)
ou le mot source pris pour un sens (Nicolas « Nicolaus »).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from wikitexte import en_clair, propre, lire_valeur, syntaxe_residuelle
import enrich_wiktionary as fr
import enrich_wiktionary_en as en

fr.NOMS.update({"georges", "nicolas", "lune"})
echecs = 0


def verifie(quoi, obtenu, attendu):
    global echecs
    ok = obtenu == attendu
    echecs += not ok
    print(f"  {'ok ' if ok else 'ÉCHEC'} {quoi:34} {obtenu!r}" + ("" if ok else f"   (attendu {attendu!r})"))


def sens(titre, texte):
    r = fr.analyser(titre, texte)
    return r and r["signification"]


print("Wiktionnaire français")
verifie("Masha : modele niche", sens("Masha",
    ": Du {{étylp|ru|fr|Маша|{{transliterator|ru|Маша}}}}."), None)
verifie("Philippe : lien dans la glose", sens("Philippe",
    ": Du {{étylp|grc|fr|Φίλιππος|Phílippos|qui aime les [[cheval|chevaux]]}}."), "qui aime les chevaux")
verifie("Salvador : sens= avec un lien", sens("Salvador",
    ": De l’{{étylp|es|fr|mot=El Salvador|sens=le [[sauveur#fr|Sauveur]]}}."), "le Sauveur")
verifie("Laurent : glose entre parentheses", sens("Laurent",
    ": Du {{étyl|la|fr|mot=Laurentius}}, dérivé de ''[[laurus]]'' («&nbsp;[[laurier]]&nbsp;»)."), "laurier")
verifie("Nicolas : le mot source n'est pas un sens", sens("Nicolas",
    ": Du {{étyl|la|fr|Nicolaus}}."), None)
verifie("Éric : sa translitteration non plus", sens("Éric",
    ": Du {{étyl|non|fr|Eiríkr}}."), None)
verifie("Georgi : un equivalent n'est pas un sens", sens("Georgi",
    ": Du {{étyl|bg|fr|mot=Георги|tr=Georgi|sens=[[Georges]]}}."), None)
verifie("Sélène : sauf s'il est aussi nom commun", sens("Sélène",
    ": Du {{étyl|grc|fr|mot=Σελήνη|tr=Selếnê|sens=Lune}}."), "lune")
verifie("Clorinde : un titre n'est pas un sens", sens("Clorinde",
    ": Prénom d'un personnage de « {{w|La Jérusalem délivrée}} »."), None)
verifie("Olaf : seule la ligne du prenom", sens("Olaf",
    ": {{lien-ancre-étym|fr|prénom}} Du {{étylp|non|fr|Óláfr}}.\n"
    ": {{lien-ancre-étym|fr|nom propre}} Initiales de « Office européen de lutte antifraude »"), None)
verifie("Olaf : origine de la bonne ligne", fr.analyser("Olaf",
    ": {{term|prénom}} Du {{étylp|non|fr|Óláfr}}.\n: {{term|ville}} De l’{{étylp|it|fr|mot=Olafo}}.")["origines"], ["scandinave"])

print("Wiktionnaire anglais")
t = "From {{bor|en|he|קְטוּרָה|tr=Qəṭūrā|t=[[w:Keturah|Keturah]]}}."
verifie("Keturah : t= lu en entier", lire_valeur(t, t.index("t=[[") + 2), "[[w:Keturah|Keturah]]")
verifie("Jamie : modificateur en ligne", en.glose_propre("ie<id:diminutive>"), None)
verifie("Abdul : crochets simples permis", en.glose_propre("servant [of]"), "servant [of]")
verifie("Gabriel : modele niche rendu", en.glose_propre("{{sqb|[[strong]]}} [[man]]"), "strong man")

print("Dernier filet")
for sale in ("chevaux]]", "{{transliterator", "&nbsp;laurier&nbsp;", "[[w:Keturah", "a|b"):
    verifie(f"refuse {sale!r}", propre(sale), None)
    verifie(f"repere {sale!r}", syntaxe_residuelle(sale), True)
verifie("deux gloses citees", propre("Voyante » ou « Dame"), "Voyante ou Dame")
verifie("ponctuation orpheline", propre("mûr, vieux, ; hâtif"), "mûr, vieux ; hâtif")
verifie("entites et insecables", en_clair("«&nbsp;laurier&nbsp;»"), "« laurier »")

print(f"\n{'OK' if not echecs else f'{echecs} ÉCHEC(S)'}")
sys.exit(1 if echecs else 0)
