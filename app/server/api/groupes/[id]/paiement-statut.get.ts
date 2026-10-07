/**
 * L'etat du paiement de la liste, en une ligne : pour que l'app de l'autre
 * parent se mette a jour seule quand l'un des deux a paye, et dise qu'un
 * paiement est en cours au lieu de laisser payer deux fois.
 * Appele souvent (feuille ouverte, mur du jour) : une seule lecture.
 * `avance` : celui qui demande a un déblocage déjà payé qui attend une liste.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const g = await q1<{ paye: boolean; payeur: string | null; par_moi: boolean; par: string | null; pseudo: string | null; jusqu: string | null; avance: boolean }>(
    `select (g.paye_le is not null) as paye, pu.pseudo as payeur, (g.paye_par = ?2) as par_moi,
            case when g.paiement_en_cours_jusqu > ${MAINTENANT} then g.paiement_en_cours_par end as par,
            eu.pseudo as pseudo, g.paiement_en_cours_jusqu as jusqu,
            exists (select 1 from achats_apple a
                     where a.user_id = ?2 and a.transaction_id is not null
                       and a.applique_le is null and a.rembourse_le is null) as avance
       from groupes g
       left join utilisateurs pu on pu.id = g.paye_par
       left join utilisateurs eu on eu.id = g.paiement_en_cours_par
      where g.id = ?1`, [gid, moi.user_id])
  if (!g) throw createError({ statusCode: 404, statusMessage: 'groupe_introuvable' })
  setHeader(e, 'cache-control', 'no-store')
  return {
    paye: !!g.paye,
    par: g.paye ? g.payeur : null,
    // C'est moi qui l'ai payée (ailleurs, ou par un achat confirmé après coup) :
    // l'écran ne m'annonce pas mon propre achat comme celui d'un autre.
    par_moi: !!g.paye && !!g.par_moi,
    en_cours: !g.paye && g.par
      ? { par: g.pseudo, moi: g.par === moi.user_id, jusqu: g.jusqu }
      : null,
    // Un déblocage payé dans l'app iPhone et pas encore appliqué (apple.ts) :
    // il servira à cette liste, sans rien payer de plus. L'écran le dit.
    avance: !g.paye && !!g.avance
  }
})
