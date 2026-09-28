#!/usr/bin/env node
/**
 * IndexNow : signale a Bing (et Yandex, Seznam, Naver, qui partagent les
 * soumissions) les URL du sitemap dont le HTML a change depuis le dernier
 * envoi reussi. A lancer APRES `wrangler deploy` : la page doit deja etre en
 * ligne quand le robot vient la chercher.
 *
 * Entree : .seo-empreintes.json (ecrit par scripts/seo.mjs a chaque build).
 * Etat    : .indexnow-envoye.json (local, gitignore) = ce qui a ete accepte.
 *           Le premier lancement envoie donc tout le sitemap, une fois.
 * Sort aussi les URL qui ont QUITTE le sitemap (passees en noindex ou
 * supprimees) : sans ca, Bing garderait l'ancienne version indexee.
 *
 * Google ignore IndexNow : pour lui, c'est le sitemap et la Search Console.
 *
 *   node scripts/indexnow.mjs           envoie
 *   node scripts/indexnow.mjs --essai   affiche ce qui partirait, n'envoie rien
 *   node scripts/indexnow.mjs --tout    renvoie tout le sitemap
 *
 * Ne fait jamais echouer un deploiement : en cas de souci, un avertissement
 * et code 0 ; l'etat n'avance pas, le prochain lancement renverra.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EMPREINTES = resolve(RACINE, '.seo-empreintes.json')
const ETAT = resolve(RACINE, '.indexnow-envoye.json')
const ESSAI = process.argv.includes('--essai')
const TOUT = process.argv.includes('--tout')
const LOT = 10000                                // limite du protocole par requete
const avertir = m => { console.warn(`[indexnow] ${m}`); process.exit(0) }

if (!existsSync(EMPREINTES)) avertir('pas de .seo-empreintes.json : lancer le build (scripts/seo.mjs) avant.')
const { site, cle, urls } = JSON.parse(readFileSync(EMPREINTES, 'utf8'))
const hote = new URL(site).host
if (/localhost|workers\.dev|vercel\.app/.test(hote)) avertir(`domaine ${hote} : rien a signaler.`)

const avant = !TOUT && existsSync(ETAT) ? JSON.parse(readFileSync(ETAT, 'utf8')) : {}
const changees = Object.keys(urls).filter(u => avant[u] !== urls[u])
const sorties = Object.keys(avant).filter(u => !(u in urls))
const aEnvoyer = [...changees, ...sorties]

console.log(`[indexnow] ${hote} : ${changees.length} nouvelles ou modifiees, ${sorties.length} sorties du sitemap`)
if (!aEnvoyer.length) process.exit(0)
if (ESSAI) { console.log(aEnvoyer.slice(0, 30).map(u => '  ' + u).join('\n') + (aEnvoyer.length > 30 ? `\n  … +${aEnvoyer.length - 30}` : '')); process.exit(0) }

// La cle doit etre en ligne, sinon IndexNow repond 403 et on croirait a une panne.
const keyLocation = `${site}/${cle}.txt`
try {
  const r = await fetch(keyLocation, { cache: 'no-store' })
  if (!r.ok || (await r.text()).trim() !== cle) avertir(`${keyLocation} ne renvoie pas la cle : deploiement pas encore en ligne ?`)
} catch (e) { avertir(`${keyLocation} injoignable (${e.message}).`) }

const etat = { ...avant }
for (const u of sorties) delete etat[u]
for (let i = 0; i < aEnvoyer.length; i += LOT) {
  const lot = aEnvoyer.slice(i, i + LOT)
  const envoyer = () => fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: hote, key: cle, keyLocation, urlList: lot.map(u => site + u) })
  })
  let r
  try {
    r = await envoyer()
    // 403 juste apres un deploiement : le robot qui verifie la cle a pu
    // tomber sur un point de Cloudflare qui servait encore l'ancienne
    // version, sans le fichier. Une seconde chance, 90 s plus tard.
    if (r.status === 403) {
      console.log('[indexnow] cle refusee (403) : nouvel essai dans 90 s…')
      await new Promise(ok => setTimeout(ok, 90_000))
      r = await envoyer()
    }
  } catch (e) { avertir(`envoi impossible (${e.message}).`) }
  // 200 = recu, 202 = recu, cle en cours de verification. Le reste : on garde l'etat.
  if (r.status !== 200 && r.status !== 202) {
    const detail = { 400: 'requete invalide', 403: 'cle refusee', 422: 'URL hors du domaine ou cle incoherente', 429: 'trop de requetes' }[r.status] ?? ''
    avertir(`HTTP ${r.status} ${detail} : rien n'est marque envoye.`
      + (r.status === 403 ? ` Verifier que ${keyLocation} n'est pas bloque aux robots (Cloudflare : Securite > Evenements).` : ''))
  }
  for (const u of lot) if (u in urls) etat[u] = urls[u]
  writeFileSync(ETAT, JSON.stringify(etat, null, 1))
  console.log(`[indexnow] lot ${i / LOT + 1} : ${lot.length} URL acceptees (HTTP ${r.status})`)
}
