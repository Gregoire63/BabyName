/**
 * Avant d'ouvrir la feuille d'achat de l'App Store (app iOS seulement).
 *
 * Rien n'est encore payé ici. On vérifie que l'achat a un sens, on prend la
 * place (un seul paiement à la fois par liste, Stripe ou Apple : migration
 * 0009), et on tire le JETON que l'app confiera à StoreKit. Apple le rendra
 * dans la transaction signée : c'est par lui que le serveur saura quelle
 * liste débloquer, sans rien croire de ce que l'app dira ensuite
 * (server/utils/apple.ts).
 *
 * Un déblocage déjà payé et jamais appliqué — la liste visée venait d'être
 * débloquée par l'autre parent — sert ici, tout de suite, sans nouvel achat.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  exigerAppIos(e)
  await limiter(e, 'achat-apple', moi.user_id, 30, 3600)

  const lire = () => q1<{ paye: boolean; par: string | null; sess: string | null; actif: boolean }>(
    `select (paye_le is not null) as paye,
            paiement_en_cours_par as par, paiement_en_cours_session as sess,
            (paiement_en_cours_jusqu > ${MAINTENANT}) as actif
       from groupes where id = ?1`, [gid])
  const g = await lire()
  if (!g) throw createError({ statusCode: 404, statusMessage: 'groupe_introuvable' })
  if (g.paye) return { ok: true, deja: true }

  if (!applePret()) throw createError({ statusCode: 503, statusMessage: 'paiement_non_configure' })
  if (!venteOuverte()) throw createError({ statusCode: 503, statusMessage: 'vente_fermee' })

  if (await utiliserAvanceApple(moi.user_id, gid)) return { ok: true, deja: true, avance: true }

  // Apple encaisse sans nous demander notre avis : si l'on ne peut pas, à cet
  // instant, vérifier un achat chez lui (son API en panne, notre clé refusée),
  // on n'ouvre pas sa feuille. Mieux vaut « réessayez » qu'un achat payé et
  // pas débloqué.
  if (!(await appleRepond())) throw createError({ statusCode: 503, statusMessage: 'achat_indisponible' })

  // L'autre parent est en train de payer (sur le site, ou dans son app) :
  // on attend, sinon on paie deux fois.
  if (g.actif && g.par && g.par !== moi.user_id) throw await enCours(g.par, gid)
  // Ma propre page de paiement Stripe, restée ouverte ailleurs : elle ne
  // doit plus pouvoir encaisser pendant que j'achète ici.
  if (g.actif && g.par === moi.user_id && g.sess) await expirerSession(g.sess)

  // Prendre la place, atomiquement. Dix minutes : la feuille d'Apple se
  // traite en quelques secondes, et la place se rend d'elle-même sinon.
  const pris = await ecrire(
    `update groupes set paiement_en_cours_par = ?2, paiement_en_cours_session = null,
                        paiement_en_cours_jusqu = ${decale('+10 minutes')}
      where id = ?1 and paye_le is null
        and (paiement_en_cours_par is null or paiement_en_cours_par = ?2
             or paiement_en_cours_jusqu is null or paiement_en_cours_jusqu <= ${MAINTENANT})`,
    [gid, moi.user_id])
  if (!pris.changes) {
    const apres = await lire()
    if (apres?.paye) return { ok: true, deja: true }
    throw await enCours(apres?.par ?? null, gid)
  }

  const jeton = crypto.randomUUID()
  await ecrire(`insert into achats_apple (jeton, user_id, groupe_id) values (?1, ?2, ?3)`,
    [jeton, moi.user_id, gid])
  return { ok: true, jeton, produit: produitApple().produit }
})

async function enCours(uid: string | null, gid: number) {
  const par = uid
    ? (await q1<{ pseudo: string | null }>(`select pseudo from utilisateurs where id = ?1`, [uid]))?.pseudo ?? null
    : null
  return createError({ statusCode: 409, statusMessage: 'paiement_en_cours', data: { par, groupe: gid } })
}
