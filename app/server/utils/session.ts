import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'

const COOKIE = 'pr_session'
// 120 jours : la valeur est dans CONSERVATION (shared/utils/editeur.ts), que
// la politique de confidentialite affiche. Un seul chiffre, deux lecteurs.
const DUREE = 60 * 60 * 24 * CONSERVATION.sessionJours

const b64 = (b: Buffer) => b.toString('base64url')

function secret(): string {
  // String() : destr transformerait un secret 100 % numerique en nombre
  const s = String(useRuntimeConfig().sessionSecret || process.env.SESSION_SECRET || '')
  if (s) return s
  // En developpement, la base est locale et jetable : exiger le secret de
  // production pour pouvoir simplement se connecter en local n'apporte
  // aucune securite, ca empeche juste de lancer l'app. `import.meta.dev`
  // vaut false a la compilation : cette branche n'existe pas en production.
  if (import.meta.dev) return 'developpement-local-sans-valeur'
  throw createError({ statusCode: 500, statusMessage: 'SESSION_SECRET absente' })
}

function signer(charge: string): string {
  return b64(createHmac('sha256', secret()).update(charge).digest())
}

/**
 * Le cookie porte le compte ET sa generation de sessions (`g`).
 *
 * Un cookie signe ne se revoque pas : tant qu'il n'a pas expire, il dit vrai.
 * La generation, elle, vit en base (utilisateurs.session_gen) ; chaque
 * requete la compare (voir garde.ts). « Deconnecter mes autres appareils »
 * l'incremente, et tous les cookies emis avant cessent de valoir d'un coup.
 * Un cookie d'avant cette regle n'a pas de `g` : il vaut 0, la generation de
 * depart — personne n'est deconnecte par la mise a jour.
 */
export function creerJeton(userId: string, gen = 0): string {
  const charge = b64(Buffer.from(JSON.stringify({ u: userId, g: gen, e: Math.floor(Date.now() / 1000) + DUREE })))
  return `${charge}.${signer(charge)}`
}

export interface Session { u: string; g: number }

export function lireJeton(jeton: string | undefined): Session | null {
  if (!jeton || !jeton.includes('.')) return null
  const [charge, sig] = jeton.split('.')
  if (!charge || !sig) return null
  const attendu = Buffer.from(signer(charge))
  const recu = Buffer.from(sig)
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return null
  try {
    const { u, g, e } = JSON.parse(Buffer.from(charge, 'base64url').toString())
    if (!u || typeof u !== 'string' || typeof e !== 'number' || e < Math.floor(Date.now() / 1000)) return null
    return { u, g: Number.isInteger(g) ? g : 0 }
  } catch { return null }
}

export function poserSession(e: H3Event, userId: string, gen = 0) {
  setCookie(e, COOKIE, creerJeton(userId, gen), {
    // secure en production ; en local on sert en http, et Safari refuse un
    // cookie Secure sur http://localhost — on ne pourrait pas se connecter.
    httpOnly: true, secure: !import.meta.dev, sameSite: 'lax', path: '/', maxAge: DUREE
  })
}

export function retirerSession(e: H3Event) {
  deleteCookie(e, COOKIE, { path: '/' })
}

/** Le compte du cookie, SANS verifier sa generation : a reserver aux
 *  chemins qui la verifient ensuite en base (garde.ts). */
export function sessionOuNull(e: H3Event): Session | null {
  return lireJeton(getCookie(e, COOKIE))
}

export function jetonAleatoire(): string {
  return randomBytes(32).toString('base64url')
}

/** Le secret du serveur, pour signer autre chose que la session (defis
 *  WebAuthn, codes recus par e-mail, empreintes des limites). */
export function secretServeur(): string { return secret() }

/** Un HMAC court, en base64url : empreinte non reversible d'une valeur. */
export function empreinteSignee(valeur: string, contexte: string): string {
  return b64(createHmac('sha256', secret()).update(`${contexte}\u0000${valeur}`).digest())
}
