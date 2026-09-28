/**
 * Les droits RGPD, exerces comme un utilisateur les exercerait.
 *
 * Ce qu'on prouve, et pourquoi chaque point compte :
 *  - l'export contient TOUT ce qui concerne la personne, et RIEN des autres
 *    (un export qui livre les votes du conjoint est une fuite) ;
 *  - l'effacement est immediat, depuis l'app, et ne detruit pas les donnees
 *    des AUTRES : la liste partagee survit, l'autre parent garde ses votes,
 *    un deblocage paye reste acquis ;
 *  - une session restee ouverte sur un autre appareil ne survit pas au
 *    compte, et ne se transforme pas en erreur 500 ;
 *  - la purge nocturne efface l'inactif et lui seul, ne tourne qu'avec son
 *    secret, et peut se rejouer sans rien casser.
 *
 * Le serveur est lance avec essai-rgpd.env (CRON_SECRET) ; la base de dev
 * seme un compte « Fantome », inactif depuis 25 mois.
 */
import { readFileSync } from 'node:fs'
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const SECRET = process.env.CRON_SECRET
if (!SECRET) { console.error('Lancer via relance.sh : essai-rgpd.env n’a pas été chargé.'); process.exit(2) }

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []

async function appareil(qui) {
  const { ctx, page } = await onglet(nav)
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  if (qui) {
    await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
    await entrerComme(page, qui)
    await page.waitForSelector('.bento', { timeout: 20000 })
  }
  const api = (chemin, init) => page.evaluate(async ([c, i]) => {
    const r = await fetch(c, i ? { ...i, headers: { 'content-type': 'application/json' } } : undefined)
    return { status: r.status, j: await r.json().catch(() => null) }
  }, [chemin, init])
  return { ctx, page, api }
}
/** Le compte existe-t-il ? La porte du jeu d'essai (/api/dev/entrer) répond
 *  200, ou 404 quand plus personne ne porte ce prénom. Elle ne note aucune
 *  activité : demander ne rajeunit pas un compte inactif. */
const existe = pseudo => fetch(`${BASE}/api/dev/entrer`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pseudo })
}).then(r => r.status)
const purger = (entete) => fetch(`${BASE}/api/admin/purger`, { headers: entete ? { authorization: entete } : {} })
  .then(async r => ({ status: r.status, j: await r.json().catch(() => null) }))

// ================================================ 0. Le schema est en place
const sante = await fetch(`${BASE}/api/sante`).then(r => r.json())
dit(sante?.base?.migrations?.['rgpd.effacement_sans_cascade'] === true,
    'le schéma RGPD est appliqué (effacer un créateur n’efface plus sa liste)')
dit(sante?.presence?.purge_quotidienne === true, '/api/sante voit la purge quotidienne configurée')
dit(Array.isArray(sante?.legal?.manquants) && !JSON.stringify(sante.legal).match(/\d{14}/),
    `/api/sante liste les mentions légales manquantes, sans en révéler aucune (${sante?.legal?.manquants?.join(', ') || 'aucune'})`)

// ================================================ 1. La purge
dit((await purger()).status === 401, 'purge sans secret : refusée')
dit((await purger('Bearer pas-le-bon')).status === 401, 'purge avec un mauvais secret : refusée')
dit((await existe('Fantome')) === 200, 'avant la purge, le compte inactif est là')
const p1 = await purger(`Bearer ${SECRET}`)
dit(p1.status === 200 && p1.j?.comptes_inactifs === 1,
    `la purge efface le compte inactif depuis 25 mois, et lui seul (${p1.j?.comptes_inactifs})`)
dit(p1.j?.listes_sans_membre >= 1, 'et la liste où il était seul')
dit(p1.j?.compteurs_anciens >= 1, 'et les compteurs de quota de plus de deux mois')
dit(p1.j?.jetons_morts >= 1, 'et les restes du lien magique (e-mails compris)')
dit(JSON.stringify(p1.j).match(/[0-9a-f]{8}-[0-9a-f]{4}/) === null, 'son bilan ne contient que des nombres, aucun identifiant')
dit((await existe('Fantome')) === 404, 'après la purge, le compte effacé n’existe plus')
const p2 = await purger(`Bearer ${SECRET}`)
dit(p2.status === 200 && Object.entries(p2.j).every(([k, v]) => k === 'ok' || v === 0),
    'rejouée, la purge ne trouve plus rien : elle est idempotente')
dit((await existe('Paul')) === 200, 'les comptes actifs sont intacts')

// ================================================ 2. Export (Alice)
const A1 = await appareil('Alice')          // son telephone
const A2 = await appareil('Alice')          // sa tablette, restee connectee
const seule = (await A1.api('/api/groupes', { method: 'POST', body: JSON.stringify({ nom: 'Rien qu’à moi' }) })).j
await A1.page.evaluate(() => localStorage.setItem('trace-de-session', 'x'))
await A1.page.reload({ waitUntil: 'networkidle' })
await A1.page.waitForSelector('.bento', { timeout: 20000 })

await A1.page.getByRole('button', { name: /Mon compte/ }).click()
await A1.page.waitForSelector('[role="dialog"]')
const [dl] = await Promise.all([
  A1.page.waitForEvent('download'),
  A1.page.getByRole('link', { name: 'Télécharger mes données' }).click()
])
dit(/^babynamed-mes-donnees-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()),
    `le bouton télécharge un fichier nommé (${dl.suggestedFilename()})`)
