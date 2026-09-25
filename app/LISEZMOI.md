# babyNames — développement local

## Démarrer

```bash
npm install
npm run dev
```

Et c'est tout. Pas de `.env`, pas de Docker, pas de Neon.

Au premier lancement, l'app crée une base Postgres locale dans `.data/`,
y applique `server/assets/schema.sql`, et la remplit avec deux comptes et
une liste déjà entamée. Le terminal affiche alors :

```
  Base de developpement semee (Postgres embarque, dossier .data/).
  Liste « Notre liste », code d'invitation dec0de00.
  Cle de Greg   : DEVG-REGX-2345
  Cle d'Audrey  : DEVA-DREY-2345
  Cle de Mamie  : DEVM-AMIE-2345 (observatrice, code ob5e0bad)
```

Sur <http://localhost:3000/connexion>, le bloc **Base locale — entrer comme**
connecte d'un geste Greg, Audrey ou Mamie (en développement seulement).
Ouvrez Audrey dans une fenêtre privée : le vote aveugle se teste à deux, sur
la même base.

Aux lancements suivants, le terminal rappelle l'âge du jeu d'essai et les
clés — et signale un jeu **périmé** : on ne sème qu'une base vide, donc une
base semée avant un changement de `server/utils/semence.ts` garde l'ancien jeu
(monter `VERSION_SEMENCE` à chaque changement de ce fichier).

### Gérer la base locale sans arrêter le serveur

**Mon compte → Outils de développement** (accueil, sous votre nom) :

| Geste | Effet |
|---|---|
| Base neuve | vide toutes les tables et ressème le jeu d'essai du jour ; on repart de la connexion |
| Nouvelle journée | efface les compteurs du jour : le filet quotidien revient, comme demain matin |
| Quotas à zéro | départ et jour à zéro, pour tout le monde |
| Débloquer / Rebloquer | passe une liste en payée (« offerte ») ou la rend gratuite, sans Stripe |

La feuille « Débloquer cette liste » a aussi, en dev, **Débloquer sans payer**.

Ces gestes passent par `/api/dev/base`, qui répond **404 en production** et
**403 si le serveur de dev parle à une base distante** (un `vercel env pull`,
un `NUXT_DATABASE_URL` oublié) : « Base neuve » ne peut pas vider Neon.

`npm run dev:neuf` fait la même chose que « Base neuve », serveur arrêté.

## Ce qu'il y a dans le jeu d'essai

| | |
|---|---|
| Greg | 27 votes, 2 gardés (Alma, Nine), une famille écartée d'un geste (`kevi`) et des non un par un |
| Audrey | 19 votes, un veto sur Jayden, un commentaire sur Louise |
| Mamie | **observatrice** : 6 votes, dont un **non à Louise**, qui reste un accord |
| en commun | 9 prénoms, plus des désaccords francs (Marius, Hector : Greg oui, Audrey non) pour remplir « À revoir » |
| listes | « Notre liste » débloquée (code `dec0de00`), « Essai gratuit » et « Autre essai » au quota 3/jour pour taper dans le mur en trois swipes |
| écrans | Accueil · Swipe · Classement (Communs · À revoir · Mes choix · Portrait) · La liste |

Greg a exactement **12 oui**, soit le seuil du portrait de goûts, et Audrey
n'en a que 5 de visibles pour lui : c'est ce qui permet de vérifier que le
portrait parle d'un côté et **se tait** de l'autre au lieu d'inventer.

`Kevin` est volontairement jugé « non » **avant** le balayage de sa famille :
c'est le cas limite qui vérifie qu'un choix individuel survit à la remise en
jeu d'une famille.

## Les essais

`essais/` contient vingt-sept essais de bout en bout — vrai navigateur, vrai
serveur, vraie base — soit près de 500 assertions. Ils ne testent pas des
fonctions, ils testent des promesses : « le refus ne se dit jamais », « un
observateur ne casse pas un accord », « aucun champ de carte bancaire dans
l'app », « effacer son compte n'efface pas celui de l'autre », « chaque écran
passe les critères WCAG AA ».

```bash
npm i -D playwright axe-core && npx playwright install chromium
sh essais/relance.sh essais/essai-paiement.mjs
```

`essais/LISEZMOI.md` dit ce que chacun garde, et pourquoi les chiffres de la
semence (12 oui pour Greg, 5 visibles pour Audrey) ne se changent pas à la
légère.

## Si le dev refuse de démarrer

Symptômes : `Failed to fetch dynamically imported module .../pages/index.vue`,
et des `.vue` servis en `text/css`. C'est un **service worker** resté installé
sur `localhost:3000` — typiquement après un `npm run preview`, qui sert la
version construite sur le même port que `npm run dev`.

Le worker met en cache-d'abord tout `/_nuxt/`. En production ce sont des noms
hachés, donc immuables ; en dev c'est l'espace de modules de Vite. Il servait
du vieux, Vite recevait n'importe quoi, et l'app ne démarrait plus.

