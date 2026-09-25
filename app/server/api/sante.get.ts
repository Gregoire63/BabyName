/** Diagnostic : dit ce qui est configuré, sans jamais révéler de valeur. */
export default defineEventHandler(async () => {
  const c = useRuntimeConfig()
  const presence = {
    // La base D1, liée au Worker sous le nom DB (wrangler.jsonc).
    base: !!(globalThis as any).__env__?.DB,
    base_variable: 'DB (Cloudflare D1)',
    secret_session: !!(c.sessionSecret || process.env.SESSION_SECRET),
    // Le lien de connexion par e-mail : la cle et l'expediteur sont poses.
    courriel: !!(c.emailCle && c.emailExpediteur),
    // Le paiement : pret seulement si la cle ET le prix sont poses. Le secret
    // du webhook a part — sans lui la caisse s'ouvre, mais seul le retour du
    // navigateur debloque, ce qui rate ceux qui ferment l'onglet trop tot.
    paiement: !!(c.stripeSecretKey && c.stripePriceId),
    paiement_webhook: !!c.stripeWebhookSecret,
    // La purge RGPD : en ligne, la tache planifiee de Cloudflare la lance
    // chaque nuit (scheduledTasks, nuxt.config.ts) ; CRON_SECRET ouvre en plus
    // /api/admin/purger pour la declencher a la main. En developpement, il n'y
    // a pas de planificateur : seulement la route, si le secret est pose.
    purge_quotidienne: !import.meta.dev || !!(process.env.CRON_SECRET || c.cronSecret)
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
  let infos: any = { joignable: false }
  try {
    const b = await base()
    const tables = await b.q<{ name: string }>(
      `select name from sqlite_master
        where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%'
          and name not in ('d1_migrations', '_semence')`)
    const appliquees = (await b.q<{ name: string }>(`select name from d1_migrations order by id`)).map(r => r.name)
    // Les colonnes dont le code a besoin : sans elles l'app tourne, mais
    // certaines routes echouent. Les voir d'un coup d'oeil evite de deviner.
    const cols = await b.q<{ t: string; c: string }>(
      `select m.name as t, p.name as c
         from sqlite_master m join pragma_table_info(m.name) p
        where m.type = 'table'
          and m.name in ('votes', 'utilisateurs', 'groupes', 'passkeys', 'liens_connexion', 'limites', 'quota_jour')`)
    // Effacer un compte ne doit pas effacer les listes qu'il a creees (donc
    // les votes de l'autre parent) : la cle vers le createur passe a NULL.
    const rgpd = await b.q1<{ regle: string }>(
      `select on_delete as regle from pragma_foreign_key_list('groupes') where "from" = 'cree_par'`)
    const a = (t: string, col: string) => cols.some(x => x.t === t && x.c === col)
    infos = {
      joignable: true, moteur: 'd1', tables: tables.length,
      migrations: {
        appliquees,
        'votes.balayage': a('votes', 'balayage'),
        'utilisateurs.cle_acces_hash': a('utilisateurs', 'cle_acces_hash'),
        'groupes.paye_le': a('groupes', 'paye_le'),
        'groupes.offert': a('groupes', 'offert'),
        'groupes.code_observateur': a('groupes', 'code_observateur'),
        'quota_jour': a('quota_jour', 'n'),
        'groupes.paiement_ref': a('groupes', 'paiement_ref'),
        'quota.depart': a('groupes', 'quota_depart') && a('utilisateurs', 'gestes_depart'),
        'connexion.passkeys_et_liens': a('utilisateurs', 'session_gen') && a('passkeys', 'id')
          && a('liens_connexion', 'id') && a('limites', 'cle'),
        'rgpd.effacement_sans_cascade': String(rgpd?.regle ?? '').toUpperCase() === 'SET NULL'
      }
      // Pas de compte des listes vendues ici : cette route est publique, et
      // le nombre de clients n'a pas a l'etre. Il se lit dans la console D1.
    }
  } catch (err: any) {
    // Le message d'erreur de la base peut en dire trop : il reste dans les
    // journaux, pas sur une route publique.
    console.error('[sante]', String(err?.message ?? err).slice(0, 200))
    infos = { joignable: false, erreur: import.meta.dev ? String(err?.message ?? err).slice(0, 120) : 'base_injoignable' }
  }
  return { presence, legal, base: infos }
})
