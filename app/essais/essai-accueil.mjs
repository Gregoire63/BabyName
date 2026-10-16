/**
 * L'accueil, tel qu'un testeur l'a vu sur son Android (16/10) :
 *
 *  1. « Une autre liste » (＋) et « Rejoindre une liste » (→) : les deux
 *     pastilles à la même hauteur, les deux titres aussi — en français et en
 *     anglais, à 360 et 412 px, en sombre et en clair. Elles étaient à 10-12 px
 *     l'une de l'autre : chaque carte centrait son contenu, et l'une a une
 *     description plus courte.
 *  2. Le signe au milieu de sa pastille, mesuré sur l'ENCRE (une capture,
 *     pas une boîte) : un « ＋ » ou un « → » de police tombe où sa police le
 *     place, pas au milieu.
 *  3. En coin de la carte de la liste en cours — et de l'accueil d'un compte
 *     neuf, sans liste : deux cœurs, pas l'étincelle qu'il a prise pour la
 *     marque de Gemini.
 */
import { lancer, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
/** Un tiers de pixel : un pixel de l'écran d'un téléphone (×3). */
const TOLERANCE = Number(process.env.TOLERANCE_ENCRE || 0.34)
const erreurs = []
const nav = await lancer()

/**
 * Où tombe l'encre du signe, par rapport au centre de SA pastille — les deux
 * lus dans la même capture : la pastille (le disque de couleur unie, bords
 * adoucis exclus) et le signe (ce qui, dedans, n'est pas de sa couleur). Le
 * centre de la boîte de l'élément ne suffit pas : une capture d'élément se
 * cale sur des pixels entiers, et l'élément est souvent à 0,4 px près.
 */
async function encre(page, rond) {
  const b = await rond.boundingBox()
  const marge = 4
  const png = await page.screenshot({ clip: { x: b.x - marge, y: b.y - marge, width: b.width + 2 * marge, height: b.height + 2 * marge } })
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data
    const px = (i, j) => { const o = (j * c.width + i) * 4; return [d[o], d[o + 1], d[o + 2]] }
    const ecart = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2])
    // la couleur de la pastille : la plus fréquente au centre de la capture
    const n = new Map(), m = c.width / 2
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) {
      if ((i + 0.5 - m) ** 2 + (j + 0.5 - c.height / 2) ** 2 > (m * 0.7) ** 2) continue
      const p = px(i, j).join(','); n.set(p, (n.get(p) ?? 0) + 1)
    }
    const fond = [...n.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number)
    // Le disque, par deux cordes : du milieu, on va de part et d'autre tant
    // que la couleur est la sienne. Les cordes passent à côté du signe (aux
    // sept dixièmes du rayon : une flèche de police est large), et leurs bords
    // adoucis le sont des deux côtés : leur milieu est celui du disque. En clair, la pastille (#fbfaf9) ne se
    // distingue de la carte (#fff) que de 15 : le seuil est bas.
    const corde = (i0, j0, di, dj) => {
      let a = 0, b = 0
      while (ecart(px(i0 - di * (a + 1), j0 - dj * (a + 1)), fond) <= 5) a++
      while (ecart(px(i0 + di * (b + 1), j0 + dj * (b + 1)), fond) <= 5) b++
      return { a, b }
    }
    const R0 = c.width / 2 - 4 * window.devicePixelRatio
    const ox = Math.round(c.width / 2 + R0 * 0.7), oy = Math.round(c.height / 2 + R0 * 0.7)
    const v = corde(ox, Math.floor(c.height / 2), 0, 1)
    const h = corde(Math.floor(c.width / 2), oy, 1, 0)
    const cy = Math.floor(c.height / 2) + (v.b - v.a) / 2 + 0.5
    const cx = Math.floor(c.width / 2) + (h.b - h.a) / 2 + 0.5
    const R = R0
    // le signe : ce qui, dans le disque, n'est pas de sa couleur
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) {
      if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 > (R * 0.8) ** 2) continue
      if (ecart(px(i, j), fond) < 60) continue
      x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j)
    }
    if (x1 < 0) return null
    const k = window.devicePixelRatio
    return { dx: ((x0 + x1 + 1) / 2 - cx) / k, dy: ((y0 + y1 + 1) / 2 - cy) / k }
  }, png.toString('base64'))
}

