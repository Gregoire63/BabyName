/** Diagnostic : dit ce qui est configuré, sans jamais révéler de valeur. */
export default defineEventHandler(async () => {
  const c = useRuntimeConfig()
  const { url, source } = urlBase()
  const presence = {
    base: !!url,
    base_variable: source,
    secret_session: !!(c.sessionSecret || process.env.SESSION_SECRET),
    secret_migration: !!process.env.NUXT_MIGRATION_SECRET
  }
  // Sans URL, il reste la base embarquee du developpement : on interroge
  // quand meme, sinon /api/sante annonce « pas de base » alors que l'app marche.
  let infos: any = { joignable: false }
  try {
    const r = await q1<{ n: number }>(
      `select count(*)::int as n from information_schema.tables where table_schema='public'`)
    infos = { joignable: true, moteur: (await base()).moteur, tables: r?.n ?? 0 }
  } catch (err: any) {
    infos = { joignable: false, erreur: String(err?.message ?? err).slice(0, 120) }
  }
  return { presence, base: infos }
})