Depuis, le plugin PWA ne s'enregistre plus en dev et désinstalle ce qui
traîne, et `sw.js` exige une vraie empreinte dans le nom de fichier. Si vous
tombez sur un navigateur encore dans l'ancien état, collez ceci dans la
console de `localhost:3000` :

```js
navigator.serviceWorker.getRegistrations()
  .then(rs => Promise.all(rs.map(r => r.unregister())))
  .then(() => caches.keys())
  .then(ks => Promise.all(ks.map(k => caches.delete(k))))
  .then(() => location.reload())
```

## Pourquoi un Postgres embarqué

Neon n'est joignable ni depuis la machine de dev ni depuis un connecteur, et
un faux serveur d'API qui renvoie des données inventées ment sur le SQL —
c'est comme ça qu'une colonne mal nommée (`v.cree_le` au lieu de `v.vote_le`)
est partie en production sans que rien ne la rattrape.

`@electric-sql/pglite`, c'est le vrai Postgres compilé en WebAssembly : mêmes
types, mêmes vues, mêmes déclencheurs plpgsql, mêmes messages d'erreur. Une
requête qui passe en local passe sur Neon, et une qui casse casse ici d'abord.

Le choix se fait dans `server/utils/db.ts` :

1. une variable d'environnement `…DATABASE_URL` / `…POSTGRES_URL` → Postgres distant ;
2. sinon, en développement → la base embarquée ;
3. sinon → erreur.

La branche embarquée est derrière `import.meta.dev`, remplacé par `false` à la
compilation : elle n'existe pas dans le bundle de production.

## Travailler sur la vraie base

Pour reproduire un problème avec les données réelles, il faut l'URL Neon :

```bash
npx vercel link            # une fois
npx vercel env pull .env   # écrit NUXT_DATABASE_URL et NUXT_SESSION_SECRET
npm run dev
```

Dès que `.env` contient une URL, la base embarquée n'est plus utilisée.
**Attention : vous écrivez alors dans la base de production.** Pour éviter ça,
créez une branche dans Neon et utilisez son URL.

## Déploiement

Vercel déploie à chaque `git push` sur `main`, à condition que le dépôt soit
connecté au projet : **Vercel → babyname → Settings → Git → Connect Git
Repository → GitHub → Gregoire63/BabyName**, branche de production `main`.
Sans cette connexion, l'app se déploie mais aucun push ne la met à jour.

`vercel.json` n'autorise que `main` :

```json
{ "git": { "deploymentEnabled": { "main": true, "*": false } } }
```

Ce n'est pas de la coquetterie. Les variables Neon visent `preview` autant que
`production` : sans cette règle, une branche poussée pour essayer quelque chose
déploie une preview qui écrit dans **la base de production**. Pour retrouver
les previews proprement, il faut d'abord donner aux previews leur propre
branche Neon, puis remettre la branche voulue à `true` ici.

Réglages du projet, pour mémoire :

| | |
|---|---|
| Framework | Nuxt.js (détecté) |
| Root directory | racine du dépôt |
| Build / Install | par défaut |
| Node | 22.x |
| Région | cdg1 (Paris) |
| Branche de production | `main` |

Variables d'environnement en production : les `NEON_DATABASE_*` posées par
l'intégration Neon, et `NUXT_SESSION_SECRET`. L'app ne cherche pas un nom
précis : `server/utils/db.ts` prend la première variable qui finit par
`DATABASE_URL` ou `POSTGRES_URL`, en préférant les poolées.

## Référencement : moteurs et IA

`npm run build` lance `scripts/seo.mjs` **avant** `nuxt build`. Il écrit dans
`public/` (ignoré par git, régénéré à chaque déploiement) :

| Sortie | Rôle |
|---|---|
| `prenom/<slug>/` | une fiche statique par prénom : sens (avec sa certitude), origine, courbe INSEE, graphies, proches — 7 438 pages, dont les 857 sans sens ni origine en `noindex` et hors sitemap (constante `mince`) |
| `prenoms/…` | le portail, les listes (tendances, rares, populaires, origines, lettres) |
| `choisir-un-prenom-a-deux/` | **la page de l'application** : fonctionnement, gratuit / payant, données, FAQ ; `WebApplication` + `FAQPage` en JSON-LD |
| `sitemap.xml`, `robots.txt`, `llms.txt` | pour les robots |

Pourquoi une page de l'application à part : `/` est l'app, une coquille
JavaScript. Google l'exécute ; la plupart des robots d'IA (GPTBot, ClaudeBot,
PerplexityBot) non — ils n'y voyaient rien. La coquille porte maintenant une
description et un `<noscript>` qui renvoie vers cette page.

Règles tenues par le script, et vérifiées par `essai-seo` :

- **Domaine** : `NUXT_PUBLIC_SITE_URL`, sinon celui de production que Vercel
  injecte au build. Canoniques, sitemap et llms.txt en dépendent.
