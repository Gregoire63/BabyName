export default defineEventHandler(async (e) => {
  const { email, pseudo } = await readBody<{ email?: string; pseudo?: string }>(e) ?? {}
  const adresse = (email ?? '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(adresse)) {
    throw createError({ statusCode: 400, statusMessage: 'email_invalide' })
  }

  // Anti-abus. 3 etait bien trop serre : une faute de frappe suivie de deux
  // essais suffisait a se verrouiller. On compte les jetons NON UTILISES
  // seulement — cliquer sur son lien ne doit pas consommer son quota — et on
  // renvoie le delai d'attente pour que l'interface puisse le dire.
  const recents = await q1<{ n: number; attente: number }>(
    `select count(*)::int as n,
            coalesce(ceil(extract(epoch from (min(cree_le) + interval '15 minutes' - now())) / 60), 0)::int as attente
       from jetons_magiques
      where email = $1 and utilise_le is null and cree_le > now() - interval '15 minutes'`, [adresse])
  if ((recents?.n ?? 0) >= 8) {
    throw createError({
      statusCode: 429,
      statusMessage: 'trop_de_demandes',
      data: { attente_minutes: Math.max(1, recents?.attente ?? 15) }
    })
  }

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
