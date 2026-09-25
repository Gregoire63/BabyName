import type { H3Event } from 'h3'

/**
 * Limiter les essais.
 *
 * Ce qui se devine par essais successifs n'avait aucun frein : un code
 * d'invitation (8 caractères hexadécimaux, 4 milliards de valeurs — à cent
 * essais par seconde, une liste parmi mille tombe en douze heures), un code
 * reçu par e-mail (un million de valeurs), la création de comptes à la
 * chaîne. Une table suffit, pas besoin d'un service de plus : une ligne par
 * action et par EMPREINTE (d'IP, de compte, d'e-mail) — jamais la valeur en
 * clair : une IP hachée sans secret se retrouve en quelques minutes,
 * l'espace est trop petit. D'où le HMAC.
 *
 * Fenêtre fixe, remise à zéro quand elle est passée : grossier, mais une
 * seule requête, et ça ne laisse passer qu'au pire deux fois le plafond
 * autour d'un changement de fenêtre — sans importance à ces ordres de
 * grandeur. Les lignes vieilles de deux jours partent avec la purge.
 *
 * En développement, les plafonds sont multipliés : les essais créent des
 * comptes et rejoignent des listes à la chaîne depuis la même adresse. Un
 * essai qui vérifie les limites elles-mêmes remet le facteur à 1
 * (NUXT_LIMITES_FACTEUR, voir essais/essai-connexion.env). En production,
 * rien ne les desserre.
 */
const FACTEUR_DEV = Number(process.env.NUXT_LIMITES_FACTEUR) || 50

/** L'adresse du client. Sur Vercel, X-Real-IP et X-Forwarded-For sont posés
 *  par la plateforme, qui écrase ce que le client enverrait. */
export function ipDe(e: H3Event): string {
  return getHeader(e, 'x-real-ip')?.trim()
    || (getHeader(e, 'x-forwarded-for') ?? '').split(',')[0]!.trim()
    || getRequestIP(e)
    || 'inconnue'
}

/**
 * Compte un essai pour (action, qui). Au-delà de `max` dans la fenêtre :
 * 429, avec Retry-After. Le compteur monte AVANT le travail : un essai
 * refusé compte aussi, sinon on pourrait sonder sans jamais s'user.
 */
export async function limiter(e: H3Event, action: string, qui: string, max: number, fenetreSec: number) {
  const plafond = import.meta.dev ? max * FACTEUR_DEV : max
  const cle = `${action}:${empreinteSignee(qui, 'limite').slice(0, 24)}`
  const r = await q1<{ n: number; reste: number }>(
    `insert into limites (cle, debut, n) values ($1, now(), 1)
     on conflict (cle) do update set
       n     = case when limites.debut < now() - make_interval(secs => $2::double precision)
                    then 1 else limites.n + 1 end,
       debut = case when limites.debut < now() - make_interval(secs => $2::double precision)
                    then now() else limites.debut end
     returning n, greatest(1, ceil(extract(epoch from
       (debut + make_interval(secs => $2::double precision) - now()))))::int as reste`,
    [cle, fenetreSec])
  if (r && r.n > plafond) {
    setHeader(e, 'retry-after', String(r.reste))
    throw createError({ statusCode: 429, statusMessage: 'trop_d_essais', data: { reessayer_dans: r.reste } })
  }
}

/** Remet un compteur à zéro — après un succès, pour ne pas punir quelqu'un
 *  qui s'est trompé deux fois puis a réussi. */
export async function oublierEssais(action: string, qui: string) {
  const cle = `${action}:${empreinteSignee(qui, 'limite').slice(0, 24)}`
  await q(`delete from limites where cle = $1`, [cle])
}
