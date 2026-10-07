import type { H3Event } from 'h3'

/**
 * Prévenir les téléphones — les apps des stores seulement.
 *
 * Un accord arrive souvent quand l'autre a fermé l'app : c'est lui qu'il faut
 * prévenir, et c'est la seule chose que le site ne sait pas faire seul. L'app
 * iOS et l'app Android donnent un jeton d'adresse (table `appareils`,
 * migration 0011) ; on envoie le message au service d'acheminement d'Expo,
 * qui le remet à Apple ou à Google.
 *
 * CE QU'ON ENVOIE : une phrase, et l'écran où aller. Jamais le prénom — il
 * s'afficherait sur un écran verrouillé, dans une pièce où le choix du prénom
 * est peut-être encore un secret. « Vous avez un nouvel accord » suffit à
 * faire ouvrir l'app, et ne dit rien à qui regarde par-dessus l'épaule.
 *
 * CE QUI PRÉVIENT — ce qui se passe dans une de ses listes quand on n'y est
 * pas, et rien d'autre :
 *  - un accord (prevenirAccord), quelqu'un qui rejoint la liste
 *    (prevenirArrivee) : ce pour quoi on a l'app ; ils sonnent ;
 *  - la liste débloquée par quelqu'un d'autre (prevenirDeblocage), un
 *    commentaire (prevenirCommentaire), l'autre qui prend de l'avance
 *    (prevenirAvance) : l'activité de la liste, sans bruit, et rare — un
 *    déblocage n'arrive qu'une fois, les commentaires d'une même personne
 *    sont groupés par demi-heure, l'avance ne se dit qu'en franchissant un
 *    palier, une fois par jour au plus.
 * PAS chaque vote, pas les vetos (ils sont secrets), pas de rappel quotidien,
 * pas de réclame : une notification qui ne dit rien de neuf apprend à les
 * couper toutes, accords compris.
 *
 * Tout ici est « au mieux » : un message qui ne part pas ne casse rien, et ne
 * retarde jamais la réponse à celui qui vient de voter (`enFond`).
 */

/** Le jeton que rend `expo-notifications` : « ExponentPushToken[…] ». */
const JETON = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,120}\]$/
export function jetonPushValide(x: unknown): string | null {
  return typeof x === 'string' && JETON.test(x) ? x : null
}

export interface Avis {
  titre: string
  corps: string
  /** Où mène la notification touchée : un chemin de l'app (« /g/12/communs »). */
  chemin: string
  /**
   * Le canal Android (les mêmes noms que dans l'app, mobile/src/notifications.ts).
   * « accords », par défaut : il sonne. « activite » : sans bruit, et l'on
   * peut le couper dans les réglages du téléphone sans perdre les accords.
   */
  canal?: 'accords' | 'activite'
}

/** L'adresse du service d'envoi. NUXT_PUSH_URL la remplace — pour les essais,
 *  qui parlent à un faux service local ; jamais à changer en production. */
function adresse(): string {
  return String(useRuntimeConfig().pushUrl || 'https://exp.host/--/api/v2/push/send')
}

/**
 * Lance un travail APRÈS la réponse : sur Cloudflare, `waitUntil` garde le
 * Worker en vie le temps qu'il finisse ; ailleurs (nuxt dev), la promesse
 * court simplement. Ses erreurs s'écrivent dans le journal, sans plus.
 */
export function enFond(e: H3Event, travail: Promise<unknown>) {
  const p = travail.catch(err => console.warn('[push]', String(err?.message ?? err)))
  try { (e as any).waitUntil?.(p) } catch { /* pas de waitUntil : elle court quand même */ }
}

/**
 * Envoie un avis à des jetons. Rend ceux qu'Apple ou Google disent périmés
 * (app désinstallée, notifications coupées) : ils ne servent plus à rien.
 */
async function envoyer(jetons: string[], avis: Avis): Promise<string[]> {
  const perimes: string[] = []
  const acces = String(useRuntimeConfig().pushJeton || '')
  for (let i = 0; i < jetons.length; i += 100) {            // 100 messages par appel, au plus
    const lot = jetons.slice(i, i + 100)
    const r = await fetch(adresse(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json', accept: 'application/json',
        ...(acces ? { authorization: `Bearer ${acces}` } : {})
      },
      body: JSON.stringify(lot.map(to => avis.canal === 'activite'
        // Sans son : sur iPhone, c'est le message qui le décide ; sur Android, le canal.
        ? { to, title: avis.titre, body: avis.corps, data: { chemin: avis.chemin },
            channelId: 'activite', priority: 'default' }
        : { to, title: avis.titre, body: avis.corps, data: { chemin: avis.chemin },
            sound: 'default', channelId: 'accords', priority: 'high' }))
    })
    if (!r.ok) { console.warn('[push] envoi refusé :', r.status); continue }
    const tickets = ((await r.json().catch(() => null)) as any)?.data
    if (!Array.isArray(tickets)) continue
    tickets.forEach((t: any, k: number) => {
      if (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered' && lot[k]) perimes.push(lot[k]!)
    })
  }
  return perimes
}

