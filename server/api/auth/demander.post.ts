export default defineEventHandler(async (e) => {
  const { email, pseudo } = await readBody<{ email?: string; pseudo?: string }>(e) ?? {}
  const adresse = (email ?? '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(adresse)) {
    throw createError({ statusCode: 400, statusMessage: 'email_invalide' })
  }

  // Anti-abus : pas plus de 3 demandes par adresse en 15 minutes.
  const recents = await q1<{ n: number }>(
    `select count(*)::int as n from jetons_magiques
      where email = $1 and cree_le > now() - interval '15 minutes'`, [adresse])
  if ((recents?.n ?? 0) >= 3) throw createError({ statusCode: 429, statusMessage: 'trop_de_demandes' })

  const jeton = jetonAleatoire()
  await q(`insert into jetons_magiques (jeton, email, expire_le)
           values ($1, $2, now() + interval '20 minutes')`, [jeton, adresse])

  // Le pseudo n'est retenu qu'à la première connexion.
  if (pseudo?.trim()) {
    await q(`insert into utilisateurs (email, pseudo) values ($1, $2)
             on conflict (email) do nothing`, [adresse, pseudo.trim().slice(0, 40)])
  }

  const base = useRuntimeConfig().public.siteUrl || getRequestURL(e).origin
  const res = await envoyerLienMagique(adresse, `${base}/api/auth/verifier?jeton=${jeton}`)

  // Réponse volontairement identique que l'adresse existe ou non.
  return { ok: true, ...(res.lien ? { lien_debug: res.lien } : {}) }
})
