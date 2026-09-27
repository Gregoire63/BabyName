# babyNamed — développement local

## Démarrer

```bash
npm install
npm run dev
```

Et c'est tout. Pas de `.env`, pas de Docker, pas de compte Cloudflare.

`nuxt dev` passe par wrangler, qui simule en local la plateforme de
production — dont la base **D1** (du SQLite), dans `.data/wrangler`. Au
premier lancement, l'app y applique les migrations
(`server/assets/migrations/`) et la remplit avec deux comptes et une liste
déjà entamée. Le terminal affiche alors :

```
  Base de developpement semee (D1 simulee par wrangler, dossier .data/wrangler).
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

Ces gestes passent par `/api/dev/base`, qui répond **404 en production**. Le
serveur de dev parle toujours à la base locale — sauf si l'on ajoutait
`"remote": true` à la liaison `DB` de `wrangler.jsonc` : ne jamais le faire,
« Base neuve » viderait la production.

`npm run dev:neuf` fait la même chose que « Base neuve », serveur arrêté.

## Ce qu'il y a dans le jeu d'essai

| | |
|---|---|
| Greg | 27 votes, 2 gardés (Alma, Nine), une famille écartée d'un geste (`kevi`) et des non un par un ; un blocage secret sur Brandon, au format d'avant les graphies |
| Audrey | 19 votes, un blocage secret sur Jayden (et ses 8 graphies), **Mathilde « déjà pris »** (« ma sœur »), un commentaire sur Louise ; adresse vérifiée `audrey@exemple.test` (lien de connexion : la boîte de dev le reçoit) |
| Mamie | **observatrice** : 6 votes, dont un **non à Louise**, qui reste un accord |
| en commun | 9 prénoms, plus des désaccords francs (Marius, Hector : Greg oui, Audrey non) pour remplir « À revoir » |
| listes | « Notre liste » débloquée (code `dec0de00`), « Essai gratuit » et « Autre essai » au quota 3/jour pour taper dans le mur en trois swipes |
| cadeau | un code payé pour de faux, **`BEBE-2345-CADE`**, de la part de Mamie : `/?cadeau=BEBE2345CADE` |
| écrans | Accueil · Swipe · Classement (Communs · À revoir · Mes choix · Portrait) · La liste |

Greg a exactement **12 oui**, soit le seuil du portrait de goûts, et Audrey
n'en a que 5 de visibles pour lui : c'est ce qui permet de vérifier que le
portrait parle d'un côté et **se tait** de l'autre au lieu d'inventer.

`Kevin` est volontairement jugé « non » **avant** le balayage de sa famille :
c'est le cas limite qui vérifie qu'un choix individuel survit à la remise en
jeu d'une famille.

## Les essais

`essais/` contient trente essais de bout en bout — vrai navigateur, vrai
serveur, vraie base — soit près de 600 assertions. Ils ne testent pas des
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

## Pourquoi D1

La base est **Cloudflare D1** : du SQLite, dans le même compte que l'app.
Rien à réveiller (Neon s'endormait après cinq minutes sans requête, et la
requête suivante attendait), aucune connexion à ouvrir et fermer à chaque
requête, sept jours de retour arrière inclus (*Time Travel*), gratuit dans
les limites ci-dessous, et un seul prestataire.

En local, c'est le **même moteur** : wrangler fait tourner D1 dans workerd,
comme en ligne. Une requête qui passe en local passe en production.

Trois règles d'écriture, toutes dans `server/utils/db.ts` :

- **pas de transaction ouverte** : on envoie un lot (`lot([...])`), exécuté
  d'un bloc, tout ou rien — et en un seul aller-retour ;
- **les dates sont du texte** ISO 8601 en UTC, au format de
  `Date.toISOString()` : `${MAINTENANT}` et `${decale('-1 day')}` dans le SQL,
  `jourParis()` pour le jour de Paris (SQLite ne connaît pas les fuseaux) ;
- **ni booléens ni JSON natifs** : 0/1 et du texte, remis en forme en sortie
  (`BOOLEENS`, `JSONS`) pour que l'API réponde comme avant. Une liste en
  paramètre : `prenom in ${DANS(3)}`.

Paramètres `?1`, `?2`… ; une contrainte d'unicité se reconnaît avec
`estDoublon(err)`.

Limites du plan gratuit (voir « Héberger sur Cloudflare ») : 5 millions de
lignes lues et 100 000 écrites par jour, 500 Mo par base. D1 compte les
lignes **parcourues**, pas renvoyées : une requête qui balaie une table sans
index coûte toute la table. D'où les clés primaires qui commencent par la
liste (`groupe_id`, `user_id`, …) et les index de la migration.

## Travailler sur la vraie base

Depuis le poste, avec wrangler (connecté une fois par `npx wrangler login`) :

```bash
# une requête
npx wrangler d1 execute DB --remote --config wrangler.jsonc --command "select count(*) from utilisateurs"
# une copie complète, en SQL
npx wrangler d1 export DB --remote --config wrangler.jsonc --output sauvegarde.sql
```

Ou dans le tableau de bord : *Storage & Databases → D1 → babynamed → Console*.
**Vous écrivez alors dans la base de production.** Retour arrière en cas de
fausse manœuvre : `npx wrangler d1 time-travel restore DB --timestamp=…`
(sept jours).

## Héberger sur Cloudflare

L'app tourne sur **Cloudflare Workers** : l'API et la coquille de l'app dans
le Worker (pas de démarrage à froid), les fichiers statiques — fiches
prénoms, JavaScript, catalogue — servis directement par Cloudflare, sans
passer par lui. Coût : **0 €** dans les limites du plan gratuit :

| | Gratuit | Au-delà |
|---|---|---|
| Requêtes au Worker (API + pages de l'app ; pas les fichiers statiques) | 100 000 / jour | Workers Paid, 5 $/mois |
| Temps de calcul | 10 ms par requête | 30 s |
| D1 | 5 M lignes lues, 100 000 écrites / jour, 500 Mo par base | idem, plus larges |

Passé une limite du jour, les requêtes échouent jusqu'à minuit UTC : si
l'app décolle, passer à Workers Paid (une vente par mois le paie). Les
conditions de Cloudflare autorisent l'usage commercial du plan gratuit ; elles
interdisent seulement de collecter des numéros de carte sur le site — ce que
l'app ne fait jamais (page de paiement Stripe).

### Première mise en place (une fois)

1. **Domaine** : acheter `babynamed.fr` chez un registrar qui vend les `.fr`
   (OVH, Gandi, Infomaniak… — Cloudflare n'en vend pas), puis *Cloudflare →
   Add a domain* (plan Free) et remplacer chez le registrar les serveurs DNS
   par ceux que Cloudflare donne.
2. **La base, dans l'Union européenne** — irréversible, à ne pas rater :

   ```bash
   npx wrangler login
   npx wrangler d1 create babynamed --jurisdiction eu
   ```

   Recopier l'identifiant affiché (`database_id`) dans `wrangler.jsonc`, à la
   place des zéros, et pousser. Ce n'est pas un secret.
3. **Le Worker, relié au dépôt** : *Workers & Pages → Create → Import a
   repository* → GitHub `Gregoire63/BabyName` :

   | | |
   |---|---|
   | Nom du projet | `babynamed` (le même que `name` dans `wrangler.jsonc`) |
   | Root directory | `app` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Branche de production | `main` ; **builds des autres branches : désactivés** (elles partageraient la vraie base) |

   Chaque `git push` sur `main` construit et déploie, comme avant.
4. **Les secrets** : *Worker → Settings → Variables and Secrets* (type
   *Secret*), ou `npx wrangler secret put NOM` :
   `NUXT_SESSION_SECRET` (le même qu'avant garde les sessions ouvertes… sur
   l'ancien domaine seulement, donc au choix), `NUXT_EMAIL_CLE`,
   `NUXT_STRIPE_SECRET_KEY`, `NUXT_STRIPE_WEBHOOK_SECRET`,
   `NUXT_STRIPE_PRICE_ID`, et `CRON_SECRET` si l'on veut pouvoir lancer la
   purge à la main. Le reste (`NUXT_PUBLIC_SITE_URL`, prix, expéditeur) est
   déjà dans `wrangler.jsonc`.
5. **Le schéma** : rien à faire — la première requête applique les
   migrations. (Ou avant : `npm run base:migrer`.)
6. **Les données d'avant** : voir « Quitter Vercel et Neon » ci-dessous.
7. **Le domaine sur le Worker** : décommenter `routes` dans `wrangler.jsonc`
   (ou *Worker → Settings → Domains & Routes → Add → Custom domain*), puis
   une règle de redirection `www.babynamed.fr` → `babynamed.fr` (*Rules →
   Redirect Rules*). Une fois le domaine vérifié : `"workers_dev": false`.
8. **Robots d'IA** : *Security → Bots* — vérifier que le blocage des robots
   d'IA est **désactivé** et que le `robots.txt` « géré » par Cloudflare est
   coupé : Cloudflare les propose (et les active parfois d'office sur un
   nouveau domaine), et ils fermeraient la porte que les fiches ouvrent.
9. **Stripe** : pointer le webhook sur `https://babynamed.fr/api/paiement/webhook`
   (même événements), et remplacer l'adresse du site dans *Settings →
   Business → Public details* (voir « Brancher Stripe »).
