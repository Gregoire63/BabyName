import { lancer } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }
const lisible = t => t.trim().split('\n').pop().trim()

// La base de dev est persistante : un essai qui change un vote le change pour
// de bon. On repart donc d'une base neuve a chaque passage (voir relance.sh).
const nav = await lancer()

async function entrer(cle) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  // Le panneau Nuxt DevTools flotte au-dessus de la barre du bas et avale les
  // clics. Il n'existe qu'en dev : on le masque plutot que de deplacer la barre.
  await ctx.addInitScript(() => {
    const cacher = () => {
      const s = document.createElement('style')
      s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
      document.head?.appendChild(s)
    }
    if (document.head) cacher()
    else document.addEventListener('DOMContentLoaded', cacher)
  })
  const page = await ctx.newPage()
  page.on('pageerror', e => console.log('   [err]', e.message))
  page.on('console', m => { if (m.type() === 'error' && !/TUNNEL|favicon|fonts/.test(m.text())) console.log('   [js]', m.text()) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
  await page.locator('input.champ').fill(cle)
  await page.getByRole('button', { name: 'Entrer' }).click()
  await page.waitForSelector('.bento', { timeout: 20000 })
  return { ctx, page }
}

// ---------- 1. l'accueil n'explique plus le millesime ----------------------
const { ctx: c1, page } = await entrer('DEVP-ARNA-2345')
dit(await page.locator('.note').count() === 0, 'le laïus sur le millésime INSEE a disparu')
// Les statistiques arrivent avec le catalogue, apres la liste des listes :
// on attend la section plutot que de lire l'ecran a mi-chargement.
await page.waitForSelector('.section:has-text("naissances")', { timeout: 15000 }).catch(() => null)
const sections = (await page.locator('.section').allInnerTexts()).map(t => t.trim())
dit(sections.some(t => /naissances/i.test(t)),
    `le titre de la section reste (${sections.join(' | ')})`)

// ---------- 2. le segment a quatre volets ---------------------------------
await page.locator('.bento .grande').first().click()
await page.waitForSelector('.onglets button', { timeout: 20000 })
await page.locator('.onglets button', { hasText: 'Classement' }).click()
await page.waitForTimeout(900)
const sec = page.locator('.pager > section:nth-child(2)')
const volets = (await sec.locator('.segment button').allInnerTexts()).map(t => t.trim().split('\n')[0].trim())
dit(JSON.stringify(volets) === JSON.stringify(['Communs', 'À revoir', 'Mes choix', 'Portrait']),
    `volets : ${volets.join(' | ')}`)
dit(await sec.locator('.segment button:has-text("Duels")').count() === 0, 'plus de Duels')

// ---------- 4. Mes choix ---------------------------------------------------
await sec.locator('.segment button', { hasText: 'Mes choix' }).click()
await page.waitForTimeout(900)
const entetes = await sec.locator('.groupe .entete').allInnerTexts()
dit(entetes.length === 5, `cinq blocs : ${entetes.map(e => e.replace(/\s+/g,' ').trim()).join(' | ')}`)
await sec.locator('.groupe .entete', { hasText: 'Non' }).click()
await page.waitForTimeout(500)
dit(await sec.locator('.famille').count() >= 1, 'les familles écartées sont dans « Non »')
await page.waitForTimeout(400); await page.screenshot({ path: '/tmp/g4-choix.png' })
// Remettre la famille « kevi » d'un geste : ses prénoms reviennent en jeu, le
// non donné un par un à Kevin reste.
const famille = sec.locator('.famille', { hasText: 'Kevyn' })
await famille.getByRole('button', { name: /^Remettre les/ }).click()
await page.waitForTimeout(1200)
const mesVotes = await page.evaluate(async () => {
  const r = await fetch('/api/groupes/1/votes').then(x => x.json())
  const moi = (await fetch('/api/groupes/1').then(x => x.json())).moi.user_id
  return r.votes.filter(v => v.user_id === moi).map(v => v.prenom)
})
dit(!mesVotes.includes('Kevyn') && !mesVotes.includes('Kevan') && mesVotes.includes('Kevin')
    && await sec.locator('.famille', { hasText: 'Kevyn' }).count() === 0,
    'remettre une famille : Kevyn et Kevan reviennent en jeu, le non donné à Kevin reste')

// ---------- 5. A revoir, vu par Paul --------------------------------------
await sec.locator('.segment button', { hasText: 'À revoir' }).click()
await page.waitForTimeout(900)
const noms = await sec.locator('.desaccord .nom').allInnerTexts()
dit(noms.sort().join(',') === 'Hector,Marius', `désaccords vus par Paul : ${noms.join(', ')}`)
const avis = await sec.locator('.desaccord').first().innerText()
dit(/Vous · Oui/.test(avis) && /Alice · Non/.test(avis), 'qui a dit quoi est affiché')
const groupesPaul = (await sec.locator('.titre-groupe').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim())
dit(groupesPaul.length === 1 && /^Ceux qu’Alice n’a pas aimés/.test(groupesPaul[0]),
    `vu par Paul, un seul groupe : « ${groupesPaul.join(' | ')} »`)
await page.waitForTimeout(400); await page.screenshot({ path: '/tmp/g5-revoir.png' })

// ---------- 6. Alice change d'avis : le scenario de Paul -----------------
const { page: p2 } = await entrer('DEVP-ARNB-2345')
await p2.locator('.bento .grande').first().click()
await p2.waitForSelector('.onglets button', { timeout: 20000 })
await p2.locator('.onglets button', { hasText: 'Classement' }).click()
await p2.waitForTimeout(900)
const s2 = p2.locator('.pager > section:nth-child(2)')
await s2.locator('.segment button', { hasText: 'À revoir' }).click()
await p2.waitForTimeout(900)
const vus = await s2.locator('.desaccord .nom').allInnerTexts()
dit(vus.sort().join(',') === 'Hector,Marius', `Alice voit les mêmes : ${vus.join(', ')}`)
const groupesAlice = (await s2.locator('.titre-groupe').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim())
dit(groupesAlice.length === 1 && /^Ceux que vous n’avez pas aimés/.test(groupesAlice[0]),
    `vu par Alice, rangés chez elle : « ${groupesAlice.join(' | ')} »`)

const carte = s2.locator('.desaccord').filter({ has: p2.locator('.nom:text-is("Marius")') })
await carte.locator('.trio .v2').click()          // « finalement oui »
await p2.waitForSelector('.fete', { timeout: 8000 })
dit(true, 'changer d’avis déclenche l’effet d’accord')
await p2.waitForTimeout(500); await p2.screenshot({ path: '/tmp/g6-match.png' })
// L'effet d'accord attend qu'on le ferme : c'est un moment, pas une
// notification (cf. essai-social). On le referme comme un humain le ferait.
await p2.locator('.fete .actions .btn').first().click()
await p2.waitForTimeout(600)
dit(await p2.locator('.fete').count() === 0, 'l’effet d’accord se ferme quand on le ferme')

await s2.locator('.segment button', { hasText: 'Communs' }).click()
await p2.waitForTimeout(900)
const communs = await s2.locator('article h2').allInnerTexts()
dit(communs.includes('Marius'), `Marius est passé dans les communs : ${communs.slice(0,5).join(', ')}`)
await s2.locator('.segment button', { hasText: 'À revoir' }).click()
await p2.waitForTimeout(700)
const reste = await s2.locator('.desaccord .nom').allInnerTexts()
dit(!reste.includes('Marius') && reste.includes('Hector'),
    `il ne reste que le vrai désaccord : ${reste.join(', ')}`)

// ---------- 7. l'ancienne adresse des duels -------------------------------
const p3 = await c1.newPage()
await p3.goto(`${BASE}/g/1/duels`, { waitUntil: 'networkidle' })
await p3.waitForSelector('.segment button.on', { timeout: 20000 })
dit((await p3.locator('.segment button.on').innerText()).trim().split('\n')[0].trim() === 'À revoir',
    '/g/1/duels ouvre « À revoir »')

await nav.close()
console.log(`\n${ko.length ? 'ECHEC' : 'TOUT PASSE'} — ${ok.length} ok, ${ko.length} echecs`)
process.exit(ko.length ? 1 : 0)
