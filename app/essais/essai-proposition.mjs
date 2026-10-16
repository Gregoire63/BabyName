/**
 * Un prénom du catalogue que les filtres de la liste écartent, cherché puis
 * aimé, est PROPOSÉ aux autres : en tête de leur pile, « proposé par Paul »
 * (VueGroupe, proposerHorsFiltres). Sans quoi ils ne le verraient jamais.
 *
 *  1. Paul cherche Bernadette (très rare : hors des filtres par défaut), la
 *     met en première carte, dit oui : la liste la porte, et l'écran le dit.
 *  2. Alice : Bernadette en tête de SA pile, « proposé par Paul » ; sa vraie
 *     carte du catalogue (pas celle d'un prénom ajouté) ; la fiche le dit ;
 *     pas de « Non aux Ber… » ; un accord dessus. Mamie, observatrice, l'a
 *     aussi en tête.
 *  3. Ce qui ne propose rien : un non ; un prénom dans les filtres (Ambre) ; une
 *     graphie rare d'un son que la pile a déjà (Roze, Rose) ; un prénom que
 *     tous les autres décideurs ont déjà jugé ; le vote d'une observatrice.
 *  4. Changer d'avis : un neutre repris par un non dans « Mes choix », un oui
 *     repris par un non sur la carte rejugée — la proposition part, le vote
 *     reste ; plus rien à reprendre quand un autre l'a jugée.
 *  5. Par l'adresse (?prenom=, le bouton d'une fiche publique) : pareil.
 *  6. Les filtres changent ensuite et l'y font entrer : une seule carte.
 *  7. Seul dans une liste neuve : proposé pour ceux qui viendront ; une
 *     carte pour un son (pas Gabriel derrière Gabryel), un oui qui vaut pour
 *     les graphies de la pile, pas de « Non aux… ».
 *  8. Aucune violation WCAG A/AA sur la carte ; aucune erreur JS.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AXE = readFileSync(process.env.ESSAI_AXE
  || createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const { ok, ko, dit } = compteur()
const erreurs = []
const blanc = s => String(s ?? '').replace(/[\s  ]+/g, ' ').trim()
const texte = async loc => blanc(await loc.innerText({ timeout: 5000 }).catch(() => ''))

// Les prénoms de l'essai : au catalogue, très rares (hors des filtres par
// défaut), seuls de leur prononciation. Roze est rare, mais se dit comme Rose.
const cat = JSON.parse(readFileSync(resolve(RACINE, 'public/data/catalogue.json'), 'utf8'))
const iDe = l => cat.cols.l.indexOf(l)
const seulsEtRares = ['Bernadette', 'Josiane', 'Henriette', 'Paulette', 'Ghislaine', 'Yvette', 'Germaine', 'Lucienne', 'Brigitte']
  .filter(l => { const i = iDe(l); return i < 0 || !cat.cols.q[i] || cat.cols.l.some((x, k) => k !== i && cat.cols.gp[k] === cat.cols.gp[i]) })
dit(seulsEtRares.length === 0 && cat.cols.q[iDe('Roze')] && !cat.cols.q[iDe('Rose')] && cat.cols.gp[iDe('Roze')] === cat.cols.gp[iDe('Rose')]
    && !cat.cols.q[iDe('Louise')],
  `les prénoms de l’essai sont ce qu’il faut qu’ils soient${seulsEtRares.length ? ` — sauf ${seulsEtRares.join(', ')}` : ''}`)

const nav = await lancer()
async function entrer(qui) {
  const { ctx, page } = await onglet(nav)
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
const ajouts = async page => (await api(page, '/api/groupes/1')).json?.ajouts ?? []
const monVote = async (page, nom) => {
  const r = (await api(page, '/api/groupes/1')).json
  const moi = r?.moi?.user_id
  return ((await api(page, '/api/groupes/1/votes')).json?.votes ?? []).find(v => v.user_id === moi && v.prenom === nom)?.valeur
}

const devant = p => p.locator('.carte.fiche:not(.derriere)')
async function attendreCarte(p, nom) {
  await p.waitForFunction(n => {
    const c = document.querySelectorAll('.carte.fiche:not(.derriere)')
    return c.length === 1 && c[0].querySelector('.nom')?.textContent.trim() === n
  }, nom, { timeout: 15000 }).catch(() => {})
  return (await devant(p).locator('.nom').first().innerText().catch(() => '')).trim()
}
const etiquettes = async p => (await devant(p).locator('.etiquettes .puce').allInnerTexts()).map(blanc)
const pile = async p => {
  await p.locator('.carte.fiche').first().waitFor({ timeout: 30000 })
  await p.waitForTimeout(400)
}
async function epingler(p, nom) {
  // Un oui a pu faire un accord (Louise l'est déjà dans la base d'essai) : sa
  // fête couvre la pile.
  if (await p.locator('.fete').count()) { await p.keyboard.press('Escape'); await p.waitForTimeout(700) }
  await p.getByRole('button', { name: 'Chercher un prénom' }).click()
  await p.waitForSelector('.feuille-corps input.chercher', { timeout: 8000 })
  await p.waitForTimeout(400)
  await p.locator('.feuille-corps input.chercher').fill(nom.toLowerCase())
  await p.waitForTimeout(450)
  await p.locator('.feuille-corps .resultats .trouve')
    .filter({ has: p.locator('.nom', { hasText: new RegExp(`^\\s*${nom}\\s*$`) }) }).first().click({ timeout: 8000 })
  return attendreCarte(p, nom)
}
/** Le message de la pile (« Proposé à la liste : … »), '' s'il ne vient pas. */
async function message(p, attente = 6000) {
  const m = p.locator('.retour.carte[role="status"]').filter({ hasText: 'Proposé à la liste' })
  await m.waitFor({ timeout: attente }).catch(() => {})
  return texte(m)
}
/** Voter sur la carte de devant, puis laisser partir ce qui suit le vote. */
async function voter(p, verdict, nom) {
  const nomBouton = { oui: `Oui à ${nom}`, non: `Non à ${nom}`, neutre: `Neutre pour ${nom}` }[verdict]
  await p.getByRole('button', { name: nomBouton, exact: true }).click({ timeout: 8000 })
}
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

