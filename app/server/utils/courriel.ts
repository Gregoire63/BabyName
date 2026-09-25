/**
 * Envoyer un e-mail — ceux de la connexion, et rien d'autre.
 *
 * Pas de SDK : un appel HTTP au prestataire nommé dans shared/utils/editeur.ts
 * (COURRIEL), avec la clé posée en secret du Worker. Aucune liste de diffusion, aucun
 * pixel de suivi, aucun lien réécrit : un lien de connexion qui passe par un
 * traceur de clics fuirait son jeton chez un tiers.
 *
 * En développement, sans clé, rien ne part : le message est rangé dans une
 * boîte locale (/api/dev/courriels, les outils de dev de « Mon compte ») et
 * écrit dans la console. Les essais y lisent leurs liens et leurs codes.
 */
export interface Courriel { a: string; sujet: string; texte: string; html: string }

const BOITE_DEV: (Courriel & { le: string })[] = []

function reglages() {
  const c = useRuntimeConfig()
  return {
    cle: String(c.emailCle ?? ''),
    expediteur: String(c.emailExpediteur ?? '')
  }
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

function gabarit(titre: string, corps: string, bouton: { texte: string; lien: string }, code: string, apres: string) {
  const codeEspace = `${code.slice(0, 3)} ${code.slice(3)}`
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"></head>
<body style="margin:0;padding:24px 12px;background:#fbfaf9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a234e">
<div style="max-width:460px;margin:0 auto;background:#ffffff;border:1px solid #ece7e3;border-radius:18px;padding:26px 24px">
<p style="margin:0 0 4px;font-weight:800;font-size:15px">babyNamed</p>
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.25">${esc(titre)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">${corps}</p>
<p style="margin:0 0 22px"><a href="${esc(bouton.lien)}" style="display:inline-block;background:#1a234e;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:999px">${esc(bouton.texte)}</a></p>
<p style="margin:0 0 6px;font-size:14px;color:#5f6480">Ou tapez ce code dans l’app :</p>
<p style="margin:0 0 22px;font-size:30px;font-weight:800;letter-spacing:6px">${esc(codeEspace)}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#5f6480">${apres}</p>
</div></body></html>`
}

export function courrielConnexion(o: { a: string; pseudo: string; lien: string; code: string }): Courriel {
  const minutes = CONSERVATION.lienMinutes
  return {
    a: o.a,
    sujet: `Votre connexion à babyNamed — code ${o.code}`,
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
    sujet: `Confirmez votre adresse — code ${o.code}`,
    texte: `Bonjour ${o.pseudo},\n\nPour pouvoir retrouver votre compte babyNamed avec cette adresse, confirmez-la :\n${o.lien}\n\nOu tapez ce code dans l’app : ${o.code}\n\nValable ${minutes} minutes. Si vous n’avez rien demandé, ignorez ce message : l’adresse ne sera pas enregistrée.\n`,
    html: gabarit('Confirmez votre adresse',
      `${esc(o.pseudo)}, pour pouvoir retrouver votre compte babyNamed avec cette adresse :`,
      { texte: 'Confirmer mon adresse', lien: o.lien }, o.code,
      `Valable ${minutes} minutes. Si vous n’avez rien demandé, ignorez ce message : l’adresse ne sera pas enregistrée.`)
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
