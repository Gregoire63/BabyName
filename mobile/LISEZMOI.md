# babyNamed — l'app des stores (iOS, Android)

Le site, dans une coquille. L'app affiche https://babynamed.fr dans une vue web
et lui prête ce qu'un navigateur n'a pas : les notifications, la feuille de
partage, le vibreur, le bouton « Retour » d'Android. Elle n'a **aucun écran à
elle** (sauf « Pas de connexion ») : les écrans, les textes et les règles
vivent dans le site, dossier `app/` du dépôt. Une mise en ligne du site vaut
pour le web et pour les deux apps ; on ne repasse par les stores que pour
changer ce dossier-ci.

**Ce qui s'y vend, et par qui.** Apple et Google prennent une commission sur
ce qui s'achète dans une app et sur ce vers quoi elle envoie.

- **iPhone** : une liste se débloque par l'**achat intégré de l'App Store**, et
  par lui seul (`src/achats.ts`, plus bas « L'achat intégré »). Apple encaisse,
  au prix réglé dans App Store Connect. Le site et son prix n'y sont jamais
  nommés, les cadeaux et les codes cadeaux n'y existent pas.
- **Android** : rien ne se vend, et rien n'y mène. Le mur du quota dit où cela
  se débloque, d'une phrase sans lien.

Dans les deux, le serveur refuse la caisse du site (Stripe), l'achat d'un
cadeau et l'usage d'un code venus d'une app (`app/shared/utils/coquille.ts`,
`app/server/utils/vente.ts`, `essai-coquille`, `essai-apple`). Une liste
débloquée, où que ce soit, l'est partout. Le détail des règles des stores :
`claude/apps-mobiles.md` (doc du projet).

## Où en est ce dossier

| Vérifié ici | Comment |
|---|---|
| Les types | `npm run typer` |
| La logique : navigation, pont, liens, notifications, panne, « Retour », page tuée par le téléphone, achat intégré | `npm run essais` (83 essais ; la vue web est une doublure qui exécute pour de bon les scripts qu'on lui injecte, StoreKit une doublure qu'on règle essai par essai) |
| Que ces essais voient quelque chose | chaque garde sabotée tour à tour : 28 dans `Coquille.tsx`, 38 dans l'achat intégré (`achats.ts`, ses verbes dans `Coquille.tsx` et `pont.ts`) — toutes repérées |
| La configuration : `app.json`, les greffons, les deux projets natifs fabriqués | `npx expo prebuild --no-install` |
| Le JavaScript s'empaquette pour les deux plateformes | `npx expo export` |
| L'app Android n'embarque rien de l'achat | `npx expo-modules-autolinking resolve --platform android` ne liste pas `expo-iap` ; aucun de ses fichiers dans le bundle Android (lu dans sa carte des sources) |
| `eas.json` | lu par l'analyseur d'EAS |

**Jamais compilé, jamais lancé sur un téléphone.** La machine qui a écrit ce
dossier n'a ni Xcode, ni le SDK Android. La première construction (EAS) et le
premier essai sur appareil sont à faire — la liste de ce qu'il faut regarder
est plus bas, et c'est là que se verront les vrais défauts. **L'achat intégré
surtout** : la feuille d'Apple, StoreKit et le bac à sable n'existent que sur
un iPhone. Ici, seul le chemin autour d'eux est éprouvé — ce que le natif
demande à StoreKit et ce qu'il fait de ses réponses, la page, le serveur
contre un faux Apple (`essai-apple`).

## Le dossier

```
app.json          tout ce qui est fixe : nom, identifiants, icônes, liens, greffons
app.config.ts     ce qui dépend de la machine : le fichier de Firebase
eas.json          les constructions : preview (à installer à la main), production (stores)
App.tsx, index.ts l'entrée
src/
  Coquille.tsx    la vue web, et tout ce qui l'entoure
  navigation.ts   ce qui s'affiche dans l'app, ce qui part dans le navigateur
  pont.ts         les messages entre la page et le natif — LA liste des verbes
  notifications.ts permission, jeton, notification touchée
  achats.ts       l'achat intégré de l'App Store (iPhone seulement)
  Panne.tsx       « Pas de connexion »
  site.ts         l'adresse du site, l'agent utilisateur
tests/            les essais (jest)
assets/           icônes et écran de démarrage (tirés de app/public/icone-maskable-512.png)
```

