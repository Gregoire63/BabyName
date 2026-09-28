/**
 * Supprimer une liste : depuis ses réglages, pour tous, avec un mot à taper.
 *
 * Ce qu'on prouve, et pourquoi chaque point compte :
 *  - un observateur ne peut pas (ni bouton, ni route) : il regarde, il ne
 *    fait pas disparaître le travail des autres ;
 *  - sans le mot, rien ne part (bouton grisé, route qui refuse) ;
 *  - l'écran nomme les autres membres et dit que le déblocage part aussi,
 *    AVANT, et « Annuler » ne touche à rien ;
 *  - après, la liste n'existe plus pour PERSONNE — ni pour qui l'a
 *    supprimée, ni pour l'autre parent, ni pour l'observatrice — et l'export
 *    de l'autre parent ne contient plus rien d'elle ;
 *  - l'appareil oublie la liste (liste en cours, accords vus, compteurs), et
 *    garde ce qui concerne les autres ;
 *  - l'ancienne adresse ramène à l'accueil, sans erreur.
 */
import { lancer, onglet, compteur, BASE } from './navigateur.mjs'

const CLE = { paul: 'DEVP-ARNA-2345', alice: 'DEVP-ARNB-2345', mamie: 'DEVM-AMIE-2345' }
const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []

async function appareil(cle) {
  const { ctx, page } = await onglet(nav)
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
  await page.getByRole('textbox', { name: /clé d’accès/i }).fill(cle)
  await page.getByRole('button', { name: 'Entrer' }).click()
  await page.waitForSelector('.bento', { timeout: 20000 })
  const api = (chemin, init) => page.evaluate(async ([c, i]) => {
    const r = await fetch(c, i ? { ...i, headers: { 'content-type': 'application/json' } } : undefined)
    return { status: r.status, j: await r.json().catch(() => null) }
  }, [chemin, init])
  return { ctx, page, api }
}
const supprimer = (X, id, confirmation) => X.api(`/api/groupes/${id}/supprimer`,
  { method: 'POST', body: JSON.stringify(confirmation === undefined ? {} : { confirmation }) })
const idDe = async (X, nom) => (await X.api('/api/groupes')).j?.find(l => l.nom === nom)?.id
const reglages = async (X, id) => {
  await X.page.goto(`${BASE}/g/${id}/reglages`, { waitUntil: 'networkidle' })
  await X.page.locator('#titre-compte').waitFor({ timeout: 20000 })
}
const bouton = (X, nom) => X.page.getByRole('button', { name: nom, exact: true })

const P = await appareil(CLE.paul)
const A = await appareil(CLE.alice)
const M = await appareil(CLE.mamie)
const notre = await idDe(P, 'Notre liste')
const autre = await idDe(P, 'Autre essai')
dit(!!notre && !!autre, `le jeu d’essai a ses listes (Notre liste : ${notre}, Autre essai : ${autre})`)

// ================================================ 1. L'observatrice
await reglages(M, notre)
dit(await bouton(M, 'Supprimer cette liste').count() === 0, 'l’observatrice ne voit pas « Supprimer cette liste »')
const rM = await supprimer(M, notre, 'SUPPRIMER')
dit(rM.status === 403, `et la route la refuse (HTTP ${rM.status})`)

// ================================================ 2. Sans le mot
dit((await supprimer(P, autre)).status === 400, 'sans confirmation : refusé')
dit((await supprimer(P, autre, 'oui')).status === 400, 'avec « oui » : refusé')
dit((await P.api(`/api/groupes/${autre}`)).status === 200, 'la liste est toujours là')

// ================================================ 3. Par l'écran, seul membre
await reglages(P, autre)
// Ce que l'appareil garde d'elle, et d'une autre liste qui doit rester.
await P.page.evaluate(([a, n]) => {
  localStorage.setItem(`communs-vus:${a}`, '4'); localStorage.setItem(`pr_${a}_2026-01-01`, '7')
  localStorage.setItem(`pr_epingle_${a}`, 'Léo'); localStorage.setItem(`communs-vus:${n}`, '9')
}, [autre, notre])
await bouton(P, 'Supprimer cette liste').click()
const definitif = bouton(P, 'Supprimer définitivement')
dit(await definitif.isDisabled(), 'le bouton final reste grisé tant que le mot n’est pas tapé')
const texteSeul = await P.page.locator('#titre-suppression-liste').innerText()
dit(!/compris/.test(texteSeul), 'seul membre : personne d’autre n’est nommé')
dit(!/déblocage/.test(texteSeul), 'liste gratuite : pas de mot sur un déblocage')
await P.page.locator('#liste-confirmation').fill('supprimer')
dit(await definitif.isEnabled(), 'le mot tapé (en minuscules, ça compte), il s’active')
await definitif.click()
await P.page.waitForURL(u => new URL(u).pathname === '/', { timeout: 15000 }).catch(() => null)
dit(new URL(P.page.url()).pathname === '/', 'retour à l’accueil')
dit(!(await idDe(P, 'Autre essai')), 'la liste a disparu des listes de Paul')
dit((await P.api(`/api/groupes/${autre}`)).status === 403, 'et son adresse ne mène plus à rien')
const stock = await P.page.evaluate(([a, n]) => ({
  courante: localStorage.getItem('bn_liste_courante'),
  siens: Object.keys(localStorage).filter(k =>
    k === `communs-vus:${a}` || k === `pr_epingle_${a}` || k.startsWith(`pr_${a}_`)),
  autre: localStorage.getItem(`communs-vus:${n}`)
}), [autre, notre])
dit(stock.courante !== String(autre) && stock.siens.length === 0,
    `l’appareil l’a oubliée (${stock.siens.join(', ') || 'plus rien'})`)
dit(stock.autre === '9', 'et garde ce qui concerne les autres listes')

// ================================================ 4. La liste partagée, débloquée
const avant = (await A.api('/api/moi/donnees')).j
dit((avant?.votes?.length ?? 0) > 0, `Alice a des votes sur « Notre liste » (${avant?.votes?.length})`)
await reglages(P, notre)
await bouton(P, 'Supprimer cette liste').click()
const avert = await P.page.locator('#titre-suppression-liste').innerText()
dit(/Alice et Mamie compris/.test(avert), 'l’écran nomme les autres membres, observatrice comprise')
dit(/déblocage part avec elle/.test(avert), 'et dit que le déblocage part avec elle')
await bouton(P, 'Annuler').click()
dit(await bouton(P, 'Supprimer cette liste').isVisible(), '« Annuler » referme')
dit((await A.api(`/api/groupes/${notre}`)).status === 200, 'sans rien toucher')

const rP = await supprimer(P, notre, 'SUPPRIMER')
dit(rP.status === 200, `Paul la supprime (HTTP ${rP.status})`)
dit((await A.api(`/api/groupes/${notre}`)).status === 403 && !(await idDe(A, 'Notre liste')),
    'Alice ne l’a plus')
dit((await M.api(`/api/groupes/${notre}`)).status === 403 && !(await idDe(M, 'Notre liste')),
    'Mamie non plus')
const apres = (await A.api('/api/moi/donnees')).j
dit(apres?.listes?.length === 0 && apres?.votes?.length === 0 && !JSON.stringify(apres).includes('Notre liste'),
    'l’export d’Alice ne contient plus rien d’elle')

await A.page.goto(`${BASE}/g/${notre}/swipe`)
await A.page.waitForURL(u => new URL(u).pathname === '/', { timeout: 15000 }).catch(() => null)
dit(new URL(A.page.url()).pathname === '/', 'Alice, sur l’ancienne adresse, revient à l’accueil')

dit(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
