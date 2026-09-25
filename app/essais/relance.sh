#!/bin/sh
# Base neuve, serveur neuf, puis l'essai : sans ca, un essai qui change un vote
# fausse le suivant.
#
#   sh essais/relance.sh essais/essai-paiement.mjs
#
# Variables : ESSAI_BASE (defaut http://127.0.0.1:3100), ESSAI_CHROME (binaire
# impose), ESSAI_PLAYWRIGHT (chemin du module si non installe dans le projet).
RACINE=$(cd "$(dirname "$0")/.." && pwd)
cd "$RACINE" || exit 1
PORT=${ESSAI_PORT:-3100}

# Un essai peut avoir besoin d'un serveur configure autrement (le faux Stripe
# d'essai-caisse, par exemple) : il le dit dans un fichier voisin, charge ici
# et seulement pour lui. Les autres essais gardent un serveur sans cle.
ENV_ESSAI="${1%.mjs}.env"
if [ -f "$ENV_ESSAI" ]; then
  set -a; . "$ENV_ESSAI"; set +a
fi
pkill -f "nuxt dev" 2>/dev/null
sleep 3
rm -rf .data
(setsid nohup npx nuxt dev --port "$PORT" > /tmp/dev.log 2>&1 &)
for i in $(seq 1 60); do
  sleep 2
  curl -s -m 8 -o /tmp/s.json "http://127.0.0.1:$PORT/api/sante" 2>/dev/null \
    && grep -q joignable /tmp/s.json && break
done
node "$1"