- **robots.txt** ferme `/?…` : les boutons des fiches mènent à l'app avec
  `?prenom=` — 7 000 variantes de la même coquille, en `nofollow` aussi. Aucun
  robot d'IA n'est écarté.
- **lastmod** du sitemap = la constante `MAJ`, pas la date du build : un
  lastmod qui change à chaque push est vite ignoré. À monter quand les données
  ou les gabarits changent.
- **Limites du gratuit** lues dans `schema.sql`, prix dans
  `NUXT_PUBLIC_PRIX_LISTE` : la page de l'app et llms.txt ne peuvent pas
  annoncer autre chose que ce que fait l'app.
- **llms.txt** (llmstxt.org) : un résumé Markdown pour les assistants qui le
  cherchent. Aucun grand moteur ne s'engage à le lire ; ce qui compte pour
  être cité par une IA, c'est une page lisible sans JavaScript, des robots
  non bloqués, l'index de Bing (qui nourrit ChatGPT et Copilot), et des
  mentions de l'app ailleurs sur le web.

`npm run seo` régénère en local ; `SEO_SORTIE=/tmp/seo npm run seo` écrit
ailleurs, pour relire sans toucher `public/`.

Après le premier déploiement :

1. **Google Search Console** : propriété « préfixe d'URL »
   `https://babyname-five.vercel.app/` (une propriété « domaine » est
   impossible sur `vercel.app`), vérification par balise HTML, puis soumettre
   `/sitemap.xml`.
2. **Bing Webmaster Tools** : importer depuis Search Console. C'est l'index
   de ChatGPT (recherche) et de Copilot.
3. **Vercel → Firewall → Bot Management** : vérifier que « AI Bots » n'est
   pas en blocage.

Un domaine à soi, si un jour : le poser **avant** de soumettre à Search
Console. Après, il faut des 301 depuis `vercel.app`, un « changement
d'adresse » dans Search Console, `NUXT_PUBLIC_SITE_URL`, et l'URL du webhook
et des pages légales chez Stripe.

## Le payant

Une liste se débloque **une fois, pour tout le monde dessus**. Ce n'est pas un
abonnement et ce n'est pas un compte : deux parents sur la même liste paient
une fois à deux, et l'un des deux peut payer pour l'autre. Prix par défaut
`6 €`, affiché depuis `NUXT_PUBLIC_PRIX_LISTE`.

| Gratuit | Débloqué |
|---|---|
| les 19 608 prénoms, la recherche, les filtres | le tri sans plafond |
| les accords, le classement, les vetos | l'essai avec le nom de famille |
| origine, sens et courbe sur chaque fiche | la projection de classe complète |
| le deuxième parent | le portrait de goûts et la divergence |
| le volet « À revoir » | ce qui cause chaque désaccord |
| 150 prénoms au départ, puis 15/jour, sans fin (par personne) | les observateurs (grands-parents sans veto) |

### Le quota : un départ large, puis un filet

Il était de 20 prénoms par jour : deux minutes de tri, et le mur tombait
pendant la première soirée, **avant le premier accord**. Si chacun dit oui à
15-20 % des prénoms, entre un tiers et la moitié des couples n'avaient encore
aucun accord à ce moment-là — on faisait payer avant d'avoir rendu service,
au moment où l'envie de continuer était la plus forte.

| | Défaut | Colonne (par liste) |
|---|---|---|
| Départ, par personne (toutes ses listes gratuites) | 150 | `quota_depart` |
| Départ, par liste (tous membres) | 300 | `quota_depart_liste` |
| Filet quotidien, une fois le départ épuisé | 15 | `quota_par_jour` |

- Le mur tombe à la deuxième ou troisième soirée, accords à l'écran — et dit
  que demain ça repart : un mur définitif se quitte, il ne s'achète pas.
- Le départ par **liste** ferme la porte aux comptes jetables : sans e-mail,
  un compte se crée en trois secondes, et chaque compte invité rapportait
  150 prénoms.
- Pas de « quota total » sec : ceux qui ne paient pas doivent pouvoir finir,
  lentement. C'est eux qui font connaître l'app.
- Offrir une liste plus large : relever ses trois colonnes dans Neon.

À mesurer après le lancement, sans rien ajouter (tout est déjà en base) :

```sql
-- qui arrive au bout du départ, et combien de listes se vendent
select (select count(*) from utilisateurs where gestes_depart >= 150)          as au_bout_du_depart,
       (select count(*) from utilisateurs)                                     as comptes,
       (select count(*) from groupes where paye_le is not null and not offert) as listes_vendues,
       (select count(*) from groupes)                                          as listes;
```

Si beaucoup arrivent au bout du départ sans payer, le mur est trop tôt ou
l'offre trop faible ; si presque personne n'y arrive, le départ est trop
large et ne vend rien.

La projection de classe est le seul cas où le gratuit montre quand même un
chiffre : celui d'un palmarès public — une graphie, l'an dernier — en disant
ce qu'il rate. Cacher le chiffre ne convainc personne ; montrer l'écart, si.

