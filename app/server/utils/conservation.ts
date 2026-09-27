/**
 * Durees de conservation (RGPD, art. 5.1.e) — et la purge qui les applique.
 *
 * Une duree ecrite dans la politique de confidentialite et jamais appliquee
 * est une promesse fausse. Celles-ci sont appliquees chaque nuit par la
 * tache planifiee de Cloudflare (server/tasks/purge.ts, voir scheduledTasks
 * dans nuxt.config.ts) — /api/admin/purger la declenche a la main — et la page
 * /confidentialite lit les MEMES constantes (CONSERVATION, dans
 * shared/utils/editeur.ts) : impossible que les deux divergent.
 *
 * - 24 mois sans ouvrir l'app : le compte est efface. Une grossesse et la
 *   premiere annee tiennent largement dedans ; au-dela, on garde des votes
 *   sur des prenoms pour un enfant deja nomme. L'activite se note a chaque
 *   ouverture (voir NOTER_ACTIVITE).
 * - 62 jours pour les compteurs de gestes : le quota ne lit que le mois en
 *   cours, deux mois couvrent toujours le mois precedent en entier.
 * - Une liste sans membre n'appartient plus a personne : elle part. On
 *   attend un jour, pour ne jamais attraper une liste a l'instant ou elle
 *   se cree (le groupe est ecrit une instruction avant son premier membre).
 * - Les liens de connexion expires depuis un jour, et les compteurs de
 *   limites vieux de deux jours.
 * - Les codes cadeaux jamais utilises, a leur echeance (CONSERVATION.cadeauMois).
 */
// Les durees elles-memes vivent dans shared/utils/editeur.ts (CONSERVATION) :
// la page /confidentialite les lit au meme endroit que la purge.

export interface BilanPurge {
  comptes_inactifs: number
  listes_sans_membre: number
  compteurs_anciens: number
  jetons_morts: number
  limites_anciennes: number
  cadeaux_perimes: number
}

export async function purger(): Promise<BilanPurge> {
  // Un seul lot : tout ou rien. On compte les lignes RENVOYEES par chaque
  // instruction, pas `changes` : D1 y ajoute les lignes emportees par les
  // cascades (votes, vetos, passkeys… d'un compte efface), et « 5 comptes
  // effaces » pour un seul serait faux.
  const [comptes, listes, compteurs, liens, limites, cadeaux] = await lot([
    [`delete from utilisateurs where vu_le < ${decale('?1')} returning 1`,
      [`-${CONSERVATION.inactiviteMois} months`]],
    // Une liste sans membre n'appartient plus a personne. On attend un jour,
    // pour ne jamais attraper une liste a l'instant ou elle se cree.
    [`delete from groupes
       where cree_le < ${decale('-1 day')}
         and not exists (select 1 from membres m where m.groupe_id = groupes.id)
      returning 1`],
    [`delete from quota_jour where jour < date('now', ?1) returning 1`, [`-${CONSERVATION.quotaJours} days`]],
    // Les liens de connexion : quinze minutes de vie, un jour de grace (pour
    // qu'un « lien expire » se distingue d'un « lien inconnu » le temps de
    // lire l'e-mail), puis plus rien.
    [`delete from liens_connexion where expire_le < ${decale('-1 day')} returning 1`],
    // Les compteurs des limites d'essais : deux jours suffisent a toutes les
    // fenetres (la plus longue fait 24 h).
    [`delete from limites where debut < ${decale('-2 days')} returning 1`],
    // Les cadeaux : un code jamais utilisé part à son échéance, avec le nom et
    // le mot de l'offrant ; un code annulé (remboursé) un mois après ; un code
    // utilisé reste attaché à sa liste (« un cadeau de… ») et part avec elle.
    [`delete from cadeaux
       where (utilise_le is null and expire_le < ${MAINTENANT})
          or (annule_le is not null and annule_le < ${decale('-1 month')})
          or (utilise_le is not null and groupe_id is null)
      returning 1`]
  ])
  return {
    comptes_inactifs: comptes!.rows.length,
    listes_sans_membre: listes!.rows.length,
    compteurs_anciens: compteurs!.rows.length,
    jetons_morts: liens!.rows.length,
    limites_anciennes: limites!.rows.length,
    cadeaux_perimes: cadeaux!.rows.length
  }
}
