/**
 * Un prénom que le catalogue n'a pas s'AJOUTE à la liste, depuis la
 * recherche, et devient une carte pour chacun de ses membres — remplie de ce
 * qu'on en sait vraiment, sans rien inventer.
 *
 *  1. Les données : l'historique (public/data/historique.json.gz) porte les
 *     prénoms publiés depuis 1900 et absents du catalogue, aucun donné
 *     depuis 2023 ; Ginette y a ses 131 480 naissances. La clé de
 *     prononciation de l'app redonne les groupes du pipeline, sans en couper
 *     ni en fusionner un. L'écriture d'un prénom tapé (ecrireAjout).
 *  2. La recherche (Paul) : un prénom du catalogue ne s'ajoute pas ; un
 *     prénom absent, si — et ce qui se dit pareil est proposé d'abord.
 *     Ajouté avec un mot, il est sa première carte, « ajouté par vous ».
 *  3. Alice : la carte en tête de SA pile, malgré des filtres qui l'en
 *     excluraient ; « ajouté par Paul », le mot ; les chiffres de l'INSEE, au
 *     bébé près, par décennie. La fiche dit qui et quand. Un accord dessus
 *     porte le mot.
 *  4. Un prénom qui n'a que son jumeau (Lucass : les chiffres de Lucas, sous
 *     SON nom) ; un prénom inventé (aucune naissance publiée, et ceux qui
 *     s'écrivent presque pareil).
 *  5. Sans historique (le fichier ne vient pas) : la carte ne prétend pas que
 *     le prénom est absent des chiffres de l'INSEE.
 *  6. Retirer : seulement son auteur, avec ce qu'il y avait mis ; refusé dès
 *     qu'un autre l'a jugé.
 *  7. Le serveur : l'observatrice ne propose rien (mais trie les cartes
 *     ajoutées) ; le même à la casse près est rendu tel quel ; écritures
 *     refusées ; mot borné ; deux cents par liste.
 *  8. Au retour sur l'app, la carte ajoutée entre-temps par l'autre est là.
 *  9. Quitter la liste, effacer son compte : les cartes restent, sans auteur
 *     ni mot ; l'export RGPD les porte.
 * 10. Aucune violation WCAG A/AA (recherche, carte, fiche), en clair et en
 *     sombre ; aucune erreur JS.
 */
import { readFileSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AXE = readFileSync(process.env.ESSAI_AXE
  || createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const { ok, ko, dit } = compteur()
const erreurs = []
const blanc = s => String(s ?? '').replace(/[\s\u202f\u00a0]+/g, ' ').trim()
/** Le texte d'un élément, '' s'il n'est pas là (un sabotage le fait manquer : l'essai le dit, sans planter). */
const texte = async loc => blanc(await loc.innerText({ timeout: 5000 }).catch(() => ''))
const milliers = n => n.toLocaleString('fr-FR')

// =================== 1. LES DONNÉES ==========================================
const cat = JSON.parse(readFileSync(resolve(RACINE, 'public/data/catalogue.json'), 'utf8'))
const hist = JSON.parse(gunzipSync(readFileSync(resolve(RACINE, 'public/data/historique.json.gz'))))
const duCatalogue = new Set(cat.cols.l.map(l => l.toUpperCase()))
{
  const n = hist.noms.length
  dit(n > 20000 && hist.f.length === n && hist.m.length === n && hist.a.length === n
      && hist.noms.every((x, i) => i === 0 || hist.noms[i - 1] < x),
    `l’historique porte ${milliers(n)} prénoms, en colonnes de même longueur, triés`)
  dit(hist.noms.every(x => !duCatalogue.has(x)), 'aucun n’est au catalogue : il ne double rien')
  dit(hist.a.every(([p, d]) => p >= 1900 && d <= 2022 && p <= d),
    'aucun n’a été donné depuis 2023 (sinon il serait au catalogue)')
}
/** Les naissances d'un prénom de l'historique, telles que l'app les lit. */
function deplie(nom) {
  const i = hist.noms.indexOf(nom)
  const col = x => { const o = new Array(hist.decennies.length).fill(0); if (x) x.slice(1).forEach((v, k) => { o[x[0] + k] = v * hist.unite }); return o }
  const f = col(hist.f[i]), m = col(hist.m[i])
  const dec = f.map((v, k) => v + m[k])
  return { total: dec.reduce((a, b) => a + b, 0), dec, pic: hist.decennies[dec.indexOf(Math.max(...dec))],
           premiere: hist.a[i][0], derniere: hist.a[i][1] }
}
const GINETTE = deplie('GINETTE')
dit(GINETTE.total === 131480 && GINETTE.pic === 1930 && GINETTE.premiere === 1909 && GINETTE.derniere === 1998,
  `Ginette : ${milliers(GINETTE.total)} naissances de ${GINETTE.premiere} à ${GINETTE.derniere}, surtout dans les années ${GINETTE.pic}`)

// Le code de l'app, compilé ici comme le fait essai-nom-complet.
const esbuild = await import('esbuild')
async function module_(entree) {
  const r = await esbuild.build({
    stdin: { contents: entree, resolveDir: RACINE, loader: 'ts' },
    bundle: true, write: false, format: 'iife', target: 'es2019',
    plugins: [{ name: 'alias-nuxt', setup(b) {
      b.onResolve({ filter: /^~\// }, a => {
        const base = resolve(RACINE, 'app', a.path.slice(2))
        return { path: existsSync(base + '.ts') ? base + '.ts' : base }
      })
    } }]
  })
  new Function(r.outputFiles[0].text)()
  return globalThis.__m
}
const { prononciation } = await module_(`import { prononciation } from '~/composables/usePhonetique'\nglobalThis.__m = { prononciation }`)
{
  // Une carte par groupe de prononciation : la clé de l'app (la recherche,
  // « se dit comme ») doit être celle qui a fait les groupes du pipeline.
  const parGp = new Map(), parCle = new Map()
  let coupes = 0, fusions = 0
  cat.cols.l.forEach((l, k) => {
    const cle = `${prononciation(l)}|${cat.sexe[cat.cols.s[k]]}`, gp = cat.cols.gp[k]
    if (parGp.has(gp) && parGp.get(gp) !== cle) coupes++
    if (parCle.has(cle) && parCle.get(cle) !== gp) fusions++
    parGp.set(gp, cle); parCle.set(cle, gp)
  })
  dit(coupes === 0 && fusions === 0 && parGp.size > 10000,
    `la clé de prononciation de l’app redonne les ${milliers(parGp.size)} groupes du pipeline (${coupes} coupé, ${fusions} fusionné)`)
  dit(prononciation('Jeaninne') === prononciation('Jeanine') && prononciation('Lucass') === prononciation('Lucas')
      && prononciation('Louna') !== prononciation('Luna') && prononciation('Manon') !== prononciation('Manone'),
    'Jeaninne se dit comme Jeanine, Lucass comme Lucas ; Louna n’est pas Luna, ni Manon Manone')
}
{
  const src = readFileSync(resolve(RACINE, 'shared/utils/ajouts.ts'), 'utf8')
  const { ecrireAjout } = await module_(src.replace(/^export /gm, '') + '\nglobalThis.__m = { ecrireAjout }')
  const cas = [['jeannine', 'Jeannine'], ['JEAN-MARIE', 'Jean-Marie'], ['  marie - rose ', 'Marie-Rose'],
    ['m’mah', 'M\'Mah'], ['McKenzie', 'McKenzie'], ['élodie', 'Élodie'], ['Jean--Paul', 'Jean-Paul'],
    ['A', ''], ['Zoé!', ''], ['x'.repeat(61), ''], ['123', '']]
  const fautes = cas.filter(([e, a]) => ecrireAjout(e) !== a).map(([e, a]) => `${e} → ${ecrireAjout(e)} (attendu ${a})`)
  dit(fautes.length === 0 && cas.every(([, a]) => !a || ecrireAjout(a) === a),
    `l’écriture d’un prénom tapé : « jeannine », « JEAN-MARIE », « m’mah »… — et elle se tient${fautes.length ? ` — ${fautes.join(' ; ')}` : ''}`)
}

// =================== 2. LA RECHERCHE : PAUL AJOUTE ===========================
const nav = await lancer()
async function entrer(qui, avant) {
  const { ctx, page } = await onglet(nav)
  if (avant) await avant(ctx)
  page.on('pageerror', e => { erreurs.push(`${qui} : ${e.message}`); console.log('   [err]', qui, e.message) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, qui)
  await page.waitForSelector('.bento', { timeout: 30000 })
  return { ctx, page }
}
const api = (page, chemin, methode = 'GET', corps) => page.evaluate(async ([c, m, b]) => {
  const r = await fetch(c, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })
  let json = null; try { json = await r.json() } catch {}
  return { status: r.status, json }
}, [chemin, methode, corps])
const ajouts = async (page, gid = 1) => (await api(page, `/api/groupes/${gid}`)).json?.ajouts ?? []

const devant = p => p.locator('.carte.fiche:not(.derriere)')
async function attendreCarte(p, nom) {
  await p.waitForFunction(n => {
    const c = document.querySelectorAll('.carte.fiche:not(.derriere)')
    return c.length === 1 && c[0].querySelector('.nom')?.textContent.trim() === n
  }, nom, { timeout: 15000 }).catch(() => {})
  return (await devant(p).locator('.nom').first().innerText().catch(() => '')).trim()
}
/** Que la carte de devant ait fini de lire ce qu'on sait d'elle (useAjouts). */
const donneesLues = p => p.waitForFunction(() => {
  const c = document.querySelector('.carte.fiche:not(.derriere)')
  return c && !c.querySelector('.resume[aria-hidden="true"]')
}, null, { timeout: 15000 }).catch(() => {})
/** Les tuiles de chiffres : ce que chacune mesure (dt), et sa valeur (dd). */
const lireTuiles = async carte => (await carte.locator('.resume > div').evaluateAll(ds => ds.map(d =>
  ({ dt: d.querySelector('dt')?.textContent ?? '', dd: d.querySelector('dd')?.textContent ?? '' }))))
  .map(t => ({ dt: blanc(t.dt), dd: blanc(t.dd) }))
const ouvrirRecherche = async p => {
  await p.getByRole('button', { name: 'Chercher un prénom' }).click()
  await p.waitForSelector('.feuille-corps input.chercher', { timeout: 8000 })
  await p.waitForTimeout(400)
}
const chercher = async (p, texte) => {
  await p.locator('.feuille-corps input.chercher').fill(texte)
  await p.waitForTimeout(450)
}
const boutonAjout = (p, nom) => p.locator('.feuille-corps').getByRole('button', { name: `Ajouter « ${nom} » à la liste`, exact: true })
async function axe(page, quoi) {
  for (const [nom, schema] of [['clair', 'light'], ['sombre', 'dark']]) {
    await page.emulateMedia({ colorScheme: schema })
    await page.waitForTimeout(300)
    await page.evaluate(AXE)
    const v = await page.evaluate(async () => (await window.axe.run(document,
      { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }))
      .violations.map(x => `${x.id} (${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')})`))
    dit(v.length === 0, `${quoi}, en ${nom} : aucune violation WCAG A/AA${v.length ? ` — ${v.join(' ; ')}` : ''}`)
  }
  await page.emulateMedia({ colorScheme: 'light' })
}

const paul = await entrer('Paul')
const P = paul.page
await P.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await devant(P).locator('.nom').first().waitFor({ timeout: 30000 })

await ouvrirRecherche(P)
await chercher(P, 'louise')
dit(await P.locator('.feuille-corps section.ajout').count() === 0, 'Louise est au catalogue : rien à ajouter')

await chercher(P, 'jeaninne')
const jumeau = P.locator('.feuille-corps').getByRole('button', { name: 'Jeanine se dit pareil : mettre en première carte' })
await jumeau.waitFor({ timeout: 8000 }).catch(() => {})
dit(await P.locator('.feuille-corps .resultats li').count() === 0 && await boutonAjout(P, 'Jeaninne').count() === 1,
  'Jeaninne n’existe nulle part : la recherche propose de l’ajouter à la liste')
dit(await jumeau.count() === 1 && /se dit pareil/.test(await texte(jumeau)),
  'et propose d’abord Jeanine, qui se dit pareil (une faute de frappe ?)')
await jumeau.click()
dit(await attendreCarte(P, 'Jeanine') === 'Jeanine', 'le toucher met Jeanine, du catalogue, en première carte')

await ouvrirRecherche(P)
await chercher(P, 'ginette')
await boutonAjout(P, 'Ginette').click()
const mot = P.locator('#mot-ajout')
await mot.waitFor({ timeout: 5000 }).catch(() => {})
dit(await mot.evaluate(el => el === document.activeElement && el.maxLength === 140).catch(() => false),
  'un premier geste ouvre le mot (140 caractères au plus), curseur dedans : rien n’est encore ajouté')
await P.waitForTimeout(800)
dit((await ajouts(P)).length === 0, 'et rien n’est parti au serveur')
await mot.fill('Le prénom de ma grand-mère').catch(() => {})
await axe(P, 'la recherche, prête à ajouter')
await P.locator('.feuille-corps').getByRole('button', { name: 'Ajouter « Ginette » à la liste', exact: true }).click({ timeout: 8000 }).catch(() => {})
await P.locator('.feuille-corps').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
dit(await attendreCarte(P, 'Ginette') === 'Ginette' && await P.locator('.feuille-corps').count() === 0,
  'le second l’ajoute : la feuille se ferme, Ginette est la première carte')
await donneesLues(P)
const etiquettesP = (await devant(P).locator('.etiquettes .puce').allInnerTexts()).map(blanc)
dit(etiquettesP.includes('ajouté par vous') && blanc(await devant(P).locator('.sens.mot').innerText({ timeout: 5000 }).catch(() => '')) === '« Le prénom de ma grand-mère »',
  `elle dit qui l’a ajoutée, et son mot (${etiquettesP.join(', ')})`)
const a0 = (await ajouts(P)).find(a => a.prenom === 'Ginette')
dit(a0?.mien === true && a0?.auteur === 'Paul' && a0?.mot === 'Le prénom de ma grand-mère',
  'la liste la porte : Ginette, ajoutée par Paul, avec son mot')

// =================== 3. ALICE : EN TÊTE DE SA PILE ===========================
// Des filtres qui l'excluraient : la liste ne trie plus que des garçons.
const filtresAvant = (await api(P, '/api/groupes/1')).json?.groupe?.filtres ?? {}
await api(P, '/api/groupes/1/filtres', 'PUT', { ...(typeof filtresAvant === 'object' ? filtresAvant : {}), sexe: ['m'] })

const alice = await entrer('Alice')
const A = alice.page
await A.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
dit(await attendreCarte(A, 'Ginette') === 'Ginette',
  'chez Alice, Ginette est la première carte — malgré les filtres de la liste (des garçons seulement)')
await donneesLues(A)
const carteA = devant(A)
const etiquettesA = (await carteA.locator('.etiquettes .puce').allInnerTexts()).map(blanc)
dit(etiquettesA[0] === 'ajouté par Paul' && etiquettesA.includes('fille') && blanc(await carteA.locator('.sens.mot').innerText({ timeout: 5000 }).catch(() => '')) === '« Le prénom de ma grand-mère »',
  `« ${etiquettesA.join(' · ')} », et le mot de Paul`)
const tuiles = await lireTuiles(carteA)
dit(tuiles[0]?.dt === `bébés depuis ${GINETTE.premiere}` && tuiles[0]?.dd === blanc(milliers(GINETTE.total))
    && tuiles[1]?.dt === 'le dernier' && tuiles[1]?.dd === `en ${GINETTE.derniere}`,
  `ses chiffres sont ceux de l’INSEE, au bébé près : ${tuiles.map(t => `${t.dd} ${t.dt}`).join(' · ')}`)
const barres = carteA.locator('.barres')
dit(await barres.locator('.col').count() === hist.decennies.length
    && /par décennie de 1900 à 2020/.test(await barres.getAttribute('role') === 'img' ? await barres.getAttribute('aria-label') : '')
    && /années 1930/.test(await barres.getAttribute('aria-label')) && /au plus haut : années 1930/.test(await texte(carteA.locator('.graphe-tete'))),
  `par décennie, de 1900 à 2020, et dit en mots : « ${await barres.getAttribute('aria-label')} »`)
dit(await carteA.locator('.barres .val').count() === 1 && /^52 ?k$/.test(await texte(carteA.locator('.barres .val'))),
  `un seul chiffre, court, sur la plus haute barre (« ${blanc(await carteA.locator('.barres .val').innerText().catch(() => ''))} »)`)
dit(await carteA.getByRole('button', { name: /^Non aux/ }).count() === 0,
  'pas de « Non aux Gin… » : on répond à une proposition, on ne balaie pas le catalogue avec elle')
await axe(A, 'la carte d’un prénom ajouté')

await carteA.getByRole('button', { name: 'Infos sur Ginette' }).click()
const fiche = A.locator('.feuille[role="dialog"]')
await fiche.waitFor({ timeout: 8000 })
const aujourdhui = await A.evaluate(() => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }))
dit(await texte(fiche.locator('.tete p.mini')) === `fille · ajouté par Paul, le ${blanc(aujourdhui)}`,
  `la fiche dit qui et quand : « ${await texte(fiche.locator('.tete p.mini'))} »`)
