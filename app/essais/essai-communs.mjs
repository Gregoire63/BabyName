/**
 * « Communs » : qui a dit quoi, et l'ordre rangé au doigt.
 *
 * Ce qui se vérifie ici, sur la semence (Paul et Alice décident, Mamie
 * observe) :
 *  - un oui de tout le monde se voit d'abord : « Oui à deux », carte mise en
 *    avant, en tête tant que personne n'a rangé ;
 *  - sinon chaque voix a sa pastille : ♥ Paul, ~ vous — lue « Oui : Paul »,
 *    « Neutre : vous » par un lecteur d'écran ;
 *  - on range en tirant la poignée : la carte change de place, l'ordre est
 *    enregistré, le même pour l'autre parent, et il tient au rechargement ;
 *  - au clavier : la poignée, puis haut et bas ; l'écran le dit, le focus
 *    reste sur la carte déplacée ;
 *  - un accord arrivé après le rangement se range à la fin, marqué
 *    « nouveau » ;
 *  - l'observatrice voit l'ordre, pas qui des deux a dit neutre, et ne peut
 *    pas ranger — ni à l'écran ni au serveur.
 */
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []

async function entrer(qui) {
  const { ctx, page } = await onglet(nav)
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, qui)
  await page.waitForSelector('.bento', { timeout: 20000 })
  await page.goto(`${BASE}/g/1/classement`, { waitUntil: 'networkidle' })
  await page.waitForSelector('article.commun h2', { timeout: 20000 })
  await page.waitForTimeout(500)
  return { ctx, page }
}
const noms = p => p.locator('article.commun h2').allInnerTexts().then(l => l.map(x => x.trim()))
const carte = (p, nom) => p.locator('article.commun')
  .filter({ has: p.locator('h2', { hasText: new RegExp(`^${nom}$`) }) })
const voix = async (p, nom) => (await carte(p, nom).locator('.voix').innerText()).replace(/\s+/g, ' ').trim()
const ordreServeur = p => p.evaluate(() => fetch('/api/groupes/1/communs').then(r => r.json()))
  .then(l => l.map(c => c.prenom))

// =================== 1. QUI A DIT QUOI ======================================
const paul = await entrer('Paul')
const depart = await noms(paul.page)
const DOUBLES = ['Anouk', 'Basile', 'Iris', 'Jeanne', 'Louise']
dit(DOUBLES.every((n, i) => depart[i] === n) && depart.length === 9,
  `sans rangement, les « oui » de tous d'abord : ${depart.join(', ')}`)
dit(await carte(paul.page, 'Louise').evaluate(a => a.classList.contains('tous'))
    && /Oui à deux/.test(await voix(paul.page, 'Louise')),
  `Louise : « ${await voix(paul.page, 'Louise')} », la carte mise en avant`)
const alma = await carte(paul.page, 'Alma').locator('.voix').evaluate(e => ({
  vu: [...e.querySelectorAll('.v')].map(v => [...v.childNodes].filter(n => !n.classList?.contains('sr-only'))
    .map(n => n.textContent).join('').replace(/\s+/g, ' ').trim()),
  lu: e.textContent.replace(/\s+/g, ' ').trim()
}))
dit(alma.vu.length === 2 && alma.vu[0] === 'vous' && /^~\s*Alice$/.test(alma.vu[1])
    && /Oui : vous/.test(alma.lu) && /Neutre : Alice/.test(alma.lu),
  `Alma, pour Paul : ${alma.vu.join(' | ')} (lu : « ${alma.lu} »)`)
dit(await carte(paul.page, 'Alma').evaluate(a => !a.classList.contains('tous')),
  'un oui et un neutre : pas de mise en avant')

