/**
 * L'app ne ralentit pas avec l'usage.
 *
 * Tout se passe sur une liste qui a servi : 450 prénoms jugés par Paul, 360
 * par Alice, des dizaines d'accords et de désaccords. C'est là que ça
 * cassait, et un jeu d'essai de trente votes ne le montrait pas.
 *
 * Ce qui se vérifie ici :
 *  - un vote ne fige pas l'écran, que les autres onglets aient été ouverts ou
 *    non (une fois « À revoir » ouvert, chaque swipe attendait qu'il se
 *    redessine : huit secondes sur un téléphone) ;
 *  - un onglet ou un volet qu'on ne regarde pas ne travaille pas : rien n'y
 *    bouge pendant qu'on trie, et il est à jour quand on y revient ;
 *  - « À revoir » s'ouvre sans geler, et ce qu'il explique est exactement ce
 *    que dit la règle, recalculée ici prénom par prénom, à l'ancienne ;
 *  - les cartes hors de l'écran des longues listes ne sont pas mises en page ;
 *  - la tête de pile est bien celle de l'ordre complet, et le catalogue n'est
 *    pas réactif (c'était, à lui seul, un quart de seconde par vote).
 *
 * Les seuils sont larges exprès (les machines diffèrent) : ils laissent
 * passer un ordinateur trois fois plus lent, pas un retour de ce qu'ils
 * gardent, qui était dix à quatre-vingts fois au-dessus.
 */
import { readFileSync } from 'node:fs'
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []
const GID = 1

// ---------------------------------------------------------------- les données
// Les cartes du tri, dans l'ordre du catalogue : une par prononciation,
// [la graphie la plus donnée, ...les autres]. Sans les très rares.
const cat = JSON.parse(readFileSync(new URL('../public/data/catalogue.json', import.meta.url), 'utf8'))
const groupes = new Map()
cat.cols.l.forEach((l, i) => {
  if (cat.cols.q?.[i]) return
  const gp = cat.cols.gp ? cat.cols.gp[i] : i
  if (!groupes.has(gp)) groupes.set(gp, [])
  groupes.get(gp).push(l)
})
const cartes = [...groupes.values()]
const fiche = new Map(cat.cols.l.map((l, i) => [l, { l, y: cat.cols.y[i], o: cat.cols.o[i], p: cat.cols.p[i] }]))

async function ouvrir(qui) {
  const { ctx, page } = await onglet(nav)
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await ctx.addInitScript(() => {
    // ce qui bloque le fil principal, relevé pour chaque geste
    window.__longs = []
    try {
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__longs.push([e.startTime, e.duration]) })
        .observe({ entryTypes: ['longtask'] })
    } catch { /* pas de mesure, pas d'essai : on le verra aux assertions */ }
    // pas de mur « c'est assez pour aujourd'hui » au 40e prénom pendant la mesure
    try { localStorage.setItem(`pr_1_${new Date().toISOString().slice(0, 10)}_bonus`, '100000') } catch { /* tant pis */ }
  })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, qui)
  await page.locator('.bento').first().waitFor({ timeout: 30000 })
  return { ctx, page }
}
const semer = (page, liste, valeurDe) => page.evaluate(async ([gid, liste, valeurs]) => {
  let rates = 0
  const un = async (i) => {
    const [prenom, ...variantes] = liste[i]
    const r = await fetch(`/api/groupes/${gid}/vote`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prenom, valeur: valeurs[i], variantes }) })
    if (!r.ok) rates++
  }
  for (let i = 0; i < liste.length; i += 12) await Promise.all(liste.slice(i, i + 12).map((_, k) => un(i + k)))
  return rates
}, [GID, liste, liste.map((_, i) => valeurDe(i))])