dit(await texte(fiche.locator('.lecture').first())
    === blanc(`${milliers(GINETTE.total)} bébés l’ont reçu en France depuis ${GINETTE.premiere}, surtout dans les années ${GINETTE.pic}. Le dernier en ${GINETTE.derniere}.`),
  `et ce que les chiffres veulent dire : « ${await texte(fiche.locator('.lecture').first())} »`)
dit(await fiche.getByRole('button', { name: 'Retirer de la liste' }).count() === 0
    && await fiche.locator('.classe, .chiffres').count() === 0,
  'ni bouton pour retirer (ce n’est pas le sien), ni classe ni tendance (des zéros qu’on n’a pas)')
await axe(A, 'la fiche d’un prénom ajouté')
await A.keyboard.press('Escape'); await A.waitForTimeout(600)

await A.getByRole('button', { name: 'Oui à Ginette' }).click()
await A.waitForTimeout(1000)
await api(P, '/api/groupes/1/vote', 'POST', { prenom: 'Ginette', valeur: 2 })
dit((await api(A, '/api/groupes/1/communs')).json.some(c => c.prenom === 'Ginette'),
  'Alice et Paul disent oui : Ginette est un accord, comme un autre')
await A.goto(`${BASE}/g/1/classement`, { waitUntil: 'networkidle' })
const accord = A.locator('article.commun', { has: A.locator('h2', { hasText: 'Ginette' }) })
await accord.waitFor({ timeout: 15000 }).catch(() => {})
dit(/« Le prénom de ma grand-mère »/.test(blanc(await accord.innerText().catch(() => ''))),
  'dans les accords, le mot de Paul tient lieu de sens')
