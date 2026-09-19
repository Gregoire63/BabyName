export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const bruts = String(getQuery(e).prenoms ?? '').split(',').filter(Boolean).slice(0, 500)
  return { votes: await votesVisibles(gid, moi.user_id, bruts.length ? bruts : undefined) }
})
