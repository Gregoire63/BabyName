#!/usr/bin/env python3
"""Jeu de reference pour la syllabation FR. Lance : python3 pipeline/test_syllabes.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from build_metrics import syllables_fr

REF = {
 "Gabriel":3,"Leo":2,"Léo":2,"Raphaël":3,"Louis":2,"Louise":2,"Jules":1,"Jade":1,
 "Arthur":2,"Adam":2,"Maël":2,"Ambre":1,"Alba":2,"Eden":2,"Charlie":2,"Noah":2,
 "Emma":2,"Alice":2,"Chloé":2,"Lina":2,"Rose":1,"Anna":2,"Léa":2,"Manon":2,
 "Inès":2,"Camille":2,"Alexandre":3,"Marie":2,"Jean":1,"Pierre":1,"Paul":1,
 "Zoé":2,"Nathan":2,"Lucas":2,"Hugo":2,"Sacha":2,"Mathis":2,"Enzo":2,"Axel":2,
 "Isaac":2,"Aaron":2,"Capucine":3,"Apolline":3,"Victoire":2,"Jean-Baptiste":3,
 "Marie-Claire":3,"Timéo":3,"Eliott":3,"Romane":2,"Gaspard":2,"Augustin":3,
 "Anaïs":3,"Loïc":2,"Noé":2,"Théo":2,"Elena":3,"Olivia":4,"Nina":2,"Tom":1,
}

ok = bad = 0
erreurs = []
for nom, attendu in REF.items():
    got = syllables_fr(nom)
    if got == attendu:
        ok += 1
    else:
        bad += 1
        erreurs.append(f"  {nom:<16} attendu {attendu}  obtenu {got}")

print(f"{ok}/{ok+bad} corrects  ({100*ok/(ok+bad):.0f} %)")
if erreurs:
    print("ecarts :")
    print("\n".join(erreurs))
