#!/usr/bin/env python3
"""
Du wikitexte au texte, pour les deux enrichissements (Wiktionnaire FR et EN).

Pourquoi un module a part : les gloses etaient decoupees par des expressions
regulieres qui s'arretaient au premier « | » ou au premier « } ». Un modele
niche dans un autre ({{étylp|ru|fr|Маша|{{transliterator|ru|Маша}}}}) ou un
lien dans une glose (« qui aime les [[cheval|chevaux]] ») etaient coupes en
deux, et la moitie arrivait telle quelle sur la carte : « {{transliterator »,
« chevaux]] », « &nbsp;laurier&nbsp; ».

Ici on lit la structure — modeles et liens equilibres, parametres nommes
distingues des parametres libres — et `propre()` refuse en dernier recours
tout ce qui ressemble encore a de la syntaxe : un sens absent vaut mieux
qu'un sens illisible.
"""
from __future__ import annotations
import html
import re

# Marque posee a la place d'un {{w|...}} quand on la demande : un lien vers
# Wikipedia designe un titre ou un nom propre (« La Jérusalem délivrée »), pas
# une glose. L'appelant qui cherche un sens entre guillemets s'en sert pour
# ecarter ces citations-la.
MARQUE_W = "\x00"


# ----------------------------------------------------------------- structure
def fin_modele(t: str, i: int) -> int:
    """Indice juste apres le modele qui s'ouvre en t[i] (« {{ »), -1 s'il ne se ferme jamais."""
    prof, n = 0, len(t)
    while i < n:
        if t.startswith("{{", i):
            prof += 1
            i += 2
        elif t.startswith("}}", i):
            prof -= 1
            i += 2
            if prof == 0:
                return i
        else:
            i += 1
    return -1


def _premier_niveau(s: str, cherche: str, i: int = 0) -> int:
    """Indice du premier `cherche` (un caractere) hors modele et hors lien, -1 sinon.
    S'arrete aussi, pour lire_valeur, sur un « }} » de premier niveau."""
    pm = pl = 0
    n = len(s)
    while i < n:
        if s.startswith("{{", i):
            pm += 1
            i += 2
            continue
        if s.startswith("}}", i):
            if pm:
                pm -= 1
                i += 2
                continue
            if cherche == "}":
                return i
        if s.startswith("[[", i):
            pl += 1
            i += 2
            continue
        if s.startswith("]]", i) and pl:
            pl -= 1
            i += 2
            continue
        if s[i] == cherche and pm == 0 and pl == 0:
            return i
        i += 1
    return -1


def decouper(interieur: str) -> list[str]:
    """Coupe l'interieur d'un modele sur ses « | » de premier niveau."""
    morceaux, debut = [], 0
    while True:
        k = _premier_niveau(interieur, "|", debut)
        if k < 0:
            morceaux.append(interieur[debut:])
            return morceaux
        morceaux.append(interieur[debut:k])
        debut = k + 1


CLE = re.compile(r"\s*[\w .-]+\s*")


def lire_modele(interieur: str) -> tuple[str, list[str], dict[str, str]]:
    """« nom|a|b|cle=v » -> ("nom", ["a", "b"], {"cle": "v"}).

    Un « = » ne fait un parametre nomme que s'il est de premier niveau :
    celui d'un modele niche (tr={{transliterator|…}}) reste dans sa valeur.
    """
    morceaux = decouper(interieur)
    nom = morceaux[0].strip()
    libres, nommes = [], {}
    for m in morceaux[1:]:
        k = _premier_niveau(m, "=")
        if k >= 0 and CLE.fullmatch(m[:k]):
            nommes[m[:k].strip()] = m[k + 1:]
        else:
            libres.append(m)
    return nom, libres, nommes


def modeles(t: str):
    """Tous les modeles de t, niches compris, dans l'ordre ou ils s'ouvrent :
    (nom, parametres libres, parametres nommes)."""
    i = 0
    while True:
        j = t.find("{{", i)
        if j < 0:
            return
        k = fin_modele(t, j)
        if k < 0:
            return
        interieur = t[j + 2:k - 2]
        yield lire_modele(interieur)
        yield from modeles(interieur)
        i = k


def lire_valeur(t: str, i: int) -> str:
    """La valeur d'un parametre qui commence en t[i], jusqu'au « | » ou au « }} »
    de premier niveau — les modeles et liens qu'elle contient restent entiers."""
    fins = [k for k in (_premier_niveau(t, "|", i), _premier_niveau(t, "}", i)) if k >= 0]
    return t[i:min(fins)] if fins else t[i:]


# ------------------------------------------------------------------- rendu
def _norme(nom: str) -> str:
    nom = nom.replace("_", " ").strip()
    return nom[:1].lower() + nom[1:]