10. **Brevo** : domaine `babynamed.fr` (enregistrements DKIM/DMARC dans le DNS
    Cloudflare) — voir « Connexion sans mot de passe ».

Avant le domaine, l'adresse d'essai `babynamed.<compte>.workers.dev` marche
entièrement (connexion, passkeys, liens) : l'app prend l'adresse de la
requête, forcément l'un des noms du Worker. Une passkey créée là-bas ne
vaudra pas sur `babynamed.fr`.

La purge RGPD tourne chaque nuit toute seule : *Cron Trigger* du Worker
(`triggers.crons` dans `wrangler.jsonc`) qui lance la tâche
`server/tasks/purge.ts` (`scheduledTasks` dans `nuxt.config.ts` — les deux
expressions doivent rester identiques).

### Quitter Vercel et Neon

Dans cet ordre, avant d'annoncer la nouvelle adresse :

1. Copier les données : `NEON_URL="postgres://…" npm run base:copier-neon`
   (l'URL : *Vercel → Storage → la base → .env.local*, la ligne
   `DATABASE_URL_UNPOOLED`), puis
   `npx wrangler d1 execute DB --remote --config wrangler.jsonc --file .data/neon-vers-d1.sql`,
   et **effacer** `.data/neon-vers-d1.sql` (il contient des adresses e-mail).
   Comptes, listes, votes, vetos, commentaires et passkeys suivent ; les
   passkeys créées sur `vercel.app` ne valent pas sur `babynamed.fr` : on
   revient par la clé d'accès ou l'e-mail, puis on en recrée une.
