/**
 * Le code des observateurs.
 *
 * Un SECOND code d'invitation, distinct de l'autre. Le rôle ne peut pas être
 * un paramètre du lien : l'invité le changerait et s'élirait parent. Il est
 * donc porté par le code lui-même, qui n'ouvre que le rôle d'observateur.
 *
 * On le crée à la demande et on le garde : le regénérer à chaque appel
 * casserait les liens déjà envoyés.
 */
import { randomBytes } from 'node:crypto'

export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  await exigerMembre(e, gid)

  const g = await q1<{ paye: boolean; code: string | null }>(
    `select (paye_le is not null) as paye, code_observateur as code
       from groupes where id = $1`, [gid])
  if (!g) throw createError({ statusCode: 404, statusMessage: 'groupe_introuvable' })
  if (!g.paye) throw createError({ statusCode: 402, statusMessage: 'liste_non_debloquee' })
  if (g.code) return { ok: true, code: g.code }

  // Collision quasi impossible sur 8 hex, mais `unique` la rendrait fatale :
  // on réessaie au lieu de renvoyer une 500 à quelqu'un qui n'y peut rien.
  for (let i = 0; i < 5; i++) {
    const code = randomBytes(4).toString('hex')
    try {
      const r = await q1<{ code_observateur: string }>(
        `update groupes set code_observateur = $2
          where id = $1 and code_observateur is null
          returning code_observateur`, [gid, code])
      if (r) return { ok: true, code: r.code_observateur }
      // Quelqu'un d'autre vient de le créer : c'est le sien qui fait foi.
      const d = await q1<{ code: string }>(
        `select code_observateur as code from groupes where id = $1`, [gid])
      if (d?.code) return { ok: true, code: d.code }
    } catch (err: any) {
      if (err?.code !== '23505') throw err
    }
  }
  throw createError({ statusCode: 503, statusMessage: 'code_indisponible' })
})
