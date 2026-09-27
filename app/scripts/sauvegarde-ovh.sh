#!/usr/bin/env bash
# Sauvegarde nocturne de la base (D1) sur l'hébergement OVH — chiffrée.
#
# Lancé chaque nuit par GitHub Actions (.github/workflows/sauvegarde-base.yml,
# à la racine du dépôt) : export de la base Cloudflare, compression, chiffrement
# avec la clé PUBLIQUE age de Greg, dépôt en SFTP dans un dossier hors de www/
# (jamais servi sur le web), puis rotation.
#
# Pourquoi, alors que D1 a déjà son « Time Travel » ? Il remonte 7 jours sur
# l'offre gratuite, et vit dans le même compte Cloudflare que la base : un
# compte perdu, une suppression remarquée trop tard, et il ne reste rien.
# Ici, une copie ailleurs, chez un autre prestataire, sur 30 jours et 12 mois.
#
# Chiffrée avant de partir : OVH ne stocke que des octets illisibles. La clé
# privée ne vit que chez Greg (gestionnaire de mots de passe) ; sans elle,
# personne — ni OVH, ni GitHub, ni quelqu'un qui volerait le mot de passe
# SFTP — ne lit une sauvegarde.
#
# Variables (secrets du dépôt GitHub, sauf mention) :
#   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID  jeton limité à D1 (export)
#   AGE_DESTINATAIRE      clé publique age, « age1… » (variable, pas secret)
#   OVH_SFTP_HOTE         ex. ftp.cluster0XX.hosting.ovh.net
#   OVH_SFTP_UTILISATEUR  l'identifiant FTP/SFTP de l'hébergement
#   LFTP_PASSWORD         son mot de passe (lu par lftp --env-password)
#   OVH_SFTP_PORT         22 par défaut
#   D1_NOM                babynamed par défaut
#   DOSSIER               sauvegardes par défaut (à la racine, hors de www/)
#   BUDGET_MO             90 par défaut : l'hébergement gratuit fait 100 Mo en
#                         tout — au-delà, les plus anciennes partent d'abord
#
# Restaurer (sur son ordinateur, la clé privée sous la main) :
#   age -d -i babynamed-sauvegarde.key babynamed-AAAA-MM-JJ.sql.gz.age | gunzip > base.sql
#   npx wrangler d1 create babynamed-restauree --jurisdiction eu
#   npx wrangler d1 execute babynamed-restauree --remote --file base.sql
set -euo pipefail

: "${AGE_DESTINATAIRE:?clé publique age manquante (variable AGE_DESTINATAIRE)}"
: "${OVH_SFTP_HOTE:?hôte SFTP manquant}"
: "${OVH_SFTP_UTILISATEUR:?utilisateur SFTP manquant}"
: "${LFTP_PASSWORD:?mot de passe SFTP manquant}"
: "${CLOUDFLARE_API_TOKEN:?jeton Cloudflare manquant}"
PORT="${OVH_SFTP_PORT:-22}"
D1="${D1_NOM:-babynamed}"
DOSSIER="${DOSSIER:-sauvegardes}"
BUDGET=$(( ${BUDGET_MO:-90} * 1000 * 1000 ))
case "$DOSSIER" in www|www/*) echo "le dossier des sauvegardes ne doit pas être sous www/" >&2; exit 1 ;; esac

jour=$(date -u +%F)
nom="babynamed-$jour.sql.gz.age"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# 1. L'export. Il bloque la base quelques secondes : d'où la nuit.
( cd "$tmp" && npx --yes wrangler@4 d1 export "$D1" --remote --output base.sql --skip-confirmation )
# Un export vide ou tronqué ne doit rien remplacer.
grep -qi "create table" "$tmp/base.sql" || { echo "export sans schéma : rien n'est déposé" >&2; exit 1; }
octets=$(wc -c < "$tmp/base.sql")

# 2. Compresser, chiffrer, oublier le clair.
gzip -9 "$tmp/base.sql"
age -r "$AGE_DESTINATAIRE" -o "$tmp/$nom" "$tmp/base.sql.gz"
rm -f "$tmp/base.sql.gz"

sftp() { lftp --env-password -u "$OVH_SFTP_UTILISATEUR" -p "$PORT" \
  -e "set sftp:auto-confirm yes; set net:max-retries 2; set net:timeout 30; $1 bye" "sftp://$OVH_SFTP_HOTE"; }

# 3. Déposer, puis relire la liste, tailles comprises (« taille nom »).
sftp "mkdir -p $DOSSIER; put $tmp/$nom -o $DOSSIER/$nom; cls -1 --size --block-size=1 $DOSSIER/;" \
  | sed -nE 's#^ *([0-9]+) +(.*/)?(babynamed-[0-9]{4}-[0-9]{2}-[0-9]{2}\.sql\.gz\.age)$#\1 \3#p' \
  | sort -k2 > "$tmp/liste"
grep -q " $nom\$" "$tmp/liste" || { echo "le dépôt n'apparaît pas dans la liste" >&2; exit 1; }

# 4. Rotation : les 30 dernières nuits et la première sauvegarde de chacun des
#    12 derniers mois — puis, si le tout dépasse le budget (l'hébergement
#    gratuit fait 100 Mo), les plus anciennes partent jusqu'à ce qu'il tienne.
#    Celle de cette nuit reste toujours.
mapfile -t tous < <(cut -d' ' -f2 "$tmp/liste")
garder=$( { printf '%s\n' "${tous[@]}" | sort -r | head -n 30
            printf '%s\n' "${tous[@]}" | sort | awk -F- '!vu[$2"-"$3]++' | tail -n 12; } | sort -u )
total=0
while read -r taille f; do
  grep -qx "$f" <<< "$garder" && total=$(( total + taille ))
done < "$tmp/liste"
while [ "$total" -gt "$BUDGET" ]; do
  plus_ancienne=$(head -n 1 <<< "$garder")
  [ "$plus_ancienne" = "$nom" ] && break
  total=$(( total - $(awk -v f="$plus_ancienne" '$2 == f { print $1 }' "$tmp/liste") ))
  garder=$(tail -n +2 <<< "$garder")
done
retirer=""
for f in "${tous[@]}"; do
  grep -qx "$f" <<< "$garder" || retirer+="rm $DOSSIER/$f; "
done
[ -n "$retirer" ] && sftp "$retirer"

echo "sauvegarde $nom déposée ($octets octets en clair ; $(grep -c . <<< "$garder") gardées, $(( total / 1000000 )) Mo sur ${BUDGET_MO:-90})"
