/**
 * Creer une liste. Son code d'invitation suit le format long
 * (shared/utils/codes.ts) ; les filtres sont bornes (validation.ts) ; et un
 * compte ne cree pas des listes a la chaine (20 par jour, bien au-dela de
 * tout usage : on cherche un prenom pour UN bebe).
 */
export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  await limiter(e, 'liste-creation', uid, 20, 86400)
  const { nom, filtres } = await readBody<{ nom?: string; filtres?: any }>(e) ?? {}
  // Le nom est facultatif : on cherche un prenom pour UN bebe, on sait
  // lequel. Il ne sert qu'a distinguer plusieurs listes, cas rare.
  const n = (typeof nom === 'string' ? nom : '').trim().slice(0, 60) || 'Notre liste'
  const f = objetBorne(filtres)
  // Les filtres sont poses des la creation : sans eux le premier ecran de tri
  // montre les prenoms les plus courants de France, ce qui n'aide personne.
  // Collision de code : 30^10 valeurs, quasi impossible — mais `unique` la
  // rendrait fatale, on retente plutot que de renvoyer une 500.
  for (let i = 0; i < 5; i++) {
    const code = nouveauCodeInvitation()
    try {
      const g = await transaction(async (c) => {
        const { rows } = await c.query(
          `insert into groupes (nom, code_invitation, cree_par, filtres)
           values ($1, $2, $3, $4) returning id`, [n, code, uid, JSON.stringify(f)])
        await c.query(`insert into membres (groupe_id, user_id, role) values ($1, $2, 'parent')`,
          [rows[0].id, uid])
        return rows[0]
      })
      return { id: Number(g.id), nom: n, code_invitation: code }
    } catch (err: any) {
      if (err?.code !== '23505') throw err
    }
  }
  throw createError({ statusCode: 503, statusMessage: 'code_indisponible' })
})
