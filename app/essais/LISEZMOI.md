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
faux Stripe (port 3199) ; `essai-connexion.env` remet les limites d'essais à
leur valeur de production (le développement les multiplie par 50) ;
`essai-rgpd.env` pose un `CRON_SECRET` pour que la
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
| `essai-quota` | un départ puis un filet quotidien, un mur qui dit que demain ça repart ; le quota est en base, suit la personne, et un compte jetable ne rapporte pas un départ entier |
| `essai-social` | **aucun refus n'est jamais annoncé** ; le match est un moment qu'on ferme soi-même |
| `essai-paiement` | l'offre dit tout, prix TTC, **case d'accord jamais pré-cochée** et sans laquelle rien ne part, aucun champ de carte, le serveur refuse le payant sans paiement |
| `essai-caisse` | tout le trajet contre un **faux Stripe local** : accord exigé, session, facture et renonciation, webhook signé, prélèvement, code à 100 %, rotation du secret, retour sans webhook, **re-verrouillage** sur remboursement total ou litige perdu |
| `essai-rgpd` | l'export donne tout ce qui est à soi et **rien des autres** ; l'effacement ne détruit pas les listes partagées ni un déblocage payé ; une session orpheline tombe en 401 ; la purge n'efface que l'inactif, et seulement avec son secret |
| `essai-accessibilite` | axe-core (WCAG 2.0/2.1 A et AA) sur chaque écran et chaque dialogue, clair et sombre ; lien d'évitement, focus piégé dans les dialogues, Échap, focus rendu, tri aux flèches, onglets au clavier, mouvement réduit, aucun tiers contacté |
| `essai-desaccord` | « ce n'est peut-être pas Marius, c'est la longueur » — et le silence tant qu'il n'y a pas de quoi le dire |
| `essai-observateur` | le non de Mamie ne retire pas Louise des accords, et elle ne peut pas poser de veto |
| `essai-deja-pris` | **deux façons de retirer un prénom** : « déjà pris » (tapé d'avance avec autocomplétion, note et auteur visibles, remis en jeu d'un geste — celui d'un autre après confirmation) et en secret (compté) ; la feuille « Bloquer » ne coche rien d'avance ; **un prénom emporte ses graphies** (Chloé bloquée, Cloé ne prend pas la carte) et ne coûte qu'un blocage ; au bout des 5, « déjà pris » reste ouvert ; Mamie lit sans toucher ; un compte effacé laisse ses « déjà pris », sans nom ni note |
| `essai-carte-actions` | **toucher la carte ouvre la fiche** (pas un glissement court, pas un appui long) ; « Infos », « Non aux Maël… » (début de prénom et nombre en clair) et « Bloquer », dessinés et nommés ; rien à balayer : le geste s'efface sans déplacer les autres ; la courbe prend la place, et sur petit écran les gestes restent dans la carte |
| `essai-recherche` | la loupe du tri ouvre la recherche, curseur dans le champ ; **toucher un prénom le met en première carte** (déjà jugé : on le rejuge, la carte rappelle le vote) ; un prénom bloqué ne se propose pas ; au bout du quota il attend son tour ; Filtres en icône ; **la feuille tient au-dessus du clavier** ; la feuille et la fiche descendent en se fermant |
| `essai-connexion` | **sans mot de passe** : passkey créée puis utilisée (authentificateur virtuel de Chrome), retirée elle n'ouvre plus rien et le trousseau est prévenu ; lien et code par e-mail (code faux, lien à usage unique, adresse inconnue muette, 5 codes faux et le lien meurt) ; adresse prouvée avant d'être enregistrée ; ancienne clé désactivable ; **déconnecter les autres appareils** ; codes d'invitation longs et essais limités ; requête d'un autre site refusée ; pas de code pour un observateur ; tailles bornées ; en-têtes de sécurité |
| `essai-graphies` | la carte dit « aussi écrit … Voir plus » au lieu de « le vote vaut pour 7 graphies » ; la feuille à onglets (une graphie par onglet, sa part dans l'étiquette, flèches au clavier), la fiche de chaque graphie ; WCAG en clair et en sombre |
| `essai-reglages` | la carte « Débloquer cette liste » dit sa **portée** (cette liste, ses membres, pas toute l'app) ; débloquée, elle le dit ; thème Clair / Système / Sombre appliqué, retenu, **posé avant le démarrage** (pas de flash), gardé à la déconnexion |
| `essai-historique` | trois pages légales lues en chaîne, **un seul Retour** pour revenir (bouton de la page comme du navigateur), glissé vers l'arrière ; **pendant le glissement la page qui bouge est opaque** ; les onglets d'une liste n'empilent rien |
| `essai-dev` | les outils de la base locale : entrer d'un geste, âge du jeu d'essai, nouvelle journée, quotas à zéro, débloquer / rebloquer sans Stripe, base neuve sans arrêter le serveur |
| `essai-seo` | ce que lisent les moteurs et les IA : page de l'app statique (WebApplication, FAQ) aux limites **lues dans le schéma**, llms.txt au bon domaine, robots.txt qui ferme `/?…` sans écarter les robots d'IA, boutons en nofollow, mentions légales sur chaque fiche, lastmod stable, coquille lisible sans JavaScript |
| `essai-prenom` | le prénom d'une fiche publique (`?prenom=`) traverse la connexion et la création de liste, et arrive **en première carte, même hors des filtres** ; épinglé jusqu'au jugement ; déjà jugé, en accord ou sous veto, on le dit sans le rejouer ; **le code d'invitation traverse la connexion** ; le bouton retour ne boucle pas |
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
