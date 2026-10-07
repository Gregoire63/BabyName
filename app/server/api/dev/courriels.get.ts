/**
 * La boite aux lettres du developpement : les e-mails que l'app aurait
 * envoyes (lien et code de connexion), les plus recents d'abord.
 * Developpement seulement : en production la route repond 404 et son
 * contenu sort du bundle (voir base.get.ts).
 */
export default defineEventHandler(() => {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'introuvable' })
  return boiteDev().map(c => ({
    a: c.a, sujet: c.sujet, le: c.le,
    lien: c.texte.match(/https?:\/\/\S+/)?.[0] ?? null,
    code: c.texte.match(/code dans l’app : (\d{6})/)?.[1] ?? null,
    // Dans le message mis en forme : le code est un lien, vers la page qui
    // le copie (pages/connexion/code.vue).
    copie: c.html.match(/<a href="([^"]+\/connexion\/code#c=\d{6})"[^>]*>\d{6}<\/a>/)?.[1] ?? null
  }))
})
