/**
 * Ouvre une page de paiement Stripe pour cette liste.
 *
 * L'app ne voit jamais de carte : elle demande une session à Stripe et renvoie
 * l'URL de la page hébergée par Stripe. Le déblocage, lui, ne vient pas de ce
 * retour — il vient du webhook signé. Un navigateur qui revient sur
 * `?paye=1` n'a rien prouvé.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)

  const g = await q1<{ paye: boolean; nom: string }>(
    `select (paye_le is not null) as paye, nom from groupes where id = ?1`, [gid])
  if (!g) throw createError({ statusCode: 404, statusMessage: 'groupe_introuvable' })
  if (g.paye) return { ok: true, deja: true }

  if (!paiementPret()) {
    throw createError({ statusCode: 503, statusMessage: 'paiement_non_configure' })
  }
  if (!venteOuverte()) {
    throw createError({ statusCode: 503, statusMessage: 'vente_fermee' })
  }

  /**
   * Le consentement, exige ICI et pas seulement par la case de l'ecran.
   *
   * Un contenu numerique livre tout de suite ne se retracte pas — mais
   * seulement si l'acheteur l'a demande expressement ET a reconnu perdre son
   * droit de retractation (art. L221-28 13°). Une case que le serveur ne
   * verifie pas se contourne d'un appel direct : sans elle, l'acheteur garde
   * ses quatorze jours sur une liste deja utilisee.
   */
  const corps = await readBody<{ consentement?: boolean }>(e).catch(() => null)
  if (corps?.consentement !== true) {
    throw createError({ statusCode: 400, statusMessage: 'consentement_requis' })
  }

  // Le retour de la page de paiement se fait la ou l'on est (sur Cloudflare,
  // forcement l'un des noms du Worker) ; la facture, elle, cite l'adresse
  // officielle du site.
  const retour = getRequestURL(e).origin
  const siteUrl = String(useRuntimeConfig().public.siteUrl || '').replace(/\/$/, '') || retour
  const session = await creerSession({
    gid, uid: moi.user_id, siteUrl, retour, consentementLe: new Date().toISOString()
  })
  return { ok: true, url: session.url as string }
})
