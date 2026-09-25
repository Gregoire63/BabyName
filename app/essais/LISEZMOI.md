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
| `ESSAI_AXE` | chemin de `axe.min.js` pour `essai-accessibilite` (sinon `npm i -D axe-core`) |

Un essai qui a besoin d'un serveur configuré autrement le dit dans un fichier
voisin : `essai-caisse.env` pose des clés Stripe bidon et pointe l'API sur un
faux Stripe (port 3199) ; `essai-rgpd.env` pose un `CRON_SECRET` pour que la
purge existe. `relance.sh` les charge pour leur essai seulement — les autres
gardent un serveur sans clé, et `essai-paiement` peut vérifier que l'écran
d'achat le dit.

`essai-caisse` se lance aussi en Managed Payments :
`NUXT_STRIPE_MANAGED_PAYMENTS=1 sh essais/relance.sh essais/essai-caisse.mjs`.

## Ce que chacun garde

| Essai | La promesse tenue |
|---|---|
| `essai-panorama` | les 19 608 prénoms, les rares hors de la pile mais dans la recherche, un seul fichier de 391 Ko |
| `essai-groupes` | une carte par prononciation, un vote qui vaut pour toutes les graphies |
| `essai-promesse` | la carte du fond est celle qui arrive — la pile ne se remélange pas sous le doigt |
| `essai-geste` | le swipe part quand le verdict s'affiche, pas dix pixels plus loin |
| `essai-quota` | le quota est en base, vider son cache ne rend pas de swipes, et il suit la personne |
| `essai-social` | **aucun refus n'est jamais annoncé** ; le match est un moment qu'on ferme soi-même |
| `essai-paiement` | l'offre dit tout, prix TTC, **case d'accord jamais pré-cochée** et sans laquelle rien ne part, aucun champ de carte, le serveur refuse le payant sans paiement |
| `essai-caisse` | tout le trajet contre un **faux Stripe local** : accord exigé, session, facture et renonciation, webhook signé, prélèvement, code à 100 %, rotation du secret, retour sans webhook, **re-verrouillage** sur remboursement total ou litige perdu |
| `essai-rgpd` | l'export donne tout ce qui est à soi et **rien des autres** ; l'effacement ne détruit pas les listes partagées ni un déblocage payé ; une session orpheline tombe en 401 ; la purge n'efface que l'inactif, et seulement avec son secret |
| `essai-accessibilite` | axe-core (WCAG 2.0/2.1 A et AA) sur chaque écran et chaque dialogue, clair et sombre ; lien d'évitement, focus piégé dans les dialogues, Échap, focus rendu, tri aux flèches, onglets au clavier, mouvement réduit, aucun tiers contacté |
| `essai-desaccord` | « ce n'est peut-être pas Marius, c'est la longueur » — et le silence tant qu'il n'y a pas de quoi le dire |
| `essai-observateur` | le non de Mamie ne retire pas Louise des accords, et elle ne peut pas poser de veto |
| `essai-portrait` | le portrait parle sur 12 oui et **se tait** sur 5 |
| `essai-classement` | les désaccords, et le changement d'avis qui fait passer un prénom en commun |
| `essai-veto` `essai-carte` `essai-nav` `essai-fond` `essai-glisse` `essai-chargement` `essai-sw` | vetos, carte, navigation, transitions, squelettes, service worker |

## Le jeu d'essai

Tout repose sur la semence de `server/utils/semence.ts`, et ses cas limites
sont délibérés : Greg a exactement **12 oui** (le seuil du portrait) et Audrey
**5 visibles** (sous le seuil) ; Audrey a dit non à **Ferdinand** que Greg n'a
jamais jugé (le seul cas qui prouve qu'un refus n'est pas annoncé) ; Mamie
observe et dit non à **Louise**, qui doit rester un accord ; **Fantome**,
inactif depuis 25 mois et seul sur sa liste, est ce que la purge doit effacer —
et lui seul. Changer ces chiffres casse les essais — c'est voulu.
