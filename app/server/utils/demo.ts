import { timingSafeEqual } from 'node:crypto'

/**
 * Le compte de démonstration — pour les équipes de validation d'Apple et de
 * Google.
 *
 * Elles doivent pouvoir entrer dans l'app, et on y entre par un e-mail
 * qu'elles ne peuvent pas lire : les deux stores demandent un identifiant et
 * un « mot de passe » qui n'expire pas. Ce compte en tient lieu — UNE adresse
 * (NUXT_DEMO_EMAIL) et UN code fixe à six chiffres (NUXT_DEMO_CODE, un
 * secret), posés sur le Worker. Sans eux, rien de ceci n'existe.
 *
 * On s'en sert comme de n'importe quel compte : l'adresse dans « Connexion »,
 * puis le code à la place de celui de l'e-mail (aucun e-mail ne part).
 *
 * Ce que ça ouvre : ce compte-là, et lui seul — personne n'est derrière. Le
 * code ne vaut pour aucune autre adresse, les freins des codes s'y appliquent
 * (dix essais par quart d'heure et par adresse, code.post.ts), et il se
 * change d'une commande une fois la validation passée.
 *
 * L'ADRESSE DOIT ÊTRE IMPOSSIBLE : un domaine réservé (.test, .example,
 * .invalid — RFC 2606), « demo@babynamed.test ». Personne ne peut recevoir
 * d'e-mail à une telle adresse, donc aucun vrai compte ne peut l'avoir
 * confirmée : un code fixe posé par mégarde sur l'adresse de quelqu'un aurait
 * ouvert SON compte. Toute autre adresse est ignorée, comme si rien n'était
 * réglé.
 */
const ADRESSE_IMPOSSIBLE = /^[^@\s]+@[^@\s]+\.(test|example|invalid)$/

function reglage(): { email: string; code: string } | null {
  const c = useRuntimeConfig()
  const email = String(c.demoEmail || '').trim().toLowerCase()
  // String() : un secret tout en chiffres arrive parfois en nombre.
  const code = String(c.demoCode || '').replace(/\D/g, '')
  return ADRESSE_IMPOSSIBLE.test(email) && code.length === 6 ? { email, code } : null
}

/** Cette adresse est-elle celle du compte de démonstration ? */
export function estAdresseDemo(email: string): boolean {
  return reglage()?.email === email
}

/** Le code tapé est-il le code fixe de ce compte ? (Comparé à temps constant.) */
export function codeDemoJuste(email: string, code: unknown): boolean {
  const r = reglage()
  if (!r || r.email !== email) return false
  const recu = String(code ?? '').replace(/\D/g, '')
  return recu.length === 6 && timingSafeEqual(Buffer.from(recu), Buffer.from(r.code))
}
