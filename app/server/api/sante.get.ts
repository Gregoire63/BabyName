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
    paiement_webhook: !!c.stripeWebhookSecret,
    // La purge RGPD ne tourne que si Vercel a un CRON_SECRET a lui envoyer.
    purge_quotidienne: !!(process.env.CRON_SECRET || c.cronSecret)
  }
  // Ce qui manque pour VENDRE, pas pour tourner. `bloquants` (identite du
  // vendeur) ferme le paiement en production ; le reste (mediateur) est une
  // obligation a remplir avant la premiere vente reelle. Des noms de champs,
  // jamais leurs valeurs.
  const manquants = mentionsManquantes()
  const legal = {
    complet: manquants.length === 0, manquants,
    bloquants: mentionsBloquantes(), vente_ouverte: venteOuverte()
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
                                            ('groupes','paiement_ref'),
                                            ('groupes','quota_depart'),
                                            ('utilisateurs','gestes_depart'),
                                            ('quota_jour','n'))`)
    // Le bloc RGPD du schema : sans lui, effacer un compte efface aussi les
    // listes qu'il a creees — donc les votes de l'autre parent.
    const rgpd = await q1<{ facultatif: boolean }>(
      `select is_nullable = 'YES' as facultatif from information_schema.columns
        where table_schema = 'public' and table_name = 'groupes' and column_name = 'cree_par'`)
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
        'quota_jour': a('quota_jour', 'n'),
        'groupes.paiement_ref': a('groupes', 'paiement_ref'),
        // Le quota « depart puis filet » : sans ces colonnes, chaque vote
        // d'une liste gratuite tombe en erreur.
        'quota.depart': a('groupes', 'quota_depart') && a('utilisateurs', 'gestes_depart'),
        'rgpd.effacement_sans_cascade': !!rgpd?.facultatif
      }
      // Pas de compte des listes vendues ici : cette route est publique, et
      // le nombre de clients n'a pas a l'etre. Il se lit dans la console Neon.
    }
  } catch (err: any) {
    infos = { joignable: false, erreur: String(err?.message ?? err).slice(0, 120) }
  }
  return { presence, legal, base: infos }
})
