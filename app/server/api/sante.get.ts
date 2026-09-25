/** Diagnostic : dit ce qui est configuré, sans jamais révéler de valeur. */
export default defineEventHandler(async () => {
  const c = useRuntimeConfig()
  const { url, source } = urlBase()
  const presence = {
    base: !!url,
    base_variable: source,
    secret_session: !!(c.sessionSecret || process.env.SESSION_SECRET),
    secret_migration: !!process.env.NUXT_MIGRATION_SECRET,
    // Le paiement : pret seulement si la cle ET le prix sont poses. Le secret
    // du webhook a part — sans lui la caisse s'ouvre, mais seul le retour du
    // navigateur debloque, ce qui rate ceux qui ferment l'onglet trop tot.
    paiement: !!(c.stripeSecretKey && c.stripePriceId),
    paiement_webhook: !!c.stripeWebhookSecret
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
                                            ('utilisateurs','cle_acces_hash'),
                                            ('groupes','paye_le'),
                                            ('groupes','offert'),
                                            ('groupes','code_observateur'),
                                            ('quota_jour','n'))`)
    const a = (t: string, c: string) => cols.some(x => x.t === t && x.c === c)
    infos = {
      joignable: true, moteur: (await base()).moteur, tables: r?.n ?? 0,
      migrations: {
        'votes.balayage': a('votes', 'balayage'),
        'utilisateurs.cle_acces_hash': a('utilisateurs', 'cle_acces_hash'),
        // Le schema du payant. Si l'un manque, le code deploye interroge des
        // colonnes absentes : c'est la premiere chose a regarder apres un push.
        'groupes.paye_le': a('groupes', 'paye_le'),
        'groupes.offert': a('groupes', 'offert'),
        'groupes.code_observateur': a('groupes', 'code_observateur'),
        'quota_jour': a('quota_jour', 'n')
      }
      // Pas de compte des listes vendues ici : cette route est publique, et
      // le nombre de clients n'a pas a l'etre. Il se lit dans la console Neon.
    }
  } catch (err: any) {
    infos = { joignable: false, erreur: String(err?.message ?? err).slice(0, 120) }
  }
  return { presence, base: infos }
})