// =================== 1. PAUL CHERCHE BERNADETTE, ET L'AIME ===================
const paul = await entrer('Paul')
const P = paul.page
await P.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await pile(P)
dit(await epingler(P, 'Bernadette') === 'Bernadette' && !(await etiquettes(P)).some(e => /propos/.test(e)),
  'Paul cherche Bernadette (très rare : hors des filtres de la liste) : sa première carte, sans rien proposer encore')
await voter(P, 'oui', 'Bernadette')
dit(await message(P) === 'Proposé à la liste : Bernadette', 'il dit oui : « Proposé à la liste : Bernadette »')
const b0 = (await ajouts(P)).find(a => a.prenom === 'Bernadette')
dit(b0?.mien === true && b0?.auteur === 'Paul' && b0?.mot === null && await monVote(P, 'Bernadette') === 2,
  'la liste la porte, proposée par Paul, sans mot — et le oui de Paul est là')

// =================== 2. ALICE, MAMIE : EN TÊTE DE PILE =======================
const alice = await entrer('Alice')
const A = alice.page
let retraitsAlice = 0
A.on('request', r => { if (r.method() === 'DELETE' && /\/ajouts/.test(r.url())) retraitsAlice++ })
await A.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
dit(await attendreCarte(A, 'Bernadette') === 'Bernadette',
  'chez Alice, Bernadette est la première carte — que ses filtres auraient écartée')
const eA = await etiquettes(A)
dit(eA[0] === 'proposé par Paul' && eA.includes('fille'), `« ${eA.join(' · ')} »`)
const dt0 = await texte(devant(A).locator('.resume > div dt').first())
dit(dt0 === 'des naissances' && await devant(A).locator('.sens.mot').count() === 0,
  `sa vraie carte, celle du catalogue (« ${dt0} »), pas celle d’un prénom ajouté`)
dit(await devant(A).getByRole('button', { name: /^Non aux/ }).count() === 0,
  'pas de « Non aux Ber… » : on répond à une proposition, on ne balaie pas le catalogue avec elle')
