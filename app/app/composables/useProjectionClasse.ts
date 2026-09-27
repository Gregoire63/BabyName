import { tendanceFiable, type Prenom } from '~/composables/useCatalogue'

/**
 * « Il y en aura combien dans sa classe ? »
 *
 * C'est la vraie question derriere « originalite » et « risque d'explosion »,
 * et deux jauges sur 100 n'y repondent pas. Celle-ci repond en enfants.
 *
 * Deux corrections separent notre reponse de celle d'un palmares public, et
 * ce sont elles qu'on vend :
 *
 * 1. LE GROUPE DE PRONONCIATION. Une classe n'ecrit pas les prenoms, elle les
 *    appelle : Elyo, Élio et Hélio sont trois enfants qui se retournent. Tous
 *    les classements comptent les graphies separement et sous-estiment donc.
 * 2. L'ANNEE DE NAISSANCE. Les chiffres publies ont deux ans de retard sur
 *    l'enfant a naitre. Pour un prenom qui monte de 25 %/an, deux ans
 *    changent la reponse.
 *
 * La version gratuite affiche le calcul brut — une graphie, aujourd'hui —
 * parce que c'est ce que n'importe qui peut deja trouver ailleurs, et qu'un
 * chiffre cache ne convainc personne. Ce qui se paie, c'est l'ecart entre ce
 * chiffre-la et le vrai.
 */

/** Effectif moyen d'une classe en France (maternelle et elementaire, ~23-24). */
export const CLASSE = 25

/** Annees entre la derniere donnee fiable et la naissance de l'enfant. */
const HORIZON = 2

export interface Projection {
  /** Frequence retenue, pour 10 000 naissances. */
  p10k: number
  /** Enfants du meme prenom parmi les CLASSE-1 autres eleves. */
  autres: number
  /** Probabilite qu'au moins un autre eleve porte le prenom. */
  pAuMoinsUn: number
  /** Une classe sur N en aura un deuxieme (null si >= ~1 par classe). */
  uneClasseSur: number | null
  /** La phrase, deja ecrite. */
  phrase: string
}

export interface Ecart {
  /** Combien de fois le chiffre complet depasse le chiffre brut. */
  facteur: number
  /** Ce que la tendance ajoute a elle seule, ou null. */
  evolution: string | null
  /** Ce que les autres graphies ajoutent, ou null. */
  graphies: string | null
}

/**
 * Borne la projection.
 *
 * Extrapoler +40 %/an sur deux ans donnerait x2, ce qu'aucun prenom ne tient
 * deux annees de suite : les courbes s'aplatissent des qu'un prenom devient
 * courant. On plafonne la pente a ±25 %/an et le facteur total a x2 / ÷2.
 */
function facteurTendance(tendance: number): number {
  const t = Math.max(-25, Math.min(25, tendance ?? 0)) / 100
  return Math.max(0.5, Math.min(2, Math.pow(1 + t, HORIZON)))
}

const arrondi = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d

/**
 * La pente du groupe, si elle veut dire quelque chose. Le groupe entier
 * compte (Elyo + Élio + Hélio), mais sous une vingtaine de bebes par an la
 * pente n'est que l'arrondi de l'INSEE : on ne la projette pas, et on ne
 * l'ecrit pas (« il monte encore, +14 %/an »).
 */
function pente(p: Prenom): number {
  const nGroupe = p.f > 0 && p.fgp > 0 ? p.n * p.fgp / p.f : p.n
  return tendanceFiable({ n: nGroupe }) ? (p.tgp ?? p.t) : 0
}

/**
 * @param complet false = une seule graphie, au taux d'aujourd'hui (gratuit).
 *                true  = tout le groupe, projete a la naissance (debloque).
 */
export function projeter(p: Prenom, complet: boolean): Projection | null {
  const base = complet && p.fgp > 0 ? p.fgp : p.f
  if (!base || base <= 0) return null

  const p10k = complet ? base * facteurTendance(pente(p)) : base
  const q = Math.min(0.5, p10k / 10000)
  const autres = (CLASSE - 1) * q
  const pAuMoinsUn = 1 - Math.pow(1 - q, CLASSE - 1)
  const uneClasseSur = pAuMoinsUn > 0.005 && pAuMoinsUn < 0.9
    ? Math.round(1 / pAuMoinsUn) : null

  let phrase: string
  if (autres >= 1.6) {
    phrase = `Environ ${Math.round(autres)} autres ${p.l} dans sa classe.`
  } else if (pAuMoinsUn >= 0.5) {
    phrase = `Il y aura très probablement un autre ${p.l} dans sa classe.`
  } else if (pAuMoinsUn >= 0.25) {
    phrase = `Une chance sur ${uneClasseSur} qu'il ne soit pas le seul de sa classe.`
  } else if (uneClasseSur && uneClasseSur <= 80) {
    phrase = `Une classe sur ${uneClasseSur} en compte deux. La sienne, probablement pas.`
  } else {
    phrase = `Il sera le seul de son école, et sans doute de sa ville.`
  }

  return { p10k: arrondi(p10k), autres: arrondi(autres), pAuMoinsUn, uneClasseSur, phrase }
}

/** Ce que le calcul brut rate — de quoi juger l'offre sans l'avoir prise. */
export function ecart(p: Prenom): Ecart | null {
  if (!p.f || p.f <= 0) return null
  const ft = facteurTendance(pente(p))
  const fg = p.fgp > 0 ? p.fgp / p.f : 1
  const facteur = arrondi(ft * fg, 2)

  let evolution: string | null = null
  if (ft >= 1.2) evolution = `il monte encore (+${Math.round(pente(p))} %/an)`
  else if (ft <= 0.85) evolution = `il recule (${Math.round(pente(p))} %/an)`

  let graphies: string | null = null
  if (p.ngp > 1 && fg >= 1.15) {
    const noms = (p.variantes ?? []).slice(0, 2).join(', ')
    graphies = `il s'écrit aussi autrement${noms ? ` (${noms})` : ''}, et la classe entend pareil`
  }

  if (!evolution && !graphies) return null
  return { facteur, evolution, graphies }
}
