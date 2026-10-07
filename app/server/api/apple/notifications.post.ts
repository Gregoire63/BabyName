/**
 * Le courrier d'Apple (App Store Server Notifications, version 2).
 *
 * Apple écrit ici quand quelque chose arrive à un achat. Deux courriers nous
 * importent :
 *  - un REMBOURSEMENT, qu'il accorde lui-même, sans nous demander (REFUND, et
 *    REFUND_REVERSED s'il revient dessus). Sans ce courrier, une liste
 *    remboursée resterait débloquée ;
 *  - l'ACHAT lui-même (ONE_TIME_CHARGE), qu'Apple nous annonce de son côté,
 *    au moment où il encaisse. L'app nous le présente d'ordinaire dans la
 *    seconde ; mais si elle a été fermée entre le paiement et le déblocage,
 *    ou si l'achat a été validé plus tard par un tiers (« Demander à
 *    acheter »), ce courrier débloque la liste sans attendre que l'app soit
 *    rouverte sur ce téléphone.
 *
 * ON NE CROIT PAS CE COURRIER, on s'en sert comme d'une sonnette. N'importe
 * qui peut poster ici : le message n'est lu que pour savoir DE QUELLE
 * transaction il parle, et l'état de cette transaction se relit chez Apple,
 * avec notre clé (server/utils/apple.ts). Un faux courrier ne peut donc que
 * nous faire relire une vraie transaction — et seulement une que l'on
 * attend, pour ne pas servir à harceler Apple : une transaction déjà connue,
 * ou qui dit porter le jeton d'une feuille d'achat encore ouverte (un UUID
 * tiré par nous, que seule l'app de l'acheteur connaît). Dans ce second cas,
 * c'est le jeton rendu par APPLE qui compte, pas celui que le courrier
 * affiche.
 *
 * L'adresse se règle dans App Store Connect (l'app → Informations sur l'app
 * → Notifications du serveur App Store), production et bac à sable.
 *
 * Toujours 200, sauf si l'on n'a pas pu relire : Apple renverra alors.
 */
const JETON = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
const attendu = (jeton: string) =>
  q1<{ ok: number }>(`select 1 as ok from achats_apple where jeton = ?1 and transaction_id is null`, [jeton])

export default defineEventHandler(async (e) => {
  await limiter(e, 'apple-courrier', ipDe(e), 240, 60)
  const corps = await readBody<{ signedPayload?: unknown }>(e).catch(() => null)
  const message = contenuJws(corps?.signedPayload)
  const annonce = contenuJws(message?.data?.signedTransactionInfo)
  const id = String(annonce?.transactionId ?? '')
  if (!TRANSACTION_APPLE.test(id)) return { ok: true, ignore: 'sans_transaction' }

  const connue = await q1<{ ok: number }>(`select 1 as ok from achats_apple where transaction_id = ?1`, [id])
  if (!connue) {
    // Pas encore présentée par l'app. On ne dérange Apple que si le courrier
    // dit porter le jeton d'une feuille d'achat que nous avons ouverte.
    const dit = String(annonce?.appAccountToken ?? '').toLowerCase()
    if (!JETON.test(dit) || !(await attendu(dit))) return { ok: true, ignore: 'transaction_inconnue' }
  }

  const t = await lireTransactionApple(id)
  if (!t) return { ok: true, ignore: 'introuvable_chez_apple' }
  if (!connue) {
    // Ce que le courrier affichait ne compte plus : seuls le produit et le
    // jeton rendus par Apple désignent une liste. Sans cela, un faux courrier
    // ferait enregistrer au nom de personne une transaction qui revient à qui
    // la présentera — ou débloquer une liste par l'achat d'autre chose.
    const { produit, paquet } = produitApple()
    const rendu = String(t.appAccountToken ?? '').toLowerCase()
    if (t.bundleId !== paquet || t.productId !== produit || !JETON.test(rendu) || !(await attendu(rendu))) {
      return { ok: true, ignore: 'transaction_inconnue' }
    }
  }
  const r = await synchroniserApple(t, null)
  if (r.etat === 'rembourse') console.info('[apple] achat remboursé', { liste: r.groupe })
  else if (!connue) console.info('[apple] achat annoncé par Apple', r.etat, { liste: r.groupe, bac: t.environment === 'Sandbox' })
  return { ok: true, etat: r.etat }
})
