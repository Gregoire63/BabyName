#!/bin/sh
# Le build de PRODUCTION, dans workerd (le moteur de Cloudflare), puis l'essai.
#
#   sh essais/relance-worker.sh essais/essai-worker.mjs
#
# `nuxt dev` tourne sous Node, sans empaquetage : ce qui ne casse qu'une fois
# le Worker construit n'y apparaît pas (le 28/09 : un `import 'reflect-metadata'`
# retiré par Nitro, et aucune passkey ne se créait en production). Ici :
# `nuxt build` (sauf SANS_BUILD=1), `wrangler dev` sur la sortie, une base D1
# locale neuve, et un compte d'essai à la clé connue ABCD-EFGH-JKMN.
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
(setsid nohup npx wrangler dev --config .output/server/wrangler.json --port "$PORT" \
  --local-upstream "localhost:$PORT" --persist-to "$ETAT" \
  --var NUXT_SESSION_SECRET:essai-worker-secret-de-session-0123456789abcdef \
  --var NUXT_PUBLIC_SITE_URL:"http://localhost:$PORT" \
  --var CRON_SECRET:secret-essai-worker > /tmp/worker.log 2>&1 &)
for i in $(seq 1 60); do
  sleep 2
  curl -s -m 5 -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/sante" 2>/dev/null | grep -q 200 && break
done
# La clé d'accès se garde en empreinte SHA-256 de sa forme normalisée.
H=$(printf 'ABCDEFGHJKMN' | sha256sum | cut -d' ' -f1)
npx wrangler d1 execute DB --local --persist-to "$ETAT" --config .output/server/wrangler.json \
  --command "insert into utilisateurs (pseudo, cle_acces_hash) values ('Essai', '$H')" > /dev/null 2>&1
ESSAI_BASE="http://localhost:$PORT" CRON_SECRET=secret-essai-worker node "$1"
CODE=$?
pkill -f "wrangler dev --config .output" 2>/dev/null
rm -rf "$ETAT"
exit $CODE
