#!/usr/bin/env python3
"""
Clé de prononciation pour les prénoms français.

À quoi ça sert : dans la pile de swipe, juger Nelya, Nélya, Nélia, Nelia et
Nëlya l'un après l'autre, c'est cinq cartes pour une seule décision.

BIAIS ASSUMÉ : sous-regrouper plutôt que sur-regrouper. Fusionner deux prénoms
qui sonnent différemment supprime un choix réel — c'est une faute. Les laisser
séparés ne fait que conserver l'état actuel.

Ce biais a une conséquence nette sur la méthode. On ne fait PAS de
transcription phonétique complète : on neutralise seulement les décorations
qui ne s'entendent pas — accents, h, lettres doublées, y/i, k/c/qu, ph/f,
tréma, e muet final. On ne réinterprète jamais un digramme vocalique.

Une première version le faisait (ai → è, en → nasale) et ses plus gros groupes
étaient faux : elle mettait Ella avec Ayla, Eden avec Ayden, Eden avec Edem.
Ce sont des prénoms différents. La règle française « ai se dit è » est vraie
pour les mots français et fausse pour Ayla, Ayden, Kayla, Layna, qui sont
justement ceux qui peuplent la longue traîne. En doutant, on laisse deux
cartes ; c'est le prix, et il est bien plus bas que l'inverse.
"""
from __future__ import annotations
import re
import unicodedata

VOYELLES = set("aeiou")


def _mot(m: str) -> str:
    if not m:
        return ""
    s = unicodedata.normalize("NFD", m.lower().strip())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")   # accents et tréma
    s = s.replace("æ", "ae").replace("œ", "oe").replace("ç", "s")

    # --- digrammes consonantiques, avant que le h ne disparaisse ---------
    s = s.replace("sch", "C").replace("sh", "C")
    s = re.sub(r"ch([lr])", r"k\1", s)           # Chloe, Christian
    s = s.replace("ch", "C")                      # C = son « ch »
    s = s.replace("ph", "f")
    s = s.replace("th", "t")
    s = s.replace("gn", "N")                      # N = son « gn »
    s = s.replace("h", "")                        # Noah = Noa, Lehna = Lena

    # --- s sonore entre voyelles, AVANT que le c ne devienne s -----------
    # Sinon Alice devenait « aliz » : le s issu d'un c n'est jamais sonore.
    s = re.sub(r"(?<=[aeiouy])s(?=[aeiouy])", "z", s)

    s = s.replace("y", "i")                       # Elya = Elia, Gabryel = Gabriel

    # --- consonnes --------------------------------------------------------
    s = s.replace("qu", "k").replace("q", "k").replace("ck", "k")
    s = re.sub(r"c(?=[ei])", "s", s)
    s = s.replace("c", "k")
    s = re.sub(r"g(?=[ei])", "J", s)              # J = son « j »
    s = s.replace("gu", "g")
    s = s.replace("j", "J")
    s = s.replace("x", "ks")
    s = s.replace("w", "v")                       # Wanda / Vanda

    # --- lettres doublees : aucune ne s'entend ---------------------------
    s = re.sub(r"(.)\1+", r"\1", s)

    # --- e muet final, apres consonne seulement --------------------------
    # Sauf apres n ou m : la, le e final ne se tait pas, il DENASALISE.
    # Manon /manɔ̃/ n'est pas Manone /manɔn/, Sohan n'est pas Sohane, Jean
    # n'est pas Jeanne. Les confondre, c'est supprimer un prenom.
    if len(s) > 2 and s.endswith("e") and s[-2] not in VOYELLES and s[-2] not in "nm":
        s = s[:-1]
    return s


def prononciation(nom: str) -> str:
    """Clé de prononciation. Deux prénoms qui la partagent s'écrivent
    différemment mais se disent pareil."""
    parties = [p for p in re.split(r"[-\s’']+", str(nom)) if p]
    return "-".join(_mot(p) for p in parties)
