/**
 * Où s'ouvre une adresse (src/navigation.ts) — sans téléphone :
 *
 *     npm run essais
 */
import assert from 'node:assert/strict'
import { adresseDuChemin, adresseDuLien, destination } from '../src/navigation'

const SITE = 'https://babynamed.fr'
const dest = (a: string) => destination(a, SITE)

test('les écrans de l’app restent dans l’app', () => {
  for (const a of ['/', '/?code=K7QMX3XPD9', '/connexion', '/connexion?mode=connexion', '/connexion/app#t=abc',
    '/connexion/lien', '/g/12/swipe', '/g/12/communs?x=1', '/rejoindre/K7QMX3XPD9', '/conditions',
    '/confidentialite', '/mentions-legales', '/accessibilite', '/une-route-de-demain']) {
    assert.equal(dest(SITE + a), 'app', a)
  }
})

test('les pages publiques du site — celles qui vendent — partent dans le navigateur', () => {
  for (const a of ['/prenoms/', '/prenom/louise/', '/prenoms/2027/filles/', '/choisir-un-prenom-a-deux/',
    '/idee-cadeau-futurs-parents/', '/sitemap.xml', '/llms.txt', '/logo.png']) {
    assert.equal(dest(SITE + a), 'dehors', a)
  }
})

test('les autres sites, un e-mail, un numéro : dehors', () => {
  for (const a of ['https://www.cnil.fr/fr/plaintes', 'https://www.babynamed.fr/', 'http://babynamed.fr/',
    'https://babynamed.fr.exemple.test/', 'https://checkout.stripe.com/c/pay/x', 'mailto:contact@babynamed.fr',
    'tel:+33600000000']) {
    assert.equal(dest(a), 'dehors', a)
  }
})

test('ce qui ne se suit pas ne se suit pas', () => {
  for (const a of ['javascript:alert(1)', 'data:text/html,<p>x', 'blob:https://babynamed.fr/1234', 'file:///etc/passwd',
    'intent://babynamed.fr/#Intent;scheme=https;end', 'pas une adresse', '', SITE + '/api/moi/donnees',
    SITE + '/api/auth/moi']) {
    assert.equal(dest(a), 'rien', a)
  }
})

test('une page vide que la vue web s’ouvre à elle-même est laissée tranquille', () => {
  assert.equal(dest('about:blank'), 'app')
  assert.equal(dest('about:srcdoc'), 'app')
})

test('un site d’essai (une autre origine, donnée à la construction) suit la même règle', () => {
  const essai = 'http://192.168.1.20:3000'
  assert.equal(destination(essai + '/g/1/swipe', essai), 'app')
  assert.equal(destination(essai + '/prenoms/', essai), 'dehors')
  assert.equal(destination(SITE + '/', essai), 'dehors')
})

test('un lien qui ouvre l’app : seulement une adresse de l’app, sur le site', () => {
  assert.equal(adresseDuLien(SITE + '/rejoindre/K7QMX3XPD9', SITE), SITE + '/rejoindre/K7QMX3XPD9')
  assert.equal(adresseDuLien(SITE + '/connexion/app#t=abc_DEF-123', SITE), SITE + '/connexion/app#t=abc_DEF-123')
  for (const a of [null, undefined, '', 'babynamed://rejoindre/K7QMX3XPD9', 'https://ailleurs.exemple.test/rejoindre/x',
    SITE + '/prenoms/', SITE + '/api/dev/base', 'javascript:alert(1)']) {
    assert.equal(adresseDuLien(a, SITE), null, String(a))
  }
})

test('une notification touchée : un chemin de l’app, rien d’autre', () => {
  assert.equal(adresseDuChemin('/g/12/communs', SITE), SITE + '/g/12/communs')
  assert.equal(adresseDuChemin('/g/12/reglages', SITE), SITE + '/g/12/reglages')
  for (const c of ['//ailleurs.exemple.test/g/1', 'https://ailleurs.exemple.test/', 'g/12/communs', '/prenoms/',
    '/api/moi/supprimer', '/g/1 2', '/\\ailleurs.exemple.test', '', null, undefined, 12, { chemin: '/' },
    '/' + 'a'.repeat(400)]) {
    assert.equal(adresseDuChemin(c, SITE), null, JSON.stringify(c))
  }
})
