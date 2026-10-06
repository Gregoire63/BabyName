/**
 * « Recevoir un lien de connexion » : un e-mail avec un lien et un code.
 *
 * La reponse est la MEME, que l'adresse ait un compte ou non : sinon ce
 * formulaire dirait a n'importe qui si telle personne utilise l'app. Les
 * limites (par IP, par adresse) empechent d'en faire un canon a e-mails.
 */
export default defineEventHandler(async (e) => {
  await limiter(e, 'lien-ip', ipDe(e), 20, 3600)
  const { email: brut } = await readBody<{ email?: string }>(e) ?? {}
  const email = emailValide(brut)
  await limiter(e, 'lien-email', email, 5, 900)
  // Le compte de démonstration des stores n'a pas de boîte à lire : rien ne
  // part, son code est fixe (utils/demo.ts).
  if (estAdresseDemo(email)) return { ok: true }
  if (!courrielPret()) throw createError({ statusCode: 503, statusMessage: 'courriel_non_configure' })

  const u = await q1<{ id: string; pseudo: string }>(
    `select id, pseudo from utilisateurs where email = ?1 and email_verifie_le is not null`, [email])
  if (u) {
    const { jeton, code } = await creerLien({ email, userId: u.id, but: 'connexion' })
    await envoyerCourriel(courrielConnexion({ a: email, pseudo: u.pseudo, lien: lienDe(e, jeton), code }))
  } else {
    // Le meme temps de reponse, a peu pres : un envoi prend quelques
    // centaines de millisecondes, une adresse inconnue n'en prendrait aucune.
    await new Promise(r => setTimeout(r, 250 + Math.random() * 350))
  }
  return { ok: true }
})