2. Vérifier sur `babynamed.fr` : `/api/sante`, une connexion, un vote.
3. Supprimer le projet Vercel (sinon chaque push y construit un code qui ne
   sait plus y tourner), puis la base Neon une fois la copie vérifiée.

### En local, comme en ligne

`npm run preview` construit la version de production et la sert avec
wrangler, dans workerd — le même moteur que Cloudflare, base locale
comprise (`.wrangler/state`). `npm run deploy` construit et déploie depuis le
poste, sans passer par GitHub.

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

- **Domaine** : `NUXT_PUBLIC_SITE_URL`, sinon `https://babynamed.fr`.
  Canoniques, sitemap et llms.txt en dépendent.
- **robots.txt** ferme `/?…` : les boutons des fiches mènent à l'app avec
  `?prenom=` — 7 000 variantes de la même coquille, en `nofollow` aussi. Aucun
  robot d'IA n'est écarté.
- **lastmod** du sitemap = la constante `MAJ`, pas la date du build : un
  lastmod qui change à chaque push est vite ignoré. À monter quand les données
  ou les gabarits changent.
- **Limites du gratuit** lues dans la migration, prix dans
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

1. **Google Search Console** : propriété « domaine » `babynamed.fr`,
   vérifiée par un enregistrement TXT dans le DNS Cloudflare, puis soumettre
   `/sitemap.xml`.
