/**
 * Droit a l'effacement (RGPD, art. 17) — immediat, depuis l'app, sans ecrire
 * a personne.
 *
 * Ce qui part : le compte, ses votes, vetos, favoris, duels, classements,
 * commentaires et compteurs, dans toutes ses listes (cascade depuis
 * `membres`). Les listes ou il ne reste plus personne partent aussi, payees
 * ou non : une liste sans membre n'est plus les donnees de personne.
 *
 * Ce qui reste : les listes des AUTRES. L'autre parent garde les siennes, ses
 * votes, et le deblocage s'il avait eu lieu — effacer ses propres donnees ne
 * doit pas effacer celles de quelqu'un d'autre. (C'est ce que corrige le bloc
 * RGPD du schema : avant lui, effacer le createur effacait la liste.)
 *
 * Confirmation tapee en toutes lettres : c'est irreversible, et un double
 * appui trop rapide sur un telephone ne doit pas suffire.
 */
export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  const { confirmation } = await readBody<{ confirmation?: string }>(e) ?? {}
  if (String(confirmation ?? '').trim().toUpperCase() !== 'SUPPRIMER') {
    throw createError({ statusCode: 400, statusMessage: 'confirmation_requise' })
  }

  const ids = (await q<{ groupe_id: number }>(
    `select groupe_id from membres where user_id = ?1`, [uid])).map(r => Number(r.groupe_id))
  // Un lot : le compte (et, en cascade, tout ce qui lui appartient), puis les
  // listes ou il ne reste plus personne — ensemble ou pas du tout.
  const [, vides] = await lot([
    [`delete from utilisateurs where id = ?1`, [uid]],
    [`delete from groupes
       where id in ${DANS(1)}
         and not exists (select 1 from membres m where m.groupe_id = groupes.id)
      returning id`, [ids]]
  ])
  // Les lignes renvoyees, pas `changes` : D1 y compte aussi les cascades.
  const bilan = { listes_effacees: vides!.rows.length, listes_laissees_aux_autres: ids.length - vides!.rows.length }

  retirerSession(e)
  return { ok: true, ...bilan }
})