## Commandes

```sh
npm install
npm run verifier        # types + essais : à lancer avant toute construction
npx expo-doctor         # la santé du projet (deux de ses contrôles demandent le réseau)
npx expo start          # Expo Go : un premier coup d'œil, sans rien construire
```

**Expo Go** (l'app d'essai d'Expo, celle qu'ouvre `npx expo start`) montre le
site dans la vue web, le pont, le bouton « Retour ». Il n'a **ni
notifications, ni liens qui ouvrent l'app, ni achat intégré** : la carte
« Notifications » des réglages n'y apparaît donc pas, pas plus que l'offre
« Débloquer cette liste » sur iPhone, et c'est normal. Pour le reste, une vraie
construction (plus bas) — le profil `preview` suffit, et sa vue web s'inspecte
depuis un ordinateur (`chrome://inspect` pour Android).

**Les alertes de `npm install`** (« 60 vulnerabilities ») : quatre avis, que
npm compte une fois par paquet qui en dépend de près ou de loin — `braces`
et `sprintf-js` (sous jest, les essais), `uuid` (sous l'outil qui fabrique le
projet Xcode), `node-forge` (sous la ligne de commande d'Expo). Des outils de
la machine de développement : **aucun n'est dans l'app** (vérifié sur la
liste des fichiers des deux bundles), et trois des quatre n'ont pas de
version corrigée publiée. Ne **pas** lancer `npm audit fix --force` : la
« correction » qu'il propose ramène Expo à la version 44.

## Première mise en route

Dans l'ordre. Les comptes développeur Apple et Google existent déjà.

1. **Le projet Expo.** `npx eas-cli login`, puis `npx eas-cli init` : il crée
   le projet et écrit son identifiant dans `app.json` (`extra.eas.projectId`).
   À committer. Sans lui, pas de notifications (l'app marche, sans prévenir).

2. **Android : Firebase**, pour les notifications.
   - console.firebase.google.com → un projet → ajouter une app Android,
     paquet `fr.babynamed.app` → télécharger `google-services.json`.
   - Le donner à EAS, sans le committer (le dépôt est public) :
     `npx eas-cli env:set --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment production --environment preview`
   - La clé d'envoi : Firebase → Paramètres du projet → Comptes de service →
     « Générer une nouvelle clé privée », puis `npx eas-cli credentials` →
     Android → Google Service Account → clé FCM V1 → téléverser ce fichier.

3. **Construire.**
   - Android, à installer à la main : `npx eas-cli build -p android --profile preview` (un .apk).
   - iOS : `npx eas-cli build -p ios --profile production`, puis
     `npx eas-cli submit -p ios` → TestFlight. EAS se connecte au compte Apple
     et crée ce qu'il faut : l'identifiant d'app (avec les notifications et
     les domaines associés), le certificat, la clé des notifications.
   - Les deux pour les stores : `npx eas-cli build -p all --profile production`.

4. **Relier le site aux apps** — c'est ce qui fait qu'une invitation ou un
   lien de connexion ouvre l'app. Deux variables du Worker, déjà en attente
   dans `app/wrangler.jsonc` (`vars`, en commentaire ; rien de secret) :
   - `NUXT_APPLE_APP_ID` : `<identifiant d'équipe Apple>.fr.babynamed.app`
     (l'équipe : developer.apple.com → Membership, dix caractères) ;
   - `NUXT_ANDROID_EMPREINTES` : les empreintes SHA-256 du certificat de
     signature, séparées par une virgule — celle de Google Play (Play Console →
     Intégrité de l'app → Signature d'application) ET celle de la clé d'envoi
     (`npx eas-cli credentials` → Android) ;
   - vérifier : https://babynamed.fr/.well-known/apple-app-site-association et
     https://babynamed.fr/.well-known/assetlinks.json répondent (404 tant que
     les variables manquent) ;
   - **l'ordre compte** : un téléphone lit ces fichiers quand il INSTALLE
     l'app, pas quand on touche un lien. Les variables d'abord (celle d'Apple
     se connaît avant toute construction ; celles d'Android après la
     première), le site en ligne, les deux adresses qui répondent — et
     seulement ensuite l'installation. Une app installée trop tôt : la
     désinstaller, la réinstaller. Attendre ne suffit pas : sur iPhone, Apple
     garde sa propre copie du fichier, sans moyen de la purger, et le
     téléphone ne la relit qu'une fois par semaine environ ; Android 14 et
     avant ne relisent qu'à l'installation ou à une mise à jour, Android 15
     sous sept jours.

5. **Le compte de démonstration**, que les deux stores demandent pour valider :
   `NUXT_DEMO_EMAIL` (une adresse impossible, en `.test` : `demo@babynamed.test`)
   dans `vars`, et `NUXT_DEMO_CODE` (six chiffres) en **secret** du Worker
   (`npx wrangler secret put NUXT_DEMO_CODE`). On s'en sert comme d'un compte :
   l'adresse dans « Connexion », puis le code à la place de celui de l'e-mail.

6. **L'achat intégré (iPhone).** Tant que ces étapes ne sont pas toutes
   faites, l'app iPhone ne propose simplement rien — elle ne casse pas.
   - **Les accords.** App Store Connect, rubrique des accords (« Business »,
     l'ancienne « Accords, informations fiscales et bancaires ») : accepter
     l'accord des apps payantes, remplir coordonnées bancaires et fiscalité.
     Sans lui, StoreKit ne connaît aucun produit.
   - **La commission.** S'inscrire au Small Business Program
     (developer.apple.com/app-store/small-business-program) : 15 % au lieu du
     taux normal. Tôt : le taux réduit ne s'applique que quinze jours après la
     fin du mois fiscal de l'acceptation, et ne rattrape pas ce qui a été
     vendu avant.
   - **Le produit.** App Store Connect → l'app → Achats intégrés → « + » →
     **Consommable** (il se rachète pour chaque liste), identifiant
     `fr.babynamed.app.deblocage` — celui que le site nomme
     (`NUXT_PUBLIC_APPLE_PRODUIT`), à la lettre près. Un prix, un nom affiché
     et une description en français, une capture de la feuille « Débloquer »
     pour la validation. La première fois, le produit se soumet AVEC une
     version de l'app (fiche de la version → « Achats intégrés »).
   - **La clé du serveur.** App Store Connect → Utilisateurs et accès →
     Intégrations → Achats intégrés → générer une clé. Le fichier `.p8` ne se
     télécharge qu'une fois ; ne pas le committer (`.gitignore` le refuse).
     `npx wrangler secret put NUXT_APPLE_IAP_CLE` (y coller le contenu du
     fichier), puis dans `app/wrangler.jsonc` : `NUXT_APPLE_IAP_CLE_ID`
     (l'identifiant de la clé) et `NUXT_APPLE_IAP_EMETTEUR` (« Issuer ID »,
     affiché avec les clés — sur l'onglet « App Store Connect API » s'il
     manque sur celui des achats intégrés). Vérifier :
     https://babynamed.fr/api/achats-apple/etat répond `"ouvert": true` — le
     serveur vient alors de présenter la clé à Apple, qui l'a acceptée. S'il
     répond `false` : `npx wrangler tail` (dans `app/`), recharger l'adresse,
     et lire la ligne « [apple] » — une clé mal collée, un identifiant faux,
     un 401 d'Apple.
   - **Le courrier d'Apple.** App Store Connect → l'app → Informations sur
     l'app → Notifications du serveur App Store : la même adresse pour la
     production et pour le bac à sable,
     `https://babynamed.fr/api/apple/notifications`, version 2. C'est par là
     qu'un remboursement accordé par Apple re-verrouille la liste.
   - **Essayer** : TestFlight (les achats y sont gratuits, et vont au bac à
     sable), ou un testeur « Sandbox » (Utilisateurs et accès → Sandbox). Une
     liste débloquée ainsi est notée « offerte », pas vendue.
   - **Pour la validation**, dans les notes à l'équipe d'Apple : où est
     l'achat (une liste → Réglages → « Débloquer cette liste »), et pourquoi
     il n'y a pas de bouton « Restaurer les achats » — l'achat est consommable,
     et ce qu'il débloque est rattaché au compte babyNamed : il se retrouve en
     se connectant, sur n'importe quel appareil.

## À regarder sur un vrai téléphone

Ce que les essais d'ici ne peuvent pas dire. Sur iPhone ET sur Android :

- **Ouverture** : l'écran de démarrage, puis le site, sans page blanche entre
  les deux ; en avion : « Pas de connexion », et « Réessayer » repart.
- **Bords** : rien sous l'encoche ni sous la barre du bas, et pas de marge en
  double non plus (le natif écarte déjà la page des bords : si le site
  s'écartait encore de lui-même, on verrait un vide en haut) ; la barre d'état
  lisible en clair et en sombre (régler « Sombre » dans l'app), et le réglage
  « Système » suit bien le téléphone quand on le bascule en sombre.
- **Après une longue veille** : laisser l'app ouverte derrière d'autres, une
  nuit — ou, sur Android, Options pour les développeurs → « Ne pas conserver
  les activités ». Y revenir : le site, pas un écran blanc. Puis la même
  chose en touchant une notification : on arrive aux accords. C'est le cas
  que le téléphone ne signale pas toujours (plus bas, « La page écoute-t-elle ? »).
- **Clavier** : une feuille avec un champ (« Rejoindre une liste », la
  recherche) reste au-dessus du clavier — **surtout sur Android**, où c'est
  l'app qui lui fait de la place (`KeyboardAvoidingView`, `Coquille.tsx`).
- **Connexion** : par code ; fermer l'app d'un geste juste après, la rouvrir :
  toujours connecté (Android recharge la page exprès pour cela). Sur iPhone,
  créer puis utiliser une passkey.
- **Liens** : une invitation (`/rejoindre/…`) touchée dans un message ouvre
  l'app, dans la liste ; le lien de connexion demandé depuis l'app ouvre
  l'app ; celui demandé depuis Safari ou Chrome reste dans le navigateur.
  Pour savoir si l'iPhone a bien relié le site à l'app : coller une
  invitation dans Notes, appui long — « Ouvrir dans babyNamed » doit être
  proposé. Sur Android : `adb shell pm get-app-links fr.babynamed.app` doit
  dire `verified` pour babynamed.fr.
- **Notifications** : « Me prévenir d'un nouvel accord » pose la question du
  téléphone ; un accord fait depuis un autre compte arrive, app ouverte et app
  fermée ; la toucher mène aux accords.
- **Android, « Retour »** : ferme la feuille ouverte, puis revient à l'accueil,
  puis sort de l'app.
- **Partage** : « Partager le lien » ouvre la feuille du téléphone ;
  « Télécharger mes données » propose d'enregistrer le fichier.
- **Android, rien à vendre** : sur une liste gratuite, aucun écran ne parle
  d'acheter ; le mur du quota dit « Swipes illimités : sur le site
  babynamed.fr. », sans lien.
- **iPhone, l'achat** (bac à sable ou TestFlight), sur une liste gratuite :
  - l'offre apparaît dans les réglages de la liste, au prix d'App Store
    Connect ; nulle part le prix du site, ni le site, ni un code cadeau ;
  - acheter : la feuille d'Apple, puis « C'est débloqué », sans rien toucher ;
    l'autre membre de la liste la voit débloquée ;
  - refermer la feuille d'Apple : rien, le bouton est de nouveau là ;
  - **le cas qui compte** : payer, et passer en mode avion AVANT « C'est
    débloqué » (ou tuer l'app). L'écran dit que la confirmation tarde.
    Remettre le réseau, rouvrir l'app : la liste se débloque seule, et Apple ne
    redemande rien ;
  - une seconde liste se rachète (c'est un consommable) ;
  - pour aller plus loin, un achat qui n'aboutit pas du premier coup :
    App Store Connect → Sandbox → le testeur → « Interrompre les achats ».
    L'achat échoue, l'iPhone fait accepter des conditions, puis la
    transaction arrive d'elle-même : la liste doit se débloquer sans qu'on
    rachète (c'est le chemin d'un achat validé plus tard par un tiers) ;
  - les conditions de vente, ouvertes depuis la feuille « Débloquer » : elles
    parlent de l'App Store, pas du site.
  Le remboursement ne s'essaie pas simplement sur un téléphone : il est
  éprouvé contre un faux Apple (`essai-apple`), et se lira au premier vrai
  dans le journal du Worker (`[apple] achat remboursé`).
- **Dehors** : un lien des mentions légales vers un autre site s'ouvre dans le
  navigateur, pas dans l'app.

## Le pont

La liste des verbes est dans `src/pont.ts`, et la même côté site dans
`app/app/composables/useCoquille.ts` : à garder identiques. Un verbe inconnu
est ignoré des deux côtés, on peut donc en ajouter sans casser les apps déjà
installées — le site d'abord, l'app ensuite.

| La page dit | Le natif |
|---|---|
| `pret`, `theme` `{ sombre, fond, bords? }` | retire l'écran de démarrage ; colore la barre d'état |
| `push.etat`, `push.demander` | répond `{ ok, permission, jeton? }` |
| `partager` `{ titre, texte, url }` | la feuille de partage ; répond `{ ok }` |
| `fichier` `{ nom, mime, texte }` | l'écrit, le propose à l'enregistrement ; répond `{ ok }` |
| `vibrer` `{ genre }` | le vibreur |
| `reglages` | les réglages du téléphone pour l'app |
| `quitter` | sort de l'app (Android) |
| `achat.produit` `{ produit }` | iPhone : le prix d'Apple ; répond `{ ok, prix }` |
| `achat.acheter` `{ produit, jeton }` | iPhone : la feuille d'achat ; répond `{ ok, etat, transaction? }` — `achete`, `annule`, `attente` (un accord à donner), `erreur` |
| `achat.attente` | iPhone : les transactions payées et pas encore finies, avec leur date ; répond `{ ok, transactions }` |
| `achat.finir` `{ transaction }` | iPhone : le site l'a traitée, StoreKit peut l'oublier ; répond `{ ok }` |

Sur Android et dans Expo Go, les quatre verbes d'achat répondent `{ ok: false }`.

| Le natif dit | Quand |
|---|---|
| `lien` `{ url }` | un lien a ouvert l'app, une notification a été touchée |
| `actif` | l'app revient au premier plan |
| `retour` | le bouton « Retour » d'Android |
| `achat.arrivee` | iPhone : une transaction vient d'arriver d'elle-même (un achat validé plus tard par un tiers) |

### La page écoute-t-elle ?

Le natif ne voit pas la page. Elle peut être en train de se charger ; le
téléphone peut avoir tué son processus pendant que l'app dormait, sans
toujours le dire. Un message remis à une page absente est perdu, sans erreur
nulle part — une notification touchée qui ne mène à rien, un bouton « Retour »
qui ne fait rien, un écran blanc au réveil.

Chaque message du natif revient donc avec un **accusé de réception**
(`accuse`), posté par le script même qui le remet (`scriptPour`, `src/pont.ts`)
— le site n'a rien à faire pour cela. Trois réponses possibles :

| L'accusé | Ce que fait le natif |
|---|---|
| « entendu » | rien : la page s'en occupe |
| « personne n'écoute » (le document est là, le site n'y a pas démarré) | un lien : il le charge ; « Retour » : il recule dans l'historique, ou sort de l'app |
| rien pendant quatre secondes, app à l'écran | la page n'est plus là : une vue web neuve, vers le lien en attente, sinon là où l'on était |

Aucun signal de chargement de la vue web ne sert à cela, et c'est voulu : sur
Android, son « début de chargement » sonne aussi à chaque changement d'écran
du site (qui n'est pas un chargement).

Le site reconnaît l'app à son agent utilisateur : `… babyNamedApp/1.0.0 (ios)`
(`src/site.ts`). À ne pas changer de forme.

`bords: 'page'` n'est pas encore envoyé par le site. Aujourd'hui le natif
tient la page entre la barre d'état et le bas de l'écran, sur une bande de la
couleur du fond. Le jour où le site saura passer dessous lui-même (le fond
dégradé continuerait derrière l'heure), il lui suffira de le dire — sans
nouvelle version des apps.

## L'achat intégré (iPhone)

Trois acteurs, et aucun ne croit l'autre sur parole.

- **Le serveur du site** tire un jeton (un UUID) pour la liste à débloquer,
  puis relit lui-même chez Apple chaque transaction qu'on lui présente
  (`app/server/utils/apple.ts`). C'est lui qui décide de ce qui est payé.
- **Le natif** (`src/achats.ts`) ouvre la feuille d'achat d'Apple avec ce jeton
  (`appAccountToken` : Apple le rend dans la transaction signée), et rend la
  transaction à la page.
- **La page** (`app/app/composables/useAchatApple.ts`) passe les plats : elle
  porte la transaction au serveur, et dit au natif quand elle est traitée.

**Le natif ne finit jamais une transaction de lui-même.** Tant qu'elle n'est
pas finie, StoreKit la garde et la représente à chaque lancement : c'est ce
qui rattrape l'app fermée entre le paiement et le déblocage. La page ne dit
« finir » qu'après la réponse du serveur.

**Rien de cela sur Android.** `package.json` (`expo.autolinking.android.exclude`)
écarte `expo-iap` de l'app Android : ni la bibliothèque de facturation de
Google, ni sa permission (`com.android.vending.BILLING`, que le module
déclarerait). Le code lui-même n'y est pas : `src/achats.ts` ne charge le
module que si `Platform.OS === 'ios'`, et l'empaqueteur retire la branche
morte du bundle Android. Ne pas séparer ce test du `require` qui le suit.

**Pas de greffon `expo-iap` dans `app.json`**, exprès. Sur iOS il n'ajoute au
Podfile que la source de CocoaPods, qui est déjà celle par défaut ; sur
Android il réécrit des fichiers Gradle pour un module que l'app n'embarque
pas. Si une construction iOS ne trouvait pas le pod `openiap`, l'ajouter
(`"plugins": [..., "expo-iap"]`) serait la première chose à essayer.

La version d'`expo-iap` est fixée (5.8.2), sans `~` ni `^` : c'est le chemin
de l'argent. Avant de la monter, relire dans ses sources ce que rend
`requestPurchase` sur iOS (aujourd'hui : la transaction en cas d'achat, une
erreur `user-cancelled` ou `deferred-payment` sinon), puis `npm run verifier`.

## Les liens

L'app n'ouvre elle-même que deux adresses de babynamed.fr : `/rejoindre/<code>`
(une invitation) et `/connexion/app` (le lien de connexion demandé depuis
l'app). Tout le reste s'ouvre dans le navigateur, app installée ou non — les
pages publiques, un lien cadeau, le retour d'un paiement fait sur le site. Les déclarer : `app.json` (`associatedDomains`,
`intentFilters`) ET `app/server/routes/.well-known/`. Les deux listes doivent
dire la même chose.

## Ce que l'app garde sur le téléphone

Rien à elle : la session (un cookie), le thème et le choix des notifications
sont ceux du site, gardés par la vue web. Sur Android, ces données ne partent
pas dans la sauvegarde Google du téléphone (`allowBackup: false`, `app.json`) :
une session n'a pas à réapparaître sur un autre appareil sans qu'on s'y soit
connecté. Un téléphone restauré redemande donc de se connecter.

## Publier une nouvelle version

Seulement quand ce dossier change. `version` dans `app.json` (le numéro de
construction, lui, monte tout seul), `npm run verifier`, puis
`npx eas-cli build -p all --profile production --auto-submit`.

## Un site d'essai

L'app affiche babynamed.fr. Pour une construction qui affiche autre chose (un
déploiement de test) : `EXPO_PUBLIC_SITE=https://… npx eas-cli build --profile preview`.
Les liens universels, eux, ne valent que pour babynamed.fr.

## Les images

`assets/` vient de `app/public/icone-maskable-512.png`, redessiné en 1024 px
(le dégradé recalculé, le monogramme raffermi). Si l'original du logo existe
en grand ou en vectoriel, le mettre à la place : mêmes noms, mêmes tailles.