2. **Bing Webmaster Tools** : importer depuis Search Console. C'est l'index
   de ChatGPT (recherche) et de Copilot.
3. **Cloudflare → Security → Bots** : blocage des robots d'IA désactivé,
   `robots.txt` géré coupé (voir « Héberger sur Cloudflare »).

## Le payant

Une liste se débloque **une fois, pour tout le monde dessus**. Ce n'est pas un
abonnement et ce n'est pas un compte : deux parents sur la même liste paient
une fois à deux, et l'un des deux peut payer pour l'autre. Prix par défaut
`6 €`, affiché depuis `NUXT_PUBLIC_PRIX_LISTE`.

| Gratuit | Débloqué |
|---|---|
| les 19 608 prénoms, la recherche, les filtres | le tri sans plafond |
| les accords, le classement, « déjà pris » et les blocages secrets | l'essai avec le nom de famille |
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
- Offrir une liste plus large : relever ses trois colonnes dans la console D1.

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
| Produit | `prod_VKB9yYrGETljLP` — « babyNames — liste débloquée » : **à renommer** « babyNamed — liste débloquée » (c'est ce nom que la page de paiement et la facture affichent) |
| Prix | `price_1UJWn1GaKiRYW6iYRjRPV7xn` — 6 € **TTC**, paiement unique, clé `babynames_liste` (une clé interne : elle peut rester) |

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

Les secrets du Worker (*Worker → Settings → Variables and Secrets*, type
*Secret*, ou `npx wrangler secret put NOM`). Les deux variables de l'e-mail
de connexion sont décrites dans « Connexion sans mot de passe ».

| Variable | Valeur |
|---|---|
| `NUXT_STRIPE_SECRET_KEY` | une **clé restreinte** `rk_live_…` (Developers → API keys → Create restricted key) avec **une seule** permission : *Checkout Sessions → Write*. C'est tout ce que le serveur appelle (création et relecture de session) ; volée, elle ne permet ni rembourser, ni lire les clients, ni vider le compte. |
| `NUXT_STRIPE_PRICE_ID` | `price_1UJWn1GaKiRYW6iYRjRPV7xn` |
| `NUXT_STRIPE_PRICE_ID_CADEAU` | facultatif : un second produit, « babyNamed — liste à offrir », au même prix, pour lire les cadeaux à part dans les ventes. Vide : les cadeaux passent sur le prix de la liste. |
| `NUXT_STRIPE_WEBHOOK_SECRET` | le `whsec_…` affiché à la création du webhook ci-dessous |
| `NUXT_PUBLIC_SITE_URL` | déjà dans `wrangler.jsonc` : `https://babynamed.fr` |
| `CRON_SECRET` | facultatif : ouvre `/api/admin/purger` pour lancer la purge à la main (`Authorization: Bearer …`). La purge de chaque nuit n'en a pas besoin. |
| `NUXT_STRIPE_TAX_RATE_ID` | **seulement si assujetti à la TVA** — voir « TVA » plus bas. |

**Toujours le domaine de production** pour le webhook :
`https://babynamed.fr/api/paiement/webhook`. Un webhook pointé ailleurs parle
à un code qui n'est peut-être pas celui de production — chaque paiement
serait encaissé et rien ne se débloquerait.

Le webhook existe : `we_1UJWzGGaKiRYW6iY3GrUaM1e`, pointé sur l'ancienne
adresse `vercel.app` — **à repointer** sur `babynamed.fr` au passage, version
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
   - Nom public : `babyNamed` ; **libellé de relevé** : `BABYNAMED`. Un débit
     qu'on ne reconnaît pas devient une contestation — 20 € de frais pour
     une vente de 6 €.
   - E-mail **et adresse** de support : Stripe les exige sur chaque reçu.
   - Site : `https://babynamed.fr` ; **politique de
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

- coupon `liste-offerte` : 100 %, limité au produit de la liste débloquée ;
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
3. `NUXT_STRIPE_MANAGED_PAYMENTS=1` dans les variables du Worker.

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

### Offrir babyNamed : les codes cadeaux

Quelqu'un paie pour quelqu'un d'autre — les grands-parents, une amie, les
collègues. Le cadeau est aussi le meilleur canal d'acquisition : celui qui
offre fait entrer un couple qui ne connaissait pas l'app.

| Étape | Où | Ce qui se passe |
|---|---|---|
| Offrir | `/offrir`, **sans compte** (liens : accueil, carte « Liste débloquée », page de l'app, llms.txt) | nom et mot facultatifs, case d'accord, puis Stripe. Le code (12 caractères) est tiré à l'ouverture de la session et voyage dans ses métadonnées. |
| Recevoir le code | `/offrir/merci?session_id=…` et la **facture** Stripe (champ « Code cadeau ») | le serveur relit la session, enregistre le cadeau s'il est payé (`livrerCadeau`, comme le webhook), rend le code et un lien `/?cadeau=…` à transmettre. |
| L'ouvrir | le lien, ou le code tapé dans « Rejoindre une liste » ou « Débloquer » | le lien traverse la connexion ; la feuille « Un cadeau pour vous » dit de qui, le mot, et propose les listes **pas encore débloquées** ou une nouvelle (les questions habituelles, puis la liste arrive débloquée). |

En base (`cadeaux`, migration 0003) : l'empreinte du code, jamais le code ;
une ligne n'existe qu'une fois le paiement encaissé. Une liste débloquée par
un cadeau a `paye_le`, `offert = 0` et **la référence du paiement du
cadeau** : un remboursement total ou un litige perdu annule le code et,
s'il a servi, re-verrouille la liste (`reprendrePaiement`) — aucun événement
de webhook de plus à écouter.

Règles, et pourquoi :

- **Valable 2 ans** (`CONSERVATION.cadeauMois`) — aucune durée minimale en
  droit français, mais elle doit être annoncée : elle l'est sur la page, la
  facture et les conditions. Échu et inutilisé, il est effacé par la purge.
- **Rétractation** : rien n'est fourni à l'achat, l'acheteur garde ses 14
  jours tant que le code n'a pas servi ; en cochant, il demande le déblocage
  dès l'utilisation et perd alors ce droit (art. L221-28 13°). Une demande
  de rétractation : rembourser le paiement dans Stripe, le webhook annule le
  code.
- **Pas de code promo** sur un cadeau : un cadeau à 0 € serait un code à
  revendre.
- **Code perdu** : Stripe → Payments, chercher l'e-mail de l'acheteur → le
  code est dans les métadonnées du paiement et sur la facture.

En local : le jeu d'essai contient un code payé pour de faux,
**`BEBE-2345-CADE`** (`/?cadeau=BEBE2345CADE`, « de la part de Mamie »),
et `/offrir` a un bouton « Créer un code sans payer (base locale) ».

Offrir soi-même, sans passer par la caisse — pas d'écran d'administration :
c'est une surface d'attaque pour un geste qu'on fait trois fois par an. La
console D1 suffit (*Storage & Databases → D1 → babynamed → Console*) :

```sql
-- les listes, pour trouver la bonne
select id, nom, code_invitation, cree_le, paye_le, offert from groupes order by cree_le;

-- l'offrir (le code est celui affiché dans « La liste »)
update groupes set paye_le = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), offert = 1
 where code_invitation = 'XXXXXXXXXX' and paye_le is null
returning nom;
```

Pour un ami qui passera par la caisse : un **code promo à 100 %** dans Stripe
(Products → Coupons), il le saisit sur la page de paiement, la liste se
débloque et reste marquée offerte.

### Mettre en production

Le schéma vit dans `server/assets/migrations/` et s'applique tout seul (voir
« Schéma ») : pousser suffit. Avant d'ouvrir la vente :

1. Remplir `shared/utils/editeur.ts` (adresse, téléphone, médiateur).
   **Tant que SIRET, adresse ou téléphone manquent, le paiement reste fermé
   en production** (`503 vente_fermee`, « le paiement ouvre très bientôt » à
   l'écran) — l'app gratuite, elle, marche. Le médiateur ne ferme pas la
   caisse (une adhésion prend quelques jours, et il faut pouvoir tester avec
   le code promo), mais il est obligatoire avant la première vente réelle.
   `GET /api/sante` → `legal.bloquants` et `legal.manquants`.
2. Les secrets de l'e-mail (`NUXT_EMAIL_CLE`, et l'expéditeur dans
   `wrangler.jsonc`) — voir « Connexion sans mot de passe ». Sans eux, l'app
   ne propose que la passkey : rien ne casse.
3. Offrir les listes qui ne doivent pas prendre le mur (ci-dessus).

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

## Retirer un prénom : déjà pris, ou en secret

Deux raisons, deux gestes. La feuille « Bloquer ce prénom »
(`FeuilleEcarter.vue`, depuis la carte comme depuis un accord) demande
laquelle, **sans rien cocher d'avance** : cocher « déjà pris » par défaut
ferait publier « mon ex » à qui tape vite.

| | Déjà pris | En secret |
|---|---|---|
| pour | la famille, les amis, quelqu'un qu'on connaît trop | un ex, ce qu'on ne veut pas expliquer |
| qui le voit | toute la liste (observateurs compris), avec l'auteur et sa note | personne : le prénom disparaît, sans nom |
| combien | sans quota (borne technique : 200 par liste) | `BLOCAGES_SECRETS` = 5 par personne et par liste |
| qui le retire | tout décideur (celui d'un autre demande confirmation) | son auteur seul, dans Classement › Mes choix |
| où | La liste › Déjà pris (on les tape AVANT de trier), ou la carte | la carte, ou un accord |
| table | `deja_pris` | `vetos` |

Les deux emportent les **graphies** (même prononciation, `gp` du catalogue) :
une ligne par graphie, rattachées à leur `tete`. Avant, bloquer Chloé faisait
arriver Cloé à la carte suivante, et chaque graphie coûtait un blocage — avec
deux blocages, un ex prénommé Chloé ne se bloquait tout simplement pas. Le
quota compte des têtes (trigger `trg_quota_veto`, migration 0002).

Pas de blocages illimités, même en payant : un secret illimité, c'est un droit
de censure invisible sur les goûts de l'autre, le contraire de ce que vend
l'app. Ce qui s'explique passe par « déjà pris », dont la transparence tient
lieu de limite.

Un « déjà pris » appartient à la liste : effacer son compte le laisse en
place, sans auteur ni note (`on delete set null` + `trg_deja_pris_sans_auteur`).

## Données personnelles (RGPD)

Tout ce que la loi demande, fait dans l'app plutôt que promis dans un texte :

| Droit / obligation | Où |
|---|---|
| Information (art. 13) | `/confidentialite`, et deux lignes au moment de créer le compte |
| Accès, portabilité (art. 15, 20) | *Mon compte → Télécharger mes données* : `GET /api/moi/donnees`, un JSON lisible — tout ce qui concerne la personne, rien des autres |
| Rectification (art. 16) | *Mon compte → Nom affiché* ; le reste se modifie dans l'app |
| Effacement (art. 17) | *Mon compte → Supprimer mon compte* : `POST /api/moi/supprimer` (mot `SUPPRIMER` exigé), immédiat |
| Conservation limitée (art. 5.1.e) | purge chaque nuit : tâche `server/tasks/purge.ts`, lancée par le *Cron Trigger* du Worker ; à la main : `GET /api/admin/purger` avec `CRON_SECRET` |
| Minimisation | e-mail facultatif, enregistré seulement une fois prouvé, et qui ne sert qu'à la connexion ; liens et codes gardés en empreintes ; compteurs d'essais sur des empreintes chiffrées (jamais une IP en clair) ; police servie par l'app (plus d'IP envoyée à Google) |
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

## Connexion sans mot de passe

Plus de clé d'accès à recopier. On crée son compte avec un prénom, puis
l'app propose (sans l'imposer) de quoi le retrouver ailleurs :