### Brancher Stripe

Le compte Stripe « BabyNames » a déjà son catalogue, créé le 25 septembre 2026 :

| | |
|---|---|
| Produit | `prod_VKB9yYrGETljLP` — « babyNames — liste débloquée » |
| Prix | `price_1UJWn1GaKiRYW6iYRjRPV7xn` — 6 € **TTC**, paiement unique, clé `babynames_liste` |

Le prix est `tax_behavior: inclusive` : si la TVA s'applique un jour (Stripe
Tax ou Managed Payments), le client paie toujours 6 €, et c'est la marge qui
absorbe la taxe — pas l'affichage. En France, un prix affiché à un
particulier est TTC ; un « 6 € » qui devient « 7,20 € » à la caisse, c'est
un panier abandonné et une pratique trompeuse. Ce réglage ne se change plus
une fois posé : c'est voulu.

Pas de code fiscal sur le produit : il n'a aucun effet tant que ni Stripe Tax
ni Managed Payments ne sont allumés, et Stripe demande de ne pas le choisir à
la place du vendeur. Celui qui décrit l'app, vérifié dans l'API :
`txcd_10103000` — *Software as a service (SaaS) — personal use*. (Pas
`txcd_10701411`, « information services », qui exclut explicitement ce
qu'on consulte à travers un logiciel en ligne.)

Variables d'environnement Vercel (babyname → Settings → Environment Variables).
État relevé le 25 septembre 2026 : les quatre premières sont posées ;
`CRON_SECRET` manque ; `NUXT_MIGRATION_SECRET` et `NUXT_MAGIC_LINK_DEBUG`
traînent encore et sont à **supprimer** (la première rouvre une route de
migration, la seconde ne sert plus à rien).

| Variable | Valeur |
|---|---|
| `NUXT_STRIPE_SECRET_KEY` | une **clé restreinte** `rk_live_…` (Developers → API keys → Create restricted key) avec **une seule** permission : *Checkout Sessions → Write*. C'est tout ce que le serveur appelle (création et relecture de session) ; volée, elle ne permet ni rembourser, ni lire les clients, ni vider le compte. |
| `NUXT_STRIPE_PRICE_ID` | `price_1UJWn1GaKiRYW6iYRjRPV7xn` |
| `NUXT_STRIPE_WEBHOOK_SECRET` | le `whsec_…` affiché à la création du webhook ci-dessous |
| `NUXT_PUBLIC_SITE_URL` | `https://babyname-five.vercel.app` |
| `CRON_SECRET` | une longue chaîne aléatoire (`openssl rand -hex 32`). **Sans préfixe** : c'est Vercel qui la lit et l'envoie au cron de purge RGPD. Sans elle, la purge n'existe pas (404). |
| `NUXT_STRIPE_TAX_RATE_ID` | **seulement si assujetti à la TVA** — voir « TVA » plus bas. |

**Toujours le domaine de production**, jamais une URL de déploiement
(`babyname-xxxx-gregoire63s-projects.vercel.app`) : celles-là sont des photos
figées d'une version passée. Un webhook pointé dessus parle à un code qui n'a
peut-être même pas la route de paiement — chaque paiement serait encaissé et
rien ne se débloquerait.

Le webhook existe : `we_1UJWzGGaKiRYW6iY3GrUaM1e`, URL de production, version
`2026-08-26.dahlia` (la même que celle épinglée dans `server/utils/stripe.ts`).
Il écoute **quatre** événements :

| Événement | Effet |
|---|---|
| `checkout.session.completed` | débloque (carte, Apple Pay…) |
| `checkout.session.async_payment_succeeded` | débloque un paiement différé (prélèvement) — sans lui, on encaisse sans débloquer |
| `charge.refunded` | **re-verrouille** si le remboursement est **total** ; un remboursement partiel ne touche à rien |
| `charge.dispute.closed` | **re-verrouille** si le litige est **perdu** ; gagné, rien ne bouge |

Le lien entre un paiement et sa liste est `groupes.paiement_ref` (le `pi_…`),
noté au déblocage. Les votes ne bougent jamais : on retire le déblocage, pas
les données.

**Ce que l'API ne permet pas de régler — à faire dans le Dashboard, une fois :**

1. **Settings → Business → Public details**
   - Nom public : `babyNames` ; **libellé de relevé** : `BABYNAMES`. Un débit
     qu'on ne reconnaît pas devient une contestation — 20 € de frais pour
     une vente de 6 €.
   - E-mail **et adresse** de support : Stripe les exige sur chaque reçu.
   - Site : `https://babyname-five.vercel.app` ; **politique de
     confidentialité** : `…/confidentialite` ; **conditions** : `…/conditions`.
2. **Settings → Business → Customer emails** : **Successful payments** et
   **Refunds** activés, langue par défaut français. *Indispensable* : c'est
   ce qui envoie la facture — et la facture est le « support durable » qui
   rend valable la renonciation au droit de rétractation (voir plus bas).
3. **Settings → Branding** : l'icône (le logo, 128 px minimum) et les
   couleurs `#1a234e` / `#ecbbb6`. La page de paiement reçoit déjà les
   couleurs par l'API (`branding_settings`) ; les reçus et factures, eux,
   ne lisent que ce réglage.
4. **Settings → Payment methods** : carte, Apple Pay, Google Pay et Link
   suffisent pour 6 €. Klarna, Amazon Pay et les moyens locaux étrangers
   peuvent être coupés (frais plus élevés, aucun gain pour un achat à 6 €) —
   facultatif.
5. **Sécurité** : double authentification sur le compte Stripe.

### La facture, et pourquoi elle compte

Chaque session demande une facture après paiement (`invoice_creation`,
0,4 % du montant chez Stripe : 2,4 centimes par liste). Elle part par e-mail
avec le reçu, et son pied porte :

- l'identité du vendeur (nom, SIRET, adresse, depuis `shared/utils/editeur.ts`) ;
- « TVA non applicable, art. 293 B du CGI » en franchise ;
- la confirmation **datée** que l'acheteur a demandé l'accès immédiat et
  renoncé à son droit de rétractation (art. L221-28 13°) ;
- la version des conditions acceptées, et le médiateur de la consommation.

Sans cette confirmation sur un support durable (art. L221-13), la
renonciation ne vaut rien : l'acheteur garde quatorze jours pour se faire
rembourser une liste déjà utilisée. Les reçus seuls ne la portent pas.

L'accord lui-même est recueilli **avant** le paiement : une case jamais
pré-cochée dans l'écran d'achat, que le serveur exige aussi (sans elle,
`400 consentement_requis`, et Stripe n'est même pas appelé). Il est gravé dans
les métadonnées de la session et du paiement (`conditions_version`,
`consentement_le`, `execution_immediate`) : en cas de litige, la preuve est
dans le Dashboard.

### TVA

`shared/utils/editeur.ts` → `tva: 'franchise'` par défaut (micro-entreprise
sous le seuil, mention de l'art. 293 B). **À vérifier sur une facture Tiime.**
Si l'entreprise est assujettie :

1. `tva: 'assujetti'` et `numeroTva: 'FR…'` dans `editeur.ts` ;
2. Stripe → Products → Tax rates → nouveau taux : « TVA », 20 %,
   **inclusive**, France ;
3. son id (`txr_…`) dans `NUXT_STRIPE_TAX_RATE_ID`.

Le prix reste 6 € TTC ; la facture affiche alors 1 € de TVA incluse.

### Tester sans sandbox

Le compte n'a que le mode live. Le trajet se vérifie quand même sans rien
payer — tout est prêt dans Stripe :

- coupon `liste-offerte` : 100 %, limité au produit babyNames ;
- code promo **`ESSAI-3HACXZ`** : deux utilisations, valable jusqu'au
  25 octobre 2026.

Passer par la caisse avec ce code : session réelle, webhook réel,
`no_payment_required`, liste débloquée et marquée offerte, facture à 0 € par
e-mail (qui doit montrer le pied de page légal). Ensuite, si l'on veut voir
une vraie carte passer : **un** paiement de 6 €, puis un remboursement
**total** depuis le Dashboard — la liste doit alors se **re-verrouiller**
(c'est le webhook `charge.refunded`). Les frais Stripe, eux, ne reviennent
pas : environ 0,34 €.

`essai-caisse.mjs` fait le même trajet hors ligne, contre un faux Stripe.

### Managed Payments, plus tard

Stripe peut devenir **vendeur officiel** (merchant of record) : il déclare la
TVA dans 80 pays, gère les litiges, le support et le droit de rétractation.
Pour 3,5 % de plus, et en collectant la TVA sur chaque vente.

| Par liste à 6 € (carte UE) | Checkout direct | Managed Payments |
|---|---|---|
| Franchise en base de TVA (art. 293 B) | **≈ 5,64 €** nets | ≈ 4,45 € (1 € de TVA collectée par Stripe) |
| Assujetti à la TVA | ≈ 4,64 € + tes déclarations | **≈ 4,45 €**, zéro déclaration |

(Checkout direct : 1,5 % + 0,25 € par carte européenne, plus 0,4 % pour la
facture — voir « La facture ».)

Tant que la micro-entreprise est en franchise, Checkout direct garde un euro
de plus par vente. Le jour où elle en sort, ou où les ventes à des
particuliers d'autres pays de l'UE approchent 10 000 € par an, Managed
Payments devient le bon choix. Le basculer :

1. Dashboard → Settings → Managed Payments → activer ;
2. donner au produit un code fiscal éligible (le Dashboard les étiquette) ;
3. `NUXT_STRIPE_MANAGED_PAYMENTS=1` dans Vercel.

En Managed Payments, le code n'envoie ni facture, ni texte personnalisé, ni
habillage (Stripe les refuse, et émet lui-même reçus et factures en son nom) ;
`essai-caisse.mjs` passe dans les deux positions.

**Attention, constaté le 25/09/2026 contre l'API live** : le compte a Managed
Payments **activé par défaut** (Dashboard → Settings → Managed Payments). Une
session qui ne précise rien part donc en Managed Payments — et Stripe refuse
alors la facture et le texte personnalisé : plus aucune vente possible. Le code
envoie désormais `managed_payments[enabled]` **explicitement**, `false` sans la
variable, `true` avec : le réglage du Dashboard ne décide plus à notre place.
Autant le remettre sur « désactivé » par défaut dans le Dashboard pour que le
comportement affiché corresponde au comportement réel.

### Ce qui débloque, et ce qui ne débloque pas

Une liste est débloquée si et seulement si `groupes.paye_le` est rempli.
Tout — le quota, le nom de famille, la projection, le portrait, les
observateurs, le désaccord expliqué — lit ce seul champ, pour tout le monde
sur la liste.

Il n'est posé que par `livrer()` (`server/utils/stripe.ts`) et n'est retiré
que par `reprendrePaiement()` — webhook signé, remboursement total ou litige
perdu. `livrer()` n'a que deux appelants :

- **le webhook**, après vérification de la signature (HMAC-SHA256 du corps
  brut, moins de cinq minutes, temps constant, n'importe laquelle des
  signatures `v1` pendant une rotation du secret). Sans elle, l'URL du
  webhook suffirait à tout débloquer gratuitement ;
- **le retour du navigateur**, qui n'apporte qu'un identifiant de session :
  le serveur la relit chez Stripe avec la clé secrète, et vérifie qu'elle
  porte bien **cette** liste. C'est la ceinture en plus des bretelles — un
  secret de webhook mal recopié, et sans elle chaque acheteur paierait sans
  rien recevoir.

« Payé » ne veut pas dire `paid` : un code promo à 100 % donne une session à
0 € que Stripe termine avec `no_payment_required`. Tout ce qui n'est pas
`unpaid` se livre ; les listes à 0 € sont marquées `offert`.

`essai-caisse.mjs` fait tout ce trajet contre un faux Stripe : 45 assertions,
dont les trois défauts qu'il a trouvés en naissant (code à 100 % ignoré,
prélèvement jamais débloqué, rotation du secret qui rejetait tout), l'accord
exigé avant paiement, la facture, et les re-verrouillages (remboursement
total, litige perdu — mais pas un remboursement partiel ni un litige gagné).

### Offrir une liste

Pas d'écran d'administration : c'est une surface d'attaque pour un geste
qu'on fait trois fois par an. La console Neon suffit (Vercel → Storage →
la base → *Open in Neon* → SQL Editor) :

```sql
-- les listes, pour trouver la bonne
select id, nom, code_invitation, cree_le, paye_le, offert from groupes order by cree_le;

-- l'offrir (le code est celui affiché dans « La liste »)
update groupes set paye_le = now(), offert = true
 where code_invitation = 'xxxxxxxx' and paye_le is null
returning nom;
```

Pour un ami qui passera par la caisse : un **code promo à 100 %** dans Stripe
(Products → Coupons), il le saisit sur la page de paiement, la liste se
débloque et reste marquée offerte.

### Mettre en production sans coupure

Le nouveau schéma est purement additif, et l'**ancien** code tourne dessus
(vérifié sur une copie de la base de production : aucune ligne perdue, accords
identiques, rejouable). Donc on migre **avant** de pousser, jamais après :

1. Console Neon → SQL Editor → coller tout `server/assets/schema.sql` → Run.
   Il contient désormais le bloc RGPD (clés étrangères sans cascade,
   `paiement_ref`, e-mails vestiges effacés) et le quota « départ puis
   filet » (colonnes ajoutées, rien de supprimé) ; l'ancien code tourne dessus.
   **Sans ce collage, chaque vote d'une liste gratuite tombe en erreur.**
2. Offrir les listes qui ne doivent pas prendre le mur (ci-dessus). Sans ça,
   toute liste existante passe en gratuit au déploiement : 40 gestes par jour.
3. Remplir `shared/utils/editeur.ts` (SIRET, adresse, téléphone, médiateur).
   **Tant que SIRET, adresse ou téléphone manquent, le paiement reste fermé
   en production** (`503 vente_fermee`, « le paiement ouvre très bientôt » à
   l'écran) — l'app gratuite, elle, marche. Le médiateur ne ferme pas la
   caisse (une adhésion prend quelques jours, et il faut pouvoir tester avec
   le code promo), mais il est obligatoire avant la première vente réelle.
   `GET /api/sante` → `legal.bloquants` et `legal.manquants`.
4. Poser `CRON_SECRET` dans Vercel.
5. Pousser. Vercel construit depuis `app/`.
6. Retirer `NUXT_MIGRATION_SECRET` et `NUXT_MAGIC_LINK_DEBUG` de Vercel.

Dans l'autre ordre, le nouveau code arrive sur l'ancienne base et chaque page
tombe en erreur jusqu'à la migration.

Aucun numéro de carte ne passe par l'application : on demande une session à
Stripe, on envoie le navigateur sur *sa* page, c'est lui qui encaisse. Il n'y
a aucun champ de paiement dans le code, et l'essai le vérifie.

### Le désaccord expliqué

« Ce n'est peut-être pas Marius, c'est la longueur. » L'écran « À revoir »
disait qui avait dit quoi, jamais pourquoi — et la réponse était dans les
votes : quelqu'un qui dit non à Marius et oui à des prénoms de 1,8 syllabe
en moyenne ne refuse pas Marius, il refuse trois syllabes.

Rien de nouveau n'est révélé : c'est la même matière que `À revoir` affichait
déjà, lue autrement. Trois garde-fous, et ils comptent plus que la fonction :
on n'explique que le **non** (pointer ce que l'autre aime serait un
argumentaire contre lui) ; il faut **12 oui visibles** chez celui qui refuse ;
il faut **1,2 écart-type** sur un axe où il est réellement constant. Sinon
l'écran se tait — et dit une fois pourquoi, sans quoi la fonction a l'air
cassée. Une explication calculée sur cinq prénoms serait crédible et fausse,
le seul type d'erreur que personne ne remarque.

### Les observateurs

Deuxième code d'invitation, stocké dans `groupes.code_observateur` et créé à
la demande par `POST /api/groupes/:id/observateurs`. Le rôle vient du **code**,
jamais du corps de la requête : sinon l'invité modifie son lien et s'élit
parent, avec droit de veto sur des accords qui ne sont pas les siens.

Un observateur juge et son avis se lit, mais `v_matchs` l'exclut des deux
côtés — ses votes n'entrent pas dans le score, et le quorum ne l'attend pas.
`POST /api/groupes/:id/veto` lui répond `403`. Le jeu d'essai contient Mamie,
qui dit **non à Louise** : `essai-observateur.mjs` vérifie que Louise reste un
accord. Si elle disparaissait, le rôle ne servirait à rien et l'argument de
vente serait un mensonge que personne ne remarquerait avant d'avoir payé.

### Les liens entrants

Deux paramètres d'adresse ouvrent l'app ailleurs que sur l'accueil :

| Lien | Fabriqué par | Effet |
|---|---|---|
| `/?code=xxxxxxxx` | le partage d'une liste (réglages) | rejoint la liste et y entre |
| `/?prenom=louise` | le bouton des fiches publiques (`scripts/seo.mjs`) | ce prénom devient la première carte de la liste où l'on entre (celle en cours, ou celle qu'on crée) |

Les deux traversent la connexion (`/connexion?code=…&prenom=…`) : c'est
justement quelqu'un qui n'a pas encore de compte qui les suit. Le slug se
résout par `trouverPrenom()` (`useCatalogue.ts`) : l'écriture exacte de la
fiche (`jean-baptiste`), sinon la forme collée, le plus donné à égalité.

Le prénom passe devant **même hors des filtres** — la connexion l'a promis —
et reste épinglé (stockage local, par liste) jusqu'à son jugement, rechargement
et mur du jour compris. Déjà jugé, en accord ou sous veto : un message, pas de
nouvelle carte. `ref=seo` n'est lu par rien : l'app ne mesure pas d'audience.

Les redirections **remplacent** l'entrée d'historique : sinon le bouton retour
ramène sur le lien, qui renvoie aussitôt dans la liste.

## Données personnelles (RGPD)

Tout ce que la loi demande, fait dans l'app plutôt que promis dans un texte :

| Droit / obligation | Où |
|---|---|
| Information (art. 13) | `/confidentialite`, et deux lignes au moment de créer le compte |
| Accès, portabilité (art. 15, 20) | *Mon compte → Télécharger mes données* : `GET /api/moi/donnees`, un JSON lisible — tout ce qui concerne la personne, rien des autres |
| Rectification (art. 16) | *Mon compte → Nom affiché* ; le reste se modifie dans l'app |
| Effacement (art. 17) | *Mon compte → Supprimer mon compte* : `POST /api/moi/supprimer` (mot `SUPPRIMER` exigé), immédiat |
| Conservation limitée (art. 5.1.e) | purge chaque nuit : `GET /api/admin/purger`, cron Vercel (`vercel.json`), protégée par `CRON_SECRET` |
| Minimisation | pas d'e-mail ; les e-mails du temps du lien magique sont effacés ; police servie par l'app (plus d'IP envoyée à Google) |
| Registre (art. 30) | `docs/registre-des-traitements.md` |
| Traceurs (art. 82 loi I&L) | un cookie de session et du stockage local strictement nécessaires : **pas de bandeau**, et il ne doit jamais en falloir un. Ajouter une mesure d'audience ou un pixel changerait ça — et le registre. |

**Effacer un compte ne doit pas effacer celui des autres.** Avant le bloc RGPD
du schéma, `groupes.cree_par` était en cascade : effacer le créateur d'une
liste effaçait la liste — donc les votes de l'autre parent — et effacer
l'acheteur échouait (`paye_par` sans règle). Les deux passent à `NULL`. Une
liste où il ne reste personne part, payée ou non ; une liste partagée reste,
débloquée, à ceux qui y sont.

**Les durées** vivent dans `shared/utils/editeur.ts` (`CONSERVATION`) : 24 mois
sans ouvrir l'app, 62 jours pour les compteurs, 120 jours de cookie. La purge
et la page `/confidentialite` lisent la même constante. L'activité se note au
plus une fois par jour et par personne (`NOTER_ACTIVITE`, dans la garde des
routes) : c'est elle qui fait courir les 24 mois.

**Une session sur un autre appareil** survit dans le navigateur, pas dans la
base : la garde vérifie que le compte existe encore et répond `401` (cookie
retiré) au lieu de laisser une clé étrangère lever une `500`.

`essai-rgpd.mjs` exerce tout ça comme un utilisateur (37 assertions), avec
« Fantome », un compte semé inactif depuis 25 mois.

## Mentions légales et vente à des particuliers

`shared/utils/editeur.ts` est la **seule** source de l'identité du vendeur :
mentions légales, conditions, confidentialité, pied de facture Stripe et
`/api/sante` la lisent. Chaque champ obligatoire vide s'affiche en rouge
« à compléter » sur les pages publiques. À remplir avant de vendre :

- **SIRET, adresse professionnelle, téléphone** (LCEN, art. 6 III : le
  téléphone est exigé pour une personne physique) ;
- **médiateur de la consommation** — obligatoire pour vendre à des
  particuliers, même 6 € (art. L612-1 ; amende jusqu'à 3 000 € pour une
  personne physique). Adhérer à un médiateur agréé (liste sur
  economie.gouv.fr/mediation-conso), puis `mediateur: { nom, adresse, site }` ;
- **régime de TVA** (voir « TVA »).

La plateforme européenne de règlement en ligne des litiges (RLL/ODR) a fermé
le 20 juillet 2025 : son lien n'a plus à figurer nulle part.

Pages publiques, lisibles sans compte : `/mentions-legales`, `/confidentialite`,
`/conditions` (utilisation **et** vente), `/accessibilite`. Changer le texte des
conditions, c'est changer `VERSIONS_TEXTES.conditions` : la version acceptée
est gravée dans chaque paiement.

## Accessibilité

Visée : RGAA 4.1.2 (WCAG 2.1 AA). Déclaration volontaire publiée sur
`/accessibilite` — une microentreprise n'y est pas obligée, mais elle dit ce
qui marche et à qui écrire.

- Contrastes AA partout, thème sombre compris (`--doux`, `--oui`, `--non`,
  `--neutre` redescendus d'un cran).
- Clavier : focus visible, lien d'évitement, **tri aux flèches** (← non,
  → oui, ↓ neutre), volets du classement en vrais onglets (flèches, Début,
  Fin).
- Dialogues (`useDialogue`) : focus dedans, fond `inert`, Tab qui boucle,
  Échap qui ferme, focus rendu à la fermeture — feuilles, fiche, fête d'un
  accord, confirmation « écarter la famille ».
- Lecteurs d'écran : titre par écran annoncé (`NuxtRouteAnnouncer`), prénom
  suivant annoncé dans le tri, courbes décrites, états des filtres dits.
- Mouvement réduit : tout s'arrête. L'app n'est plus bloquée en portrait.

`essai-accessibilite.mjs` passe axe-core (WCAG 2.0/2.1 A et AA) sur chaque
écran et chaque dialogue, en clair et en sombre, et vérifie au clavier ce
qu'aucun outil ne voit. Il lui faut axe-core : `npm i -D axe-core` (ou
`ESSAI_AXE=/chemin/axe.min.js`).

## Schéma

`server/assets/schema.sql` fait foi, et il est idempotent
(`create … if not exists`, `create or replace`). En local il est rejoué à
chaque démarrage. En production il s'applique via `POST /api/admin/migrer`,
protégé par `NUXT_MIGRATION_SECRET` — variable à vider une fois la migration
passée, sinon la route reste ouverte.

## Vérifier

`GET /api/sante` dit ce qui est branché sans révéler aucune valeur :

```json
{ "presence": { "base": false, "secret_session": false, "paiement": true,
                "paiement_webhook": true, "purge_quotidienne": true },
  "legal": { "complet": false, "manquants": ["siret", "mediateur"],
             "bloquants": ["siret"], "vente_ouverte": false },
  "base": { "joignable": true, "moteur": "embarque", "tables": 15,
            "migrations": { "rgpd.effacement_sans_cascade": true, "groupes.paiement_ref": true } } }
```

`legal.vente_ouverte: false` en production = le paiement est fermé tant que
`bloquants` n'est pas vide.

`"moteur": "embarque"` en local, `"postgres"` sur Vercel.
