import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'

const COOKIE = 'pr_session'
const DUREE = 60 * 60 * 24 * 120          // 120 jours

const b64 = (b: Buffer) => b.toString('base64url')

function secret(): string {
  // String() : destr transformerait un secret 100 % numerique en nombre
  const s = String(useRuntimeConfig().sessionSecret || process.env.SESSION_SECRET || '')
  if (!s) throw createError({ statusCode: 500, statusMessage: 'SESSION_SECRET absente' })
  return s
}

function signer(charge: string): string {
  return b64(createHmac('sha256', secret()).update(charge).digest())
}

export function creerJeton(userId: string): string {
  const charge = b64(Buffer.from(JSON.stringify({ u: userId, e: Math.floor(Date.now() / 1000) + DUREE })))
  return `${charge}.${signer(charge)}`
}

export function lireJeton(jeton: string | undefined): string | null {
  if (!jeton || !jeton.includes('.')) return null
  const [charge, sig] = jeton.split('.')
  const attendu = Buffer.from(signer(charge))
  const recu = Buffer.from(sig)
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return null
  try {
    const { u, e } = JSON.parse(Buffer.from(charge, 'base64url').toString())
    if (!u || typeof e !== 'number' || e < Math.floor(Date.now() / 1000)) return null
    return u as string
  } catch { return null }
}

export function poserSession(e: H3Event, userId: string) {
  setCookie(e, COOKIE, creerJeton(userId), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: DUREE
  })
}

export function retirerSession(e: H3Event) {
  deleteCookie(e, COOKIE, { path: '/' })
}

export function userIdOuNull(e: H3Event): string | null {
  return lireJeton(getCookie(e, COOKIE))
}

export function jetonAleatoire(): string {
  return randomBytes(32).toString('base64url')
}
