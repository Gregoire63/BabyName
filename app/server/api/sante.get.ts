import type { H3Event } from 'h3'

/**
 * Diagnostic : dit ce qui est configuré, sans jamais révéler de valeur.
 *
 * Le détail (secrets posés, mentions légales manquantes, vente ouverte,
 * migrations) se lisait ici par n'importe qui : une carte de la configuration
 * et, pire, un aveu public (« médiateur manquant, vente ouverte »). En ligne,
 * il demande donc `Authorization: Bearer <CRON_SECRET>` (server/utils/admin.ts) ;
 * sans, on ne dit que si l'app et sa base répondent. En développement, tout
 * reste lisible : essais/relance.sh attend `joignable`.
 */
export default defineEventHandler(async (e) => {
  if (!import.meta.dev && !estAdmin(e)) return etatPublic(e)
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
          and m.name in ('bulletins', 'utilisateurs', 'groupes', 'passkeys', 'liens_connexion', 'limites',
                         'vetos', 'deja_pris', 'cadeaux')`)
    // Effacer un compte ne doit pas effacer les listes qu'il a creees (donc
    // les votes de l'autre parent) : la cle vers le createur passe a NULL.
    const rgpd = await b.q1<{ regle: string }>(
      `select on_delete as regle from pragma_foreign_key_list('groupes') where "from" = 'cree_par'`)
    const a = (t: string, col: string) => cols.some(x => x.t === t && x.c === col)
    infos = {
      joignable: true, moteur: 'd1', tables: tables.length,
      migrations: {
        appliquees,
        // Les votes en bulletins, un par membre et par liste (migration 0005).
        'bulletins': a('bulletins', 'positifs') && a('bulletins', 'negatifs') && a('bulletins', 'nb'),
        'groupes.paye_le': a('groupes', 'paye_le'),
        'groupes.offert': a('groupes', 'offert'),
        'groupes.code_observateur': a('groupes', 'code_observateur'),
        'groupes.paiement_ref': a('groupes', 'paiement_ref'),
        'quota.depart': a('groupes', 'quota_depart') && a('utilisateurs', 'gestes_depart')
          && a('bulletins', 'depart') && a('bulletins', 'n_jour'),
        'connexion.passkeys_et_liens': a('utilisateurs', 'session_gen') && a('passkeys', 'id')
          && a('liens_connexion', 'id') && a('limites', 'cle'),
        'rgpd.effacement_sans_cascade': String(rgpd?.regle ?? '').toUpperCase() === 'SET NULL',
        // « Déjà pris » et les graphies bloquées d'un coup (migration 0002).
        'exclusions.deja_pris_et_graphies': a('vetos', 'tete') && a('deja_pris', 'tete'),
        // Les codes cadeaux (migration 0003).
        'cadeaux': a('cadeaux', 'code_hash') && a('cadeaux', 'expire_le')
      }
      // Pas de compte des listes vendues ici : meme reservee, cette route n'a
      // pas a porter le nombre de clients. Il se lit dans la console D1.
    }
  } catch (err: any) {
    // Le message d'erreur de la base peut en dire trop : il reste dans les
    // journaux, pas sur une route publique.
    console.error('[sante]', String(err?.message ?? err).slice(0, 200))
    infos = { joignable: false, erreur: import.meta.dev ? String(err?.message ?? err).slice(0, 120) : 'base_injoignable' }
  }
  return { presence, legal, base: infos }
})

/** Ce que tout le monde voit : l'app répond, et sa base aussi (503 sinon). */
async function etatPublic(e: H3Event) {
  try {
    await q(`select 1`)
    return { ok: true }
  } catch (err: any) {
    console.error('[sante]', String(err?.message ?? err).slice(0, 200))
    setResponseStatus(e, 503)
    return { ok: false }
  }
}
