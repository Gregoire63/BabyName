import type { Prenom } from '~/composables/useCatalogue'
import { bords, estVoyelle } from '~/composables/usePhonetique'

/**
 * « Qu'est-ce qu'on aime, en fait ? »
 *
 * Apres deux cents swipes, personne ne sait dire ce qu'il a choisi. Les oui
 * ont un motif — une epoque, une longueur, une finale — et ce motif est
 * invisible de l'interieur. C'est ce que ce fichier remonte.
 *
 * Deux regles de methode, et tout depend d'elles :
 *
 * 1. LA REFERENCE EST CE QUE LA PERSONNE A JUGE, pas le catalogue. Les
 *    filtres ont deja choisi a sa place : si la liste ne montre que des
 *    prenoms courts, « vous aimez les prenoms courts » ne dit rien. On
 *    compare les oui au vu, donc a decision constante.
 * 2. ON NE PARLE QUE DE CE QUI TIENT. Un ecart sur trois prenoms n'est pas un
 *    gout, c'est du bruit. Seuils explicites ci-dessous, et silence quand ils
 *    ne sont pas atteints : un portrait invente se remarque tout de suite et
 *    disqualifie le reste de l'application.
 *
 * Rien n'est calcule sur des votes qu'on n'a pas le droit de voir : l'entree
 * est `votesVisibles`, qui ne rend les verdicts d'autrui que sur les prenoms
 * qu'on a soi-meme juges.
 */

/** En dessous, on se tait : le motif ne serait pas distinguable du hasard. */
const MIN_OUI = 12
/** Une origine ne se cite qu'a partir de tant de oui la portant. */
const MIN_OCC = 3
/** Ecart relatif minimal pour qu'un trait merite une phrase. */
const LIFT = 1.35

export interface Trait {
  /** Clé stable, sert aussi à comparer deux personnes sur le même axe. */
  axe: 'origine' | 'longueur' | 'rarete' | 'epoque' | 'finale' | 'genre'
  texte: string
  /** Force du trait, pour trier. */
  poids: number
}

export interface Portrait {
  userId: string
  pseudo: string
  nOui: number
  nJuges: number
  traits: Trait[]
  /** null tant que MIN_OUI n'est pas atteint. */
  assez: boolean
}

export interface VoteVisible {
  prenom: string; user_id: string; pseudo: string; valeur: number
}

const moyenne = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

/** Finale entendue : une voyelle ou une consonne — l'oreille trie la-dessus. */
function finaleVocalique(nom: string): boolean {
  const f = bords(nom).fin
  return !!f && estVoyelle(f)
}

function traitsDe(oui: Prenom[], juges: Prenom[]): Trait[] {
  const out: Trait[] = []
  const n = oui.length

  // --- origines : sur-representation, pas part brute -----------------------
  const compte = (l: Prenom[]) => {
    const m = new Map<string, number>()
    for (const p of l) for (const o of p.g) m.set(o, (m.get(o) ?? 0) + 1)
    return m
  }
  const cOui = compte(oui), cVu = compte(juges)
  const origines: { o: string; lift: number; k: number }[] = []
  for (const [o, k] of cOui) {
    if (k < MIN_OCC) continue
    const partOui = k / n
    const partVu = (cVu.get(o) ?? 0) / Math.max(1, juges.length)
    if (partVu <= 0) continue
    const lift = partOui / partVu
    if (lift >= LIFT) origines.push({ o, lift, k })
  }
  origines.sort((a, b) => b.lift * b.k - a.lift * a.k)
  if (origines.length) {
    const noms = origines.slice(0, 2).map(x => x.o).join(' et ')
    out.push({
      axe: 'origine', poids: origines[0]!.lift,
      texte: `Vos oui penchent ${origines.length > 1 ? 'vers les origines' : "vers l'origine"} ${noms}, nettement plus que ce qu'on vous a montré.`
    })
  }

  // --- longueur ------------------------------------------------------------
  const syOui = moyenne(oui.map(p => p.y)), syVu = moyenne(juges.map(p => p.y))
  if (syVu > 0 && Math.abs(syOui - syVu) >= 0.28) {
    const court = syOui < syVu
    out.push({
      axe: 'longueur', poids: Math.abs(syOui - syVu) * 2,
      texte: court
        ? `Vous dites oui plus court : ${syOui.toFixed(1)} syllabes en moyenne, contre ${syVu.toFixed(1)} pour ce que vous avez vu.`
        : `Vous dites oui plus long : ${syOui.toFixed(1)} syllabes en moyenne, contre ${syVu.toFixed(1)} pour ce que vous avez vu.`
    })
  }

  // --- rarete --------------------------------------------------------------
  const oOui = moyenne(oui.map(p => p.o)), oVu = moyenne(juges.map(p => p.o))
  if (oVu > 0 && Math.abs(oOui - oVu) >= 7) {
    const rare = oOui > oVu
    out.push({
      axe: 'rarete', poids: Math.abs(oOui - oVu) / 10,
      texte: rare
        ? `Vous allez vers ce qui s'entend peu (originalité ${oOui.toFixed(0)} contre ${oVu.toFixed(0)} en moyenne vue).`
        : `Vous allez vers ce qui se porte (originalité ${oOui.toFixed(0)} contre ${oVu.toFixed(0)} en moyenne vue).`
    })
  }

  // --- epoque : le pic historique, c'est le grand-pere ou le voisin de CP ---
  //
  // La serie commence en 1900 et la colonne est toujours remplie : 1900 est
  // une VRAIE valeur, celle des prenoms deja au sommet quand les archives
  // commencent. Les exclure (`> 1900`) retirait exactement les plus retro —
  // Louise et Jeanne — et tirait la moyenne vers le present.
  const pics = oui.map(p => p.p).filter(x => x >= 1900)
  const picsVu = juges.map(p => p.p).filter(x => x >= 1900)
  if (pics.length >= MIN_OUI * 0.6 && picsVu.length >= 10) {
    const a = moyenne(pics), b = moyenne(picsVu)
    const d = Math.abs(a - b)
    if (d >= 6) {
      // Huit ans ne sont pas « une generation ». On calibre le mot sur
      // l'ecart : une phrase qui sur-vend se retourne contre le reste.
      const ampleur = d >= 22 ? 'une génération' : d >= 12 ? 'une bonne décennie' : 'quelques années'
      out.push({
        axe: 'epoque', poids: d / 12,
        texte: a < b
          ? `Vos oui ont eu leur heure vers ${Math.round(a)} — ${ampleur} avant le reste de votre liste.`
          : `Vos oui sont plus récents que le reste de votre liste : leur sommet est vers ${Math.round(a)}, ${ampleur} après.`
      })
    }
  }

  // --- finale : ce qui s'entend en dernier ---------------------------------
  const vOui = oui.filter(p => finaleVocalique(p.l)).length / n
  const vVu = juges.filter(p => finaleVocalique(p.l)).length / Math.max(1, juges.length)
  if (Math.abs(vOui - vVu) >= 0.14) {
    out.push({
      axe: 'finale', poids: Math.abs(vOui - vVu) * 3,
      texte: vOui > vVu
        ? `${Math.round(vOui * 100)} % de vos oui finissent sur une voyelle — c'est une préférence d'oreille, elle ne se voit pas à l'écrit.`
        : `Vos oui finissent sur une consonne (${Math.round((1 - vOui) * 100)} %) : des prénoms qui s'arrêtent net plutôt qu'ils ne s'ouvrent.`
    })
  }

  return out.sort((a, b) => b.poids - a.poids)
}