- **une passkey** (WebAuthn) : Face ID, empreinte ou code du téléphone. Elle
  se range dans le trousseau (iCloud, Google, 1Password…) et suit sur les
  autres appareils. La base ne garde que la clé **publique** ; rien de
  biométrique ne quitte le téléphone. Vérification confiée à
  `@simplewebauthn/server` (pas de cryptographie maison) ;
- **un lien par e-mail, doublé d'un code à 6 chiffres**. Le code est
  indispensable : l'app installée sur l'écran d'accueil a ses propres
  cookies, et le lien s'ouvrirait dans le navigateur, pas dans elle.

Sans l'un ni l'autre, l'accueil affiche « Ce compte n'existe que sur cet
appareil ». Les comptes d'avant gardent leur clé (« J'ai déjà une clé », en
petit) jusqu'à ce qu'ils la désactivent dans *Mon compte*.

| Où | Quoi |
|---|---|
| `server/api/auth/passkey/*` | options et vérification (inscription, connexion) ; défi dans un cookie signé de 5 min |
| `server/api/auth/lien*.ts`, `code.post.ts`, `email.*.ts` | lien + code (15 min, un seul usage, 5 codes faux et le lien meurt, empreintes seulement) |
| `server/utils/liens.ts`, `courriel.ts` | création/consommation des liens ; envoi (Brevo ou Resend, sans SDK) |
| `app/components/SecuriserCompte.vue`, `MoyensConnexion.vue`, `FormulaireEmail.vue` | l'étape après création, *Mon compte → Se connecter*, le formulaire adresse → code |
| `app/pages/connexion/lien.vue` | le lien de l'e-mail : jeton après le `#`, effacé de l'adresse, **un bouton** avant de le consommer (les robots des messageries ouvrent les liens) |

