/**
 * Quitter une liste.
 *
 * Ce qu'on y a donné part avec soi, en cascade depuis `membres` : votes,
 * blocages, favoris, classements, commentaires. Les prénoms « déjà pris »
 * qu'on y a ajoutés restent à la liste, sans son nom ni sa note — comme à
 * l'effacement du compte (trigger trg_deja_pris_sans_auteur, migration 0002).
 * Le déblocage reste acquis aux autres, même si c'est soi qui l'avait payé.
 *
 * Le propriétaire peut partir aussi : la liste passe au plus ancien de ceux
 * qui décident (server/utils/proprietaire.ts). Si plus personne n'y décide,
 * la liste part : des observateurs seuls n'ont plus rien à regarder.
 *
 * `confirmation: 'QUITTER'` : l'écran demande confirmation, le serveur
 * refuse un appel qui ne l'a pas passée.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const { confirmation } = await readBody<{ confirmation?: string }>(e) ?? {}
  if (String(confirmation ?? '').trim().toUpperCase() !== 'QUITTER') {
    throw createError({ statusCode: 400, statusMessage: 'confirmation_requise' })
  }
  const [, , vide] = await lot([
    [`update deja_pris set user_id = null where groupe_id = ?1 and user_id = ?2`, [gid, moi.user_id]],
    [`delete from membres where groupe_id = ?1 and user_id = ?2`, [gid, moi.user_id]],
    [`delete from groupes
       where id = ?1
         and not exists (select 1 from membres m where m.groupe_id = ?1 and m.role <> 'observateur')
      returning id`, [gid]]
  ])
  return { ok: true, liste_supprimee: vide!.rows.length > 0 }
})