await axe(A, 'la carte d’un prénom proposé')
await devant(A).getByRole('button', { name: 'Infos sur Bernadette' }).click()
const ficheA = A.locator('.feuille[role="dialog"]')
await ficheA.waitFor({ timeout: 8000 }).catch(() => {})
dit(await texte(ficheA.locator('.tete p.mini')) === 'fille · proposé par Paul' && await ficheA.locator('.chiffres').count() === 1,
  `la fiche aussi : « ${await texte(ficheA.locator('.tete p.mini'))} », avec ses chiffres du catalogue`)
await A.keyboard.press('Escape'); await A.waitForTimeout(600)
await voter(A, 'oui', 'Bernadette')
await A.waitForTimeout(1200)
dit((await api(A, '/api/groupes/1/communs')).json?.some(c => c.prenom === 'Bernadette'),
  'Alice dit oui aussi : Bernadette est un accord — ce que les filtres auraient empêché')
dit(await message(A, 1500) === '', 'et Alice ne propose rien : Bernadette l’était déjà')

const mamie = await entrer('Mamie')
const M = mamie.page
let tentativesMamie = 0
M.on('request', r => { if (r.method() === 'POST' && /\/ajouts/.test(r.url())) tentativesMamie++ })
await M.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
dit(await attendreCarte(M, 'Bernadette') === 'Bernadette' && (await etiquettes(M))[0] === 'proposé par Paul',
  'Mamie, observatrice, l’a aussi en tête de pile')

// =================== 3. CE QUI NE PROPOSE RIEN ===============================
await epingler(P, 'Josiane')
await voter(P, 'non', 'Josiane')
dit(await message(P, 2500) === '' && !(await ajouts(P)).some(a => a.prenom === 'Josiane'),
  'un non à Josiane : rien de proposé (on ne pousse pas chez les autres ce qu’on écarte)')

// Ambre : dans les filtres, et qu'Alice n'a pas jugée (Louise, si : son
// refus de proposer ne prouverait rien des filtres).
await epingler(P, 'Ambre')
await voter(P, 'oui', 'Ambre')
dit(await message(P, 2500) === '' && !(await ajouts(P)).some(a => a.prenom === 'Ambre'),
  'un oui à Ambre, que les filtres laissent passer : rien (Alice l’a dans sa pile)')

await epingler(P, 'Roze')
await voter(P, 'oui', 'Roze')
dit(await message(P, 2500) === '' && !(await ajouts(P)).some(a => a.prenom === 'Roze'),
  'un oui à Roze, rare, mais qui se dit comme Rose : rien (le son est dans la pile d’Alice)')

await api(A, '/api/groupes/1/vote', 'POST', { prenom: 'Yvette', valeur: 1 })
await epingler(P, 'Yvette')
await voter(P, 'oui', 'Yvette')
dit(await message(P, 2500) === '' && !(await ajouts(P)).some(a => a.prenom === 'Yvette'),
  'un oui à Yvette, qu’Alice a déjà jugée : rien (il n’y a plus personne à qui la proposer)')

await epingler(M, 'Ghislaine')
await voter(M, 'oui', 'Ghislaine')
dit(await message(M, 2500) === '' && !(await ajouts(M)).some(a => a.prenom === 'Ghislaine') && tentativesMamie === 0,
  `Mamie, observatrice, aime Ghislaine : rien de proposé, pas même tenté (${tentativesMamie} demande)`)

// =================== 4. CHANGER D'AVIS =======================================
await epingler(P, 'Henriette')
await voter(P, 'neutre', 'Henriette')
dit(await message(P) === 'Proposé à la liste : Henriette' && (await ajouts(P)).some(a => a.prenom === 'Henriette'),
  'un « pourquoi pas » à Henriette la propose aussi')
await P.goto(`${BASE}/g/1/classement`, { waitUntil: 'networkidle' })
const cl = P.locator('.pager > section:nth-child(2)')
await cl.locator('.segment button', { hasText: 'Mes choix' }).click({ timeout: 20000 })
await cl.locator('.groupe .entete').filter({ has: P.locator('strong', { hasText: /^Neutre$/ }) }).click()
await P.waitForTimeout(500)
const rangH = cl.locator('.groupe .rangee').filter({ has: P.locator('.nom', { hasText: /^\s*Henriette\s*$/ }) })
if (!await rangH.count()) await cl.locator('.groupe').filter({ has: P.locator('.entete strong', { hasText: /^Neutre$/ }) }).locator('button.tout, button:has-text("Voir")').first().click().catch(() => {})
await rangH.locator('.petit.v0').click({ timeout: 8000 }).catch(() => {})
await P.waitForTimeout(1500)
dit(!(await ajouts(P)).some(a => a.prenom === 'Henriette') && await monVote(P, 'Henriette') === 0,
  'Paul la passe à non dans « Mes choix » : la proposition part, son non reste')