**Le domaine, avant tout.** Une passkey est liée au domaine où elle est
créée : `babynamed.fr`. En changer plus tard rend les passkeys existantes
inutilisables. Il sert aussi à l'e-mail : `connexion@babynamed.fr`.

**L'e-mail (Brevo)** — le prestataire est nommé dans
`shared/utils/editeur.ts` (`COURRIEL`), et la politique de confidentialité le
cite d'elle-même :

1. Créer un compte Brevo (gratuit, 300 e-mails/jour), puis *Senders, Domains
   & Dedicated IPs → Domains* : ajouter `babynamed.fr` et poser dans le DNS
   Cloudflare les enregistrements DKIM/DMARC qu'il donne.
2. *Transactional → Settings* : **couper le suivi des clics** (et des
   ouvertures). Un lien de connexion réécrit par un traceur passerait par
   un tiers, jeton compris.
3. *SMTP & API → API keys* : créer une clé ; en secret du Worker,
   `NUXT_EMAIL_CLE`. L'expéditeur, `NUXT_EMAIL_EXPEDITEUR`, est déjà dans
   `wrangler.jsonc` (`babyNamed <connexion@babynamed.fr>`).
4. `/api/sante` → `presence.courriel: true`.

Pour Resend à la place : `COURRIEL.fournisseur = 'resend'` dans
`editeur.ts` (la politique de confidentialité suit), même variables.

