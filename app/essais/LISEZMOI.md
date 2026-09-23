# Les essais

Des essais de bout en bout : un vrai navigateur, un vrai serveur, une vraie
base. Ils ne testent pas des fonctions, ils testent des **promesses** — « le
refus ne se dit jamais », « un observateur ne casse pas un accord », « aucun
champ de carte bancaire dans l'app ». C'est pour ça qu'ils sont lisibles :
chaque ligne `OK` est une phrase qu'on peut montrer à quelqu'un.

## Lancer

```bash
npm i -D playwright && npx playwright install chromium
sh essais/relance.sh essais/essai-paiement.mjs
```

`relance.sh` tue le serveur, efface `.data/`, en redémarre un sur le port 3100
et attend `/api/sante`. **Cette remise à zéro n'est pas optionnelle** : les
essais votent, paient et invitent ; l'un qui garde son état fausse le suivant.

| Variable | Pour quoi |
|---|---|
| `ESSAI_BASE` | une autre URL que `http://127.0.0.1:3100` |
| `ESSAI_PORT` | un autre port pour `relance.sh` |
| `ESSAI_CHROME` | imposer un binaire Chromium (sinon celui de Playwright) |
| `ESSAI_PLAYWRIGHT` | chemin du module si Playwright n'est pas dans le projet |

## Ce que chacun garde

| Essai | La promesse tenue |
|---|---|
| `essai-panorama` | les 19 608 prénoms, les rares hors de la pile mais dans la recherche, un seul fichier de 391 Ko |
| `essai-groupes` | une carte par prononciation, un vote qui vaut pour toutes les graphies |
| `essai-promesse` | la carte du fond est celle qui arrive — la pile ne se remélange pas sous le doigt |
| `essai-geste` | le swipe part quand le verdict s'affiche, pas dix pixels plus loin |
| `essai-quota` | le quota est en base, vider son cache ne rend pas de swipes, et il suit la personne |
| `essai-social` | **aucun refus n'est jamais annoncé** ; le match est un moment qu'on ferme soi-même |
| `essai-paiement` | l'offre dit tout, aucun champ de carte, le serveur refuse le payant sans paiement |
| `essai-observateur` | le non de Mamie ne retire pas Louise des accords, et elle ne peut pas poser de veto |
| `essai-portrait` | le portrait parle sur 12 oui et **se tait** sur 5 |
| `essai-classement` | les désaccords, et le changement d'avis qui fait passer un prénom en commun |
| `essai-veto` `essai-carte` `essai-nav` `essai-fond` `essai-glisse` `essai-chargement` `essai-sw` | vetos, carte, navigation, transitions, squelettes, service worker |

## Le jeu d'essai

Tout repose sur la semence de `server/utils/semence.ts`, et ses cas limites
sont délibérés : Greg a exactement **12 oui** (le seuil du portrait) et Audrey
**5 visibles** (sous le seuil) ; Audrey a dit non à **Ferdinand** que Greg n'a
jamais jugé (le seul cas qui prouve qu'un refus n'est pas annoncé) ; Mamie
observe et dit non à **Louise**, qui doit rester un accord. Changer ces
chiffres casse les essais — c'est voulu.
