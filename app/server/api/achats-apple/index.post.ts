/**
 * Un achat fait dans l'app iOS, présenté au serveur.
 *
 * L'app n'apporte qu'un numéro de transaction. Le serveur le relit chez
 * Apple, et c'est Apple qui dit le reste (server/utils/apple.ts) : rien de ce
 * que l'app ou la page ajouterait n'est cru. D'où un corps d'une seule clé.
 *
 * Appelé juste après l'achat, et à chaque lancement de l'app pour les
 * transactions restées en suspens (l'app fermée en plein achat, un achat
 * validé plus tard par un parent). Rejouable : la même transaction ne
 * débloque qu'une fois.
 *
 * Ce que l'app en fait : sur une réponse 200, elle dit à StoreKit que la
 * transaction est traitée (`finir`) — sauf `etrangere`, qu'elle garde. Sur
 * `transaction_inconnue` ou une panne, elle la garde aussi : elle reviendra
 * au prochain lancement.
 */
export default defineEventHandler(async (e) => {
  const moi = await exigerUtilisateur(e)
  await limiter(e, 'achat-apple-valider', moi, 40, 600)

  const { transaction } = await readBody<{ transaction?: unknown }>(e).catch(() => null) ?? {}
  const id = String(transaction ?? '')
  if (!TRANSACTION_APPLE.test(id)) throw createError({ statusCode: 400, statusMessage: 'transaction_invalide' })

  const t = await lireTransactionApple(id)
  if (!t) throw createError({ statusCode: 404, statusMessage: 'transaction_inconnue' })

  // Une transaction d'Apple, mais pas pour ce que l'on vend ici (`etrangere`) :
  // on ne débloque rien. L'app ne la clôt pas pour autant — payée, elle doit
  // rester présentable, pour le jour où ce réglage la reconnaîtrait.
  const { produit, paquet } = produitApple()
  if (t.bundleId !== paquet || t.productId !== produit) {
    console.warn('[apple] transaction étrangère', { paquet: t.bundleId, produit: t.productId })
    return { ok: true, etat: 'etrangere' as const, groupe: null }
  }

  const r = await synchroniserApple(t, moi)
  // Les autres membres apprennent que leur limite est tombée.
  if (r.nouveau && r.groupe) enFond(e, prevenirDeblocage(r.groupe, r.par ?? moi))
  if (r.etat !== 'rembourse') console.info('[apple] achat', r.etat, { liste: r.groupe, bac: t.environment === 'Sandbox' })
  return { ok: true, etat: r.etat, groupe: r.groupe }
})
