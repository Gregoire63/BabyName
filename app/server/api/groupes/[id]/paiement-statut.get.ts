/**
 * L'etat du paiement de la liste, en une ligne : pour que l'app de l'autre
 * parent se mette a jour seule quand l'un des deux a paye, et dise qu'un
 * paiement est en cours au lieu de laisser payer deux fois.
 * Appele souvent (feuille ouverte, mur du jour) : une seule lecture.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const g = await q1<{ paye: boolean; payeur: string | null; par: string | null; pseudo: string | null; jusqu: string | null }>(
    `select (g.paye_le is not null) as paye, pu.pseudo as payeur,
            case when g.paiement_en_cours_jusqu > ${MAINTENANT} then g.paiement_en_cours_par end as par,
            eu.pseudo as pseudo, g.paiement_en_cours_jusqu as jusqu
       from groupes g
       left join utilisateurs pu on pu.id = g.paye_par
       left join utilisateurs eu on eu.id = g.paiement_en_cours_par
      where g.id = ?1`, [gid])
  if (!g) throw createError({ statusCode: 404, statusMessage: 'groupe_introuvable' })
  setHeader(e, 'cache-control', 'no-store')
  return {
    paye: !!g.paye,
    par: g.paye ? g.payeur : null,
    en_cours: !g.paye && g.par
      ? { par: g.pseudo, moi: g.par === moi.user_id, jusqu: g.jusqu }
      : null
  }
})
