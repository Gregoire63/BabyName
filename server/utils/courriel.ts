/** Envoi du lien magique. Resend en production ; en dev on renvoie le lien. */
export async function envoyerLienMagique(email: string, lien: string): Promise<{ envoye: boolean; lien?: string }> {
  const c = useRuntimeConfig()
  if (c.magicLinkDebug === '1' || !c.resendApiKey) {
    console.log(`[lien magique] ${email} -> ${lien}`)
    // Le lien n'est renvoyé au client QUE si le mode debug est explicitement activé.
    return c.magicLinkDebug === '1' ? { envoye: false, lien } : { envoye: false }
  }
  const r = await $fetch<{ id: string }>('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.resendApiKey}` },
    body: {
      from: c.mailFrom,
      to: [email],
      subject: 'Votre lien de connexion',
      text: `Bonjour,\n\nVoici votre lien de connexion (valable 20 minutes, usage unique) :\n\n${lien}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`
    }
  }).catch((e) => { console.error('resend', e); return null })
  return { envoye: !!r }
}
