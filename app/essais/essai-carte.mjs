import { lancer } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const nav = await lancer()
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
await ctx.addInitScript(() => {
  const c = () => { const s = document.createElement('style')
    s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
    document.head?.appendChild(s) }
  document.head ? c() : document.addEventListener('DOMContentLoaded', c)
})
const page = await ctx.newPage()
page.on('pageerror', e => console.log('   [err]', e.message))

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await page.locator('input.champ').fill('DEVG-REGX-2345')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })
await page.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 20000 })

const devant = await page.locator('.carte.fiche:not(.derriere) .nom').first().innerText()
const derriere = await page.locator('.carte.fiche.derriere .nom').first().innerText()
console.log(`  devant = ${devant} · derrière = ${derriere}`)

// On filme chaque image : nom de chaque carte, son opacite effective et son
// echelle. Le bug se voit a une image pres, pas sur une capture.
const film = page.evaluate(async () => {
  const images = []
  const t0 = performance.now()
  while (performance.now() - t0 < 2200) {
    const cartes = [...document.querySelectorAll('.cartes > .fiche')].map(el => {
      const s = getComputedStyle(el)
      const m = new DOMMatrixReadOnly(s.transform)
      return {
        nom: el.querySelector('.nom')?.textContent?.trim(),
        op: +(+s.opacity).toFixed(2),
        ech: +Math.hypot(m.a, m.b).toFixed(2),
        x: Math.round(m.m41),
        derriere: el.classList.contains('derriere')
      }
    })
    images.push({ t: Math.round(performance.now() - t0), cartes })
    await new Promise(r => requestAnimationFrame(r))
  }
  return images
})
await page.locator('.rond.non').click()
const images = await film

// Visible = pas trop transparente, pas partie au loin.
const dominante = (im) => {
  const vues = im.cartes.filter(c => c.op > 0.3 && Math.abs(c.x) < 150)
  if (!vues.length) return null
  return vues.sort((a, b) => (b.op * b.ech) - (a.op * a.ech))[0]
}
let precedent = null
console.log('\n  ce que l’œil voit, image par image :')
for (const im of images) {
  const d = dominante(im)
  const cle = d ? `${d.nom} (op ${d.op}, ech ${d.ech})` : '—'
  if (cle !== precedent) { console.log(`   t=${String(im.t).padStart(4)}ms  ${cle}`); precedent = cle }
}
const noms = [...new Set(images.flatMap(im => { const d = dominante(im); return d ? [d.nom] : [] }))]
console.log('\n  suite des cartes dominantes :', noms.join(' → '))
const intrus = noms.filter(n => n !== devant && n !== derriere)
console.log(intrus.length
  ? `  BUG REPRODUIT : ${intrus.join(', ')} apparait alors qu'on attendait ${derriere}`
  : `  aucun intrus : on passe de ${devant} a ${derriere}, rien d'autre`)
await nav.close()
process.exit(intrus.length ? 1 : 0)