async function mesurer(page, quoi) {
  await page.waitForSelector('.bento .creer', { timeout: 30000 })
  await page.waitForTimeout(700)
  const cartes = page.locator('.bento .creer')
  const m = []
  for (let i = 0; i < await cartes.count(); i++) {
    const c = cartes.nth(i)
    const b = await c.locator('.rond').boundingBox()
    const t = await c.locator('strong').boundingBox()
    m.push({ nom: (await c.locator('strong').innerText()).trim(), rond: b.y + b.height / 2, titre: t.y,
             encre: await encre(page, c.locator('.rond')) })
  }
  const [a, b] = m
  dit(m.length === 2 && Math.abs(a.rond - b.rond) <= 0.5 && Math.abs(a.titre - b.titre) <= 0.5,
    `${quoi} : « ${a?.nom} » et « ${b?.nom} », pastilles et titres à la même hauteur (écarts ${Math.abs(a?.rond - b?.rond).toFixed(1)} et ${Math.abs(a?.titre - b?.titre).toFixed(1)} px)`)
  const decale = m.filter(x => !x.encre || Math.abs(x.encre.dx) > TOLERANCE || Math.abs(x.encre.dy) > TOLERANCE)
  dit(decale.length === 0,
    `${quoi} : chaque signe au milieu de sa pastille (${m.map(x => `${x.nom} ${x.encre ? `${x.encre.dx.toFixed(2)}, ${x.encre.dy.toFixed(2)}` : 'rien'}`).join(' ; ')})`)
  dit(await page.locator('.bento .grande .deco.coeurs').count() === 1 && await page.locator('.bento .grande .etincelles').count() === 0,
    `${quoi} : en coin de la grande carte, deux cœurs — pas d’étincelle`)
}

async function ouvrir({ langue, largeur, theme, qui }) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: 915 }, deviceScaleFactor: 3,
    hasTouch: true, colorScheme: theme, locale: langue === 'fr' ? 'fr-FR' : 'en-US' })
  const page = await ctx.newPage()
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  if (qui) await entrerComme(page, qui)
  else {
    await page.evaluate(async () => {
      await fetch('/api/auth/entrer', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pseudo: 'Néo' }) })
    })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  }
  await page.waitForSelector('.bento', { timeout: 30000 })
  await page.evaluate(async (l) => {
    await fetch('/api/moi/langue', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ choix: l, langue: l }) })
    localStorage.setItem('pr_langue', l)
  }, langue)
  await page.reload({ waitUntil: 'networkidle' })
  return { ctx, page }
}

// --- 1, 2, 3 : Paul, qui a des listes
for (const langue of ['fr', 'en']) {
  for (const largeur of [360, 412]) {
    const { ctx, page } = await ouvrir({ langue, largeur, theme: 'dark', qui: 'Paul' })
    await mesurer(page, `${langue}, ${largeur} px, sombre`)
    await ctx.close()
  }
}
{
  const { ctx, page } = await ouvrir({ langue: 'fr', largeur: 412, theme: 'light', qui: 'Paul' })
  await mesurer(page, 'fr, 412 px, clair')
  await ctx.close()
}
// Un téléphone qui n'a pas la police de l'app — ou qui va chercher un signe
// dans une police de repli (un « ＋ » pleine chasse, sur Android : une police
// japonaise) : le signe doit rester au milieu. Un tracé n'en dépend pas ; un
// caractère tombait jusqu'à 2 px plus haut.
{
  const { ctx, page } = await ouvrir({ langue: 'fr', largeur: 412, theme: 'dark', qui: 'Paul' })
  await page.addStyleTag({ content: '.bento .creer .rond { font-family: IPAGothic, "Noto Sans CJK JP", serif !important; }' })
  await mesurer(page, 'fr, 412 px, police de repli')
  await ctx.close()
}
// --- un compte neuf, sans liste : « Créer ma liste » et la carte d'accueil
{
  const { ctx, page } = await ouvrir({ langue: 'fr', largeur: 360, theme: 'dark' })
  dit(await page.locator('.bento .grande.accueil').count() === 1, 'un compte neuf : la carte d’accueil, pas de liste en cours')
  await mesurer(page, 'compte neuf, 360 px')
  await ctx.close()
}

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})${erreurs.length ? ` — ${erreurs.slice(0, 3).join(' ; ')}` : ''}`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
