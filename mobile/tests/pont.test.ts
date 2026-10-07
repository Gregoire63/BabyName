/**
 * Les messages du pont (src/pont.ts) — sans téléphone :
 *
 *     npm run essais
 */
import assert from 'node:assert/strict'
import { agentPour, FOND_CLAIR, FOND_SOMBRE, lireMessage, nomDeFichier, scriptPour } from '../src/pont'

const lire = (m: unknown) => lireMessage(JSON.stringify(m))

test('« prête » et « thème » : des couleurs sûres, quoi que dise la page', () => {
  assert.deepEqual(lire({ v: 1, type: 'pret', sombre: false, fond: '#FBFAF9' }),
    { type: 'pret', sombre: false, fond: '#fbfaf9', bords: 'natif' })
  assert.deepEqual(lire({ type: 'theme', sombre: true, fond: '#101321', bords: 'page' }),
    { type: 'theme', sombre: true, fond: '#101321', bords: 'page' })
  // Une couleur qui n'en est pas une : celle du site, selon le thème annoncé.
  assert.equal((lire({ type: 'pret', sombre: true, fond: 'red; background:url(x)' }) as any).fond, FOND_SOMBRE)
  assert.equal((lire({ type: 'pret', fond: 12 }) as any).fond, FOND_CLAIR)
  assert.equal((lire({ type: 'pret', sombre: 'oui' }) as any).sombre, false)
  assert.equal((lire({ type: 'pret', bords: 'nimporte' }) as any).bords, 'natif')
})

test('une question porte un identifiant, que la réponse reprendra', () => {
  assert.deepEqual(lire({ type: 'push.etat', id: 'q1' }), { type: 'push.etat', id: 'q1' })
  assert.deepEqual(lire({ type: 'push.demander', id: 'q42' }), { type: 'push.demander', id: 'q42' })
  assert.equal(lire({ type: 'push.etat' }), null)
  assert.equal(lire({ type: 'push.etat', id: 'a b' }), null)
  assert.equal(lire({ type: 'push.etat', id: 'x'.repeat(41) }), null)
})

test('partager : un lien http(s), des textes bornés', () => {
  assert.deepEqual(lire({ type: 'partager', id: 'q2', titre: 'babyNamed', texte: 'Aide-moi', url: 'https://babynamed.fr/rejoindre/K7QMX3XPD9' }),
    { type: 'partager', id: 'q2', titre: 'babyNamed', texte: 'Aide-moi', url: 'https://babynamed.fr/rejoindre/K7QMX3XPD9' })
  assert.equal(lire({ type: 'partager', id: 'q2', url: 'javascript:alert(1)' }), null)
  assert.equal(lire({ type: 'partager', id: 'q2' }), null)
  assert.equal((lire({ type: 'partager', id: 'q2', url: 'https://babynamed.fr/', texte: 'x'.repeat(5000) }) as any).texte.length, 2000)
  assert.equal((lire({ type: 'partager', id: 'q2', url: 'https://babynamed.fr/', titre: 7 }) as any).titre, '')
})

test('fichier : un nom sans chemin, un contenu qui existe', () => {
  const m = lire({ type: 'fichier', id: 'q3', nom: 'babynamed-mes-donnees-2026-10-06.json', mime: 'application/json', texte: '{}' }) as any
  assert.deepEqual(m, { type: 'fichier', id: 'q3', nom: 'babynamed-mes-donnees-2026-10-06.json', mime: 'application/json', texte: '{}' })
  assert.equal(lire({ type: 'fichier', id: 'q3', nom: 'x.json', texte: '' }), null)
  assert.equal(lire({ type: 'fichier', id: 'q3', nom: 'x.json' }), null)
  assert.equal((lire({ type: 'fichier', id: 'q3', nom: 'x.json', mime: 'n’importe quoi', texte: 'a' }) as any).mime, 'text/plain')
  assert.equal(nomDeFichier('../../etc/passwd'), 'babynamed.txt')
  assert.equal(nomDeFichier('..\\secret.json'), 'secret.json')
  assert.equal(nomDeFichier('/tmp/x/mes données.json'), 'tmp-x-mes-donn-es.json')
  assert.equal(nomDeFichier('.cache'), 'babynamed.txt')
  assert.equal(nomDeFichier(undefined), 'babynamed.txt')
})

test('les verbes sans réponse', () => {
  assert.deepEqual(lire({ type: 'vibrer', genre: 'succes' }), { type: 'vibrer', genre: 'succes' })
  assert.deepEqual(lire({ type: 'vibrer', genre: 'tremblement de terre' }), { type: 'vibrer', genre: 'leger' })
  assert.deepEqual(lire({ type: 'reglages' }), { type: 'reglages' })
  assert.deepEqual(lire({ type: 'quitter' }), { type: 'quitter' })
})

