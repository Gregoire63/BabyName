/**
 * Le lien de l'e-mail a ete ouvert (page /connexion/lien) : on le consomme.
 *
 *  - lien de CONNEXION : cet appareil est connecte au compte ;
 *  - lien d'INSCRIPTION : le compte nait (adresse prouvee), et cet appareil
 *    y est connecte ;
 *  - lien de VERIFICATION (adresse ajoutee depuis « Mon compte ») : l'adresse
 *    devient celle du compte. L'appareil qui l'ouvre n'est PAS connecte pour
 *    autant — il a prouve une boite mail, pas demande a entrer.
 */
export default defineEventHandler(async (e) => {
  await limiter(e, 'lien-valider', ipDe(e), 30, 600)
  const { jeton } = await readBody<{ jeton?: string }>(e) ?? {}
  const l = await consommerJeton(String(jeton ?? ''))
  if (!l) throw createError({ statusCode: 400, statusMessage: 'lien_invalide' })

  if (l.but === 'verification') {
    await enregistrerEmail(l.user_id!, l.email)
    return { but: 'verification', email: l.email }
  }
  if (l.but === 'inscription') {
    const u = await ouvrirCompteInscrit(l.email, l.pseudo ?? '')
    poserSession(e, u.id, u.gen)
    return { but: 'inscription', nouveau: u.nouveau, utilisateur: { id: u.id, pseudo: u.pseudo } }
  }
  const u = await q1<{ id: string; pseudo: string; gen: number }>(
    `update utilisateurs set vu_le = ${MAINTENANT} where id = ?1 and email = ?2
     returning id, pseudo, session_gen as gen`, [l.user_id, l.email])
  // L'adresse a change entre l'envoi et le clic : le lien ne vaut plus.
  if (!u) throw createError({ statusCode: 400, statusMessage: 'lien_invalide' })
  poserSession(e, u.id, u.gen)
  return { but: 'connexion', utilisateur: { id: u.id, pseudo: u.pseudo } }
})
