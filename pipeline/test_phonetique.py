#!/usr/bin/env python3
"""
Jeu de reference pour la cle de prononciation.
Lance : python3 pipeline/test_phonetique.py

Deux listes, et la seconde compte plus que la premiere : sur-regrouper
supprime un choix reel, sous-regrouper ne fait que conserver l'existant.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from phonetique import prononciation as p

# Doivent se retrouver dans le meme groupe : graphies d'un meme son.
ENSEMBLE = [
    ("Maël", "Maëlle", "Maelle", "Mael"),
    ("Lyam", "Liam"),
    ("Théo", "Teo"),
    ("Noa", "Noah"),
    ("Léa", "Lea", "Leah"),
    ("Louna", "Lounna"),
    ("Sacha", "Sasha"),
    ("Mila", "Milla"),
    ("Gabriel", "Gabryel"),
    ("Nathan", "Natan"),
    ("Emma", "Ema"),
    ("Zoé", "Zoe"),
    ("Maya", "Maïa"),
    ("Enzo", "Enzzo"),
    ("Ayden", "Aiden"),
    ("Elyo", "Elio"),
    ("Anaé", "Anae"),
    ("Naël", "Nael", "Naelle"),
    ("Ilyan", "Ilian"),
    ("Célia", "Selia"),
    ("Kylian", "Kilian", "Killian"),
    ("Ella", "Ela", "Hella"),
    ("Nelya", "Nélya", "Nélia", "Nelia", "Nëlya", "Nellya"),
    ("Eliott", "Eliot", "Elliot", "Elliott"),
    ("Timéo", "Timeo"),
    ("Sofia", "Sophia"),
    ("Léna", "Lena"),
]

# Ne doivent SURTOUT PAS se retrouver ensemble.
DISTINCTS = [
    ("Lucas", "Luca"),          # le s final de Lucas se prononce
    ("Louna", "Luna"),          # « ou » n'est pas « u »
    ("Alice", "Alix"),          # alis / aliks
    ("Thomas", "Toma"),
    ("Louis", "Loïs"),          # le trema coupe
    ("Anaïs", "Anès"),
    ("Milla", "Camille"),
    ("Léa", "Léo"),
    ("Jean", "Jane"),
    ("Manon", "Manone"),
    ("Alexis", "Alex"),
    ("Noé", "Noa"),
    ("Sohan", "Sohane"),        # le -e final denasalise : /so.ɑ̃/ vs /so.an/
    ("Marie", "Maria"),
    ("Elsa", "Elise"),
    ("Ella", "Ayla"),       # /ɛla/ et /ajla/ : la regle « ai = e » ne vaut
    ("Eden", "Ayden"),      # pas pour les prenoms importes
    ("Eden", "Edem"),
    ("Léna", "Leyna"),
    ("Yanis", "Janis"),     # le j francais n'est pas le y : /ʒanis/ et /janis/
]

# Limites connues, assumees. Les lister vaut mieux que les ignorer.
LIMITES = [
    ("Théo", "Téo", "regroupes — mais Teo/Teho/Theo aussi, c'est voulu"),
    ("Nathan", "Natan", "regroupes"),
    ("Leyna", "Léna", "NON regroupes : « ey » n'est pas ramene a « e »"),
    ("Eythan", "Ethan", "NON regroupes, meme raison"),
]

ok = ko = 0
messages = []
for grp in ENSEMBLE:
    cles = {n: p(n) for n in grp}
    if len(set(cles.values())) == 1:
        ok += 1
    else:
        ko += 1
        messages.append(f"  PAS REGROUPES : {cles}")
for a, b in DISTINCTS:
    if p(a) != p(b):
        ok += 1
    else:
        ko += 1
        messages.append(f"  CONFONDUS : {a} et {b} -> {p(a)}")

print(f"{ok}/{ok+ko} corrects")
for m in messages:
    print(m)
print("\nlimites connues (non corrigees, biais prudent assume) :")
for a, b, pourquoi in LIMITES:
    print(f"  {a} ({p(a)}) et {b} ({p(b)}) : {pourquoi}")
sys.exit(1 if ko else 0)
