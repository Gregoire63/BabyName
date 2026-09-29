/**
 * La reservation de paiement d'une liste (voir migration 0009).
 * Liberee au paiement (livrer), a l'abandon (annuler-paiement.post.ts), ou
 * d'elle-meme a l'echeance de la page Stripe.
 */
export async function liberer(gid: number, uid: string) {
  await ecrire(
    `update groupes set paiement_en_cours_par = null, paiement_en_cours_session = null,
                        paiement_en_cours_jusqu = null
      where id = ?1 and paiement_en_cours_par = ?2`, [gid, uid])
}
