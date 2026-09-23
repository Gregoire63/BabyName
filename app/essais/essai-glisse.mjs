import { lancer } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }

/**
 * Releve TOUS les etats de transition traverses, pas un instantane.
 *
 * Premiere version : un echantillon a instant fixe. Inutilisable — en dev le
 * chunk de la page cible met un temps variable a s'evaluer, et pendant ce
 * temps la boucle rAF est affamee. On voyait la page entrante deja arrivee et
 * on croyait la transition absente alors qu'elle se deroulait.
 */
async function capter(page) {
  return page.evaluate(async () => {
    const x = el => Math.round(new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)
    // On echantillonne a CHAQUE image, pas au changement de classe : la classe
    // -leave-to est posee avant que la transition n'avance d'un pixel, donc
    // dedupliquer par classe ne montrait jamais le milieu du mouvement.
    const e = { min: 0, max: 0, barre: false, vu: false }
    const s = { min: 0, max: 0, barre: false, vu: false }
    const t0 = performance.now()
    while (performance.now() - t0 < 2500) {
      for (const el of document.querySelectorAll('.page-enter-active, .page-leave-active')) {
        const c = el.className.includes('-enter-') ? e : s
        const v = x(el)
        c.vu = true
        c.min = Math.min(c.min, v); c.max = Math.max(c.max, v)
        if (el.querySelector('.onglets')) c.barre = true
      }
      await new Promise(r => requestAnimationFrame(r))
    }
    return {
      sens: document.documentElement.dataset.sens,
      nb: (e.vu ? 1 : 0) + (s.vu ? 1 : 0),
      xEntrante: e.max, xEntranteMin: e.min, barreEntrante: e.barre,
      xSortante: s.min, xSortanteMax: s.max, barreSortante: s.barre,
      etats: [`entre ${e.min}..${e.max}${e.barre ? ' +barre' : ''}`,
              `sort ${s.min}..${s.max}${s.barre ? ' +barre' : ''}`]
    }
  })
}

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

// On prechauffe la route : en dev, le premier chargement du chunk fausse
// toute mesure de duree.
await page.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.bento', { timeout: 20000 })

// ---------- 1. entrer : tout arrive de la droite --------------------------
const pE = capter(page)
await page.locator('.bento .grande').first().click()
const e = await pE
console.log(`   sens=${e.sens} · états :`, e.etats.join(' | '))
dit(e.nb === 2, `les deux pages coexistent (${e.nb})`)
dit(e.xEntrante >= 380 && e.xEntranteMin <= 20,
    `la liste glisse du bord droit jusqu’en place (${e.xEntrante} → ${e.xEntranteMin} px)`)
dit(e.sens === 'avant', `sens « avant » posé sur <html> (${e.sens})`)
dit(e.barreEntrante, 'la barre du bas glisse AVEC la liste')
await page.screenshot({ path: '/tmp/t1-entree.png' })
await page.waitForSelector('.onglets button', { timeout: 20000 })
await page.waitForFunction(() => !document.querySelector('[class*="-leave-active"]'), null, { timeout: 8000 })

// ---------- 2. ressortir : tout repart a droite ---------------------------
const pS = capter(page)
await page.locator('.onglets a.sortie').click()
const s = await pS
console.log(`   sens=${s.sens} · états :`, s.etats.join(' | '))
dit(s.sens === 'arriere', `sens « arrière » posé sur <html> (${s.sens})`)
dit(s.xEntranteMin <= -60 && s.xEntrante >= -5,
    `l’accueil revient de la gauche (${s.xEntranteMin} → ${s.xEntrante} px)`)
dit(s.xSortanteMax >= 200, `la liste repart à DROITE (jusqu’à x = ${s.xSortanteMax} px)`)
dit(s.barreSortante, 'la barre du bas repart AVEC la liste')
await page.screenshot({ path: '/tmp/t2-sortie.png' })
await page.waitForSelector('.bento', { timeout: 20000 })
await page.waitForFunction(() => !document.querySelector('[class*="-leave-active"]'), null, { timeout: 8000 })
dit(await page.locator('.onglets').count() === 0, 'une fois posé sur l’accueil, plus de barre')

// ---------- 3. le bug des deux cartes -------------------------------------
await page.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 20000 })
const nomAvant = await page.locator('.carte.fiche:not(.derriere) .nom').first().innerText()
await page.locator('.rond.non').click()
await page.waitForTimeout(370)
// offsetWidth : largeur de MISE EN PAGE, insensible aux transformations —
// c'est elle qui trahissait le partage de la ligne flex.
const cartes = await page.evaluate(() => [...document.querySelectorAll('.cartes > .fiche')].map(c => ({
  nom: c.querySelector('.nom')?.textContent?.trim(),
  large: c.offsetWidth, pos: getComputedStyle(c).position, derriere: c.classList.contains('derriere')
})))
console.log('   cartes :', JSON.stringify(cartes))
dit(cartes.length >= 2, `plusieurs cartes coexistent bien pendant l’échange (${cartes.length})`)
dit(cartes.every(c => c.pos === 'absolute'), 'toutes hors du flux')
dit(new Set(cartes.map(c => c.large)).size === 1,
    `toutes à la même largeur, donc superposées : ${[...new Set(cartes.map(c => c.large))].join(' / ')} px`)
await page.screenshot({ path: '/tmp/t3-swipe.png' })
await page.waitForTimeout(900)
dit((await page.locator('.carte.fiche:not(.derriere) .nom').first().innerText()) !== nomAvant,
    'la carte a bien changé')
dit(await page.getByRole('button', { name: 'Plus d’informations' }).count() >= 1,
    '« Plus d’informations » a remplacé « Tout voir »')

await nav.close()
console.log(`\n${ko.length ? 'ECHEC' : 'TOUT PASSE'} — ${ok.length} ok, ${ko.length} echecs`)
process.exit(ko.length ? 1 : 0)
