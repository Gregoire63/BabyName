import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

/**
 * Les passkeys (WebAuthn), côté serveur : où elles valent, et le défi.
 *
 * La vérification elle-même est confiée à @simplewebauthn/server — du code
 * de cryptographie audité, pas une réécriture maison. Ici, seulement ce qui
 * dépend de l'app.
 */

/**
 * La « partie de confiance » : le domaine auquel une passkey est liée.
 *
 * Une passkey créée sur babynamed.fr ne vaut QUE là : c'est ce qui la rend
 * insensible à l'hameçonnage (une copie de la page sur un autre domaine ne
 * peut rien en tirer). Conséquence : changer de domaine plus tard rend les
 * passkeys existantes inutilisables.
 *
 * L'adresse de la REQUÊTE fait foi, et c'est sûr sur Cloudflare : une requête
 * n'atteint le Worker que par l'un de SES noms (babynamed.fr, ou l'adresse
 * workers.dev d'essai tant qu'elle est ouverte) — un en-tête Host forgé mène
 * ailleurs, pas ici. Un lien de connexion part donc toujours vers l'app
 * elle-même. NUXT_PUBLIC_SITE_URL s'ajoute aux origines acceptées ; en
 * local, c'est localhost.
 */
export function partieConfiante(e: H3Event) {
  const origine = getRequestURL(e).origin
  const site = String(useRuntimeConfig().public.siteUrl || '').replace(/\/$/, '')
  const origines = [...new Set([origine, site].filter(Boolean))]
  return {
    rpID: new URL(origine).hostname,
    origine,
    origines,
    rpIDs: [...new Set(origines.map(o => new URL(o).hostname))]
  }
}

/**
 * Le défi d'une cérémonie WebAuthn, dans un cookie signé de 5 minutes.
 *
 * Pas de table : le défi n'a de valeur que pour la requête suivante du même
 * navigateur. Signé (on ne peut pas le forger), limité à un but
 * (« inscription » ne sert pas à « connexion ») et, pour l'inscription, au
 * compte qui l'a demandé. Effacé dès qu'il est lu : un seul usage.
 */
const COOKIE_DEFI = 'pr_defi'
type But = 'inscription' | 'connexion'

export function poserDefi(e: H3Event, defi: { c: string; b: But; u?: string }) {
  const charge = Buffer.from(JSON.stringify({ ...defi, e: Date.now() + 5 * 60_000 })).toString('base64url')
  setCookie(e, COOKIE_DEFI, `${charge}.${empreinteSignee(charge, 'defi')}`, {
    httpOnly: true, secure: !import.meta.dev, sameSite: 'strict', path: '/api/auth', maxAge: 300
  })
}

export function lireDefi(e: H3Event, but: But): { c: string; u?: string } | null {
  const brut = getCookie(e, COOKIE_DEFI)
  deleteCookie(e, COOKIE_DEFI, { path: '/api/auth' })
  if (!brut || !brut.includes('.')) return null
  const [charge, sig] = brut.split('.')
  if (!charge || !sig) return null
  const attendu = Buffer.from(empreinteSignee(charge, 'defi'))
  const recu = Buffer.from(sig)
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return null
  try {
    const d = JSON.parse(Buffer.from(charge, 'base64url').toString())
    if (d.b !== but || typeof d.c !== 'string' || typeof d.e !== 'number' || d.e < Date.now()) return null
    return { c: d.c, u: d.u }
  } catch { return null }
}

/**
 * Un nom lisible pour la liste des passkeys : le gestionnaire qui la garde
 * quand on le reconnaît (son identifiant AAGUID), sinon l'appareil.
 * « Trousseau iCloud » dit où la retrouver ; « Passkey n° 2 » ne dit rien.
 */
const GESTIONNAIRES: Record<string, string> = {
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'Trousseau iCloud',
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Gestionnaire Google',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome sur Mac',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
  '53414d53-554e-4700-0000-000000000000': 'Samsung Pass',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  '531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
  '50726f74-6f6e-5061-7373-50726f746f6e': 'Proton Pass'
}

export function nomPasskey(aaguid: string | undefined, ua: string): string {
  const connu = aaguid ? GESTIONNAIRES[aaguid.toLowerCase()] : undefined
  if (connu) return connu
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  if (/CrOS/.test(ua)) return 'Chromebook'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Passkey'
}