await P.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await pile(P)
await epingler(P, 'Paulette')
await voter(P, 'oui', 'Paulette')
await message(P)
const avantP = (await ajouts(P)).some(a => a.prenom === 'Paulette')
await P.waitForTimeout(5500)   // le message précédent s'efface
dit(await epingler(P, 'Paulette') === 'Paulette' && (await etiquettes(P)).includes('proposé par vous'),
  'Paulette, proposée puis recherchée : sa carte dit « proposé par vous »')
await voter(P, 'neutre', 'Paulette')
dit(await message(P, 2500) === '' && (await ajouts(P)).filter(a => a.prenom === 'Paulette').length === 1,
  'rejugée neutre : rien de reproposé, rien de redit — elle l’était déjà')
await epingler(P, 'Paulette')
await voter(P, 'non', 'Paulette')
await P.waitForTimeout(1500)
dit(avantP && !(await ajouts(P)).some(a => a.prenom === 'Paulette') && await monVote(P, 'Paulette') === 0,
  'rejugée non sur la carte : la proposition part, le non reste')

await epingler(P, 'Germaine')
await voter(P, 'oui', 'Germaine')
await message(P)
await api(A, '/api/groupes/1/vote', 'POST', { prenom: 'Germaine', valeur: 1 })
await P.waitForTimeout(5500)
await epingler(P, 'Germaine')
await voter(P, 'non', 'Germaine')
await P.waitForTimeout(1500)
dit((await ajouts(P)).some(a => a.prenom === 'Germaine') && await monVote(P, 'Germaine') === 0,
  'Germaine, qu’Alice a jugée entre-temps : la proposition reste à la liste (le non de Paul aussi)')
dit((await api(P, `/api/groupes/1/ajouts?prenom=Germaine&seule=1`, 'DELETE')).status === 409
    && (await api(A, `/api/groupes/1/ajouts?prenom=Germaine&seule=1`, 'DELETE')).status === 403,
  'le serveur le tient : 409 pour Paul, 403 pour Alice (ce n’est pas la sienne)')
retraitsAlice = 0   // la demande de l'essai, ci-dessus : seules comptent celles de l'app

// =================== 5. PAR L'ADRESSE ========================================
await P.goto(`${BASE}/g/1/swipe?prenom=lucienne`, { waitUntil: 'networkidle' })
dit(await attendreCarte(P, 'Lucienne') === 'Lucienne', 'Lucienne, demandée par l’adresse : première carte')
await voter(P, 'oui', 'Lucienne')
dit(await message(P) === 'Proposé à la liste : Lucienne' && (await ajouts(P)).some(a => a.prenom === 'Lucienne'),
  'aimée, elle est proposée comme si on l’avait cherchée')

// =================== 6. DES FILTRES QUI L'Y FONT ENTRER ======================
await P.waitForTimeout(5500)
await epingler(P, 'Brigitte')
await voter(P, 'oui', 'Brigitte')
await message(P)
const filtres = (await api(P, '/api/groupes/1')).json?.groupe?.filtres ?? {}
await api(P, '/api/groupes/1/filtres', 'PUT', { ...(typeof filtres === 'object' ? filtres : {}), inclure_rares: true })
await A.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
dit(await attendreCarte(A, 'Lucienne') === 'Lucienne', 'chez Alice, les propositions arrivent dans l’ordre : Lucienne')
await voter(A, 'non', 'Lucienne')
dit(await attendreCarte(A, 'Brigitte') === 'Brigitte' && (await etiquettes(A))[0] === 'proposé par Paul',
  'puis Brigitte, « proposé par Paul », même si les rares sont maintenant dans la pile')
