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

Sur <http://localhost:3000/connexion>, choisissez « J'ai déjà une clé » et
collez celle de Greg. Ouvrez celle d'Audrey dans une fenêtre privée : le vote
aveugle se teste à deux, sur la même base.

`npm run dev:neuf` efface `.data/` et repart d'une base vierge.

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

`essais/` contient dix-sept essais de bout en bout — vrai navigateur, vrai
serveur, vraie base — soit 218 assertions. Ils ne testent pas des fonctions,
ils testent des promesses : « le refus ne se dit jamais », « un observateur ne
casse pas un accord », « aucun champ de carte bancaire dans l'app ».

```bash
npm i -D playwright && npx playwright install chromium
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
| 20 swipes/jour, 600/mois (par personne) | les observateurs (grands-parents sans veto) |

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

À poser **soi-même** dans Vercel → babyname → Settings → Environment Variables :

| Variable | Valeur |
|---|---|
| `NUXT_STRIPE_SECRET_KEY` | une **clé restreinte** `rk_live_…` (Developers → API keys → Create restricted key) avec **une seule** permission : *Checkout Sessions → Write*. C'est tout ce que le serveur appelle (création et relecture de session) ; volée, elle ne permet ni rembourser, ni lire les clients, ni vider le compte. |
| `NUXT_STRIPE_PRICE_ID` | `price_1UJWn1GaKiRYW6iYRjRPV7xn` |
| `NUXT_STRIPE_WEBHOOK_SECRET` | le `whsec_…` affiché à la création du webhook ci-dessous |
| `NUXT_PUBLIC_SITE_URL` | `https://babyname-five.vercel.app` |

**Toujours le domaine de production**, jamais une URL de déploiement
(`babyname-xxxx-gregoire63s-projects.vercel.app`) : celles-là sont des photos
figées d'une version passée. Un webhook pointé dessus parle à un code qui n'a
peut-être même pas la route de paiement — chaque paiement serait encaissé et
rien ne se débloquerait.

Puis Developers → Webhooks → **Add destination** :

- URL : `https://babyname-five.vercel.app/api/paiement/webhook`
- Version de l'API : `2026-08-26.dahlia`, la même que celle épinglée dans
  `server/utils/stripe.ts` — le code attend les objets sous cette forme ;
- Événements : `checkout.session.completed` **et**
  `checkout.session.async_payment_succeeded` — le second est celui des
  prélèvements (SEPA…), qui ne sont pas encaissés quand la page se ferme.
  Sans lui, on encaisse sans débloquer.

Et dans Settings → Public details / Customer emails :

- **Libellé de relevé** : `BABYNAMES`. Un débit qu'on ne reconnaît pas sur
  son relevé devient une contestation — 20 € de frais pour une vente de 6 €.
- Email de support, et les URL des CGV et de la politique de confidentialité
  (Stripe les affiche sur la page de paiement, et en a besoin pour activer le
  compte en live).
- **Reçus automatiques** pour les paiements réussis : gratuits, et suffisants
  pour une vente de 6 € à un particulier. Pas besoin de Stripe Invoicing.

### Tester sans sandbox

Le compte n'a que le mode live. Le trajet se vérifie quand même sans rien
payer : un coupon à 100 % et son code promo (Products → Coupons), puis un
passage par la caisse avec ce code — session réelle, webhook réel,
`no_payment_required`, liste débloquée et marquée offerte. Ensuite **un** vrai
paiement de 6 € avec sa propre carte, remboursé depuis le Dashboard (les frais
Stripe, eux, ne reviennent pas : environ 0,34 €).

`essai-caisse.mjs` fait le même trajet hors ligne, contre un faux Stripe.

### Managed Payments, plus tard

Stripe peut devenir **vendeur officiel** (merchant of record) : il déclare la
TVA dans 80 pays, gère les litiges, le support et le droit de rétractation.
Pour 3,5 % de plus, et en collectant la TVA sur chaque vente.

| Par liste à 6 € (carte UE) | Checkout direct | Managed Payments |
|---|---|---|
| Franchise en base de TVA (art. 293 B) | **≈ 5,66 €** nets | ≈ 4,45 € (1 € de TVA collectée par Stripe) |
| Assujetti à la TVA | ≈ 4,66 € + tes déclarations | **≈ 4,45 €**, zéro déclaration |

Tant que la micro-entreprise est en franchise, Checkout direct garde un euro
de plus par vente. Le jour où elle en sort, ou où les ventes à des
particuliers d'autres pays de l'UE approchent 10 000 € par an, Managed
Payments devient le bon choix. Le basculer :

1. Dashboard → Settings → Managed Payments → activer ;
2. donner au produit un code fiscal éligible (le Dashboard les étiquette) ;
3. `NUXT_STRIPE_MANAGED_PAYMENTS=1` dans Vercel.

Le code n'envoie déjà aucun des paramètres que Managed Payments refuse ;
`essai-caisse.mjs` passe dans les deux positions.

### Ce qui débloque, et ce qui ne débloque pas

Une liste est débloquée si et seulement si `groupes.paye_le` est rempli.
Tout — le quota, le nom de famille, la projection, le portrait, les
observateurs, le désaccord expliqué — lit ce seul champ, pour tout le monde
sur la liste.

Il n'est posé que par `livrer()` (`server/utils/stripe.ts`), et `livrer()`
n'a que deux appelants :

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

`essai-caisse.mjs` fait tout ce trajet contre un faux Stripe : 22 assertions,
dont les trois défauts qu'il a trouvés en naissant (code à 100 % ignoré,
prélèvement jamais débloqué, rotation du secret qui rejetait tout).

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
2. Offrir les listes qui ne doivent pas prendre le mur (ci-dessus). Sans ça,
   toute liste existante passe en gratuit au déploiement : 40 gestes par jour.
3. Pousser. Vercel construit depuis `app/`.
4. Retirer `NUXT_MIGRATION_SECRET` de Vercel s'il y est encore.

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

## Schéma

`server/assets/schema.sql` fait foi, et il est idempotent
(`create … if not exists`, `create or replace`). En local il est rejoué à
chaque démarrage. En production il s'applique via `POST /api/admin/migrer`,
protégé par `NUXT_MIGRATION_SECRET` — variable à vider une fois la migration
passée, sinon la route reste ouverte.

## Vérifier

`GET /api/sante` dit ce qui est branché sans révéler aucune valeur :

```json
{ "presence": { "base": false, "secret_session": false },
  "base": { "joignable": true, "moteur": "embarque", "tables": 14 } }
```

`"moteur": "embarque"` en local, `"postgres"` sur Vercel.