test('l’achat intégré : un produit, un jeton qui est un UUID, un numéro de transaction — ou rien', () => {
  const PRODUIT = 'fr.babynamed.app.deblocage'
  const JETON = '6f7da3b0-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
  assert.deepEqual(lire({ type: 'achat.produit', id: 'q1', produit: PRODUIT }), { type: 'achat.produit', id: 'q1', produit: PRODUIT })
  assert.equal(lire({ type: 'achat.produit', id: 'q1' }), null)
  assert.equal(lire({ type: 'achat.produit', id: 'q1', produit: 'un produit' }), null)
  assert.equal(lire({ type: 'achat.produit', produit: PRODUIT }), null)

  assert.deepEqual(lire({ type: 'achat.acheter', id: 'q2', produit: PRODUIT, jeton: JETON.toUpperCase() }),
    { type: 'achat.acheter', id: 'q2', produit: PRODUIT, jeton: JETON })
  // Apple n'accepte qu'un UUID, et ne rend rien d'autre : sans lui, le serveur ne saurait pas quoi débloquer.
  assert.equal(lire({ type: 'achat.acheter', id: 'q2', produit: PRODUIT, jeton: 'liste-12' }), null)
  assert.equal(lire({ type: 'achat.acheter', id: 'q2', produit: PRODUIT, jeton: `${JETON}0` }), null)
  assert.equal(lire({ type: 'achat.acheter', id: 'q2', produit: PRODUIT }), null)
  assert.equal(lire({ type: 'achat.acheter', id: 'q2', jeton: JETON }), null)

  assert.deepEqual(lire({ type: 'achat.attente', id: 'q3' }), { type: 'achat.attente', id: 'q3' })
  assert.equal(lire({ type: 'achat.attente' }), null)

  assert.deepEqual(lire({ type: 'achat.finir', id: 'q4', transaction: '2000000100000001' }),
    { type: 'achat.finir', id: 'q4', transaction: '2000000100000001' })
  assert.equal(lire({ type: 'achat.finir', id: 'q4', transaction: 2000000100000001 }), null)
  assert.equal(lire({ type: 'achat.finir', id: 'q4', transaction: '2000000100000001; tout' }), null)
  assert.equal(lire({ type: 'achat.finir', id: 'q4' }), null)
})

test('l’agent d’une vue web : la marque de l’app, puis l’apparence du téléphone si on la connaît', () => {
  const MARQUE = 'babyNamedApp/1.0.0 (android)'
  assert.equal(agentPour(MARQUE, true), 'babyNamedApp/1.0.0 (android) apparence/sombre')
  assert.equal(agentPour(MARQUE, false), 'babyNamedApp/1.0.0 (android) apparence/claire')
  // Inconnue : rien d'affirmé, la page s'en remet à sa vue web.
  assert.equal(agentPour(MARQUE, null), MARQUE)
  // Le site reconnaît toujours l'app à sa marque, apparence ou non (app/shared/utils/coquille.ts).
  const motifDuSite = /\bbabyNamedApp\/(\d+(?:\.\d+){0,3}) \((ios|android)\)(?: apparence\/(sombre|claire)\b)?/
  assert.deepEqual(motifDuSite.exec(`Mozilla/5.0 Mobile ${agentPour(MARQUE, true)}`)?.slice(1), ['1.0.0', 'android', 'sombre'])
  assert.deepEqual(motifDuSite.exec(`Mozilla/5.0 Mobile ${agentPour(MARQUE, null)}`)?.slice(1), ['1.0.0', 'android', undefined])
})

test('ce qu’on ne comprend pas ne fait rien', () => {
  for (const brut of ['', 'pas du json', 'null', '42', '"pret"', '[]', '{}', '{"type":7}', '{"type":"un-verbe-de-demain"}']) {
    assert.equal(lireMessage(brut), null, brut)
  }
})

/** Exécute le script comme le ferait la vue web, dans une page donnée. Rend ce que la page a posté au natif. */
function executer(script: string, page: { ecoute?: (brut: string) => void; pont?: boolean } = {}) {
  const postes: any[] = []
  let alertes = 0
  const fenetre: any = {}
  if (page.pont !== false) fenetre.ReactNativeWebView = { postMessage: (t: string) => { postes.push(JSON.parse(t)) } }
  if (page.ecoute) fenetre.__babyNamedNatif = page.ecoute
  let erreur: unknown = null
  try { new Function('window', 'alert', script)(fenetre, () => { alertes++ }) } catch (e) { erreur = e }
  return { postes, alertes, erreur }
}

test('le message remis à la page ne peut pas sortir de sa chaîne', () => {
  const piege = 'https://babynamed.fr/"});alert(1);// </script> \\'
  const script = scriptPour({ type: 'lien', url: piege })
  assert.match(script, /;true;$/)
  // La page reçoit exactement ce message, et rien d'autre ne s'exécute.
  const recus: string[] = []
  const { alertes, erreur } = executer(script, { ecoute: t => recus.push(t) })
  assert.equal(alertes, 0)
  assert.equal(erreur, null)
  assert.deepEqual(recus.map(t => JSON.parse(t)), [{ type: 'lien', url: piege }])
})

test('chaque message revient avec son accusé de réception', () => {
  // Elle écoute : « entendu ».
  const recus: string[] = []
  assert.deepEqual(executer(scriptPour({ type: 'retour' }), { ecoute: t => recus.push(t) }).postes,
    [{ type: 'accuse', de: 'retour', ecoute: true }])
  assert.equal(recus.length, 1)
  // Le document est là, le site n'y a pas démarré : « personne n'écoute ».
  assert.deepEqual(executer(scriptPour({ type: 'lien', url: 'https://babynamed.fr/g/12/communs' })).postes,
    [{ type: 'accuse', de: 'lien', ecoute: false }])
  // Elle échoue en le traitant : l'accusé part quand même.
  const casse = executer(scriptPour({ type: 'actif' }), { ecoute: () => { throw new Error('la page a planté') } })
  assert.deepEqual(casse.postes, [{ type: 'accuse', de: 'actif', ecoute: true }])
  // Une page sans pont (un autre site, une page d'erreur) : rien ne casse, rien ne revient.
  const ailleurs = executer(scriptPour({ type: 'actif' }), { pont: false })
  assert.deepEqual([ailleurs.postes, ailleurs.erreur], [[], null])
  // Ce que le natif en lit.
  assert.deepEqual(lire({ type: 'accuse', de: 'lien', ecoute: true }), { type: 'accuse', de: 'lien', ecoute: true })
  assert.deepEqual(lire({ type: 'accuse', de: 7, ecoute: 'oui' }), { type: 'accuse', de: '', ecoute: false })
})