/**
 * Prévient les AUTRES membres d'une liste — pas celui qui vient d'agir, il a
 * l'écran sous les yeux. Une lecture ; rien de plus si personne n'a l'app.
 * `seul` : ce membre-là seulement (un message qui ne vaut que pour lui).
 */
export async function prevenirListe(groupeId: number, sauf: string | null,
  avis: Avis | (() => Promise<Avis | null>), seul: string | null = null) {
  const cibles = await q<{ jeton: string }>(
    `select a.jeton from membres m join appareils a on a.user_id = m.user_id
      where m.groupe_id = ?1 and m.user_id <> ?2 and (?3 is null or m.user_id = ?3)`,
    [groupeId, sauf ?? '', seul])
  if (!cibles.length) return
  const a = typeof avis === 'function' ? await avis() : avis
  if (!a) return
  const perimes = await envoyer(cibles.map(c => c.jeton), a)
  if (perimes.length) await ecrire(`delete from appareils where jeton in ${DANS(1)}`, [perimes])
}

/**
 * Ce vote vient-il de FAIRE un accord ? La règle de `accords` (votes.ts),
 * pour un seul prénom : tous les décideurs ont une voix positive, et au moins
 * un oui. « Vient de » : avec ma voix d'avant, ce n'en était pas un.
 * `lignes` : la voix de chaque membre APRÈS le vote (SQL_VOTES_DU_PRENOM).
 */
export function vientDeFaireUnAccord(moi: string, avant: number | null | undefined,
  lignes: { user_id: string; role?: string; valeur: number | null }[]): boolean {
  const decideurs = lignes.filter(l => l.role !== 'observateur')
  if (decideurs.length < 2 || !decideurs.some(d => d.user_id === moi)) return false
  const accord = (mienne: (d: typeof decideurs[number]) => number | null | undefined) => {
    let oui = 0
    for (const d of decideurs) {
      const v = d.user_id === moi ? mienne(d) : d.valeur
      if (v === null || v === undefined || !(Number(v) > 0)) return false
      if (Number(v) === 2) oui++
    }
    return oui > 0
  }
  return accord(d => d.valeur) && !accord(() => avant)
}

/** Un nouvel accord : les autres membres l'apprennent — sans le prénom. */
export function prevenirAccord(groupeId: number, auteur: string, prenom: string) {
  return prevenirListe(groupeId, auteur, async () => {
    // Retiré du jeu (veto, « déjà pris ») : la liste ne le compte pas, on
    // n'annonce pas un accord qu'on ne trouverait pas en ouvrant l'app.
    const retire = await q1(
      `select 1 as x from vetos where groupe_id = ?1 and prenom = ?2
       union all select 1 from deja_pris where groupe_id = ?1 and prenom = ?2 limit 1`, [groupeId, prenom])
    if (retire) return null
    return { titre: 'Nouvel accord', corps: 'Vous êtes d’accord sur un prénom de plus.',
             chemin: `/g/${groupeId}/communs` }
  })
}

/** Quelqu'un vient d'entrer dans la liste : ceux qui y étaient l'apprennent. */
export function prevenirArrivee(groupeId: number, arrivant: string, observe: boolean) {
  return prevenirListe(groupeId, arrivant, async () => {
    const r = await q1<{ pseudo: string; nom: string }>(
      `select u.pseudo, g.nom from utilisateurs u, groupes g where u.id = ?1 and g.id = ?2`, [arrivant, groupeId])
    if (!r) return null
    return {
      titre: r.nom,
      corps: observe ? `${r.pseudo} suit maintenant votre liste.` : `${r.pseudo} a rejoint votre liste.`,
      chemin: `/g/${groupeId}/reglages`
    }
  })
}

/**
 * La liste vient d'être débloquée — par quelqu'un d'autre, ou par un cadeau :
 * les autres membres apprennent que leur limite est tombée. `auteur` : qui a
 * payé ou utilisé le cadeau (il n'est pas prévenu, il le sait) ; inconnu
 * (compte effacé depuis), tout le monde l'apprend, sans nom.
 */
export function prevenirDeblocage(groupeId: number, auteur: string | null) {
  return prevenirListe(groupeId, auteur, async () => {
    const r = await q1<{ nom: string; pseudo: string | null }>(
      `select g.nom, (select pseudo from utilisateurs where id = ?2) as pseudo
         from groupes g where g.id = ?1 and g.paye_le is not null`, [groupeId, auteur])
    // Re-verrouillée entre-temps (un remboursement) : on n'annonce rien.
    if (!r) return null
    return {
      titre: r.nom,
      corps: r.pseudo ? `${r.pseudo} a débloqué la liste : swipes illimités, pour vous aussi.`
        : 'Votre liste est débloquée : swipes illimités.',
      chemin: `/g/${groupeId}/swipe`, canal: 'activite'
    }
  })
}

