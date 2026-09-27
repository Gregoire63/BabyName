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
      // Un lot : la liste et son premier membre, ensemble ou pas du tout.
      const [g] = await lot([
        // Le nombre de blocages secrets est pose ici, pas par la valeur par
        // defaut de la colonne (migration 0002).
        [`insert into groupes (nom, code_invitation, cree_par, filtres, nb_vetos_max)
          values (?1, ?2, ?3, ?4, ?5) returning id`, [n, code, uid, JSON.stringify(f), BLOCAGES_SECRETS]],
        [`insert into membres (groupe_id, user_id, role)
          select id, ?2, 'parent' from groupes where code_invitation = ?1`, [code, uid]]
      ])
      return { id: Number(g!.rows[0].id), nom: n, code_invitation: code }
    } catch (err: any) {
      if (!estDoublon(err)) throw err
    }
  }
  throw createError({ statusCode: 503, statusMessage: 'code_indisponible' })
})
