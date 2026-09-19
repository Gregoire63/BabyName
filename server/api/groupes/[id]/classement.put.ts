/** Remplace le top-N manuel (glisser-déposer). Transactionnel : on ne laisse
 *  jamais un classement à moitié écrit. */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const { ordre } = await readBody<{ ordre?: string[] }>(e) ?? {}
  if (!Array.isArray(ordre)) throw createError({ statusCode: 400, statusMessage: 'ordre_manquant' })
  if (ordre.length > 20) throw createError({ statusCode: 400, statusMessage: 'max_20' })
  if (new Set(ordre).size !== ordre.length) throw createError({ statusCode: 400, statusMessage: 'doublons' })

  const client = await db().connect()
  try {
    await client.query('begin')
    await client.query(`delete from classement_manuel where groupe_id=$1 and user_id=$2`, [gid, moi.user_id])
    for (let i = 0; i < ordre.length; i++) {
      await client.query(
        `insert into classement_manuel (groupe_id, user_id, prenom, position) values ($1,$2,$3,$4)`,
        [gid, moi.user_id, ordre[i], i + 1])
    }
    await client.query('commit')
  } catch (err) {
    await client.query('rollback'); throw err
  } finally {
    client.release()
  }
  return { ok: true, n: ordre.length }
})
