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
| en commun | 9 prénoms, de quoi remplir Communs, Duels et Top |

`Kevin` est volontairement jugé « non » **avant** le balayage de sa famille :
c'est le cas limite qui vérifie qu'un choix individuel survit à la remise en
jeu d'une famille.

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
