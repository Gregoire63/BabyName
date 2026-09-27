/**
 * S'inscrire : un prénom et une adresse e-mail.
 *
 * Le compte ne naît qu'une fois la boîte mail prouvée, par le lien ou le code
 * de l'e-mail (lien/valider.post.ts, code.post.ts). Jusque-là il n'existe que
 * la demande — l'adresse, le prénom, l'empreinte du jeton et du code — et
 * elle meurt en quinze minutes : une adresse tapée de travers, ou celle de
 * quelqu'un d'autre, ne laisse aucun compte derrière elle.
 *
 * L'adresse a déjà un compte : on n'en crée pas un second, et on ne le dit
 * pas ici. La réponse est la même — sinon ce formulaire dirait à n'importe
 * qui si telle personne utilise l'app. L'e-mail, lui, le dit, à la seule
 * personne qui le lit : il porte un lien et un code de CONNEXION à ce compte,
 * et l'écran qui attend le code l'accepte (code.post.ts).
 *
 * Limites : douze inscriptions par heure et par IP (des comptes à la chaîne),
 * cinq e-mails par quart d'heure et par adresse (un canon à e-mails), la même
 * que pour les liens de connexion.
 */
export default defineEventHandler(async (e) => {
  await limiter(e, 'inscription', ipDe(e), 12, 3600)
  const corps = await readBody<{ pseudo?: string; email?: string }>(e) ?? {}
  const pseudo = pseudoValide(corps.pseudo)
  const email = emailValide(corps.email)
  await limiter(e, 'lien-email', email, 5, 900)
  if (!courrielPret()) throw createError({ statusCode: 503, statusMessage: 'courriel_non_configure' })

  const compte = await q1<{ id: string; pseudo: string }>(
    `select id, pseudo from utilisateurs where email = ?1`, [email])
  if (compte) {
    const { jeton, code } = await creerLien({ email, userId: compte.id, but: 'connexion' })
    await envoyerCourriel(courrielDejaInscrit({ a: email, pseudo: compte.pseudo, lien: lienDe(e, jeton), code }))
  } else {
    const { jeton, code } = await creerLien({ email, pseudo, but: 'inscription' })
    await envoyerCourriel(courrielInscription({ a: email, pseudo, lien: lienDe(e, jeton), code }))
  }
  return { ok: true }
})