const derriere = blanc(await A.locator('.carte.fiche.derriere .nom').first().innerText().catch(() => ''))
await voter(A, 'non', 'Brigitte')
await A.waitForTimeout(900)
const suite = [await texte(devant(A).locator('.nom').first()),
  blanc(await A.locator('.carte.fiche.derriere .nom').first().innerText().catch(() => ''))]
dit(derriere !== 'Brigitte' && !suite.includes('Brigitte'),
  `une carte, pas deux : jugée, Brigitte ne revient pas par la pile (derrière : ${derriere} ; ensuite : ${suite.join(', ')})`)
await api(P, '/api/groupes/1/filtres', 'PUT', typeof filtres === 'object' ? filtres : {})
dit(retraitsAlice === 0, `Alice n’a rien tenté de retirer : ce ne sont pas ses propositions (${retraitsAlice} demande)`)

// =================== 7. SEUL DANS SA LISTE, POUR CEUX QUI VIENDRONT =========
// Une liste neuve, des filles seulement : Gabryel (Gabriel, autrement écrit)
// en est sorti tout entier. Paul l'aime avant d'avoir invité qui que ce soit.
const l7 = (await api(P, '/api/groupes', 'POST', { nom: 'Pour plus tard' })).json
const f7 = (await api(P, `/api/groupes/${l7.id}`)).json?.groupe?.filtres ?? {}
await api(P, `/api/groupes/${l7.id}/filtres`, 'PUT', { ...(typeof f7 === 'object' ? f7 : {}), sexe: ['f'] })
await P.goto(`${BASE}/g/${l7.id}/swipe`, { waitUntil: 'networkidle' })
await pile(P)
await epingler(P, 'Gabryel')
await voter(P, 'oui', 'Gabryel')
dit(await message(P) === 'Proposé à la liste : Gabryel'
    && ((await api(P, `/api/groupes/${l7.id}`)).json?.ajouts ?? []).some(a => a.prenom === 'Gabryel'),
  'seul dans sa liste, Paul aime Gabryel, hors des filtres : proposé quand même, pour ceux qui viendront')
await api(P, `/api/groupes/${l7.id}/filtres`, 'PUT', typeof f7 === 'object' ? f7 : {})
const code7 = (await api(P, `/api/groupes/${l7.id}`)).json?.groupe?.code_invitation
await api(A, '/api/groupes/rejoindre', 'POST', { code: code7 })
await A.goto(`${BASE}/g/${l7.id}/swipe`, { waitUntil: 'networkidle' })
dit(await attendreCarte(A, 'Gabryel') === 'Gabryel' && (await etiquettes(A))[0] === 'proposé par Paul',
  'Alice rejoint la liste (les garçons y sont revenus) : Gabryel en premier, « proposé par Paul »')
const derriere7 = blanc(await A.locator('.carte.fiche.derriere .nom').first().innerText().catch(() => ''))
dit(derriere7 && !['Gabriel', 'Gabriël', 'Gabriele', 'Gabryël'].includes(derriere7),
  `et pas Gabriel juste derrière, alors qu’il est le plus donné : un son, une carte (derrière : ${derriere7})`)
dit(await devant(A).getByRole('button', { name: /^Non aux/ }).count() === 0,
  'pas de « Non aux Gabr… » sur une proposition, même quand la pile a sa famille')
await voter(A, 'oui', 'Gabryel')
await A.waitForTimeout(1500)
const votes7 = ((await api(A, `/api/groupes/${l7.id}/votes`)).json?.votes ?? [])
const moiA = (await api(A, `/api/groupes/${l7.id}`)).json?.moi?.user_id
dit(votes7.some(v => v.user_id === moiA && v.prenom === 'Gabriel' && v.valeur === 2),
  'son oui à Gabryel vaut pour Gabriel et ses graphies, comme sur toute carte')
const apres7 = [await texte(devant(A).locator('.nom').first()),
  blanc(await A.locator('.carte.fiche.derriere .nom').first().innerText().catch(() => ''))]
dit(!apres7.some(n => /^Gabr/.test(n)), `Gabriel ne revient pas ensuite (${apres7.join(', ')})`)

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})${erreurs.length ? ` — ${erreurs.slice(0, 3).join(' ; ')}` : ''}`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
