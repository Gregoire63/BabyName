import { liberer } from '../../../utils/reservation'
/**
 * Ouvre une page de paiement Stripe pour cette liste.
 *
 * L'app ne voit jamais de carte : elle demande une session à Stripe et renvoie
 * l'URL de la page hébergée par Stripe. Le déblocage, lui, ne vient pas de ce
 * retour — il vient du webhook signé. Un navigateur qui revient sur
 * `?paye=1` n'a rien prouvé.
 */
export default defineEventHandler(async (e) => {
  refuserDansUneApp(e)   // rien ne se vend dans une app des stores (utils/vente.ts)
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)

  const g = await q1<{ paye: boolean; nom: string; par: string | null; sess: string | null; actif: boolean }>(
    `select (paye_le is not null) as paye, nom,
            paiement_en_cours_par as par, paiement_en_cours_session as sess,
            (paiement_en_cours_jusqu > ${MAINTENANT}) as actif
       from groupes where id = ?1`, [gid])
  if (!g) throw createError({ statusCode: 404, statusMessage: 'groupe_introuvable' })
  if (g.paye) return { ok: true, deja: true, par: await payeurDe(gid) }

  /**
   * Un déblocage déjà payé dans l'app iPhone et jamais appliqué — la liste
   * visée venait d'être débloquée par quelqu'un d'autre — sert d'abord, ici
   * aussi (server/utils/apple.ts). On a promis qu'il « débloquera une autre
   * de vos listes » : le faire payer une seconde fois parce qu'il est passé
   * par le site trahirait la promesse. Ce n'est pas une vente — ni case
   * d'accord, ni Stripe.
   */
  if (applePret() && await utiliserAvanceApple(moi.user_id, gid)) {
    return { ok: true, deja: true, avance: true }
  }

  if (!paiementPret()) {
    throw createError({ statusCode: 503, statusMessage: 'paiement_non_configure' })
  }
  if (!venteOuverte()) {
    throw createError({ statusCode: 503, statusMessage: 'vente_fermee' })
  }

  /**
   * Le consentement, exige ICI et pas seulement par la case de l'ecran.
   *
   * Un contenu numerique livre tout de suite ne se retracte pas — mais
   * seulement si l'acheteur l'a demande expressement ET a reconnu perdre son
   * droit de retractation (art. L221-28 13°). Une case que le serveur ne
   * verifie pas se contourne d'un appel direct : sans elle, l'acheteur garde
   * ses quatorze jours sur une liste deja utilisee.
   */
  const corps = await readBody<{ consentement?: boolean }>(e).catch(() => null)
  if (corps?.consentement !== true) {
    throw createError({ statusCode: 400, statusMessage: 'consentement_requis' })
  }

  // Le retour de la page de paiement se fait la ou l'on est (sur Cloudflare,
  // forcement l'un des noms du Worker) ; la facture, elle, cite l'adresse
  // officielle du site.
  /**
   * Un paiement deja ouvert sur cette liste. On ne croit pas la reservation
   * sur parole : on relit la page chez Stripe.
   *  - payee (le webhook n'est pas encore passe) : on livre, c'est debloque ;
   *  - encore ouverte : c'est la mienne, je la reprends ; celle de l'autre
   *    parent, j'attends — sinon on paie deux fois ;
   *  - expiree, ou disparue : la place est libre.
   */
  let libre = !g.actif || !g.par
  if (!libre && g.sess) {
    const s = await lireSession(g.sess).catch(() => null)
    if (s?.status === 'complete') {
      await livrer(s)
      const apres = await q1<{ paye: boolean }>(
        `select (paye_le is not null) as paye from groupes where id = ?1`, [gid])
      if (apres?.paye) return { ok: true, deja: true, par: await payeurDe(gid) }
    }
    if (s?.status === 'open') {
      if (g.par === moi.user_id && s.url) return { ok: true, url: s.url as string }
    } else {
      libre = true
    }
  }
  if (!libre && g.par !== moi.user_id) throw paiementEnCours(await pseudoDe(g.par!), gid)

  /**
   * Prendre la place, atomiquement : la ligne ne change que si personne ne
   * l'a prise depuis la lecture ci-dessus. Deux clics dans la meme seconde,
   * un seul passe ; l'autre voit « paiement en cours ».
   * Deux minutes le temps de creer la page, puis l'echeance de la page.
   */
  const pris = await ecrire(
    `update groupes set paiement_en_cours_par = ?2, paiement_en_cours_session = null,
                        paiement_en_cours_jusqu = ${decale('+2 minutes')}
      where id = ?1 and paye_le is null
        and coalesce(paiement_en_cours_par, '') = ?3
        and coalesce(paiement_en_cours_session, '') = ?4`,
    [gid, moi.user_id, g.par ?? '', g.sess ?? ''])
  if (!pris.changes) {
    const autre = await q1<{ paye: boolean; par: string | null }>(
      `select (paye_le is not null) as paye, paiement_en_cours_par as par from groupes where id = ?1`, [gid])
    if (autre?.paye) return { ok: true, deja: true, par: await payeurDe(gid) }
    throw paiementEnCours(await pseudoDe(autre?.par ?? null), gid)
  }

  // Le retour de la page de paiement se fait la ou l'on est (sur Cloudflare,
  // forcement l'un des noms du Worker) ; la facture, elle, cite l'adresse
  // officielle du site.
  const retour = getRequestURL(e).origin
  const siteUrl = String(useRuntimeConfig().public.siteUrl || '').replace(/\/$/, '') || retour
  // 31 minutes : Stripe refuse moins de 30.
  const expireA = Math.floor(Date.now() / 1000) + 31 * 60
  let session: any
  try {
    session = await creerSession({
      gid, uid: moi.user_id, siteUrl, retour, consentementLe: new Date().toISOString(), expireA
    })
  } catch (err) {
    await liberer(gid, moi.user_id)
    throw err
  }
  await ecrire(
    `update groupes set paiement_en_cours_session = ?3, paiement_en_cours_jusqu = ?4
      where id = ?1 and paiement_en_cours_par = ?2`,
    [gid, moi.user_id, session.id, new Date(expireA * 1000).toISOString()])
  return { ok: true, url: session.url as string }
})

async function pseudoDe(uid: string | null): Promise<string | null> {
  if (!uid) return null
  return (await q1<{ pseudo: string | null }>(`select pseudo from utilisateurs where id = ?1`, [uid]))?.pseudo ?? null
}
async function payeurDe(gid: number): Promise<string | null> {
  return (await q1<{ pseudo: string | null }>(
    `select u.pseudo from groupes g join utilisateurs u on u.id = g.paye_par where g.id = ?1`, [gid]))?.pseudo ?? null
}
function paiementEnCours(par: string | null, gid: number) {
  return createError({ statusCode: 409, statusMessage: 'paiement_en_cours', data: { par, groupe: gid } })
}
