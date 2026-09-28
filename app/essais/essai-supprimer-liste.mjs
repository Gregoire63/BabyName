/**
 * Quitter une liste, ou la supprimer pour tous — son propriétaire seulement.
 *
 * Ce qu'on prouve, et pourquoi chaque point compte :
 *  - le propriétaire est le créateur, l'écran le nomme ; lui seul voit
 *    « Supprimer » et la route refuse les autres (y compris un parent) ;
 *  - tout le monde peut quitter, observatrice comprise ; ce qu'on a donné
 *    part, la liste reste aux autres, et ses « déjà pris » y restent sans nom
 *    ni note ; l'export de celle qui part n'en garde rien ;
 *  - seul à décider, le propriétaire ne peut plus que supprimer ;
 *  - le propriétaire qui part passe la liste au plus ancien qui décide — un
 *    membre entré par le lien, qui peut alors la renommer et la supprimer ;
 *  - rien ne part sans confirmation (le mot SUPPRIMER, ou QUITTER côté route) ;
 *  - l'écran dit, avant, qui perd quoi ; « Annuler » ne touche à rien ;
 *  - l'appareil oublie la liste ; l'ancienne adresse ramène à l'accueil.
 */
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []

async function appareil(qui) {
  const { ctx, page } = await onglet(nav)
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, qui)
  await page.waitForSelector('.bento', { timeout: 20000 })
  const api = (chemin, init) => page.evaluate(async ([c, i]) => {
    const r = await fetch(c, i ? { ...i, headers: { 'content-type': 'application/json' } } : undefined)
    return { status: r.status, j: await r.json().catch(() => null) }
  }, [chemin, init])
  return { ctx, page, api }
}
const poster = (X, chemin, corps) => X.api(chemin, { method: 'POST', body: JSON.stringify(corps ?? {}) })
const supprimer = (X, id, confirmation) => poster(X, `/api/groupes/${id}/supprimer`, confirmation === undefined ? {} : { confirmation })
const quitter = (X, id, confirmation) => poster(X, `/api/groupes/${id}/quitter`, confirmation === undefined ? {} : { confirmation })
const idDe = async (X, nom) => (await X.api('/api/groupes')).j?.find(l => l.nom === nom)?.id
const reglages = async (X, id) => {
  await X.page.goto(`${BASE}/g/${id}/reglages`, { waitUntil: 'networkidle' })
  await X.page.locator('#titre-compte').waitFor({ timeout: 20000 })
}
const bouton = (X, nom) => X.page.getByRole('button', { name: nom, exact: true })
const aLAccueil = async X => {
  await X.page.waitForURL(u => new URL(u).pathname === '/', { timeout: 15000 }).catch(() => null)
  return new URL(X.page.url()).pathname === '/'
}

const P = await appareil('Paul')
const A = await appareil('Alice')
const M = await appareil('Mamie')
const [paul, alice] = [(await P.api('/api/auth/moi')).j?.utilisateur?.id, (await A.api('/api/auth/moi')).j?.utilisateur?.id]
const notre = await idDe(P, 'Notre liste')
const essai = await idDe(P, 'Essai gratuit')
const autre = await idDe(P, 'Autre essai')
dit(!!(notre && essai && autre && paul && alice), `le jeu d’essai a ses listes (${notre}, ${essai}, ${autre})`)

// ================================================ 1. Le propriétaire
dit((await P.api(`/api/groupes/${notre}`)).j?.proprietaire === paul, 'le propriétaire est celui qui a créé la liste')
await reglages(P, notre)
dit(await P.page.locator('.puce', { hasText: 'propriétaire' }).count() === 1
    && /Paul/.test(await P.page.locator('.ligne', { has: P.page.locator('.puce', { hasText: 'propriétaire' }) }).innerText()),
  '« Qui en est » le nomme')
dit(await bouton(P, 'Supprimer cette liste').count() === 1 && await bouton(P, 'Quitter cette liste').count() === 1,
  'il peut supprimer, et quitter puisqu’Alice décide aussi')
await bouton(P, 'Supprimer cette liste').click()
const avert = await P.page.locator('#titre-suppression-liste').innerText()
dit(/(Alice et Mamie|Mamie et Alice) compris/.test(avert) && /déblocage part avec elle/.test(avert),
  'avant de supprimer, l’écran nomme les autres membres et dit que le déblocage part')
await bouton(P, 'Annuler').click()
dit((await A.api(`/api/groupes/${notre}`)).status === 200, '« Annuler » ne touche à rien')

// ================================================ 2. Les autres quittent, ne suppriment pas
await reglages(A, notre)
dit(await bouton(A, 'Supprimer cette liste').count() === 0 && await bouton(A, 'Quitter cette liste').count() === 1,
  'Alice, qui décide sans être propriétaire, peut quitter, pas supprimer')
const rA = await supprimer(A, notre, 'SUPPRIMER')
dit(rA.status === 403, `et la route le lui refuse (HTTP ${rA.status})`)
await reglages(M, notre)
dit(await bouton(M, 'Supprimer cette liste').count() === 0 && await bouton(M, 'Quitter cette liste').count() === 1,
  'l’observatrice peut quitter, pas supprimer')
dit(await M.page.getByRole('textbox', { name: 'Nom de la liste' }).count() === 0, 'ni renommer')
dit((await supprimer(M, notre, 'SUPPRIMER')).status === 403, 'et la route la refuse aussi')

// ================================================ 3. Rien sans confirmation
dit((await quitter(M, notre)).status === 400, 'quitter sans confirmation : refusé')
dit((await supprimer(P, autre)).status === 400 && (await supprimer(P, autre, 'oui')).status === 400,
  'supprimer sans le mot, ou avec « oui » : refusé')
