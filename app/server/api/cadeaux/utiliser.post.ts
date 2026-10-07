/**
 * Se servir d'un code cadeau : débloquer une liste où l'on est, ou en créer
 * une, débloquée d'emblée.
 *
 * Chaque chemin tient en UN lot, et c'est la consommation du code qui ouvre
 * le reste : elle ne réussit qu'une fois (utilise_le is null), et la liste
 * ne s'écrit que si elle a réussi (`changes() = 1`). Deux appareils qui
 * tapent le même code au même instant : un seul débloque, l'autre apprend
 * pourquoi.
 *
 * La liste débloquée porte la référence du paiement du cadeau : un
 * remboursement total la re-verrouille, comme une liste achetée
 * (reprendrePaiement).
 */
export default defineEventHandler(async (e) => {
  // Un code cadeau ne se saisit pas dans une app des stores : il s'utilise
  // sur le site, et la liste est débloquée partout (utils/vente.ts).
  refuserDansUneApp(e)
  const uid = await exigerUtilisateur(e)
  await limiter(e, 'cadeau-utiliser', uid, 20, 3600)
  const corps = await readBody<{ code?: unknown; groupe?: unknown; nouvelle?: unknown;
                                  nom?: unknown; filtres?: unknown }>(e) ?? {}
  const code = normaliserCodeCadeau(corps.code)
  if (!code) throw createError({ statusCode: 400, statusMessage: 'code_invalide' })
  const h = empreinteCadeau(code)
  const valable = `code_hash = ?1 and utilise_le is null and annule_le is null and expire_le > ${MAINTENANT}`

  // --- une liste qui existe déjà ------------------------------------------
  if (corps.groupe !== undefined && corps.groupe !== null) {
    const gid = Number(corps.groupe)
    if (!Number.isInteger(gid) || gid <= 0) throw createError({ statusCode: 400, statusMessage: 'groupe_invalide' })
    // Membre, quel que soit son rôle : c'est la règle du paiement d'une liste
    // (paiement.post.ts) — on offre à la liste, pas à une personne.
    await exigerMembre(e, gid)
    const [pris] = await lot([
      [`update cadeaux set utilise_le = ${MAINTENANT}, utilise_par = ?2, groupe_id = ?3
         where ${valable}
           and exists (select 1 from groupes where id = ?3 and paye_le is null)
        returning 1`, [h, uid, gid]],
      [`update groupes set paye_le = ${MAINTENANT}, paye_par = null, offert = 0,
              paiement_ref = (select paiement_ref from cadeaux where code_hash = ?1)
         where id = ?2 and paye_le is null and changes() = 1`, [h, gid]]
    ])
    if (!pris!.rows.length) await refusCadeau(h, gid)
    // Les autres membres apprennent que leur limite est tombée (server/utils/push.ts).
    enFond(e, prevenirDeblocage(gid, uid))
    return { ok: true, groupe: gid }
  }

  // --- une liste neuve ----------------------------------------------------
  if (corps.nouvelle !== true) throw createError({ statusCode: 400, statusMessage: 'liste_a_choisir' })
  await limiter(e, 'liste-creation', uid, 20, 86400)
  const nom = (typeof corps.nom === 'string' ? corps.nom : '').trim().slice(0, 60) || 'Notre liste'
  const filtres = JSON.stringify(objetBorne(corps.filtres))
  // Collision de code d'invitation (30^10, quasi impossible) : le lot entier
  // échoue, le cadeau n'est pas consommé, on retente avec un autre.
  for (let i = 0; i < 5; i++) {
    const invit = nouveauCodeInvitation()
    try {
      const [pris, g] = await lot([
        [`update cadeaux set utilise_le = ${MAINTENANT}, utilise_par = ?2
           where ${valable} returning 1`, [h, uid]],
        [`insert into groupes (nom, code_invitation, cree_par, filtres, nb_vetos_max, paye_le, paiement_ref)
          select ?1, ?2, ?3, ?4, ?5, ${MAINTENANT}, (select paiement_ref from cadeaux where code_hash = ?6)
           where changes() = 1
          returning id`, [nom, invit, uid, filtres, BLOCAGES_SECRETS, h]],
        [`insert into membres (groupe_id, user_id, role)
          select id, ?2, 'parent' from groupes where code_invitation = ?1`, [invit, uid]],
        [`update cadeaux set groupe_id = (select id from groupes where code_invitation = ?2)
           where code_hash = ?1 and utilise_par = ?3 and groupe_id is null`, [h, invit, uid]]
      ])
      if (!pris!.rows.length) await refusCadeau(h)
      return { ok: true, groupe: Number(g!.rows[0]!.id), nouvelle: true }
    } catch (err: any) {
      if (!estDoublon(err)) throw err
    }
  }
  throw createError({ statusCode: 503, statusMessage: 'code_indisponible' })
})
