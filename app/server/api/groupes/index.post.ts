import { randomBytes } from 'node:crypto'
export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  const { nom, filtres } = await readBody<{ nom?: string; filtres?: any }>(e) ?? {}
  // Le nom est facultatif : on cherche un prenom pour UN bebe, on sait
  // lequel. Il ne sert qu'a distinguer plusieurs listes, cas rare.
  const n = (nom ?? '').trim().slice(0, 60) || 'Notre liste'
  const code = randomBytes(4).toString('hex')
  // Les filtres sont poses des la creation : sans eux le premier ecran de tri
  // montre les prenoms les plus courants de France, ce qui n'aide personne.
  const g = await q1<{ id: number }>(
    `insert into groupes (nom, code_invitation, cree_par, filtres)
     values ($1, $2, $3, $4) returning id`,
    [n, code, uid, JSON.stringify(filtres ?? {})])
  await q(`insert into membres (groupe_id, user_id, role) values ($1, $2, 'parent')`, [g!.id, uid])
  return { id: g!.id, nom: n, code_invitation: code }
})
