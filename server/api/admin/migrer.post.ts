/**
 * Applique le schéma, une fois, après le premier déploiement.
 *
 * Pourquoi une route plutôt qu'un script : Neon n'est joignable ni depuis la
 * machine de dev (proxy) ni depuis un connecteur. Le seul endroit qui a la
 * main sur la base, c'est l'app elle-même.
 *
 * Protégée par NUXT_MIGRATION_SECRET. Le schéma est idempotent
 * (create ... if not exists / create or replace) : rejouable sans risque.
 * Supprimez la variable d'environnement une fois la migration faite.
 */
export default defineEventHandler(async (e) => {
  const attendu = process.env.NUXT_MIGRATION_SECRET || ''
  if (!attendu) throw createError({ statusCode: 404, statusMessage: 'desactive' })
  const fourni = getHeader(e, 'x-migration-secret') || String(getQuery(e).secret ?? '')
  if (fourni !== attendu) throw createError({ statusCode: 403, statusMessage: 'secret_invalide' })

  const sql = await useStorage('assets:server').getItem<string>('schema.sql')
  if (!sql) throw createError({ statusCode: 500, statusMessage: 'schema_introuvable' })

  await (await base()).executer(sql)              // le fichier entier, d'un bloc

  const tables = await q<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`)
  return { ok: true, tables: tables.map(t => t.table_name) }
})
