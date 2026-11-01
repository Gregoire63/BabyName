#!/usr/bin/env node
/**
 * Prévenir quelqu'un que sa liste lui est offerte — l'e-mail qui suit
 * l'« offrir » à la main de la console D1 (LISEZMOI, « Offrir soi-même »).
 *
 * Même boîte et même allure que les e-mails de l'app (server/utils/courriel.ts) :
 * envoyé par la boîte OVH du domaine, en SMTP (ssl0.ovh.net:465), avec le
 * gabarit des alertes de compte. Aucun suivi, aucun lien réécrit.
 *
 * Le mot de passe de la boîte vient du .env à la racine du dépôt (SMTP_PASSWORD,
 * SMTP_EMAIL ; ou NUXT_EMAIL_CLE, NUXT_EMAIL_EXPEDITEUR comme l'app), jamais
 * de la ligne de commande : il ne finit ni dans l'historique du terminal, ni ici.
 *
 *   cd app
 *   node --env-file=../.env scripts/prevenir-liste-offerte.mjs jade.kobral@gmail.com Jade "Notre liste"
 *   … --apercu   écrit l'aperçu HTML, n'envoie rien
 *   … --en       en anglais
 */
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const drapeaux = new Set(args.filter(a => a.startsWith('--')))
const [a, pseudo, liste] = args.filter(a => !a.startsWith('--'))
if (!a || !pseudo || !liste) {
  console.error('Usage : node --env-file=../.env scripts/prevenir-liste-offerte.mjs <adresse> <prénom> "<nom de la liste>" [--apercu] [--en]')
  process.exit(1)
}
const l = drapeaux.has('--en') ? 'en' : 'fr'
const SITE = (process.env.NUXT_PUBLIC_SITE_URL || 'https://babynamed.fr').replace(/\/$/, '')

const T = {
  fr: {
    sujet: 'Votre liste babyNamed vous est offerte',
    titre: `${pseudo}, votre liste est débloquée`,
    corps: [
      `Pour vous remercier d’être parmi les premiers à choisir un prénom avec babyNamed, nous vous offrons le déblocage de votre liste « ${liste} ».`,
      'Plus de limite de swipes par jour, pour vous comme pour les personnes que vous y invitez. Rien à payer ni à saisir : rouvrez simplement l’app.'
    ],
    bouton: 'Ouvrir babyNamed',
    fin: 'Une remarque, une idée, un souci ? Répondez à cet e-mail, nous lisons tout.'
  },
  en: {
    sujet: 'Your babyNamed list is on us',
    titre: `${pseudo}, your list is unlocked`,
    corps: [
      `To thank you for being one of the first to choose a name with babyNamed, we have unlocked your list “${liste}” for free.`,
      'No more daily swipe limit, for you and for everyone you invite. Nothing to pay or enter: just reopen the app.'
    ],
    bouton: 'Open babyNamed',
    fin: 'A comment, an idea, a problem? Reply to this e-mail, we read everything.'
  }
}[l]

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Le gabarit des e-mails de l'app (courriel.ts), à la lettre près.
const html = `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"></head>
<body style="margin:0;padding:24px 12px;background:#fbfaf9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a234e">
<div style="max-width:460px;margin:0 auto;background:#ffffff;border:1px solid #ece7e3;border-radius:18px;padding:26px 24px">
<p style="margin:0 0 4px;font-weight:800;font-size:15px">babyNamed</p>
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.25">${esc(T.titre)}</h1>
${T.corps.map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5">${esc(p)}</p>`).join('\n')}
<p style="margin:6px 0 22px"><a href="${SITE}/" style="display:inline-block;background:#1a234e;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:999px">${esc(T.bouton)}</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#5f6480">${esc(T.fin)}</p>
</div></body></html>`
const texte = `${T.titre}\n\n${T.corps.join('\n\n')}\n\n${T.bouton} : ${SITE}/\n\n${T.fin}\n`

if (drapeaux.has('--apercu')) {
  writeFileSync('apercu-liste-offerte.html', html)
  console.log(`Aperçu : app/apercu-liste-offerte.html (à ${a}, « ${T.sujet} »). Rien n'est parti.`)
  process.exit(0)
}

const cle = process.env.SMTP_PASSWORD || process.env.NUXT_EMAIL_CLE
const brut = process.env.NUXT_EMAIL_EXPEDITEUR
  || (process.env.SMTP_EMAIL ? `babyNamed <${process.env.SMTP_EMAIL}>` : 'babyNamed <contact@babynamed.fr>')
const [hote, port = '465'] = (process.env.NUXT_EMAIL_SMTP || 'ssl0.ovh.net:465').split(':')
if (!cle) {
  console.error('Mot de passe manquant : SMTP_PASSWORD=… dans le .env à la racine du dépôt (lancer avec --env-file=../.env depuis app/).')
  process.exit(1)
}
const m = brut.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/)
const de = m ? { name: m[1] || 'babyNamed', address: m[2] } : { name: 'babyNamed', address: brut.trim() }

const nodemailer = (await import('nodemailer')).default
const info = await nodemailer.createTransport({
  host: hote, port: Number(port), secure: Number(port) === 465, requireTLS: Number(port) !== 465,
  auth: { user: de.address, pass: cle },
  connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 15_000
}).sendMail({ from: de, to: a, subject: T.sujet, text: texte, html })
console.log(`Envoyé à ${a} depuis ${de.address} (${info.response ?? 'ok'}).`)
