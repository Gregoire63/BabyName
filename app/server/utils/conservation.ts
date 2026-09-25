/**
 * Durees de conservation (RGPD, art. 5.1.e) — et la purge qui les applique.
 *
 * Une duree ecrite dans la politique de confidentialite et jamais appliquee
 * est une promesse fausse. Celles-ci sont appliquees chaque nuit par
 * /api/admin/purger (cron Vercel, voir vercel.json), et la page
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
 */
// Les durees elles-memes vivent dans shared/utils/editeur.ts (CONSERVATION) :
// la page /confidentialite les lit au meme endroit que la purge.

export interface BilanPurge {
  comptes_inactifs: number
  listes_sans_membre: number
  compteurs_anciens: number
  jetons_morts: number
  limites_anciennes: number
}

export async function purger(): Promise<BilanPurge> {
  return transaction(async (c) => {
    const n = async (sql: string, p: any[] = []) =>
      Number((await c.query(`with x as (${sql}) select count(*)::int as n from x`, p)).rows[0]?.n ?? 0)

    const comptes_inactifs = await n(
      `delete from utilisateurs
        where vu_le < now() - make_interval(months => $1::int) returning 1`,
      [CONSERVATION.inactiviteMois])
    const listes_sans_membre = await n(
      `delete from groupes g
        where g.cree_le < now() - interval '1 day'
          and not exists (select 1 from membres m where m.groupe_id = g.id)
       returning 1`)
    const compteurs_anciens = await n(
      `delete from quota_jour where jour < current_date - $1::int returning 1`,
      [CONSERVATION.quotaJours])
    // Les liens de connexion : quinze minutes de vie, un jour de grace (pour
    // qu'un « lien expire » se distingue d'un « lien inconnu » le temps de
    // lire l'e-mail), puis plus rien. La vieille table du premier lien
    // magique, elle, n'a plus aucun usage : videe.
    const jetons_morts = await n(
      `delete from liens_connexion where expire_le < now() - interval '1 day' returning 1`)
      + await n(`delete from jetons_magiques returning 1`)
    // Les compteurs des limites d'essais : deux jours suffisent a toutes les
    // fenetres (la plus longue fait 24 h).
    const limites_anciennes = await n(
      `delete from limites where debut < now() - interval '2 days' returning 1`)

    return { comptes_inactifs, listes_sans_membre, compteurs_anciens, jetons_morts, limites_anciennes }
  })
}