# Ce que rend chaque modele, reduit a son texte. Tout modele absent d'ici
# disparait : mieux vaut perdre un mot que laisser passer de la syntaxe.
def _rendu(nom: str, libres: list[str], nommes: dict[str, str], marquer_w: bool) -> str:
    n = _norme(nom)
    p = lambda k: libres[k].strip() if len(libres) > k else ""  # noqa: E731
    if n in ("lien", "lien-ancre", "l-ancre"):                       # FR {{lien|mot|langue}}
        return nommes.get("dif", "").strip() or p(0)
    if n in ("w", "wikipédia", "wikipedia"):                          # {{w|Page|texte}}
        t = p(1) or p(0)
        return (MARQUE_W + t + MARQUE_W) if marquer_w and t else t
    if n in ("étyl", "etyl", "étylp"):                               # FR : le mot, pas la langue
        return nommes.get("mot", "").strip() or p(2)
    if n in ("l", "m", "ll", "mention", "link", "l-self", "m-self"):   # EN {{l|lang|mot|alt|glose}}
        return nommes.get("alt", "").strip() or p(2) or p(1)
    if n in ("bor", "bor+", "der", "der+", "inh", "inh+", "cog", "noncog", "ncog",
             "lbor", "slbor", "uder", "ubor", "cal", "calque", "psm"):  # EN {{bor|en|src|mot|alt|glose}}
        return nommes.get("alt", "").strip() or p(3) or p(2)
    if n in ("gloss", "gl", "q", "qual", "qualifier", "i", "sqb", "lang", "polytonique",
             "polyt", "pc", "smcp", "petites capitales", "nobr", "refnec", "réf nec",
             "référence nécessaire"):
        return p(1) if n == "lang" else p(0)
    if n == "recons":                                                 # forme reconstruite
        return ("*" + p(0)) if p(0) else ""
    if n == "nom w pc":
        return " ".join(x for x in (p(0), p(1)) if x)
    return ""


REF = re.compile(r"<ref[^>]*?/>|<ref[^>]*>.*?</ref>", re.S | re.I)
COMMENTAIRE = re.compile(r"<!--.*?-->", re.S)
LIEN = re.compile(r"\[\[([^\[\]]*)\]\]")
EXTERNE = re.compile(r"\[(?:https?:)?//[^\s\]]+\s*([^\]]*)\]")
# modificateurs en ligne du Wiktionnaire anglais : ie<id:diminutive>, mot<t:sens>
EN_LIGNE = re.compile(r"<[a-z]{1,5}:[^<>]*>")
BALISE = re.compile(r"</?[a-zA-Z][^<>]*>")
ESPACES = re.compile(r"[       ]")
PREFIXE = re.compile(r"^:?(?:w|wikipedia|wikt|fr|en)\s*:", re.I)
ANNEXE = re.compile(r"^:?(?:fichier|file|image|catégorie|category|annexe|appendix|wikisaurus)\s*:", re.I)


def _lien(m: re.Match) -> str:
    cible, _, texte = m.group(1).partition("|")
    if texte.strip():
        return texte
    if ANNEXE.match(cible.strip()):
        return ""
    return PREFIXE.sub("", cible.strip()).split("#")[0]


def _modeles_en_texte(t: str, marquer_w: bool) -> str:
    sortie, i = [], 0
    while True:
        j = t.find("{{", i)
        if j < 0:
            sortie.append(t[i:])
            break
        k = fin_modele(t, j)
        sortie.append(t[i:j])
        if k < 0:                   # jamais ferme : on ne garde rien de ce qui suit
            break
        nom, libres, nommes = lire_modele(t[j + 2:k - 2])
        sortie.append(_rendu(nom, [en_clair(x, marquer_w) for x in libres],
                             {c: en_clair(v, marquer_w) for c, v in nommes.items()}, marquer_w))
        i = k
    return "".join(sortie)


def en_clair(t: str | None, marquer_w: bool = False) -> str:
    """Le texte qu'afficherait le wiki : modeles rendus (ou retires), liens
    remplaces par leur libelle, balises, gras/italique et entites HTML resolus."""
    if not t:
        return ""
    t = COMMENTAIRE.sub("", t)
    t = REF.sub("", t)
    t = _modeles_en_texte(t, marquer_w)
    t = LIEN.sub(_lien, t)
    t = EXTERNE.sub(r"\1", t)
    t = EN_LIGNE.sub("", t)
    t = BALISE.sub("", t)
    t = t.replace("'''", "").replace("''", "")
    t = html.unescape(t)
    t = ESPACES.sub(" ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t if marquer_w else t.replace(MARQUE_W, "")


# ------------------------------------------------------------ dernier filet
# Les crochets SIMPLES sont permis : l'anglais s'en sert dans ses gloses
# (« servant [of] », « anointed [one] »). Doubles, ils trahissent un lien.
SYNTAXE = re.compile(r"\{\{|\}\}|\[\[|\]\]|[{}<>|=\x00]|&#?\w+;|https?:|//|''")


def syntaxe_residuelle(s) -> bool:
    """Vrai si s porte encore un morceau de wikitexte ou de HTML."""
    return isinstance(s, str) and bool(SYNTAXE.search(s))


def propre(g, mini: int = 3, maxi: int = 90) -> str | None:
    """Un sens affichable, ou None. Refuse tout reste de syntaxe."""
    if not isinstance(g, str):
        return None
    g = re.sub(r"\s+", " ", g).strip(" .,;:«»\"“”‘’")
    # deux gloses citees l'une apres l'autre : « voyante » ou « dame »
    g = re.sub(r"\s*»\s*(,|;|ou|et)\s*«\s*",
               lambda m: m.group(1) + " " if m.group(1) in ",;" else f" {m.group(1)} ", g)
    # restes de ponctuation laisses par un modele retire : « mûr, vieux, ; hâtif »
    g = re.sub(r"\s*,\s*([;,])", lambda m: " ;" if m.group(1) == ";" else ",", g)
    g = re.sub(r"\(\s*\)", "", g).strip()
    if not g or syntaxe_residuelle(g) or "«" in g or "»" in g:
        return None
    if not re.search(r"[A-Za-zÀ-ÖØ-öø-ÿ]", g):
        return None
    return g if mini <= len(g) <= maxi else None
