/**
 * Ajouter (ou changer) l'adresse du compte : un e-mail de verification part,
 * avec un lien et un code. Rien n'est enregistre avant la preuve — sinon on
 * pourrait attacher l'adresse de quelqu'un d'autre a son compte, et la lui
 * confisquer.
 *
 * Adresse deja prise par un autre compte : on ne le dit PAS ici (ce serait
 * reveler qui utilise l'app) ; on le dira a la confirmation, quand la boite
 * mail aura ete prouvee.
 */
export default defineEventHandler(async (e) => {
  const moi = await exigerCompte(e)
  await limiter(e, 'email-ajout', moi.id, 6, 3600)
  const { email: brut } = await readBody<{ email?: string }>(e) ?? {}
  const email = emailValide(brut)
  await limiter(e, 'lien-email', email, 5, 900)
  if (!courrielPret()) throw createError({ statusCode: 503, statusMessage: 'courriel_non_configure' })
  if (email === moi.email) return { ok: true, deja: true }

  const { jeton, code } = await creerLien({ email, userId: moi.id, but: 'verification' })
  await envoyerCourriel(courrielVerification({ a: email, pseudo: moi.pseudo, lien: lienDe(e, jeton), code }))
  return { ok: true }
})
