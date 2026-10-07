/**
 * Envoyer un e-mail — ceux de l'inscription et de la connexion, et rien d'autre.
 *
 * Le prestataire est nommé dans shared/utils/editeur.ts (COURRIEL) :
 *  - OVH : la boîte du domaine, en SMTP. Le Worker ouvre lui-même la
 *    connexion (sockets TCP de Cloudflare, bibliothèque worker-mailer),
 *    s'authentifie avec le mot de passe de la boîte (secret du Worker) et
 *    envoie, chiffré jusqu'à OVH (port 465, TLS dès la connexion).
 *  - Brevo ou Resend : un appel HTTP à leur API, avec la clé en secret.
 * Aucune liste de diffusion, aucun pixel de suivi, aucun lien réécrit : un
 * lien de connexion qui passe par un traceur de clics fuirait son jeton chez
 * un tiers.
 *
 * En développement, sans clé, rien ne part : le message est rangé dans une
 * boîte locale (/api/dev/courriels, les outils de dev de « Mon compte ») et
 * écrit dans la console. Les essais y lisent leurs liens et leurs codes.
 * Avec la clé dans app/.env (NUXT_EMAIL_CLE, NUXT_EMAIL_EXPEDITEUR), il part
 * vraiment, par la même boîte OVH qu'en ligne : on le reçoit, et son lien
 * ramène au serveur local (il suit l'adresse de la requête). Il reste aussi
 * dans la boîte locale.
 */
export interface Courriel { a: string; sujet: string; texte: string; html: string }

const BOITE_DEV: (Courriel & { le: string })[] = []

function reglages() {
  const c = useRuntimeConfig()
  return {
    cle: String(c.emailCle ?? ''),
    expediteur: String(c.emailExpediteur ?? ''),
    smtp: String(c.emailSmtp ?? '')
  }
}

/**
 * OVH, en SMTP. « serveur:port » : 465, TLS dès la connexion (ce que
 * recommande OVH) ; 587, STARTTLS. Le compte est l'adresse de l'expéditeur.
 *
 * Deux bibliothèques pour le même envoi, chargées seulement ici :
 *  - dans le Worker, worker-mailer, qui s'appuie sur `cloudflare:sockets` ;
 *  - sous `nuxt dev`, qui tourne dans Node et n'a pas ces sockets,
 *    nodemailer (dépendance de développement : la branche disparaît du
 *    Worker à la construction, `import.meta.dev` y valant faux).
 */
async function parSmtp(c: Courriel, de: { nom: string; email: string }, r: ReturnType<typeof reglages>) {
  const [hote, portBrut] = r.smtp.split(':')
  const port = Number(portBrut) || 465
  if (!hote) throw createError({ statusCode: 503, statusMessage: 'courriel_non_configure' })
  if (import.meta.dev) {
    const nodemailer = (await import('nodemailer')).default
    await nodemailer.createTransport({
      host: hote, port, secure: port === 465, requireTLS: port !== 465,
      auth: { user: de.email, pass: r.cle },
      connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 15_000
    }).sendMail({
      from: { name: de.nom, address: de.email },
      to: c.a, subject: c.sujet, text: c.texte, html: c.html
    })
    return
  }
  const { WorkerMailer } = await import('worker-mailer')
  await WorkerMailer.send({
    host: hote, port, secure: port === 465, startTls: port !== 465,
    credentials: { username: de.email, password: r.cle },
    authType: ['plain', 'login'],
    socketTimeoutMs: 15_000, responseTimeoutMs: 15_000
  }, {
    from: { name: de.nom, email: de.email },
    to: c.a, subject: c.sujet, text: c.texte, html: c.html
  })
}

/** L'envoi est-il possible ? Sans lui, l'app ne propose pas le lien par e-mail. */
export function courrielPret(): boolean {
  const r = reglages()
  return import.meta.dev || !!(r.cle && r.expediteur)
}

/** « babyNamed <connexion@exemple.fr> » → nom et adresse. */
function lireExpediteur(brut: string): { nom: string; email: string } {
  const m = brut.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/)
  return m ? { nom: m[1] || 'babyNamed', email: m[2]! } : { nom: 'babyNamed', email: brut.trim() }
}