export function portraits(
  votes: VoteVisible[], parNom: Map<string, Prenom>
): Portrait[] {
  const par = new Map<string, { pseudo: string; oui: Prenom[]; juges: Prenom[] }>()
  for (const v of votes) {
    const p = parNom.get(v.prenom)
    if (!p) continue
    let e = par.get(v.user_id)
    if (!e) { e = { pseudo: v.pseudo, oui: [], juges: [] }; par.set(v.user_id, e) }
    e.juges.push(p)
    if (v.valeur === 2) e.oui.push(p)
  }
  const out: Portrait[] = []
  for (const [userId, e] of par) {
    const assez = e.oui.length >= MIN_OUI && e.juges.length >= MIN_OUI * 2
    out.push({
      userId, pseudo: e.pseudo, nOui: e.oui.length, nJuges: e.juges.length, assez,
      traits: assez ? traitsDe(e.oui, e.juges) : []
    })
  }
  return out.sort((a, b) => b.nOui - a.nOui)
}

/**
 * La ou ca diverge.
 *
 * Deux portraits cote a cote ne disent pas grand-chose ; ce qui interesse un
 * couple, c'est l'axe sur lequel ils ne sont pas d'accord. On ne le declare
 * que si les deux ont assez juge : sinon on compare un gout a un hasard.
 */
export function divergence(
  votes: VoteVisible[], parNom: Map<string, Prenom>
): string | null {
  const par = new Map<string, { pseudo: string; oui: Prenom[] }>()
  for (const v of votes) {
    if (v.valeur !== 2) continue
    const p = parNom.get(v.prenom)
    if (!p) continue
    let e = par.get(v.user_id)
    if (!e) { e = { pseudo: v.pseudo, oui: [] }; par.set(v.user_id, e) }
    e.oui.push(p)
  }
  const gens = [...par.values()].filter(e => e.oui.length >= MIN_OUI)
  if (gens.length < 2) return null
  const [a, b] = gens.slice(0, 2) as [typeof gens[0], typeof gens[0]]

  const axes: { nom: string; va: number; vb: number; unite: (x: number) => string; seuil: number }[] = [
    { nom: 'la longueur', va: moyenne(a.oui.map(p => p.y)), vb: moyenne(b.oui.map(p => p.y)),
      unite: x => `${x.toFixed(1)} syllabes`, seuil: 0.35 },
    { nom: 'la rareté', va: moyenne(a.oui.map(p => p.o)), vb: moyenne(b.oui.map(p => p.o)),
      unite: x => `${x.toFixed(0)}/100 d'originalité`, seuil: 9 },
    { nom: "l'époque", va: moyenne(a.oui.map(p => p.p).filter(x => x >= 1900)),
      vb: moyenne(b.oui.map(p => p.p).filter(x => x >= 1900)),
      unite: x => `un sommet vers ${Math.round(x)}`, seuil: 8 }
  ]
  const pires = axes
    .filter(x => Number.isFinite(x.va) && Number.isFinite(x.vb) && Math.abs(x.va - x.vb) >= x.seuil)
    .sort((x, y) => Math.abs(y.va - y.vb) / y.seuil - Math.abs(x.va - x.vb) / x.seuil)
  const d = pires[0]
  if (!d) return null
  return `Vous divergez surtout sur ${d.nom} : ${a.pseudo} à ${d.unite(d.va)}, ${b.pseudo} à ${d.unite(d.vb)}.`
}

export { MIN_OUI }
