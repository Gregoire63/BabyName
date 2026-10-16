/**
 * Un prénom du catalogue CHERCHÉ PUIS AIMÉ est proposé aux autres : en tête
 * de leur pile, filtres ou pas — et SANS LE DIRE, ni à l'un ni à l'autre
 * (VueGroupe, proposer). Le vote reste aveugle : ni « proposé par Paul », ni
 * nom, ni heure dans ce que le serveur rend aux autres, ni notification
 * (essai-notifications). Seul un prénom créé se signe (essai-ajout).
 *
 *  1. Paul cherche Bernadette (très rare : hors des filtres par défaut), la
 *     met en première carte, dit oui : rien ne s'affiche ; la liste la porte,
 *     marquée « propose », à son nom pour lui seul.
 *  2. Alice : Bernadette en tête de SA pile, une carte comme une autre — ni
 *     étiquette, ni « proposé » dans la fiche ; le serveur ne lui dit ni qui
 *     ni quand. Un accord dessus. Mamie, observatrice, l'a aussi en tête.
 *  3. Ce qui ne propose rien : un non ; un prénom que l'autre décideur a déjà
 *     jugé ; le vote d'une observatrice (rien n'est même tenté).
 *  4. DANS les filtres aussi : Ambre ; et Roze, qui se dit comme Rose.
 *  5. Changer d'avis : un neutre repris par un non dans « Mes choix », un oui
 *     repris par un non sur la carte rejugée — la proposition part, le vote
 *     reste ; rejugée positive, elle n'est pas reproposée ; plus rien à
 *     reprendre quand un autre l'a jugée.
 *  6. Par l'adresse (?prenom=, le bouton d'une fiche publique) : pareil.
 *  7. Chez Alice, dans l'ordre : Ambre, Roze — sans Rose derrière, et son oui
 *     à Roze vaut pour Rose —, Lucienne. Elle ne retire rien qui ne soit à elle.
 *  8. Seul dans une liste neuve : proposé pour ceux qui viendront ; une carte
 *     pour un son (pas Gabriel derrière Gabryel), un oui qui vaut pour les
 *     graphies de la pile.
 *  9. Aucune erreur JS.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { ok, ko, dit } = compteur()
const erreurs = []
const blanc = s => String(s ?? '').replace(/[\s  ]+/g, ' ').trim()
const texte = async loc => blanc(await loc.innerText({ timeout: 5000 }).catch(() => ''))

// Les prénoms de l'essai : au catalogue, très rares (hors des filtres par
// défaut), seuls de leur prononciation ; Ambre, dans les filtres ; Roze,
// rare, se dit comme Rose, qui ne l'est pas.
const cat = JSON.parse(readFileSync(resolve(RACINE, 'public/data/catalogue.json'), 'utf8'))
const iDe = l => cat.cols.l.indexOf(l)
const seulsEtRares = ['Bernadette', 'Josiane', 'Henriette', 'Paulette', 'Ghislaine', 'Yvette', 'Germaine', 'Lucienne']
  .filter(l => { const i = iDe(l); return i < 0 || !cat.cols.q[i] || cat.cols.l.some((x, k) => k !== i && cat.cols.gp[k] === cat.cols.gp[i]) })
dit(seulsEtRares.length === 0 && cat.cols.q[iDe('Roze')] && !cat.cols.q[iDe('Rose')] && cat.cols.gp[iDe('Roze')] === cat.cols.gp[iDe('Rose')]
    && iDe('Ambre') >= 0 && !cat.cols.q[iDe('Ambre')],
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
const ajouts = async (page, gid = 1) => (await api(page, `/api/groupes/${gid}`)).json?.ajouts ?? []
const monVote = async (page, nom, gid = 1) => {
  const moi = (await api(page, `/api/groupes/${gid}`)).json?.moi?.user_id
  return ((await api(page, `/api/groupes/${gid}/votes`)).json?.votes ?? []).find(v => v.user_id === moi && v.prenom === nom)?.valeur
}
/** Les demandes d'ajout parties d'une page, corps compris : ce que l'app a tenté. */
function espionner(page) {
  const vues = []
  page.on('request', r => {
    if (!/\/api\/groupes\/\d+\/ajouts/.test(r.url())) return
    let corps = null; try { corps = r.postDataJSON() } catch {}
    vues.push({ methode: r.method(), corps })
  })
  return vues
}