const P = await ouvrir('Paul')
const A = await ouvrir('Alice')
// Paul : un oui sur trois ; Alice : un oui sur deux, sur les 360 premiers.
const ratesP = await semer(P.page, cartes.slice(0, 450), i => (i % 3 === 0 ? 2 : i % 3 === 1 ? 0 : 1))
const ratesA = await semer(A.page, cartes.slice(0, 360), i => (i % 2 === 0 ? 2 : 0))
await A.ctx.close()
dit(ratesP === 0 && ratesA === 0, 'une liste qui a servi : 450 prénoms jugés par Paul, 360 par Alice')

const page = P.page
await page.locator('a.carte', { hasText: 'Notre liste' }).first().click()
await page.locator('.carte.fiche:not(.derriere) .nom').first().waitFor({ timeout: 40000 })
await page.waitForTimeout(1500)

// ---------------------------------------------------------------- les mesures
/** Vote d'un bouton, et attend la carte suivante. Rend le temps où le fil principal a été bloqué. */
async function swipe(classe) {
  const t0 = await page.evaluate(() => performance.now())
  const r = await page.evaluate((classe) => new Promise(res => {
    const nom = () => document.querySelector('.carte.fiche:not(.derriere) .nom')?.textContent?.trim()
    const avant = nom(), b = document.querySelector(`.boutons .rond.${classe}`)
    if (!b) return res({ erreur: document.querySelector('.vide h2')?.textContent ?? 'pas de bouton' })
    b.click()
    const debut = performance.now()
    const suit = () => {
      const n = nom()
      if (n && n !== avant) res({ avant, apres: n })
      else if (performance.now() - debut > 20000) res({ erreur: 'la carte suivante n’est jamais venue' })
      else requestAnimationFrame(suit)
    }
    requestAnimationFrame(suit)
  }), classe)
  await page.waitForTimeout(900)   // la réponse du serveur, et ce qu'elle déclenche
  if (await page.locator('[aria-modal="true"]').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(500) }
  const bloque = await page.evaluate((t0) => Math.round(window.__longs.filter(([t]) => t >= t0).reduce((s, [, d]) => s + d, 0)), t0)
  return { ...r, bloque }
}
async function geste(faire, attente = 1200) {
  const t0 = await page.evaluate(() => performance.now())
  await faire()
  await page.waitForTimeout(attente)
  return page.evaluate((t0) => Math.round(window.__longs.filter(([t]) => t >= t0).reduce((s, [, d]) => s + d, 0)), t0)
}
const mediane = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const versOnglet = t => page.evaluate((t) => [...document.querySelectorAll('nav.onglets button')].find(x => x.textContent.includes(t))?.click(), t)
const versVolet = id => page.evaluate((id) => document.getElementById(`onglet-${id}`)?.click(), id)

// =================== 1. UN VOTE, RIEN D'AUTRE D'OUVERT ======================
const seuls = []
for (const c of ['non', 'oui', 'neutre', 'non', 'oui']) {
  const s = await swipe(c)
  if (s.erreur) console.log('   [swipe]', s.erreur)
  seuls.push(s.bloque)
}
const seul = mediane(seuls)
dit(seuls.length === 5 && seul < 150,
  `un vote ne fige pas l’écran : ${seul} ms de tâches longues (médiane de 5 votes ; 250 à 300 avant)`)

// =================== 2. « À REVOIR » S'OUVRE SANS GELER ====================
const versClassement = await geste(() => versOnglet('Classement'), 1500)
await page.locator('#volet-communs .commun').first().waitFor({ timeout: 10000 })
const nbCommuns = await page.locator('#volet-communs .commun').count()
dit(nbCommuns >= 40 && versClassement < 800,
  `le classement s’ouvre sur ${nbCommuns} accords sans geler (${versClassement} ms de tâches longues)`)
const versRevoir = await geste(() => versVolet('revoir'), 2500)
await page.locator('#volet-revoir .desaccord').first().waitFor({ timeout: 10000 })
const nbDesaccords = await page.locator('#volet-revoir .desaccord').count()
dit(nbDesaccords >= 60 && versRevoir < 800,
  `« À revoir » s’ouvre sur ${nbDesaccords} désaccords sans geler (${versRevoir} ms de tâches longues ; plus de 2 000 avant)`)