/** Une demi-heure : les commentaires d'une même personne, écrits d'affilée, ne font qu'une notification. */
const RYTHME_COMMENTAIRES = 1800

/**
 * Un commentaire vient d'être laissé : les autres membres l'apprennent — qui,
 * et dans quelle liste ; ni le prénom commenté, ni le texte. Ils le liront
 * dans « Communs », là où il a été écrit.
 */
export function prevenirCommentaire(groupeId: number, auteur: string) {
  return prevenirListe(groupeId, auteur, async () => {
    if (!(await premierDeLaFenetre('push-commentaire', `${groupeId}:${auteur}`, RYTHME_COMMENTAIRES))) return null
    const r = await q1<{ pseudo: string; nom: string }>(
      `select u.pseudo, g.nom from utilisateurs u, groupes g where u.id = ?1 and g.id = ?2`, [auteur, groupeId])
    if (!r) return null
    return { titre: r.nom, corps: `${r.pseudo} a laissé un commentaire.`,
             chemin: `/g/${groupeId}/communs`, canal: 'activite' }
  })
}

/**
 * L'AVANCE. « Les accords attendent Paul » se lit dans les réglages de la
 * liste (SectionReglages) ; encore faut-il que Paul y passe. Quand l'un prend
 * de l'avance, l'autre l'apprend : il n'y a d'accord que sur un prénom que
 * les deux ont jugé, et celui qui trie seul ne voit rien venir.
 *
 * Sans harceler personne :
 *  - seulement en FRANCHISSANT un palier (25 prénoms d'écart, puis 50, 100…) :
 *    pas à chaque vote, et rien si celui qui a de l'avance ne trie plus ;
 *  - pas si l'autre a déjà trié aujourd'hui : sur une liste gratuite, il ne
 *    pourrait rien rattraper de plus, et la notification le mènerait au mur ;
 *  - une fois par jour et par liste au plus (prevenirAvance).
 */
const PALIERS_AVANCE = [25, 50, 100, 200, 400, 800]
/** Vingt heures : « une fois par jour », sans décaler l'heure d'un jour sur l'autre. */
const RYTHME_AVANCE = 20 * 3600

/**
 * Qui vient de prendre du retard sur moi, à ce vote ? Rien à lire de plus :
 * `lignes` est ce que le vote a déjà lu de chaque membre, APRÈS lui
 * (SQL_VOTES_DU_PRENOM — son nombre de prénoms jugés, l'instant de son
 * dernier vote) ; `avant`, mon nombre de prénoms jugés avant lui.
 */
export function quiPrendDuRetard(moi: string, avant: number, jour: string,
  lignes: { user_id: string; role?: string; nb?: number | null; maj_le?: string | null }[]): { user_id: string; ecart: number }[] {
  const decideurs = lignes.filter(l => l.role !== 'observateur')
  const mien = decideurs.find(d => d.user_id === moi)
  if (!mien || decideurs.length < 2) return []
  const apres = Number(mien.nb ?? 0)
  const out: { user_id: string; ecart: number }[] = []
  for (const d of decideurs) {
    if (d.user_id === moi) continue
    const sien = Number(d.nb ?? 0)
    const franchi = PALIERS_AVANCE.some(p => avant - sien < p && apres - sien >= p)
    if (!franchi) continue
    // Il a trié aujourd'hui : il sait où en est la liste.
    if (d.maj_le && jourParis(new Date(d.maj_le)) === jour) continue
    out.push({ user_id: d.user_id, ecart: apres - sien })
  }
  return out
}

/** L'avance, dite à ceux qu'elle concerne — chacun avec son propre écart. */
export async function prevenirAvance(groupeId: number, auteur: string, retards: { user_id: string; ecart: number }[]) {
  for (const r of retards) {
    await prevenirListe(groupeId, auteur, async () => {
      if (!(await premierDeLaFenetre('push-avance', `${groupeId}:${r.user_id}`, RYTHME_AVANCE))) return null
      const x = await q1<{ pseudo: string; nom: string }>(
        `select u.pseudo, g.nom from utilisateurs u, groupes g where u.id = ?1 and g.id = ?2`, [auteur, groupeId])
      if (!x) return null
      return {
        titre: x.nom,
        corps: `${x.pseudo} a jugé ${r.ecart} prénoms de plus que vous. Les accords vous attendent.`,
        chemin: `/g/${groupeId}/swipe`, canal: 'activite'
      }
    }, r.user_id)
  }
}