const devant = p => p.locator('.carte.fiche:not(.derriere)')
async function attendreCarte(p, nom) {
  await p.waitForFunction(n => {
    const c = document.querySelectorAll('.carte.fiche:not(.derriere)')
    return c.length === 1 && c[0].querySelector('.nom')?.textContent.trim() === n
  }, nom, { timeout: 15000 }).catch(() => {})
  return (await devant(p).locator('.nom').first().innerText().catch(() => '')).trim()
}
const derriere = async p => blanc(await p.locator('.carte.fiche.derriere .nom').first().innerText().catch(() => ''))
const etiquettes = async p => (await devant(p).locator('.etiquettes .puce').allInnerTexts()).map(blanc)
const pile = async p => {
  await p.locator('.carte.fiche').first().waitFor({ timeout: 30000 })
  await p.waitForTimeout(400)
}
async function epingler(p, nom) {
  // Un oui a pu faire un accord : sa fête couvre la pile.
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
async function voter(p, verdict, nom) {
  // Le oui d'avant a pu faire un accord (Roze, Bernadette) : sa fête couvre la pile.
  if (await p.locator('.fete').count()) { await p.keyboard.press('Escape'); await p.waitForTimeout(700) }
  const nomBouton = { oui: `Oui à ${nom}`, non: `Non à ${nom}`, neutre: `Neutre pour ${nom}` }[verdict]
  await p.getByRole('button', { name: nomBouton, exact: true }).click({ timeout: 8000 })
}
/** Ce que la pile affiche par-dessus après un geste (un message, un bandeau) : '' si rien. */
async function rienNeSAffiche(p) {
  await p.waitForTimeout(1600)
  return (await p.locator('.retour.carte[role="status"]').allInnerTexts()).map(blanc).join(' | ')
}
const sans = (l, nom) => !l.some(a => a.prenom === nom)

// =================== 1. PAUL CHERCHE BERNADETTE, ET L'AIME ===================
const paul = await entrer('Paul')
const P = paul.page
const demandesP = espionner(P)
await P.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await pile(P)
dit(await epingler(P, 'Bernadette') === 'Bernadette', 'Paul cherche Bernadette (très rare : hors des filtres de la liste) : sa première carte')
await voter(P, 'oui', 'Bernadette')
const affiche1 = await rienNeSAffiche(P)
dit(affiche1 === '', `il dit oui : rien ne s’affiche${affiche1 ? ` — « ${affiche1} »` : ''}`)
const b0 = (await ajouts(P)).find(a => a.prenom === 'Bernadette')
const d0 = demandesP.find(d => d.methode === 'POST' && d.corps?.prenom === 'Bernadette')
dit(b0?.propose === true && b0?.mien === true && b0?.auteur === 'Paul' && b0?.mot === null
    && d0?.corps?.propose === true && await monVote(P, 'Bernadette') === 2,
  'la liste la porte, en proposition, à son nom pour lui — et son oui est là')

// =================== 2. ALICE, MAMIE : EN TÊTE, SANS ÉTIQUETTE ===============
const alice = await entrer('Alice')
const A = alice.page
let retraitsAlice = 0
A.on('request', r => { if (r.method() === 'DELETE' && /\/ajouts/.test(r.url())) retraitsAlice++ })
await A.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
dit(await attendreCarte(A, 'Bernadette') === 'Bernadette',
  'chez Alice, Bernadette est la première carte — que ses filtres auraient écartée')
const eA = await etiquettes(A)
dit(!eA.some(e => /propos|ajout|Paul/i.test(e)) && eA.includes('fille'),
  `une carte comme une autre : « ${eA.join(' · ')} »`)
const vueA = (await ajouts(A)).find(a => a.prenom === 'Bernadette')
dit(vueA && vueA.auteur === null && vueA.ajoute_le === null && vueA.mot === null && vueA.mien === false && vueA.propose === true,
  `le serveur ne lui dit ni qui, ni quand (${JSON.stringify(vueA)})`)
await devant(A).getByRole('button', { name: 'Infos sur Bernadette' }).click()
const ficheA = A.locator('.feuille[role="dialog"]')
await ficheA.waitFor({ timeout: 8000 }).catch(() => {})
const sousTitre = await texte(ficheA.locator('.tete p.mini'))
dit(sousTitre === 'fille' && await ficheA.locator('.chiffres').count() === 1,
  `la fiche non plus : « ${sousTitre} », ses chiffres du catalogue`)
await A.keyboard.press('Escape'); await A.waitForTimeout(600)
await voter(A, 'oui', 'Bernadette')
await A.waitForTimeout(1200)
dit((await api(A, '/api/groupes/1/communs')).json?.some(c => c.prenom === 'Bernadette'),
  'Alice dit oui aussi : Bernadette est un accord — ce que les filtres auraient empêché')
dit((await ajouts(A)).filter(a => a.prenom === 'Bernadette').length === 1, 'et rien n’est proposé une seconde fois')

const mamie = await entrer('Mamie')
const M = mamie.page
const demandesM = espionner(M)
await M.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
dit(await attendreCarte(M, 'Bernadette') === 'Bernadette', 'Mamie, observatrice, l’a aussi en tête de pile')

// =================== 3. CE QUI NE PROPOSE RIEN ===============================
await epingler(P, 'Josiane')
await voter(P, 'non', 'Josiane')
await P.waitForTimeout(1500)
dit(sans(await ajouts(P), 'Josiane'), 'un non à Josiane : rien (on ne pousse pas chez les autres ce qu’on écarte)')

await api(A, '/api/groupes/1/vote', 'POST', { prenom: 'Yvette', valeur: 1 })
await epingler(P, 'Yvette')
await voter(P, 'oui', 'Yvette')
await P.waitForTimeout(1500)
dit(sans(await ajouts(P), 'Yvette'), 'un oui à Yvette, qu’Alice a déjà jugée : rien (plus personne à qui la proposer)')

await epingler(M, 'Ghislaine')
await voter(M, 'oui', 'Ghislaine')
await M.waitForTimeout(1500)
dit(sans(await ajouts(M), 'Ghislaine') && !demandesM.some(d => d.methode === 'POST'),
  `Mamie, observatrice, aime Ghislaine : rien de proposé, pas même tenté (${demandesM.length} demande)`)

// =================== 4. DANS LES FILTRES AUSSI ===============================
await epingler(P, 'Ambre')
await voter(P, 'oui', 'Ambre')
await P.waitForTimeout(1500)
dit((await ajouts(P)).some(a => a.prenom === 'Ambre' && a.propose),
  'Ambre, que les filtres laissent passer : proposée aussi (sinon, au bout de la pile d’Alice)')
await epingler(P, 'Roze')
await voter(P, 'oui', 'Roze')
await P.waitForTimeout(1500)
dit((await ajouts(P)).some(a => a.prenom === 'Roze' && a.propose),
  'Roze, qui se dit comme Rose : proposée sous la graphie que Paul aime')

// =================== 5. CHANGER D'AVIS =======================================
await epingler(P, 'Henriette')
await voter(P, 'neutre', 'Henriette')
await P.waitForTimeout(1500)
dit((await ajouts(P)).some(a => a.prenom === 'Henriette'), 'un « pourquoi pas » à Henriette la propose aussi')
await P.goto(`${BASE}/g/1/classement`, { waitUntil: 'networkidle' })
const cl = P.locator('.pager > section:nth-child(2)')
await cl.locator('.segment button', { hasText: 'Mes choix' }).click({ timeout: 20000 })
await cl.locator('.groupe .entete').filter({ has: P.locator('strong', { hasText: /^Neutre$/ }) }).click()
await P.waitForTimeout(500)
const rangH = cl.locator('.groupe .rangee').filter({ has: P.locator('.nom', { hasText: /^\s*Henriette\s*$/ }) })
if (!await rangH.count()) await cl.locator('.groupe').filter({ has: P.locator('.entete strong', { hasText: /^Neutre$/ }) }).locator('button:has-text("Voir")').first().click().catch(() => {})
await rangH.locator('.petit.v0').click({ timeout: 8000 }).catch(() => {})
await P.waitForTimeout(1500)
dit(sans(await ajouts(P), 'Henriette') && await monVote(P, 'Henriette') === 0,
  'Paul la passe à non dans « Mes choix » : la proposition part, son non reste')

await P.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await pile(P)
await epingler(P, 'Paulette')
await voter(P, 'oui', 'Paulette')
await P.waitForTimeout(1500)
const avantP = (await ajouts(P)).some(a => a.prenom === 'Paulette')
const postsAvant = demandesP.filter(d => d.methode === 'POST').length
await epingler(P, 'Paulette')
await voter(P, 'neutre', 'Paulette')
await P.waitForTimeout(1500)
dit(avantP && demandesP.filter(d => d.methode === 'POST').length === postsAvant
    && (await ajouts(P)).filter(a => a.prenom === 'Paulette').length === 1,
  'Paulette proposée, puis rejugée neutre : rien de reproposé — elle l’était déjà')
await epingler(P, 'Paulette')
await voter(P, 'non', 'Paulette')
await P.waitForTimeout(1500)
dit(sans(await ajouts(P), 'Paulette') && await monVote(P, 'Paulette') === 0,
  'rejugée non sur la carte : la proposition part, le non reste')

await epingler(P, 'Germaine')
await voter(P, 'oui', 'Germaine')
await P.waitForTimeout(1500)
await api(A, '/api/groupes/1/vote', 'POST', { prenom: 'Germaine', valeur: 1 })
await epingler(P, 'Germaine')
await voter(P, 'non', 'Germaine')
await P.waitForTimeout(1500)
dit((await ajouts(P)).some(a => a.prenom === 'Germaine') && await monVote(P, 'Germaine') === 0,
  'Germaine, qu’Alice a jugée entre-temps : la proposition reste à la liste (le non de Paul aussi)')
dit((await api(P, '/api/groupes/1/ajouts?prenom=Germaine', 'DELETE')).status === 409
    && (await api(A, '/api/groupes/1/ajouts?prenom=Germaine', 'DELETE')).status === 403,
  'le serveur le tient : 409 pour Paul, 403 pour Alice (ce n’est pas la sienne)')
retraitsAlice = 0   // la demande de l'essai, ci-dessus : seules comptent celles de l'app

// =================== 6. PAR L'ADRESSE ========================================
await P.goto(`${BASE}/g/1/swipe?prenom=lucienne`, { waitUntil: 'networkidle' })
dit(await attendreCarte(P, 'Lucienne') === 'Lucienne', 'Lucienne, demandée par l’adresse : première carte')
await voter(P, 'oui', 'Lucienne')
await P.waitForTimeout(1500)
dit((await ajouts(P)).some(a => a.prenom === 'Lucienne'), 'aimée, elle est proposée comme si on l’avait cherchée')

// =================== 7. CHEZ ALICE, DANS L'ORDRE =============================
await A.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
dit(await attendreCarte(A, 'Ambre') === 'Ambre' && await derriere(A) === 'Roze',
  `chez Alice, les propositions arrivent dans l’ordre : Ambre, puis Roze (derrière : ${await derriere(A)})`)
await voter(A, 'non', 'Ambre')
dit(await attendreCarte(A, 'Roze') === 'Roze' && !['Rose'].includes(await derriere(A)),
  `Roze, et pas Rose juste derrière : un son, une carte (derrière : ${await derriere(A)})`)
await voter(A, 'oui', 'Roze')
await A.waitForTimeout(1200)
dit(await monVote(A, 'Rose') === 2, 'son oui à Roze vaut pour Rose, comme sur toute carte')
dit(await attendreCarte(A, 'Lucienne') === 'Lucienne', 'puis Lucienne')
await voter(A, 'non', 'Lucienne')
await A.waitForTimeout(1200)
dit(retraitsAlice === 0, `Alice n’a rien tenté de retirer : ce ne sont pas ses propositions (${retraitsAlice} demande)`)

// =================== 8. SEUL DANS SA LISTE, POUR CEUX QUI VIENDRONT =========
// Une liste neuve, des filles seulement : Gabryel (Gabriel, autrement écrit)
// en est sorti tout entier. Paul l'aime avant d'avoir invité qui que ce soit.
const l8 = (await api(P, '/api/groupes', 'POST', { nom: 'Pour plus tard' })).json
const f8 = (await api(P, `/api/groupes/${l8.id}`)).json?.groupe?.filtres ?? {}
await api(P, `/api/groupes/${l8.id}/filtres`, 'PUT', { ...(typeof f8 === 'object' ? f8 : {}), sexe: ['f'] })
await P.goto(`${BASE}/g/${l8.id}/swipe`, { waitUntil: 'networkidle' })
await pile(P)
await epingler(P, 'Gabryel')
await voter(P, 'oui', 'Gabryel')
await P.waitForTimeout(1500)
dit((await ajouts(P, l8.id)).some(a => a.prenom === 'Gabryel'),
  'seul dans sa liste, Paul aime Gabryel : proposé quand même, pour ceux qui viendront')
await api(P, `/api/groupes/${l8.id}/filtres`, 'PUT', typeof f8 === 'object' ? f8 : {})
const code8 = (await api(P, `/api/groupes/${l8.id}`)).json?.groupe?.code_invitation
await api(A, '/api/groupes/rejoindre', 'POST', { code: code8 })
await A.goto(`${BASE}/g/${l8.id}/swipe`, { waitUntil: 'networkidle' })
dit(await attendreCarte(A, 'Gabryel') === 'Gabryel' && !(await etiquettes(A)).some(e => /propos|Paul/i.test(e)),
  'Alice rejoint la liste (les garçons y sont revenus) : Gabryel en premier, sans étiquette')
const derriere8 = await derriere(A)
dit(derriere8 && !['Gabriel', 'Gabriël', 'Gabriele', 'Gabryël'].includes(derriere8),
  `et pas Gabriel juste derrière, alors qu’il est le plus donné : un son, une carte (derrière : ${derriere8})`)
await voter(A, 'oui', 'Gabryel')
await A.waitForTimeout(1500)
dit(await monVote(A, 'Gabriel', l8.id) === 2, 'son oui à Gabryel vaut pour Gabriel et ses graphies')
if (await A.locator('.fete').count()) { await A.keyboard.press('Escape'); await A.waitForTimeout(700) }
const apres8 = [await texte(devant(A).locator('.nom').first()), await derriere(A)]
dit(!apres8.some(n => /^Gabr/.test(n)), `Gabriel ne revient pas ensuite (${apres8.join(', ')})`)

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})${erreurs.length ? ` — ${erreurs.slice(0, 3).join(' ; ')}` : ''}`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