export async function envoyerCourriel(c: Courriel): Promise<void> {
  const r = reglages()
  if (import.meta.dev && !r.cle) {
    BOITE_DEV.unshift({ ...c, le: new Date().toISOString() })
    BOITE_DEV.length = Math.min(BOITE_DEV.length, 30)
    console.info(`[courriel] → ${c.a} · ${c.sujet}\n${c.texte}\n`)
    return
  }
  if (!r.cle || !r.expediteur) {
    throw createError({ statusCode: 503, statusMessage: 'courriel_non_configure' })
  }
  const de = lireExpediteur(r.expediteur)
  if (import.meta.dev) {
    // Envoyé pour de vrai, et gardé aussi dans la boîte locale.
    BOITE_DEV.unshift({ ...c, le: new Date().toISOString() })
    BOITE_DEV.length = Math.min(BOITE_DEV.length, 30)
    console.info(`[courriel] → ${c.a} · ${c.sujet} (envoi réel, ${COURRIEL.fournisseur})`)
  }
  if (COURRIEL.fournisseur === 'ovh') {
    try {
      await parSmtp(c, de, r)
    } catch (err: any) {
      if (err?.statusCode) throw err
      // Le détail (réponse du serveur SMTP) part dans les journaux, jamais au
      // navigateur — et jamais le mot de passe, que la bibliothèque ne journalise pas.
      console.error('[courriel] smtp', String(err?.message ?? err).slice(0, 300))
      throw createError({ statusCode: 502, statusMessage: 'courriel_indisponible' })
    }
    return
  }
  const reponse = COURRIEL.fournisseur === 'resend'
    ? await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${r.cle}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: `${de.nom} <${de.email}>`, to: [c.a], subject: c.sujet, text: c.texte, html: c.html })
      })
    : await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': r.cle, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: de.nom, email: de.email }, to: [{ email: c.a }],
          subject: c.sujet, textContent: c.texte, htmlContent: c.html,
          // Pas de suivi d'ouverture ni de clics : le lien de connexion ne doit
          // passer par aucun redirecteur.
          headers: { 'X-Mailin-Tag': 'connexion' }
        })
      })
  if (!reponse.ok) {
    // Le détail part dans les journaux, jamais au navigateur.
    console.error('[courriel]', reponse.status, (await reponse.text().catch(() => '')).slice(0, 300))
    throw createError({ statusCode: 502, statusMessage: 'courriel_indisponible' })
  }
}

/** La boîte locale du développement (vide en production). */
export function boiteDev() {
  return import.meta.dev ? BOITE_DEV : []
}

// ---------------------------------------------------------------- messages
const esc = (s: string) => s.replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * Le code se copie d'un geste — autant qu'un e-mail le permet.
 *
 * Un e-mail ne sait rien faire quand on le touche : aucun script n'y tourne.
 * Le code y est donc un LIEN vers une page du site qui, elle, le copie et le
 * dit (pages/connexion/code.vue). Il voyage après le « # » : il n'est envoyé
 * à aucun serveur, et il ne vaut rien sans l'adresse qui l'a reçu.
 *
 * Et il s'écrit D'UN SEUL TENANT (« 123456 », pas « 123 456 » — l'écart n'est
 * que de la mise en forme) : c'est ce que savent lire les messageries qui
 * proposent elles-mêmes de copier un code (Gmail), et les claviers qui le
 * proposent dans le champ (iOS), et c'est ce qu'on colle sans rien corriger.
 */
export function lienCopieDuCode(lien: string, code: string): string {
  return `${new URL(lien).origin}/connexion/code#c=${code}`
}