// =================== 2. RANGER AU DOIGT =====================================
{
  const p = paul.page
  const poignee = carte(p, 'Alma').locator('.poignee')
  await poignee.scrollIntoViewIfNeeded()
  const b = await poignee.boundingBox()
  const haut = await p.locator('article.commun').first().boundingBox()
  const x = b.x + b.width / 2, y = b.y + b.height / 2
  await p.mouse.move(x, y); await p.mouse.down()
  const cible = Math.max(20, haut.y + 8)
  for (let k = 1; k <= 24; k++) { await p.mouse.move(x, y + (cible - y) * k / 24); await p.waitForTimeout(16) }
  await p.waitForTimeout(1500)   // près du bord, la liste défile toute seule
  await p.mouse.up()
  await p.waitForTimeout(900)
}
const apres = await noms(paul.page)
dit(apres[0] === 'Alma' && apres.length === 9, `tirée par sa poignée, Alma passe en tête : ${apres.slice(0, 4).join(', ')}…`)
dit((await ordreServeur(paul.page))[0] === 'Alma', 'l’ordre est enregistré')
await paul.page.reload({ waitUntil: 'networkidle' })
await paul.page.waitForSelector('article.commun h2', { timeout: 20000 })
dit((await noms(paul.page))[0] === 'Alma', 'et il tient au rechargement')

const alice = await entrer('Alice')
dit((await noms(alice.page))[0] === 'Alma', 'Alice voit le même ordre : Alma en tête')
dit(/Paul/.test(await voix(alice.page, 'Alma')) && /vous/.test(await voix(alice.page, 'Alma')),
  `et pour elle, Alma dit « ${await voix(alice.page, 'Alma')} »`)
await alice.ctx.close()

// =================== 3. AU CLAVIER ==========================================
{
  const p = paul.page
  await carte(p, 'Alma').locator('.poignee').focus()
  await p.keyboard.press('ArrowDown')
  await p.waitForTimeout(300)
  const l = await noms(p)
  const annonce = (await p.locator('[aria-live="polite"]').allInnerTexts()).join(' ')
  const focus = await p.evaluate(() => document.activeElement?.closest('article')?.querySelector('h2')?.textContent?.trim())
  dit(l[1] === 'Alma' && /Alma : 2 sur 9/.test(annonce) && focus === 'Alma',
    `flèche bas sur la poignée : Alma passe 2e, c’est dit (« Alma : 2 sur 9 »), le focus la suit (${focus})`)
  await p.waitForTimeout(1200)
  dit((await ordreServeur(p))[1] === 'Alma', 'et c’est enregistré')
}

// =================== 4. UN NOUVEL ACCORD =====================================
// Alice a dit oui à Adèle ; Paul pas encore. Son oui en fait un accord, arrivé
// après le rangement : il se range à la fin, marqué « nouveau ».
await paul.page.evaluate(() => fetch('/api/groupes/1/vote', { method: 'POST',
  headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prenom: 'Adèle', valeur: 2 }) }))
await paul.page.reload({ waitUntil: 'networkidle' })
await paul.page.waitForSelector('article.commun h2', { timeout: 20000 })
const avecAdele = await noms(paul.page)
dit(avecAdele.at(-1) === 'Adèle' && /nouveau/.test(await voix(paul.page, 'Adèle')) && avecAdele[1] === 'Alma',
  `Adèle, nouvel accord, attend en dernier, marquée « nouveau » (${avecAdele.length} accords)`)

// =================== 5. L'OBSERVATRICE =====================================
const mamie = await entrer('Mamie')
dit(await mamie.page.locator('article.commun .poignee').count() === 0, 'Mamie ne range pas : pas de poignée')
dit((await noms(mamie.page))[1] === 'Alma' && /1 oui · 1 neutre/.test(await voix(mamie.page, 'Alma'))
    && !/Paul|Alice/.test(await voix(mamie.page, 'Alma')),
  `elle voit l’ordre, et pour Alma « ${await voix(mamie.page, 'Alma')} » : pas lequel des deux a dit neutre`)
dit(/Oui à deux/.test(await voix(mamie.page, 'Louise')), 'le « oui à deux » se voit aussi chez elle')
const refus = await mamie.page.evaluate(() => fetch('/api/groupes/1/ordre-communs', { method: 'PUT',
  headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prenoms: ['Louise'] }) }).then(r => r.status))
dit(refus === 403, `le serveur refuse son rangement (HTTP ${refus})`)
await mamie.ctx.close()

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
