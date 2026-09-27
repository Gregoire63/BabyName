/**
 * Le portrait de gouts — et surtout son silence.
 *
 * Un portrait qui parle toujours est un portrait faux : sur dix oui, n'importe
 * quel ecart est du bruit. Ce qui se teste ici, c'est autant ce qu'il dit que
 * ce qu'il refuse de dire.
 */
import { lancer } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }
const nav = await lancer()
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
await ctx.addInitScript(() => {
  const c = () => { const s = document.createElement('style')
    s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
    document.head?.appendChild(s) }
  if (document.head) c(); else document.addEventListener('DOMContentLoaded', c)
})
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
const plat = async sel => (await page.locator(sel).first().innerText().catch(() => ''))
  .replace(/\s+/g, ' ').trim()

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await page.locator('input.champ').fill('DEVP-ARNA-2345')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })

const ouvrir = async nom => {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const c = page.locator('.carte', { hasText: nom }).first()
  await c.waitFor({ state: 'visible', timeout: 25000 })
  await c.click(); await page.waitForTimeout(2500)
  return page.url().split('/')[4]
}

// ===================== LISTE GRATUITE : l'offre ==========================
const gLibre = await ouvrir('Essai gratuit')
await page.goto(`${BASE}/g/${gLibre}/classement`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
dit(await page.getByRole('tab', { name: 'Portrait' }).count() > 0,
    'le volet Portrait existe aussi sans avoir payé')
await page.getByRole('tab', { name: 'Portrait' }).click()
await page.waitForTimeout(900)
const libre = await plat('.pile .carte')
dit(/Ce que vos oui disent de vous/i.test(libre), 'il annonce ce qu’il contient')
dit(/pas d’accord|pas d'accord/i.test(libre), 'il annonce la divergence mesurée')
dit(await page.getByRole('button', { name: 'Voir ce que ça ouvre' }).count() > 0,
    'et il mène à l’offre')
dit(await page.locator('.trait').count() === 0,
    'aucun trait n’est montré avant l’achat — pas de démo qui gâche l’achat')

// ===================== LISTE PAYÉE : le portrait =========================
const gid = await ouvrir('Notre liste')
await page.goto(`${BASE}/g/${gid}/classement`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByRole('tab', { name: 'Portrait' }).click()
await page.waitForTimeout(1200)

const tout = await plat('.pile')
const traits = await page.locator('.trait').allInnerTexts()
dit(traits.length > 0, `${traits.length} traits calculés sur les 12 oui de Paul`)
for (const t of traits.slice(0, 6)) console.log('   [trait]', t.replace(/\s+/g, ' '))

dit(/Sur 12 oui/.test(tout), 'le portrait dit sur combien de oui il s’appuie')
dit(/parmi \d+ prénoms jugés/.test(tout),
    'et sur combien de prénoms jugés — la référence, c’est le vu, pas le catalogue')
dit(/ce qu'on vous a montré|ce qu’on vous a montré|vous avez vu/i.test(tout),
    'les phrases comparent explicitement au vu, jamais à un absolu')

// ---- le silence : Alice n'a que 5 oui visibles, on ne l'invente pas ----
dit(/Alice/.test(tout), 'Alice a sa carte')
const carteAlice = await plat('.carte:has-text("Alice")')
dit(/pas encore assez|honnête/i.test(carteAlice),
    `et on y dit qu’il n’y a pas de quoi conclure : « ${carteAlice.slice(0, 90)} »`)
dit(!/Là où ça coince/.test(tout),
    'aucune divergence n’est affirmée tant qu’une des deux personnes n’a pas assez jugé')

// ---- un chiffre vérifiable -----------------------------------------------
const verif = await page.evaluate(g => fetch(`/api/groupes/${g}/votes`)
  .then(r => r.json())
  .then(d => {
    const par = {}
    for (const v of d.votes) {
      par[v.pseudo] ??= { oui: 0, vus: 0 }
      par[v.pseudo].vus++
      if (v.valeur === 2) par[v.pseudo].oui++
    }
    return par
  }), gid)
console.log('   [votes visibles]', JSON.stringify(verif))
dit(verif.Paul?.oui === 12,
    `le serveur confirme 12 oui pour Paul (et ${verif.Alice?.oui ?? 0} visibles pour Alice)`)
dit((verif.Alice?.oui ?? 0) < 12,
    'Alice est bien sous le seuil : le silence du portrait est justifié, pas un bug')

console.log(`\n${ok.length} OK, ${ko.length} échecs`)
dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
process.exit(ko.length ? 1 : 0)
