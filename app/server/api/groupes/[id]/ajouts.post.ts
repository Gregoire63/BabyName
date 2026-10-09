/**
 * Ajouter à la liste un prénom que le catalogue n'a pas.
 *
 * La recherche ne trouve que ce que l'INSEE publie pour les trois dernières
 * années. Le prénom d'une arrière-grand-mère, une graphie à soi, un prénom
 * inventé : on l'ajoute, et il devient une carte du tri pour TOUTE la liste —
 * en tête de pile, quels que soient les réglages de chacun, puisque quelqu'un
 * l'a choisi exprès. Ensuite, c'est un prénom comme un autre : votes à
 * l'aveugle, vetos, favoris, commentaires ne connaissent qu'un prénom écrit.
 *
 * Ce n'est pas un vote : l'auteur juge sa carte comme tout le monde. Mais ce
 * n'est pas un secret non plus — la carte dit qui l'a ajoutée, avec son mot.
 * Proposer un prénom, c'est déjà dire qu'on y pense ; le cacher aurait été
 * prétendre le contraire.
 *
 * Décideurs seulement : un observateur ne met rien dans la pile des autres.
 * Le même prénom à la casse près (« jeannine », « Jeannine ») est le même :
 * on rend celui qui est déjà là, sans erreur — deux parents qui ont eu la même
 * idée ne doivent pas se le voir refuser.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  if (moi.role === 'observateur') {
    throw createError({ statusCode: 403, statusMessage: 'observateur_lecture_seule' })
  }
  await limiter(e, 'ajout', moi.user_id, 60, 3600)
  const { prenom, mot } = await readBody<{ prenom?: unknown; mot?: unknown }>(e) ?? {}
  const nom = ecrireAjout(prenom)
  if (!nom) throw createError({ statusCode: 400, statusMessage: 'prenom_invalide' })
  const texte = typeof mot === 'string'
    ? mot.replace(/\s+/g, ' ').trim().slice(0, MOT_AJOUT_MAX) || null : null

  // Deux cents lignes au plus (le trigger de la migration 0013) : les relire
  // coûte moins qu'une comparaison sans casse en SQL, qui ignore les accents.
  const deja = (await q<{ prenom: string }>(
    `select prenom from prenoms_ajoutes where groupe_id = ?1`, [gid])).find(d => memeAjout(d.prenom, nom))
  if (deja) return { ok: true, prenom: deja.prenom, deja: true }
  try {
    await ecrire(`insert into prenoms_ajoutes (groupe_id, prenom, user_id, mot) values (?1, ?2, ?3, ?4)`,
      [gid, nom, moi.user_id, texte])
  } catch (err: any) {
    if (String(err?.message).includes('ajouts_plein')) {
      throw createError({ statusCode: 409, statusMessage: 'ajouts_plein' })
    }
    // Ajouté au même instant par un autre membre : c'est le même.
    if (estDoublon(err)) return { ok: true, prenom: nom, deja: true }
    throw err
  }
  enFond(e, prevenirAjout(gid, moi.user_id))
  return { ok: true, prenom: nom }
})
