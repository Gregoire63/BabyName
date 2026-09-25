export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const { prenom, actif } = await readBody<{ prenom?: string; actif?: boolean }>(e) ?? {}
  prenomValide(prenom)
  if (actif === false) {
    await ecrire(`delete from favoris where groupe_id = ?1 and user_id = ?2 and prenom = ?3`, [gid, moi.user_id, prenom])
  } else {
    await ecrire(`insert into favoris (groupe_id, user_id, prenom) values (?1, ?2, ?3) on conflict do nothing`,
      [gid, moi.user_id, prenom])
  }
  return { ok: true }
})