function gabarit(titre: string, corps: string, bouton: { texte: string; lien: string }, code: string, apres: string) {
  const copie = esc(lienCopieDuCode(bouton.lien, code))
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"></head>
<body style="margin:0;padding:24px 12px;background:#fbfaf9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a234e">
<div style="max-width:460px;margin:0 auto;background:#ffffff;border:1px solid #ece7e3;border-radius:18px;padding:26px 24px">
<p style="margin:0 0 4px;font-weight:800;font-size:15px">babyNamed</p>
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.25">${esc(titre)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">${corps}</p>
<p style="margin:0 0 22px"><a href="${esc(bouton.lien)}" style="display:inline-block;background:#1a234e;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:999px">${esc(bouton.texte)}</a></p>
<p style="margin:0 0 6px;font-size:14px;color:#5f6480">Ou tapez ce code dans l’app :</p>
<p style="margin:0 0 6px"><a href="${copie}" style="display:inline-block;padding:6px 12px 6px 18px;border:1px solid #ece7e3;border-radius:14px;background:#fbfaf9;color:#1a234e;text-decoration:none;font-size:30px;font-weight:800;letter-spacing:6px">${esc(code)}</a></p>
<p style="margin:0 0 22px;font-size:13px"><a href="${copie}" style="color:#5f6480">Copier le code</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#5f6480">${apres}</p>
</div></body></html>`
}

export function courrielConnexion(o: { a: string; pseudo: string; lien: string; code: string }): Courriel {
  const minutes = CONSERVATION.lienMinutes
  return {
    a: o.a,
    sujet: `Votre code de connexion à babyNamed : ${o.code}`,
    texte: `Bonjour ${o.pseudo},\n\nPour vous connecter à babyNamed sur cet appareil, ouvrez ce lien :\n${o.lien}\n\nOu tapez ce code dans l’app : ${o.code}\n\nLien et code valent ${minutes} minutes, une seule fois. Si vous n’avez rien demandé, ignorez ce message : personne ne peut entrer sans eux.\n`,
    html: gabarit(`Bonjour ${o.pseudo}`,
      'Pour vous connecter à babyNamed sur cet appareil :',
      { texte: 'Me connecter', lien: o.lien }, o.code,
      `Lien et code valent ${minutes} minutes, une seule fois. Si vous n’avez rien demandé, ignorez ce message : personne ne peut entrer sans eux.`)
  }
}

export function courrielVerification(o: { a: string; pseudo: string; lien: string; code: string }): Courriel {
  const minutes = CONSERVATION.lienMinutes
  return {
    a: o.a,
    sujet: `Confirmez votre adresse, code ${o.code}`,
    texte: `Bonjour ${o.pseudo},\n\nPour pouvoir retrouver votre compte babyNamed avec cette adresse, confirmez-la :\n${o.lien}\n\nOu tapez ce code dans l’app : ${o.code}\n\nValable ${minutes} minutes. Si vous n’avez rien demandé, ignorez ce message : l’adresse ne sera pas enregistrée.\n`,
    html: gabarit('Confirmez votre adresse',
      `${esc(o.pseudo)}, pour pouvoir retrouver votre compte babyNamed avec cette adresse :`,
      { texte: 'Confirmer mon adresse', lien: o.lien }, o.code,
      `Valable ${minutes} minutes. Si vous n’avez rien demandé, ignorez ce message : l’adresse ne sera pas enregistrée.`)
  }
}

export function courrielInscription(o: { a: string; pseudo: string; lien: string; code: string }): Courriel {
  const minutes = CONSERVATION.lienMinutes
  const fin = `Valable ${minutes} minutes. Si vous n’avez rien demandé, ignorez ce message : aucun compte ne sera créé.`
  return {
    a: o.a,
    sujet: `Votre code d’inscription à babyNamed : ${o.code}`,
    texte: `Bonjour ${o.pseudo},\n\nPour créer votre compte babyNamed, ouvrez ce lien :\n${o.lien}\n\nOu tapez ce code dans l’app : ${o.code}\n\n${fin}\n`,
    html: gabarit(`Bienvenue ${o.pseudo}`, 'Pour créer votre compte babyNamed :',
      { texte: 'Créer mon compte', lien: o.lien }, o.code, fin)
  }
}

/** Une inscription sur une adresse qui a déjà un compte : on y fait entrer. */
export function courrielDejaInscrit(o: { a: string; pseudo: string; lien: string; code: string }): Courriel {
  const minutes = CONSERVATION.lienMinutes
  const fin = `Lien et code valent ${minutes} minutes, une seule fois. Si vous n’avez rien demandé, ignorez ce message : personne ne peut entrer sans eux.`
  return {
    a: o.a,
    sujet: `Vous avez déjà un compte babyNamed, code ${o.code}`,
    texte: `Bonjour ${o.pseudo},\n\nCette adresse a déjà un compte babyNamed : inutile d’en créer un second. Pour y entrer, ouvrez ce lien :\n${o.lien}\n\nOu tapez ce code dans l’app : ${o.code}\n\n${fin}\n`,
    html: gabarit(`Bonjour ${o.pseudo}`,
      'Cette adresse a déjà un compte babyNamed : inutile d’en créer un second. Pour y entrer :',
      { texte: 'Me connecter', lien: o.lien }, o.code, fin)
  }
}

/**
 * Les alertes de sécurité : ce qui permettrait à quelqu'un d'autre de revenir
 * sur le compte (une passkey de plus, une adresse remplacée) est dit à
 * l'adresse du compte. Un cookie volé ne suffit plus à s'installer en
 * silence : le vrai titulaire l'apprend, et « Mon compte » permet de défaire.
 */
function alerte(a: string, sujet: string, texte: string): Courriel {
  const suite = 'Si ce n’est pas vous : ouvrez babyNamed, Mon compte → Se connecter, retirez ce que vous ne reconnaissez pas, puis « Déconnecter mes autres appareils ».'
  return {
    a, sujet,
    texte: `${texte}\n\n${suite}\n`,
    html: `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px 12px;background:#fbfaf9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a234e">
<div style="max-width:460px;margin:0 auto;background:#ffffff;border:1px solid #ece7e3;border-radius:18px;padding:26px 24px">
<p style="margin:0 0 4px;font-weight:800;font-size:15px">babyNamed</p>
<h1 style="margin:0 0 14px;font-size:20px;line-height:1.25">${esc(sujet)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${esc(texte)}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#5f6480">${esc(suite)}</p>
</div></body></html>`
  }
}

export function alertePasskey(o: { a: string; pseudo: string; nom: string }): Courriel {
  return alerte(o.a, 'Une passkey a été ajoutée à votre compte',
    `${o.pseudo}, une passkey (${o.nom}) vient d’être ajoutée à votre compte babyNamed : elle permet désormais de s’y connecter.`)
}

export function alerteAdresse(o: { a: string; pseudo: string; nouvelle: string }): Courriel {
  return alerte(o.a, 'L’adresse de votre compte a changé',
    `${o.pseudo}, l’adresse de votre compte babyNamed est désormais ${o.nouvelle}. Les liens de connexion partiront là-bas, plus ici.`)
}

/** Une alerte ne doit jamais faire échouer ce qu'elle signale. */
export async function prevenir(c: Courriel | null) {
  if (!c || !courrielPret()) return
  await envoyerCourriel(c).catch(err => console.warn('[courriel] alerte non envoyee :', err?.statusMessage ?? err))
}