await api(P, '/api/groupes/1/filtres', 'PUT', typeof filtresAvant === 'object' ? filtresAvant : {})

// =================== 4. UN JUMEAU SEUL, UN PRÉNOM INVENTÉ ====================
await api(P, '/api/groupes/1/ajouts', 'POST', { prenom: 'Lucass' })
await api(P, '/api/groupes/1/ajouts', 'POST', { prenom: 'Zélyanne', mot: 'Inventé un soir de pluie' })
const lucas = cat.cols.l.indexOf('Lucas')
const freqLucas = `1 sur ${milliers(Math.round(10000 / cat.cols.f[lucas]))}`
await A.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
dit(await attendreCarte(A, 'Lucass') === 'Lucass', 'les cartes ajoutées arrivent dans l’ordre où elles l’ont été : Lucass')
await donneesLues(A)
await A.waitForFunction(() => /Lucas/.test(document.querySelector('.carte.fiche:not(.derriere) .identite .graphies')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {})
const cL = devant(A)
dit(blanc(await cL.locator('.identite .graphies').innerText().catch(() => '')).startsWith('se dit comme Lucas'),
  'Lucass n’a aucun chiffre à lui : sa carte dit qu’il se dit comme Lucas')
const tL = await lireTuiles(cL)
dit(tL[0]?.dt === 'Lucas, des naissances' && tL[0]?.dd === blanc(freqLucas) && tL[1]?.dt === 'Lucas, par an',
  `… et donne les chiffres de Lucas, sous SON nom (${tL.map(t => `${t.dt} : ${t.dd}`).join(' · ')})`)
dit((await cL.locator('.etiquettes .puce').allInnerTexts()).map(blanc).join('|') === 'ajouté par Paul'
    && await cL.getByRole('button', { name: /^Non aux/ }).count() === 0,
  'ni le genre de Lucas (Lucass n’est pas Lucas), ni « Non aux Luca… » : on ne balaie pas le catalogue avec lui')
const teteL = cL.locator('.graphe .graphe-tete').first()
dit(await texte(teteL) === 'Lucas depuis 1986' && await teteL.getAttribute('aria-hidden') === null,
  'sa courbe est titrée « Lucas depuis 1986 », et ce titre se lit (la courbe est celle d’un autre)')
await A.getByRole('button', { name: 'Non à Lucass' }).click()
dit(await attendreCarte(A, 'Zélyanne') === 'Zélyanne', 'puis Zélyanne')
await donneesLues(A)
await A.waitForSelector('.carte.fiche:not(.derriere) .absent', { timeout: 10000 }).catch(() => {})
const cZ = devant(A)
const prochesZ = (await cZ.locator('.proches .proche .qui').allInnerTexts()).map(blanc)
dit(blanc(await cZ.locator('.absent').innerText().catch(() => '')) === 'Aucune naissance publiée par l’INSEE depuis 1900.',
  'un prénom inventé : aucune naissance publiée par l’INSEE depuis 1900, et la carte le dit')
dit(prochesZ.length >= 1 && prochesZ.every(n => cat.cols.l.includes(n))
    && (await cZ.locator('.etiquettes .puce').allInnerTexts()).map(blanc).join('|') === 'ajouté par Paul',
  `… avec ceux du catalogue qui s’écrivent presque pareil (${prochesZ.join(', ')}) ; ni genre ni origine inventés`)
await axe(A, 'la carte d’un prénom inventé')

{
  // L'INSEE écrit RÉGINE, accent compris : c'est sous ce nom qu'elle a ses chiffres.
  const REGINE = deplie('RÉGINE')
  await api(P, '/api/groupes/1/ajouts', 'POST', { prenom: 'régine' })
  await A.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
  await devant(A).locator('.nom').first().waitFor({ timeout: 30000 })
  await ouvrirRecherche(A)
  await chercher(A, 'regine')
  const ligneR = A.locator('.feuille-corps .resultats .trouve').filter({ has: A.locator('.nom', { hasText: 'Régine' }) })
  dit(await ligneR.count() === 1, 'la recherche d’Alice trouve Régine, que Paul a ajoutée')
  await ligneR.click({ timeout: 8000 }).catch(() => {})
  await attendreCarte(A, 'Régine')
  await donneesLues(A)
  const tR = await lireTuiles(devant(A))
  dit(tR[0]?.dd === blanc(milliers(REGINE.total)) && tR[0]?.dt === `bébés depuis ${REGINE.premiere}`,
    `« régine », tapé sans capitale : Régine, et ses ${milliers(REGINE.total)} naissances, écrites avec l’accent de l’INSEE`)
}

// =================== 5. SANS HISTORIQUE ======================================
{
  const sans = await entrer('Alice', ctx => ctx.route('**/historique.json.gz', r => r.abort()))
  await sans.page.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
  await attendreCarte(sans.page, 'Zélyanne')
  await sans.page.waitForSelector('.carte.fiche:not(.derriere) .proches', { timeout: 10000 }).catch(() => {})
  await sans.page.waitForTimeout(1500)
  dit(await devant(sans.page).locator('.absent').count() === 0
      && await devant(sans.page).locator('.proches .proche').count() >= 1,
    'l’historique ne vient pas : la carte ne prétend pas que Zélyanne est absente des chiffres de l’INSEE (et garde ses proches)')
  await sans.ctx.close()
}

// =================== 6. RETIRER ==============================================
await api(P, '/api/groupes/1/ajouts', 'POST', { prenom: 'Jeaninne', mot: 'une faute' })
await api(P, '/api/groupes/1/vote', 'POST', { prenom: 'Jeaninne', valeur: 2 })
await api(P, '/api/groupes/1/favori', 'POST', { prenom: 'Jeaninne', actif: true })
dit((await api(A, `/api/groupes/1/ajouts?prenom=${encodeURIComponent('Zélyanne')}`, 'DELETE')).status === 403,
  'Alice ne peut pas retirer Zélyanne : ce n’est pas sa proposition')
await P.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await devant(P).locator('.nom').first().waitFor({ timeout: 30000 })
await ouvrirRecherche(P)
await chercher(P, 'jeaninne')
const ligneJ = P.locator('.feuille-corps .resultats .trouve').filter({ has: P.locator('.nom', { hasText: 'Jeaninne' }) })
dit(await ligneJ.count() === 1 && blanc(await ligneJ.locator('.puce.ajoute').innerText().catch(() => '')) === 'ajouté'
    && await P.locator('.feuille-corps section.ajout').count() === 0,
  'la recherche trouve Jeaninne, « ajouté » : elle ne propose plus de l’ajouter')
await ligneJ.click()
await attendreCarte(P, 'Jeaninne')
await devant(P).getByRole('button', { name: 'Infos sur Jeaninne' }).click()
const ficheP = P.locator('.feuille[role="dialog"]')
await ficheP.getByRole('button', { name: 'Retirer de la liste' }).click()
await ficheP.waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
await P.waitForTimeout(800)
const apres = await api(P, '/api/groupes/1')
const votesP = (await api(P, '/api/groupes/1/votes')).json?.votes ?? []
dit(!apres.json.ajouts.some(a => a.prenom === 'Jeaninne') && !apres.json.mes_favoris.includes('Jeaninne')
    && !votesP.some(v => v.prenom === 'Jeaninne'),
  'Paul retire sa faute de frappe depuis la fiche : partie, avec son oui et son favori')
dit(await texte(devant(P).locator('.nom').first()) !== 'Jeaninne', 'et la carte ne reste pas devant lui')
dit((await api(P, `/api/groupes/1/ajouts?prenom=${encodeURIComponent('Ginette')}`, 'DELETE')).status === 409,
  'Ginette, Alice l’a jugée : Paul ne peut plus la retirer (409)')
await ouvrirRecherche(P)
await chercher(P, 'ginette')
await P.locator('.feuille-corps .resultats .trouve').filter({ has: P.locator('.nom', { hasText: 'Ginette' }) }).click()
await attendreCarte(P, 'Ginette')
await devant(P).getByRole('button', { name: 'Infos sur Ginette' }).click()
await ficheP.getByRole('button', { name: 'Retirer de la liste' }).click()
await ficheP.getByRole('alert').waitFor({ timeout: 8000 }).catch(() => {})
dit(/La liste l’a déjà jugé : il y reste/.test(await ficheP.getByRole('alert').innerText().catch(() => ''))
    && (await ajouts(P)).some(a => a.prenom === 'Ginette'),
  'la fiche le dit, et Ginette reste')
await P.keyboard.press('Escape'); await P.waitForTimeout(600)

await P.goto(`${BASE}/g/1/reglages`, { waitUntil: 'networkidle' })
const champPris = P.locator('#champ-deja-pris')
await champPris.waitFor({ timeout: 20000 }).catch(() => {})
await champPris.fill('zély')
await P.waitForTimeout(400)
dit((await P.locator('.suggestions .suggestion .nom').allInnerTexts()).map(blanc).includes('Zélyanne'),
  '« Déjà pris » propose aussi les prénoms ajoutés : Zélyanne peut être celui d’une cousine')

// =================== 7. LE SERVEUR ===========================================
const mamie = await entrer('Mamie')
const M = mamie.page
dit((await api(M, '/api/groupes/1/ajouts', 'POST', { prenom: 'Zorglubine' })).status === 403,
  'Mamie observe : le serveur refuse qu’elle ajoute')
await M.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
dit(await attendreCarte(M, 'Ginette') === 'Ginette', 'mais elle trie les cartes ajoutées, comme les autres')
await ouvrirRecherche(M)
await chercher(M, 'zorglubine')
dit(await M.locator('.feuille-corps section.ajout').count() === 0, 'et sa recherche ne propose pas d’ajouter')
await M.keyboard.press('Escape')

const doublon = await api(A, '/api/groupes/1/ajouts', 'POST', { prenom: 'GINETTE' })
dit(doublon.status === 200 && doublon.json?.deja === true && doublon.json?.prenom === 'Ginette'
    && (await ajouts(A)).filter(a => a.prenom.toLowerCase() === 'ginette').length === 1,
  'Alice tape « GINETTE » : c’est la même, rendue telle quelle, sans seconde carte')
const casse = await api(A, '/api/groupes/1/ajouts', 'POST', { prenom: 'gINETTE' })
dit(casse.json?.deja === true && casse.json?.prenom === 'Ginette'
    && (await ajouts(A)).filter(a => a.prenom.toLowerCase() === 'ginette').length === 1,
  '« gINETTE » aussi : la casse ne fait pas un autre prénom')
const refus = []
for (const x of ['A', 'Zoé!', 'x'.repeat(61), '   ', 'Ma<script>']) {
  const r = await api(A, '/api/groupes/1/ajouts', 'POST', { prenom: x })
  if (r.status !== 400) refus.push(`${x.slice(0, 12)} → ${r.status}`)
}
dit(refus.length === 0, `ce qui n’est pas un prénom est refusé (400)${refus.length ? ` — ${refus.join(', ')}` : ''}`)
const long = await api(A, '/api/groupes/1/ajouts', 'POST', { prenom: 'bérénixe', mot: `un\n\nmot   ${'très '.repeat(80)}` })
const b = (await ajouts(A)).find(a => a.prenom === 'Bérénixe')
dit(long.json?.prenom === 'Bérénixe' && b?.mot?.length === 140 && !/\s\s|\n/.test(b.mot),
  `écrit comme le catalogue (« bérénixe » → ${long.json?.prenom}), le mot ramené à une ligne de 140 caractères`)
{
  const l = (await api(P, '/api/groupes', 'POST', { nom: 'Pleine' })).json
  const lettres = 'abcdefghijklmnopqrstuvwxyz'
  const echecs = []
  for (let i = 0; i < 200; i++) {
    const r = await api(P, `/api/groupes/${l.id}/ajouts`, 'POST', { prenom: `Plein${lettres[Math.floor(i / 26)]}${lettres[i % 26]}` })
    if (r.status !== 200) echecs.push(r.status)
  }
  const de_trop = await api(P, `/api/groupes/${l.id}/ajouts`, 'POST', { prenom: 'Pleinzz' })
  dit(echecs.length === 0 && de_trop.status === 409 && de_trop.json?.statusMessage === 'ajouts_plein',
    `deux cents par liste, pas un de plus (${200 - echecs.length} acceptés, puis ${de_trop.status} ${de_trop.json?.statusMessage})`)
}

// =================== 8. AU RETOUR SUR L'APP ==================================
await A.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await devant(A).locator('.nom').first().waitFor({ timeout: 30000 })
await api(P, '/api/groupes/1/ajouts', 'POST', { prenom: 'Josette' })
await A.evaluate(() => {
  // Une minute plus tard, l'app revient au premier plan.
  const vrai = Date.now.bind(Date)
  Date.now = () => vrai() + 60000
  document.dispatchEvent(new Event('visibilitychange'))
})
await A.waitForTimeout(1500)
await ouvrirRecherche(A)
await chercher(A, 'josette')
dit(await A.locator('.feuille-corps .resultats .trouve').filter({ has: A.locator('.nom', { hasText: 'Josette' }) }).count() === 1,
  'Paul ajoute Josette pendant qu’Alice est ailleurs : au retour sur l’app, la liste l’a déjà')
await A.keyboard.press('Escape'); await A.waitForTimeout(500)

// =================== 9. QUITTER, EFFACER, EXPORTER ===========================
{
  const l = (await api(P, '/api/groupes', 'POST', { nom: 'À quitter' })).json
  const code = (await api(P, `/api/groupes/${l.id}`)).json?.groupe?.code_invitation
  await api(A, '/api/groupes/rejoindre', 'POST', { code })
  await api(A, `/api/groupes/${l.id}/ajouts`, 'POST', { prenom: 'Raymonde', mot: 'ma tante' })
  await api(A, `/api/groupes/${l.id}/quitter`, 'POST', { confirmation: 'QUITTER' })
  const r = (await ajouts(P, l.id)).find(a => a.prenom === 'Raymonde')
  dit(r && r.auteur === null && r.mot === null && r.mien === false,
    'Alice quitte une liste : Raymonde y reste pour Paul, sans son nom ni son mot')
}
await api(A, '/api/groupes/1/ajouts', 'POST', { prenom: 'Simonne', mot: 'pour voir' })
const exporte = (await api(A, '/api/moi/donnees')).json
dit(exporte?.prenoms_ajoutes?.some(x => x.prenom === 'Simonne' && x.mot === 'pour voir' && Number(x.groupe_id) === 1)
    && /toute la liste les voit/.test(exporte?.a_savoir?.prenoms_ajoutes ?? ''),
  'l’export d’Alice porte les prénoms qu’elle a ajoutés, avec son mot, et dit qui les voit')
const efface = await api(A, '/api/moi/supprimer', 'POST', { confirmation: 'SUPPRIMER' })
const s = (await ajouts(P)).find(a => a.prenom === 'Simonne')
dit(efface.status === 200 && s && s.auteur === null && s.mot === null,
  'Alice efface son compte : Simonne reste à la liste, sans auteur ni mot')
await P.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await devant(P).locator('.nom').first().waitFor({ timeout: 30000 })
await ouvrirRecherche(P)
await chercher(P, 'simonne')
await P.locator('.feuille-corps .resultats .trouve').filter({ has: P.locator('.nom', { hasText: 'Simonne' }) }).click()
await attendreCarte(P, 'Simonne')
dit(blanc((await devant(P).locator('.etiquettes .puce').allInnerTexts())[0]) === 'ajouté',
  'sa carte dit seulement « ajouté »')

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})${erreurs.length ? ` — ${erreurs.slice(0, 3).join(' ; ')}` : ''}`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