const exp = JSON.parse(readFileSync(await dl.path(), 'utf8'))
dit(exp.compte?.pseudo === 'Alice' && exp.format === 'babynamed-export/1', 'le fichier est celui d’Alice, format versionné')
dit(exp.listes?.some(l => l.nom === 'Notre liste') && exp.listes?.some(l => l.nom === 'Rien qu’à moi'),
    'il contient ses deux listes')
dit(exp.votes?.some(v => v.prenom === 'Louise' && v.valeur === 'oui'),
    'ses votes, en clair (« oui », pas 2)')
dit(exp.commentaires?.some(c => /partout/.test(c.texte)) && exp.vetos?.some(v => v.prenom === 'Jayden'),
    'ses commentaires et ses vetos, motif compris')
dit(!exp.votes?.some(v => v.prenom === 'Lucien'),
    'aucun vote des autres membres (Lucien n’a été jugé que par Paul)')
const brut = JSON.stringify(exp)
dit(!/"[0-9a-f]{64}"/.test(brut), 'aucune empreinte (64 caractères hexadécimaux) : rien qui serve à entrer')
dit(!/Paul|Mamie/.test(brut), 'ni le nom des autres membres')

// ================================================ 3. Effacement (Alice)
const refus = await A1.api('/api/moi/supprimer', { method: 'POST', body: JSON.stringify({}) })
dit(refus.status === 400, 'sans le mot de confirmation, le serveur refuse (au cas où l’écran serait contourné)')
await A1.page.getByRole('button', { name: 'Supprimer mon compte' }).click()
const champ = A1.page.getByRole('textbox', { name: /tapez SUPPRIMER/i })
await champ.fill('supprimer')
const [rep] = await Promise.all([
  A1.page.waitForResponse(r => r.url().includes('/api/moi/supprimer')),
  A1.page.getByRole('button', { name: 'Supprimer définitivement' }).click()
])
const bilan = await rep.json()
dit(rep.status() === 200 && bilan.listes_effacees === 1 && bilan.listes_laissees_aux_autres === 1,
    `effacement : sa liste perso part, la liste partagée reste aux autres (${JSON.stringify(bilan)})`)
await A1.page.waitForURL(/\/connexion/, { timeout: 10000 })
const statut = (await A1.page.getByRole('status').filter({ hasText: 'supprimés' }).first()
  .innerText().catch(() => '')).trim()
dit(/supprimés/.test(statut), `l’écran le confirme : « ${statut} »`)
dit(await A1.page.evaluate(() => localStorage.length) === 0, 'le stockage local du navigateur est vidé')
const cookies1 = await A1.ctx.cookies()
dit(!cookies1.some(c => c.name === 'pr_session' && c.value), 'le cookie de session est retiré')
dit((await existe('Alice')) === 404, 'son compte n’existe plus')

// L'autre appareil : sa session survit dans le navigateur, pas dans la base.
await A2.page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await A2.page.waitForURL(/\/connexion/, { timeout: 15000 }).catch(() => null)
dit(A2.page.url().includes('/connexion'), 'la tablette restée connectée retombe proprement sur la connexion')
const orpheline = await A2.api('/api/groupes')
dit(orpheline.status === 401, `sa session orpheline reçoit 401, pas une erreur 500 (HTTP ${orpheline.status})`)

// ================================================ 4. Les autres n'ont rien perdu
const G = await appareil('Paul')
const listesG = (await G.api('/api/groupes')).j
const notre = listesG?.find(l => l.nom === 'Notre liste')
dit(!!notre && notre.nb_membres === 2, `Paul garde « Notre liste », Mamie avec lui (${notre?.nb_membres} membres)`)
const etatNotre = (await G.api(`/api/groupes/${notre?.id}`)).j
dit(etatNotre?.groupe?.paye === true, 'et elle reste débloquée')
const votesG = (await G.api(`/api/groupes/${notre?.id}/votes`)).j?.votes ?? []
dit(votesG.some(v => v.prenom === 'Louise' && v.pseudo === 'Paul') && !votesG.some(v => v.pseudo === 'Alice'),
    'ses votes sont intacts, ceux d’Alice ont disparu')
dit((await G.api(`/api/groupes/${seule?.id}`)).status === 403, 'la liste perso d’Alice n’existe plus pour personne')

// ================================================ 5. L'acheteur s'efface, la liste reste payee
// Paul a paye « Notre liste ». Avant le schema RGPD, l'effacer echouait (cle
// etrangere sans regle) ; ou, s'il l'avait creee, effacait la liste de Mamie.
const efface = await G.api('/api/moi/supprimer', { method: 'POST', body: JSON.stringify({ confirmation: 'SUPPRIMER' }) })
dit(efface.status === 200, `effacer celui qui a créé ET payé la liste fonctionne (HTTP ${efface.status})`)
const M = await appareil('Mamie')
const listesM = (await M.api('/api/groupes')).j
const pourMamie = listesM?.find(l => l.nom === 'Notre liste')
dit(!!pourMamie, 'Mamie garde la liste')
dit((await M.api(`/api/groupes/${pourMamie?.id}`)).j?.groupe?.paye === true,
    'toujours débloquée : un achat fait pour tous ne se reprend pas quand l’acheteur s’en va')

dit(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
