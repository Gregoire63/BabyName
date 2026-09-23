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
    `select (paye_le is not null) as paye, nom from groupes where id = $1`, [gid])
  if (!g) throw createError({ statusCode: 404, statusMessage: 'groupe_introuvable' })
  if (g.paye) return { ok: true, deja: true }

  if (!paiementPret()) {
    throw createError({ statusCode: 503, statusMessage: 'paiement_non_configure' })
  }

  const c = useRuntimeConfig()
  const siteUrl = (c.public.siteUrl as string) || getRequestURL(e).origin
  const session = await creerSession({ gid, uid: moi.user_id, siteUrl })
  return { ok: true, url: session.url as string }
})
