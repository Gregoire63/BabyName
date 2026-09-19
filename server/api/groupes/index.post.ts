import { randomBytes } from 'node:crypto'
export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  const { nom } = await readBody<{ nom?: string }>(e) ?? {}
  const n = (nom ?? '').trim().slice(0, 60) || 'Notre liste'
  const code = randomBytes(4).toString('hex')
  const g = await q1<{ id: number }>(
    `insert into groupes (nom, code_invitation, cree_par) values ($1, $2, $3) returning id`,
    [n, code, uid])
  await q(`insert into membres (groupe_id, user_id, role) values ($1, $2, 'parent')`, [g!.id, uid])
  return { id: g!.id, nom: n, code_invitation: code }
})