// Ce qu'il explique : la règle d'origine, rejouée ici prénom par prénom.
const votes = (await page.evaluate(gid => fetch(`/api/groupes/${gid}/votes`).then(r => r.json()), GID)).votes
const moi = (await page.evaluate(gid => fetch(`/api/groupes/${gid}`).then(r => r.json()), GID)).moi.user_id
const nbFr = (x, d = 1) => { const s = x.toFixed(d); return (s.endsWith('.0') ? s.slice(0, -2) : s).replace('.', ',') }
const moyenne = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const ecartType = xs => { if (xs.length < 3) return 0; const m = moyenne(xs); return Math.sqrt(moyenne(xs.map(x => (x - m) ** 2))) }
const AXES = [
  { nom: 'la longueur', valeur: p => p.y, dire: x => `${nbFr(x)} syllabes` },
  { nom: 'la rareté', valeur: p => p.o, dire: x => `${nbFr(x, 0)}/100 d'originalité` },
  { nom: "l'époque", valeur: p => (p.p >= 1900 ? p.p : null), dire: x => `un sommet vers ${Math.round(x)}` }
]
function regle(prenom) {
  const p = fiche.get(prenom)
  const refus = votes.find(v => v.prenom === prenom && v.valeur === 0 && v.user_id !== moi)
  if (!p || !refus) return null
  const sesOui = votes.filter(v => v.user_id === refus.user_id && v.valeur === 2).map(v => fiche.get(v.prenom)).filter(Boolean)
  if (sesOui.length < 12) return null
  let meilleur = null
  for (const axe of AXES) {
    const xs = sesOui.map(axe.valeur).filter(x => x !== null)
    if (xs.length < 12) continue
    const x = axe.valeur(p)
    if (x === null) continue
    const sd = ecartType(xs)
    if (sd <= 0) continue
    const m = moyenne(xs), ecarts = Math.abs(x - m) / sd
    if (ecarts >= 1.2 && (!meilleur || ecarts > meilleur.ecarts)) meilleur = { axe, m, x, ecarts }
  }
  if (!meilleur) return null
  return `Ce n'est peut-être pas ${p.l} : c'est ${meilleur.axe.nom}. ${refus.pseudo} garde des prénoms à ${meilleur.axe.dire(meilleur.m)} en moyenne, ${p.l} est à ${meilleur.axe.dire(meilleur.x)}.`
}
const lignes = await page.evaluate(() => [...document.querySelectorAll('#volet-revoir .desaccord')].map(a => ({
  prenom: a.querySelector('.nom')?.textContent.trim(), pourquoi: a.querySelector('.pourquoi')?.textContent.trim() ?? null })))
const ecarts = lignes.filter(l => (regle(l.prenom) ?? null) !== l.pourquoi)
const expliques = lignes.filter(l => l.pourquoi).length
dit(expliques >= 5 && ecarts.length === 0,
  `ses ${expliques} explications sont celles de la règle, au mot près, et il se tait sur les ${lignes.length - expliques} autres`
  + (ecarts.length ? ` — écart sur ${ecarts[0].prenom} : « ${ecarts[0].pourquoi} » au lieu de « ${regle(ecarts[0].prenom)} »` : ''))

// Les cartes hors de l'écran ne sont pas mises en page.
const hors = await page.evaluate(() => {
  const c = [...document.querySelectorAll('#volet-revoir .desaccord')].at(-1)
  return { regle: getComputedStyle(c).contentVisibility, sautee: typeof c.checkVisibility === 'function'
    ? !c.firstElementChild.checkVisibility({ contentVisibilityAuto: true }) : null }
})
dit(hors.regle === 'auto' && hors.sautee !== false,
  'la dernière carte de la liste, hors de l’écran, n’est pas mise en page tant qu’on n’y arrive pas')

