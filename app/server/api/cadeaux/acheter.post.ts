/**
 * Ouvrir la page de paiement d'un cadeau.
 *
 * Sans compte : qui offre n'est pas forcément qui trie — les grands-parents,
 * une amie, les collègues du pot de départ. Stripe demande l'e-mail pour le
 * reçu ; l'app ne garde que le nom et le mot qu'on a choisi d'écrire, et
 * seulement une fois le paiement encaissé (livrerCadeau).
 *
 * Le consentement, exigé ici comme pour une liste, mais pas le même : rien
 * n'est fourni à l'achat. L'acheteur garde ses quatorze jours tant que le code
 * n'a pas servi, et demande que la liste soit débloquée dès son utilisation —
 * c'est à ce moment-là seulement qu'il perd son droit de rétractation.
 */
export default defineEventHandler(async (e) => {
  // Une page publique qui ouvre des sessions chez Stripe : on borne, par
  // adresse, ce qu'un script pourrait en ouvrir pour rien.
  await limiter(e, 'cadeau-achat', ipDe(e), 20, 3600)
  if (!paiementPret()) throw createError({ statusCode: 503, statusMessage: 'paiement_non_configure' })
  if (!venteOuverte()) throw createError({ statusCode: 503, statusMessage: 'vente_fermee' })

  const corps = await readBody<{ consentement?: boolean; de_la_part?: unknown; message?: unknown }>(e)
    .catch(() => null)
  if (corps?.consentement !== true) {
    throw createError({ statusCode: 400, statusMessage: 'consentement_requis' })
  }

  const retour = getRequestURL(e).origin
  const siteUrl = String(useRuntimeConfig().public.siteUrl || '').replace(/\/$/, '') || retour
  const session = await creerSessionCadeau({
    code: nouveauCodeCadeau(),
    deLaPart: texteOffrant(corps.de_la_part, 40),
    message: texteOffrant(corps.message, 200),
    siteUrl, retour, consentementLe: new Date().toISOString()
  })
  return { ok: true, url: session.url as string }
})