En local, rien ne part : les e-mails arrivent dans une boîte de
développement (*Mon compte → Outils de développement*, ou
`/api/dev/courriels`). Audrey a une adresse vérifiée, `audrey@exemple.test`.
Les passkeys marchent sur `http://localhost:3000` (pas sur une adresse IP :
WebAuthn refuse `127.0.0.1` comme domaine).

## Sécurité

Audit du 25 septembre 2026 : ce qui a été trouvé, et ce qui est en place.

| Risque | Parade |
|---|---|
| Deviner un code d'invitation (8 hexadécimaux : 4 milliards, une liste parmi mille tombe en une demi-journée à 100 essais/s) | nouveaux codes à 10 caractères (30^10) ; essais limités (10/h par compte, 30/h par IP) ; les anciens codes restent valables |
| Deviner un code reçu par e-mail (un million de valeurs) | 5 essais par lien, 10 par adresse et quart d'heure, 30 par IP |
| Créer des comptes ou des listes à la chaîne | 12 comptes/h par IP, 20 listes/jour par compte |
| Un observateur (lecture seule) récupérait le code qui fait entrer comme **membre** | les codes ne sont plus envoyés aux observateurs, ni créables par eux |
| Cookie volé ou téléphone perdu : une session signée ne se révoque pas | génération de sessions en base ; *Mon compte → Déconnecter mes autres appareils* |
| Requête forgée depuis un autre site (CSRF) | cookie `SameSite=Lax`, **et** refus des requêtes `Sec-Fetch-Site: cross-site` ou d'une autre `Origin` (`server/middleware/origine.ts`) |
| Script injecté (XSS) | Vue échappe tout (aucun `v-html`) ; **CSP à nonce** sur la coquille (`server/plugins/securite.ts`), CSP stricte sur les fiches statiques |
| Détournement de clic, reniflage de type, fuite d'adresse | `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS 2 ans (`server/entetes-securite.ts` ; sur les réponses du Worker par `server/middleware/entetes.ts`, sur les fichiers statiques par le `_headers` qu'écrit `modules/entetes-cache.ts`) |
| Écrire un mégaoctet par requête (prénom, filtres) | prénoms validés (60 caractères, lettres), filtres bornés à 4 Ko |
| Lien de connexion détourné par un en-tête `Host` forgé | sur Cloudflare, une requête n'atteint le Worker que par l'un de ses noms : l'adresse de la requête est sûre ; `X-Forwarded-Host` n'est jamais lu |
| `/api/admin/migrer` (du SQL derrière un secret en clair dans l'URL) | retirée |
| `/api/sante` publique renvoyait le message d'erreur du pilote de base | message générique en production |
| Nuxt 4.4.8 : failles connues (îlots serveur, cache de payload) | Nuxt 4.5.2, `npm audit` : 0 vulnérabilité |

Déjà bon avant l'audit, et vérifié : requêtes SQL paramétrées partout ;
vote aveugle appliqué côté serveur ; webhook Stripe signé et comparé en temps
constant ; aucune donnée de carte dans l'app ; routes de développement
absentes du build ; service worker qui ne met jamais `/api/` en cache.

La CSP ne s'applique qu'en production (Vite a ses propres scripts en
développement). Pour la vérifier : `npm run preview` (la version de
production dans workerd), puis ouvrir la page et regarder la console :
aucune ligne « Refused to… ».

`essai-connexion` couvre les passkeys (authentificateur virtuel de Chrome),
le lien et le code, la révocation, les limites (à leur valeur de production,
voir `essai-connexion.env`), l'origine, les observateurs, les tailles et les
en-têtes.

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

`server/assets/migrations/` fait foi : un fichier numéroté par changement
(`0001_initial.sql`, puis `0002_…`), **jamais modifié une fois poussé**. La
table `d1_migrations` (la même que wrangler) dit lesquels sont appliqués.

Ils s'appliquent tout seuls : au démarrage en local, et à la première
requête en production (`server/utils/db.ts`) — chaque fichier en un lot,
avec sa ligne de suivi : à moitié appliqué, il ne l'est pas du tout. Pour
les appliquer avant de pousser : `npm run base:migrer`.

SQLite n'a pas `alter table … add column if not exists` : une migration
s'écrit pour être jouée une fois, c'est la table de suivi qui l'empêche de
repasser.

## Vérifier

`GET /api/sante` dit ce qui est branché sans révéler aucune valeur :

```json
{ "presence": { "base": true, "base_variable": "DB (Cloudflare D1)", "secret_session": true,
                "paiement": true, "paiement_webhook": true, "purge_quotidienne": true },
  "legal": { "complet": false, "manquants": ["adresse", "telephone", "mediateur"],
             "bloquants": ["adresse", "telephone"], "vente_ouverte": false },
  "base": { "joignable": true, "moteur": "d1", "tables": 14,
            "migrations": { "appliquees": ["0001_initial.sql"], "rgpd.effacement_sans_cascade": true } } }
```

`legal.vente_ouverte: false` en production = le paiement est fermé tant que
`bloquants` n'est pas vide.

`"moteur": "d1"` partout : en local, c'est la D1 que simule wrangler.
