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
    // Les colonnes ajoutees par migration : sans elles l'app tourne mais
    // certaines routes echouent. Les voir d'un coup d'oeil evite de deviner
    // si /api/admin/migrer est bien passe.
    const cols = await q<{ t: string; c: string }>(
      `select table_name as t, column_name as c from information_schema.columns
        where table_schema='public'
          and (table_name, column_name) in (('votes','balayage'),
                                            ('utilisateurs','cle_acces_hash'))`)
    const a = (t: string, c: string) => cols.some(x => x.t === t && x.c === c)
    infos = {
      joignable: true, moteur: (await base()).moteur, tables: r?.n ?? 0,
      migrations: {
        'votes.balayage': a('votes', 'balayage'),
        'utilisateurs.cle_acces_hash': a('utilisateurs', 'cle_acces_hash')
      }
    }
  } catch (err: any) {
    infos = { joignable: false, erreur: String(err?.message ?? err).slice(0, 120) }
  }
  return { presence, base: infos }
})
