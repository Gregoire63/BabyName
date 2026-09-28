/**
 * Entrer comme un compte du jeu d'essai — Paul, Alice, Mamie… — par son
 * prénom : le bloc « Base locale » de la page de connexion, et les essais.
 *
 * Les comptes semés n'ont ni passkey, ni (sauf Alice) d'adresse : depuis que
 * la clé d'accès est partie (migration 0007), c'est leur seule porte.
 * DÉVELOPPEMENT SEULEMENT, base locale seulement (voir utils/dev.ts).
 *
 * Le PREMIER compte de ce prénom : les essais en créent d'autres à la volée
 * (auth/entrer.post.ts), toujours après la semaille. Aucun : 404 — c'est ce
 * que vérifie un essai après une purge ou un effacement.
 */
export default defineEventHandler(async (e) => {
  // En ligne : au build, tout ce qui suit sort du bundle (voir base.get.ts).
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'introuvable' })
  const b = await exigerBaseLocale()
  const { pseudo } = await readBody<{ pseudo?: string }>(e) ?? {}
  if (!pseudo) throw createError({ statusCode: 400, statusMessage: 'pseudo_manquant' })
  const u = await b.q1<{ id: string; gen: number }>(
    `select id, session_gen as gen from utilisateurs where pseudo = ?1 order by rowid limit 1`, [pseudo])
  if (!u) throw createError({ statusCode: 404, statusMessage: 'compte_absent' })
  poserSession(e, u.id, u.gen)
  return { utilisateur: { id: u.id, pseudo } }
})