dit((await P.api(`/api/groupes/${autre}`)).status === 200, 'la liste est toujours là')

// ================================================ 4. Alice quitte « Notre liste »
const avant = (await A.api('/api/moi/donnees')).j
dit((avant?.votes?.length ?? 0) > 0, `Alice a des votes sur « Notre liste » (${avant?.votes?.length})`)
await bouton(A, 'Quitter cette liste').click()
const texteQ = await A.page.locator('#titre-quitter-liste').innerText()
dit(/effacé/.test(texteQ) && /déjà pris/.test(texteQ), 'l’écran dit ce qui part, et que ses « déjà pris » restent')
await bouton(A, 'Quitter la liste').click()
dit(await aLAccueil(A), 'retour à l’accueil')
dit(!(await idDe(A, 'Notre liste')) && (await A.api(`/api/groupes/${notre}`)).status === 403,
  'elle n’a plus la liste')
const vuP = (await P.api(`/api/groupes/${notre}`)).j
dit(vuP && !vuP.avancement?.some(m => m.pseudo === 'Alice'), 'Paul la garde, sans les votes d’Alice')
const mathilde = vuP?.deja_pris?.find(d => d.prenom === 'Mathilde')
dit(!!mathilde && mathilde.auteur === null && mathilde.motif === null,
  'le « déjà pris » d’Alice reste, sans son nom ni sa note')
const apres = (await A.api('/api/moi/donnees')).j
dit(apres?.listes?.length === 0 && apres?.votes?.length === 0 && !JSON.stringify(apres).includes('Notre liste'),
  'l’export d’Alice ne garde rien de la liste')
await A.page.goto(`${BASE}/g/${notre}/swipe`)
dit(await aLAccueil(A), 'l’ancienne adresse la ramène à l’accueil')

// ================================================ 5. Mamie quitte aussi
dit((await quitter(M, notre, 'QUITTER')).j?.liste_supprimee === false, 'Mamie quitte, la liste reste à Paul')

// ================================================ 6. Seul à décider, le propriétaire ne peut que supprimer
await reglages(P, notre)
dit(await bouton(P, 'Quitter cette liste').count() === 0 && await bouton(P, 'Supprimer cette liste').count() === 1,
  'seul à décider, Paul ne peut plus que supprimer (partir reviendrait au même)')

// ================================================ 7. Le propriétaire part : la liste passe
const rj = await poster(A, '/api/groupes/rejoindre', { code: 'dec0de01' })
dit(rj.status === 200 && rj.j?.role === 'invite', `Alice rejoint « Essai gratuit » par le lien (${rj.j?.role})`)
await reglages(P, essai)
await bouton(P, 'Quitter cette liste').click()
dit(/Alice en devient propriétaire/.test(await P.page.locator('#titre-quitter-liste').innerText()),
  'l’écran dit à Paul qu’Alice reprend la liste')
await bouton(P, 'Quitter la liste').click()
dit(await aLAccueil(P), 'Paul part')
dit((await A.api(`/api/groupes/${essai}`)).j?.proprietaire === alice, 'Alice en est propriétaire')
dit((await A.api(`/api/groupes/${essai}/nom`, { method: 'PUT', body: JSON.stringify({ nom: 'À nous deux' }) })).status === 200,
  'entrée par le lien, elle peut la renommer')
await reglages(A, essai)
dit(await bouton(A, 'Supprimer cette liste').count() === 1, 'et la supprimer')
dit((await supprimer(A, essai, 'SUPPRIMER')).status === 200 && !(await idDe(A, 'À nous deux')), 'ce qu’elle fait')

// ================================================ 8. Paul supprime « Autre essai » par l'écran
await reglages(P, autre)
await P.page.evaluate(([a, n]) => {
  localStorage.setItem(`communs-vus:${a}`, '4'); localStorage.setItem(`pr_${a}_2026-01-01`, '7')
  localStorage.setItem(`pr_epingle_${a}`, 'Léo'); localStorage.setItem(`communs-vus:${n}`, '9')
}, [autre, notre])
await bouton(P, 'Supprimer cette liste').click()
const definitif = bouton(P, 'Supprimer définitivement')
dit(await definitif.isDisabled(), 'le bouton final reste grisé tant que le mot n’est pas tapé')
dit(!/compris/.test(await P.page.locator('#titre-suppression-liste').innerText()), 'seul membre : personne d’autre n’est nommé')
await P.page.locator('#liste-confirmation').fill('supprimer')
dit(await definitif.isEnabled(), 'le mot tapé (en minuscules, ça compte), il s’active')
await definitif.click()
dit(await aLAccueil(P), 'retour à l’accueil')
dit(!(await idDe(P, 'Autre essai')) && (await P.api(`/api/groupes/${autre}`)).status === 403, 'la liste n’existe plus')
const stock = await P.page.evaluate(([a, n]) => ({
  courante: localStorage.getItem('bn_liste_courante'),
  siens: Object.keys(localStorage).filter(k =>
    k === `communs-vus:${a}` || k === `pr_epingle_${a}` || k.startsWith(`pr_${a}_`)),
  autre: localStorage.getItem(`communs-vus:${n}`)
}), [autre, notre])
dit(stock.courante !== String(autre) && stock.siens.length === 0 && stock.autre === '9',
  'l’appareil l’a oubliée, et garde ce qui concerne les autres listes')

// ================================================ 9. Et « Notre liste », payée
dit((await supprimer(P, notre, 'SUPPRIMER')).status === 200 && !(await idDe(P, 'Notre liste')),
  'Paul supprime « Notre liste »')

dit(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