// =================== 3. TOUT EST MONTÉ : LE TRI NE LE PAIE PAS =============
for (const v of ['choix', 'portrait', 'communs']) { await versVolet(v); await page.waitForTimeout(600) }
const choixAvant = await page.evaluate(() => [...document.querySelectorAll('#volet-choix .entete')]
  .map(e => e.textContent.replace(/\s+/g, ' ').trim()).find(t => t.startsWith('Non')))
await versOnglet('La liste'); await page.waitForTimeout(900)
await versOnglet('Swipe'); await page.waitForTimeout(900)

// Pendant qu'on trie, rien ne bouge dans le classement (il est en veille).
await page.evaluate(() => {
  window.__mutations = 0
  const classement = document.querySelectorAll('.pager > section')[1]
  new MutationObserver(l => { window.__mutations += l.length })
    .observe(classement, { subtree: true, childList: true, characterData: true, attributes: true })
})
const montes = []
for (const c of ['non', 'non', 'oui', 'non', 'neutre']) {
  const s = await swipe(c)
  if (s.erreur) console.log('   [swipe]', s.erreur)
  montes.push(s.bloque)
}
const monte = mediane(montes)
dit(monte < 150 && monte <= seul * 2 + 60,
  `tous les onglets ouverts, un vote ne coûte pas plus : ${monte} ms de tâches longues (${seul} sans eux ; plus de 2 000 avant)`)
dit(await page.evaluate(() => window.__mutations) === 0,
  'pendant qu’on trie, rien ne bouge dans le classement : ce qu’on ne regarde pas ne travaille pas')

// … et il est à jour quand on y revient.
await versOnglet('Classement'); await page.waitForTimeout(900)
await versVolet('choix'); await page.waitForTimeout(700)
const choixApres = await page.evaluate(() => [...document.querySelectorAll('#volet-choix .entete')]
  .map(e => e.textContent.replace(/\s+/g, ' ').trim()).find(t => t.startsWith('Non')))
const n = t => Number((t ?? '').replace(/\D/g, ''))
// Trois cartes refusées : trois prénoms de plus, et leurs autres graphies avec eux.
dit(n(choixApres) >= n(choixAvant) + 3 && n(choixApres) <= n(choixAvant) + 40,
  `revenu sur « Mes choix », les non donnés entre-temps y sont (${n(choixAvant)} → ${n(choixApres)}, graphies comprises)`)

// =================== 4. LA RÈGLE DU JEU, SOUS LE CAPOT =====================
const capot = await page.evaluate(async () => {
  let m
  try { m = await import('/_nuxt/composables/useCatalogue.ts') } catch (e) { return { erreur: String(e) } }
  const c = await m.chargerCatalogue()
  const pile = c.liste.filter(p => !p.q)
  // des « oui » variés : aucun (ordre des plus donnés), deux, puis de quoi basculer sur l'affinité
  const jeux = [[], pile.slice(3, 5), pile.filter((_, i) => i % 97 === 5).slice(0, 9), pile.filter((_, i) => i % 41 === 7).slice(0, 60)]
  const memes = jeux.every(aimes => {
    const tout = m.ordonner(pile, aimes).slice(0, 6), tete = m.premiers(pile, aimes, 6)
    return tete.length === 6 && tete.every((p, i) => p === tout[i])
  })
  return { memes, brut: c.liste[0].__v_skip === true && c.liste.at(-1).__v_skip === true, n: c.liste.length }
})
dit(!capot.erreur && capot.memes,
  capot.erreur ? `le module du catalogue ne se charge pas depuis la page : ${capot.erreur}`
    : 'la tête de pile est celle de l’ordre complet (premiers = le début de ordonner), avec ou sans oui')
dit(capot.brut, `les ${capot.n} fiches du catalogue ne sont pas réactives (markRaw)`)

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
