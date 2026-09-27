/**
 * Ce qu'un code cadeau promet, avant de s'en servir : de qui il vient, le mot
 * qui l'accompagne, et s'il vaut encore. Sans compte — la personne qui le
 * reçoit n'en a souvent pas encore, et la page de connexion lui dit qui
 * l'attend.
 *
 * 30^12 codes possibles : on ne les devine pas. La limite par adresse n'est
 * là que pour qu'un script ne fasse pas travailler la base pour rien.
 */
export default defineEventHandler(async (e) => {
  await limiter(e, 'cadeau-verifier', ipDe(e), 30, 600)
  const code = normaliserCodeCadeau(getQuery(e).code)
  if (!code) return { valide: false, raison: 'code_invalide' }
  const c = await q1<{ de_la_part: string | null; message: string | null; expire_le: string;
                      utilise_le: string | null; annule_le: string | null; expire: boolean }>(
    `select de_la_part, message, expire_le, utilise_le, annule_le,
            (expire_le <= ${MAINTENANT}) as expire
       from cadeaux where code_hash = ?1`, [empreinteCadeau(code)])
  if (!c) return { valide: false, raison: 'cadeau_inconnu' }
  const raison = c.annule_le ? 'cadeau_annule' : c.utilise_le ? 'cadeau_utilise'
    : c.expire ? 'cadeau_expire' : null
  return {
    valide: !raison, raison,
    // Le mot n'a de sens que pour qui va s'en servir : un code déjà utilisé
    // n'en dit plus rien.
    de_la_part: raison ? null : c.de_la_part,
    message: raison ? null : c.message,
    expire_le: c.expire_le
  }
})
