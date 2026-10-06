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

Les essais entrent comme Paul, Alice ou Mamie par le bloc « Base locale » de
la page de connexion (`entrerComme`, dans `navigateur.mjs` ; route
`/api/dev/entrer`, développement seulement).

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
purge existe ; `essai-coquille.env` règle les apps des stores (un faux service
de notifications sur le port 3198, de quoi faire répondre les deux fichiers
`.well-known`, le compte de démonstration). `relance.sh` les charge pour leur essai seulement — les autres
gardent un serveur sans clé, et `essai-paiement` peut vérifier que l'écran
d'achat le dit.

**Le build de production, dans workerd.** `nuxt dev` tourne sous Node, sans
empaquetage : ce qui ne casse qu'une fois le Worker construit n'y apparaît
pas (le 28/09, aucune passkey ne se créait en production). `relance-worker.sh`
fait `nuxt build`, lance `wrangler dev` sur la sortie (base D1 neuve, un
compte d'essai et un lien de connexion au jeton connu : la production n'a
pas d'autre porte) et passe l'essai :

```bash
sh essais/relance-worker.sh essais/essai-worker.mjs      # SANS_BUILD=1 : garder le build
```

Lui aussi lit le fichier voisin de l'essai (`essai-worker.env`) : chaque ligne
devient une variable du Worker.

**L'app des stores, sans téléphone.** `ongletApp(nav, 'android' | 'ios')`
(`navigateur.mjs`) ouvre un onglet qui se présente comme elle : son agent
utilisateur — ce à quoi le site et le serveur la reconnaissent — et le pont
natif, tenu par l'essai. `natif.recus` : tout ce que la page a dit au
téléphone ; `natif.permission`, `natif.reponse` : où en sont les notifications
et ce qu'on répondra à la question du téléphone ; `natif.dire(message)` : ce
que le téléphone dit à la page (un lien reçu, « Retour », le retour au
premier plan). Ce que cela ne dit pas — la vraie vue web, le vrai clavier,
les vraies notifications — se regarde sur un appareil (`mobile/LISEZMOI.md`).

`essai-caisse` se lance aussi en Managed Payments :
`NUXT_STRIPE_MANAGED_PAYMENTS=1 sh essais/relance.sh essais/essai-caisse.mjs`.

## Ce que chacun garde

| Essai | La promesse tenue |
|---|---|
| `essai-panorama` | les 19 608 prénoms, les rares hors de la pile mais dans la recherche, un seul fichier de 435 Ko |
| `essai-groupes` | une carte par prononciation, un vote qui vaut pour toutes les graphies |
| `essai-promesse` | la carte du fond est celle qui arrive — la pile ne se remélange pas sous le doigt |
| `essai-geste` | le swipe part quand le verdict s'affiche, pas dix pixels plus loin |
| `essai-quota` | un départ puis un filet quotidien, un mur qui dit que demain ça repart ; **le dernier swipe se sait d'avance** (rien derrière la carte, aucune autre carte devant avant le mur) ; le quota est en base, suit la personne, et un compte jetable ne rapporte pas un départ entier |
| `essai-social` | **aucun refus n'est jamais annoncé** ; le match est un moment qu'on ferme soi-même |
| `essai-fete` | **la fête d'un accord arrive là où l'on est**, serveur ralenti d'une seconde et demie : après un swipe puis un changement d'onglet, après un « finalement oui » puis un changement de volet ou d'onglet, elle se voit, se touche et se ferme, et la page répond ensuite ; partie à l'accueil, pas de fête ; « Voir nos accords » y mène depuis partout ; une recherche restée ouverte dessous ne fige rien |
| `essai-paiement` | l'offre dit tout, prix TTC, **case d'accord jamais pré-cochée** et sans laquelle rien ne part — mais **bouton jamais grisé** : sans la case, il la signale, juste au-dessus de lui ; aucun champ de carte, le serveur refuse le payant sans paiement |
| `essai-caisse` | tout le trajet contre un **faux Stripe local** : accord exigé, session, facture et renonciation, webhook signé, prélèvement, code à 100 %, rotation du secret, retour sans webhook, **re-verrouillage** sur remboursement total ou litige perdu |
| `essai-cadeau` | **offrir sans compte**, dans une feuille (sur `/offrir` comme depuis l'accueil) contre un faux Stripe : rien sans la case d'accord ; une session de CADEAU (code dans les métadonnées et sur la facture, rétractation tant qu'il n'a pas servi, pas de code promo, aucune liste visée) ; le code au retour, « en cours » tant que ce n'est pas encaissé, le même à chaque rechargement ; le lien traverse la connexion (« Mamie Jo vous offre babyNamed ») et crée une liste débloquée ; tapé dans « Débloquer » ou « Rejoindre » ; **un code ne sert qu'une fois** ; remboursé, il s'annule et re-verrouille la liste ; échu, il n'ouvre plus rien ; WCAG sur les trois écrans |
| `essai-rgpd` | l'export donne tout ce qui est à soi et **rien des autres** ; l'effacement ne détruit pas les listes partagées ni un déblocage payé ; une session orpheline tombe en 401 ; la purge n'efface que l'inactif, et seulement avec son secret |
| `essai-worker` | **dans le Worker de production** (relance-worker.sh) : on entre par un lien de connexion, une passkey se crée puis sert à revenir, son message s'affiche sous le bouton ; `/api/sante` ne dit que `{ ok }` sans le secret ; **les apps des stores** : les deux fichiers `.well-known` et les deux adresses que l'app ouvre sont servis, le compte de démonstration entre sans e-mail, l'achat est refusé depuis l'app, et **une notification part après la réponse** (`waitUntil`) ; aucune réponse 500 |
| `essai-coquille` | **les apps des stores**, dans un navigateur qui se présente comme elles (`ongletApp`) : **rien ne s'y vend** — accueil, tri, fiche, fête d'un accord, mur du quota, classement, réglages, « Rejoindre », `/offrir` ; Android dit où cela se débloque, d'une phrase sans lien, iOS ne dit rien ; **le serveur refuse** achat, cadeau et code venus d'une app, sans appeler Stripe ; débloquée sur le site, la liste l'est dans l'app au retour ; le pont (« prête », thème, partage, « Télécharger mes données », « Retour » d'Android, vibreur, lien reçu) ; **les notifications** (jamais demandées à l'ouverture, rien d'enregistré sans un geste même sur un téléphone qui les permet d'office, un accord prévient l'autre **sans le prénom**, une arrivée aussi ; refusées, coupées, déconnecté, jeton périmé, autre compte sur le même téléphone : plus rien) ; **les liens** (`/rejoindre/…`, et le lien de connexion qui revient là où on l'a demandé) ; le compte de démonstration |
| `essai-enregistrement` | **un nom tapé est enregistré, quelle que soit la façon de partir** : pause dans la frappe, bouton retour, app en arrière-plan, onglet ; nom de la liste, nom de famille, nom affiché ; une requête par mot, pas par lettre |
| `essai-supprimer-liste` | **quitter une liste, ou la supprimer pour tous** : le propriétaire (le créateur) est nommé, lui seul supprime (ni bouton ni route pour les autres, parent compris), rien sans le mot `SUPPRIMER` ; tout le monde peut quitter : ce qu'on a donné part, la liste reste aux autres, ses « déjà pris » y restent sans nom ni note, l'export n'en garde rien ; seul à décider, le propriétaire ne peut que supprimer ; s'il part, la liste passe au plus ancien qui décide, qui peut la renommer et la supprimer ; l'appareil oublie la liste, l'ancienne adresse ramène à l'accueil |
| `essai-accessibilite` | axe-core (WCAG 2.0/2.1 A et AA) sur chaque écran et chaque dialogue (la feuille des textes légaux comprise), clair et sombre ; lien d'évitement, focus piégé dans les dialogues, Échap, focus rendu, tri aux flèches, onglets au clavier, mouvement réduit, aucun tiers contacté |
| `essai-desaccord` | « ce n'est peut-être pas Marius, c'est la longueur » — et le silence tant qu'il n'y a pas de quoi le dire |
| `essai-observateur` | le non de Mamie ne retire pas Louise des accords, et elle ne peut pas poser de veto ; **ses cœurs sur les accords** (son oui, visible des parents ; son non jamais affiché ; retiré, il passe en neutre ; un autre observateur ne les voit qu'après son propre avis) ; **ses mots aussi** (signés, comptés sur la carte repliée des parents, même règle d'aveugle) ; les accords ne se disent pas « incomplets » à cause d'elle |
| `essai-deja-pris` | **deux façons de retirer un prénom** : « déjà pris » (tapé d'avance avec autocomplétion, note et auteur visibles, remis en jeu d'un geste — celui d'un autre après confirmation) et le veto « autre raison » (compté, sans nom) ; la feuille « Mettre un veto » ne coche rien d'avance ; **un prénom emporte ses graphies** (veto sur Chloé, Cloé ne prend pas la carte) et ne coûte qu'un veto ; au bout des 5, « déjà pris » reste ouvert ; Mamie lit sans toucher ; un compte effacé laisse ses « déjà pris », sans nom ni note |
| `essai-tendance` | **un chiffre n'est montré que s'il veut dire quelque chose** : un petit prénom (moins de 60 bébés en trois ans) donne ses bébés par an et les montre en barres **chiffrées, années dessous**, pas un « +14 % » tiré de l'arrondi de l'INSEE (carte, fiche) ; Aurélie a sa courbe, jugée à son sommet ; un prénom courant garde pourcentage et courbe ; chaque carte de la pile a sa courbe ou ses barres ; aucun sens du catalogue ne porte de wikitexte ni le mot source en guise de sens |
| `essai-carte-actions` | **toucher la carte ouvre la fiche** (pas un glissement court, pas un appui long) ; « Infos », « Non aux Maël… » (début de prénom et nombre en clair) et « Veto », dessinés et nommés ; rien à balayer : le geste s'efface sans déplacer les autres ; la courbe prend la place, et sur petit écran les gestes restent dans la carte ; **une carte chargée** (Amaël, nom de famille, message de rareté) garde sa courbe : l'origine en haut, à côté du genre, l'essai du nom sur une ligne, et des légendes qui s'effacent au lieu d'être coupées |
| `essai-ambiance` | **le fond qui respire** : sur chaque page, derrière tout, animé seulement par le compositeur — **zéro Paint** mesuré en trois secondes (un témoin animé à l'ancienne en fait des centaines) ; il glisse avec sa page, se fige sous une feuille, s'arrête net avec « réduire les animations » |
| `essai-nom-complet` | sans navigateur ni serveur (`node essais/essai-nom-complet.mjs`) : l'essai « avec notre nom » compte les syllabes **comme le pipeline** (les 19 608 prénoms redonnent la colonne `y`), le tréma et l'accent ouvrent une syllabe (Amaël Raturat : 6), les verdicts tiennent (hiatus, son répété, rime, longueur, sigle) |
| `essai-recherche` | la loupe du tri ouvre la recherche, curseur dans le champ ; **toucher un prénom le met en première carte** (déjà jugé : on le rejuge, la carte rappelle le vote) ; un prénom sous veto ne se propose pas ; au bout du quota il attend son tour ; Filtres en icône ; le prénom tapé en entier est en tête, un composé se tape avec son tiret ; **Entrée ne choisit rien** (elle range le clavier, le premier résultat prend le focus) ; **les résultats suivent chaque lettre pendant que le clavier Android compose le mot** ; **champ et résultats au-dessus du clavier**, que le navigateur l'annonce comme un iPhone, autrement, ou pas du tout : feuille haute, champ épinglé qui ne bouge pas ; faire défiler range le clavier ; la feuille et la fiche descendent en se fermant |
| `essai-connexion` | **sans mot de passe** : **inscription = prénom + adresse prouvée** (pas de compte avant le code, code faux refusé, lien ou code : une seule preuve ; adresse déjà inscrite : même écran, l'e-mail fait entrer dans le compte existant ; inscriptions en rafale freinées) ; passkey créée puis utilisée (authentificateur virtuel de Chrome), retirée elle n'ouvre plus rien et le trousseau est prévenu ; lien et code par e-mail (code faux, lien à usage unique, adresse inconnue muette, 5 codes faux et le lien meurt) ; adresse prouvée avant d'être enregistrée ; plus de clé d'accès (ni bouton, ni route) ; **déconnecter les autres appareils** ; codes d'invitation longs et essais limités ; requête d'un autre site refusée ; pas de code pour un observateur ; tailles bornées ; en-têtes de sécurité |
| `essai-graphies` | la carte dit « aussi écrit … Voir plus » au lieu de « le vote vaut pour 7 graphies » ; la feuille à onglets (une graphie par onglet, sa part dans l'étiquette, flèches au clavier), la fiche de chaque graphie ; WCAG en clair et en sombre |
| `essai-tempetes` | **les prénoms qui ont été des tempêtes** : une icône d'orage dans la rangée du haut (à la hauteur des autres étiquettes, sans déborder), un bouton nommé pour les lecteurs d'écran ; **la toucher ouvre sa feuille** (ni la fiche, ni un vote) : date, il y a combien d'années, bilan, ce qui a marqué, nom rayé des listes, lien vers la source (nouvel onglet, sans référent) ; les flèches n'y votent pas, Échap rend le focus à l'icône ; la fiche dit la même chose tout en haut ; **à l'oreille** (Eléanore se dit comme la tempête Eleanor, Ugo comme l'ouragan Hugo) ; Martin en a deux, 1999 d'abord ; rien pour Thomas, Raphaël, Louis, Mathis ni Jade ; WCAG en clair et en sombre |
| `essai-reglages` | la carte « Débloquer cette liste » dit sa **portée** (cette liste, ses membres, pas toute l'app) ; débloquée, elle le dit ; thème Clair / Système / Sombre appliqué, retenu, **posé avant le démarrage** (pas de flash), gardé à la déconnexion |
| `essai-historique` | **les textes légaux s'ouvrent dans une feuille** qui monte du bas et redescend en se fermant (conditions depuis la connexion : l'adresse, l'historique et le formulaire ne bougent pas) ; onglets et liens d'un texte à l'autre restent dans la feuille, Échap la ferme ; arrivé par un lien direct, un texte reste une page dont le Retour ramène à l'app ; vers une liste, **la page qui glisse est opaque** ; les onglets d'une liste n'empilent rien |
| `essai-dev` | les outils de la base locale : entrer d'un geste, âge du jeu d'essai, nouvelle journée, quotas à zéro, débloquer / rebloquer sans Stripe, base neuve sans arrêter le serveur |
| `essai-seo` | ce que lisent les moteurs et les IA : page de l'app statique (WebApplication, FAQ) aux limites **lues dans le schéma**, llms.txt au bon domaine, robots.txt qui ferme `/?…` sans écarter les robots d'IA, boutons en nofollow, mentions légales sur chaque fiche, lastmod stable, coquille lisible sans JavaScript ; **navigation** (rubriques, filles ou garçons d'un geste, fiche reliée à ses classements, accueil qui montre chaque classement, origines rangées, lettres voisines) ; **rien ne dépasse à droite à 360 px**, tableaux compris, en-tête sur une ligne ; **sur un téléphone, le grand champ de recherche monte sous l'en-tête** et ses suggestions se lisent au-dessus du clavier (sur un ordinateur la page ne bouge pas) |
| `essai-fluidite` | **l'app ne ralentit pas avec l'usage**, sur une liste semée de 450 + 360 votes : un vote ne fige pas l'écran, autres onglets ouverts ou non ; pendant qu'on trie, rien ne bouge dans le classement (il est en veille) et il est à jour au retour ; « À revoir » s'ouvre sans geler sur des centaines de désaccords, et ses explications sont celles de la règle, au mot près ; les cartes hors écran ne sont pas mises en page ; la tête de pile est celle de l'ordre complet ; le catalogue n'est pas réactif |
| `essai-prenom` | le prénom d'une fiche publique (`?prenom=`) traverse la connexion et la création de liste, et arrive **en première carte, même hors des filtres** ; épinglé jusqu'au jugement ; déjà jugé, en accord ou sous veto, on le dit sans le rejouer ; **le code d'invitation traverse l'inscription, même par le lien de l'e-mail** ; le bouton retour ne boucle pas |
| `essai-portrait` | le portrait parle sur 12 oui et **se tait** sur 5 |
| `essai-revoir` | **« À revoir » en deux volets qui se replient** : en-têtes en motif accordéon (bouton dans un titre, aria-expanded, aria-controls, compte lu « 3 prénoms »), un toucher replie un groupe sans toucher l'autre, replié il quitte la page (rien de tabulable), au clavier aussi ; retenu au rechargement ; l'en-tête reste collé en haut pendant qu'on fait défiler son groupe, et replié de là l'écran remonte au début du groupe ; changer d'avis dans un volet ouvert fait suivre le compte ; WCAG ouvert et replié, clair et sombre |
| `essai-classement` | les désaccords, et le changement d'avis qui fait passer un prénom en commun ; **remettre une famille écartée** d'un geste (le non donné un par un reste) |
| `essai-communs` | **qui a dit quoi** (« Oui à deux » mis en avant, sinon ♥ Paul / ~ vous), **l'ordre rangé au doigt** par la poignée, partagé par les deux parents, tenu au rechargement, aussi au clavier ; un nouvel accord attend à la fin, « nouveau » ; l'observatrice voit l'ordre sans les noms et ne range pas |
| `essai-veto` `essai-carte` `essai-nav` `essai-fond` `essai-glisse` `essai-chargement` `essai-sw` | vetos, carte, navigation, transitions, squelettes, service worker |

## Taper comme un téléphone

`fill()` et `keyboard.type()` tapent comme un clavier d'ordinateur : chaque
lettre est validée aussitôt. Un clavier Android, lui, **compose** le mot en
cours et ne le valide qu'à l'espace, à Entrée ou en se rangeant ; tant qu'il
compose, un `v-model` n'a rien vu. La recherche d'un prénom a vécu ainsi, sa
liste vide tant que le clavier était sorti, tous essais verts.

`composer(page, 'mot')` (navigateur.mjs) tape de cette façon-là, dans le champ
qui a le focus, et rend `valider()`. Un champ auquel l'écran répond pendant
qu'on écrit (une liste qui se filtre, un bouton qui se dégrise) se vérifie
**pendant** la composition : `essai-recherche`, `essai-deja-pris`,
`essai-supprimer-liste`, `essai-rgpd`, `essai-connexion`. Côté app, ces
champs-là passent par `frappe()` (`app/utils/frappe.ts`) et non par `v-model`.

Le clavier qui couvre le bas de l'écran se simule aussi (`CLAVIERS`, dans
`essai-recherche`) : une fausse « vue visible » à la façon d'un iPhone, une
autre où `innerHeight` la suit, et le cas où le navigateur ne dit rien.
`glisser()` fait défiler au doigt.

## Mesurer sur une liste qui a servi

Le jeu d'essai tient en trente votes : ce qui coûte plus cher à chaque prénom
jugé n'y paraît pas. `essai-fluidite` sème 450 votes pour Paul et 360 pour
Alice par l'API avant de mesurer — une carte par prononciation, comme le tri,
avec ses graphies. Pour une mesure de temps ou de mémoire :

- cliquer depuis la page (`page.evaluate`) plutôt que par `getByRole`, qui
  calcule le nom accessible de tous les boutons de la page : des secondes
  sur une longue liste, mises sur le compte de l'app ;
- attendre par `locator().waitFor()` plutôt que `page.waitForSelector()`,
  dont la poignée retient l'élément — et sa page entière — en mémoire : une
  « fuite » de vingt mégaoctets par aller-retour, qui n'existait pas ;
- ralentir le processeur (`Emulation.setCPUThrottlingRate`, 4 pour un
  téléphone moyen) et mesurer le build de production, pas `nuxt dev`.

## Partir avant la réponse du serveur

En local le serveur répond en dix millisecondes : on ne quitte jamais un écran
avant lui. Sur un téléphone, si — et ce qui s'ouvre à la réponse (la fête d'un
accord) s'ouvrait alors dans un onglet qu'on ne regardait plus, inerte, en
figeant toute la page. `essai-fete` retient le vote une seconde et demie
(`page.route`), et change d'écran entre-temps.

Ses gestes sont de vrais touchers aux coordonnées de l'élément
(`page.touchscreen.tap`), pas des `click()` : lancé depuis la page, un
`click()` traverse `inert` et l'essai passerait sur un écran figé ; celui de
Playwright, lui, attend tout son délai avant d'échouer. Et deux boutons
portent la classe `loupe` dans l'en-tête du tri — les filtres, puis la
recherche : viser par le nom (`aria-label`).

## Le jeu d'essai

Tout repose sur la semence de `server/utils/semence.ts`, et ses cas limites
sont délibérés : Paul a exactement **12 oui** (le seuil du portrait) et Alice
**5 visibles** (sous le seuil) ; Alice a dit non à **Ferdinand** que Paul n'a
jamais jugé (le seul cas qui prouve qu'un refus n'est pas annoncé) ; Mamie
observe et dit non à **Louise**, qui doit rester un accord ; **Fantome**,
inactif depuis 25 mois et seul sur sa liste, est ce que la purge doit effacer —
et lui seul. Changer ces chiffres casse les essais — c'est voulu.
