#!/bin/sh
# Le build de PRODUCTION, dans workerd (le moteur de Cloudflare), puis l'essai.
#
#   sh essais/relance-worker.sh essais/essai-worker.mjs
#
# `nuxt dev` tourne sous Node, sans empaquetage : ce qui ne casse qu'une fois
# le Worker construit n'y apparaît pas (le 28/09 : un `import 'reflect-metadata'`
# retiré par Nitro, et aucune passkey ne se créait en production). Ici :
# `nuxt build` (sauf SANS_BUILD=1), `wrangler dev` sur la sortie, une base D1
# locale neuve, un compte d'essai et un lien de connexion au jeton connu —
# la production n'a pas d'autre porte que l'e-mail et la passkey.
#
# `--local-upstream` garde localhost comme adresse de la requête : sans lui,
# wrangler la réécrit en babynamed.fr (la route du Worker), et les passkeys
# visent le mauvais domaine.
RACINE=$(cd "$(dirname "$0")/.." && pwd)
cd "$RACINE" || exit 1
PORT=${ESSAI_PORT_WORKER:-8799}
ETAT=$(mktemp -d)
if [ "$SANS_BUILD" != "1" ]; then
  npx nuxt build > /tmp/build-worker.log 2>&1 || { tail -30 /tmp/build-worker.log; exit 1; }
fi
pkill -f "wrangler dev --config .output" 2>/dev/null
sleep 1
# Un essai peut vouloir un Worker réglé autrement (essai-worker.env : le faux
# service de notifications, le compte de démonstration des stores…). Chaque
# ligne NOM=valeur de son fichier voisin devient une variable du Worker, et de
# l'essai. Des valeurs sans espace.
VARS=""
ENV_ESSAI="${1%.mjs}.env"
if [ -f "$ENV_ESSAI" ]; then
  while IFS='=' read -r nom valeur; do
    case "$nom" in ''|'#'*) continue ;; esac
    VARS="$VARS --var $nom:$valeur"
  done < "$ENV_ESSAI"
  set -a; . "$ENV_ESSAI"; set +a
fi
# shellcheck disable=SC2086  # $VARS : plusieurs arguments, exprès
(setsid nohup npx wrangler dev --config .output/server/wrangler.json --port "$PORT" \
  --local-upstream "localhost:$PORT" --persist-to "$ETAT" \
  --var NUXT_SESSION_SECRET:essai-worker-secret-de-session-0123456789abcdef \
  --var NUXT_PUBLIC_SITE_URL:"http://localhost:$PORT" \
  --var CRON_SECRET:secret-essai-worker $VARS > /tmp/worker.log 2>&1 &)
for i in $(seq 1 60); do
  sleep 2
  curl -s -m 5 -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/sante" 2>/dev/null | grep -q 200 && break
done
# Le lien, comme s'il venait de l'e-mail : la base n'en garde que l'empreinte
# (SHA-256 du jeton, en base64url — server/utils/liens.ts), une heure.
JETON=essai-worker-jeton-de-connexion-0123456789
H=$(node -e "process.stdout.write(require('node:crypto').createHash('sha256').update(process.argv[1]).digest('base64url'))" "$JETON")
MAINTENANT="strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
npx wrangler d1 execute DB --local --persist-to "$ETAT" --config .output/server/wrangler.json \
  --command "insert into utilisateurs (pseudo, email, email_verifie_le) values ('Essai', 'essai@exemple.test', $MAINTENANT);
    insert into liens_connexion (id, email, user_id, but, code_hash, expire_le)
      select '$H', email, id, 'connexion', 'x', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+1 hour')
        from utilisateurs where email = 'essai@exemple.test'" > /dev/null 2>&1
ESSAI_BASE="http://localhost:$PORT" ESSAI_JETON="$JETON" CRON_SECRET=secret-essai-worker node "$1"
CODE=$?
pkill -f "wrangler dev --config .output" 2>/dev/null
rm -rf "$ETAT"
exit $CODE
