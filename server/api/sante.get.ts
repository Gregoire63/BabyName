/** Diagnostic : dit ce qui est configuré, sans jamais révéler de valeur. */
export default defineEventHandler(async () => {
  const c = useRuntimeConfig()
  const { url, source } = urlBase()
  const presence = {
    base: !!url,
    base_variable: source,
    secret_session: !!(c.sessionSecret || process.env.SESSION_SECRET),
    envoi_email: !!c.resendApiKey,
    mode_debug_lien: String(c.magicLinkDebug ?? '') === '1'
  }
  let base: any = { joignable: false }
  if (url) {
    try {
      const r = await q1<{ n: number }>(
        `select count(*)::int as n from information_schema.tables where table_schema='public'`)
      base = { joignable: true, tables: r?.n ?? 0 }
    } catch (err: any) {
      base = { joignable: false, erreur: String(err?.message ?? err).slice(0, 120) }
    }
  }
  return { presence, base }
})
