import { bords, estVoyelle } from '~/composables/usePhonetique'
import type { Prenom } from '~/composables/useCatalogue'

/**
 * « Ça donne quoi avec notre nom ? »
 *
 * C'est la question que tout le monde se pose à voix haute et que personne
 * n'outille. Elle demande de savoir comment le prénom SE DIT, pas comment il
 * s'écrit : Léa Arnaud accroche (deux voyelles collées) alors que Léa Bernard
 * coule, et rien dans l'orthographe ne le montre. On a la clé de
 * prononciation ; c'est elle qui rend ce test possible.
 *
 * On ne note pas sur 10 : un prénom n'est pas « mauvais » parce qu'il fait un
 * hiatus. On signale ce qui s'entend, avec ses mots, et on laisse décider.
 */
export type Gravite = 'accroche' | 'attention' | 'bien'

/** `court` : la meme chose en quelques mots, pour la carte de tri. */
export interface Remarque { gravite: Gravite; texte: string; court: string }
/**
 * « VerdictNom » et pas « Verdict » : les composables sont importes
 * automatiquement, et useVerdicts.ts a deja son Verdict (un vote). Deux
 * exports du meme nom, et Nuxt en ignore un en le signalant a chaque
 * demarrage.
 */
export interface VerdictNom {
  remarques: Remarque[]
  syllabes: number
  initiales: string
  accroche: boolean       // au moins une vraie accroche
}

/** Sigles qu'on préfère ne pas donner à son enfant pour la vie. */
const SIGLES: Record<string, string> = {
  ADN: 'A.D.N.', KO: 'K.-O.', PD: 'P.D.', SM: 'S.M.', FN: 'F.N.',
  NTM: 'N.T.M.', SS: 'S.S.', LSD: 'L.S.D.', BB: 'B.B.', WC: 'W.-C.',
  TP: 'T.P.', PQ: 'P.Q.', CC: 'C.C.', OK: 'O.K.', VIP: 'V.I.P.'
}

const sansAccents = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

const initialesDe = (...mots: string[]) =>
  mots.flatMap(m => m.split(/[-\s’']+/)).filter(Boolean)
      .map(m => sansAccents(m)[0] ?? '').join('')

/** Noyaux vocaliques de la clé : une approximation suffisante du compte. */
function syllabesCle(cle: string): number {
  let n = 0, dedans = false
  for (const c of cle) {
    const v = estVoyelle(c)
    if (v && !dedans) n++
    dedans = v
  }
  return Math.max(1, n)
}

export function tester(prenom: string, nomFamille: string): VerdictNom | null {
  const nf = (nomFamille ?? '').trim()
  if (!nf || !prenom) return null

  const p = bords(prenom)
  const n = bords(nf)
  const remarques: Remarque[] = []

  // 1. Hiatus : deux voyelles qui se touchent. C'est le défaut le plus
  //    audible et celui que personne ne voit à l'écrit.
  if (estVoyelle(p.fin) && estVoyelle(n.debut)) {
    remarques.push({ gravite: 'accroche', court: 'deux voyelles se touchent',
      texte: `« ${prenom} ${nf} » : les deux voyelles se touchent, on entend une hésitation.` })
  }

  // 2. Même consonne de part et d'autre : on bafouille.
  if (!estVoyelle(p.fin) && p.fin === n.debut) {
    remarques.push({ gravite: 'accroche', court: 'même son de part et d’autre, ça bute',
      texte: `Le prénom finit et le nom commence par le même son — ça bute.` })
  }

  // 3. Rime : les deux se terminent pareil, sur au moins deux sons.
  const finP = p.cle.slice(-2), finN = n.cle.slice(-2)
  if (finP.length === 2 && finP === finN) {
    remarques.push({ gravite: 'attention', court: 'le prénom et le nom riment',
      texte: `Le prénom et le nom riment. Certains aiment, d'autres l'entendent comme une comptine.` })
  }

  // 4. Longueur totale.
  const syl = syllabesCle(p.cle) + syllabesCle(n.cle)
  if (syl <= 2) {
    remarques.push({ gravite: 'attention', court: `très court : ${syl} syllabes`,
      texte: `Très court à dire : ${syl} syllabes en tout.` })
  } else if (syl >= 8) {
    remarques.push({ gravite: 'attention', court: `long à dire : ${syl} syllabes`,
      texte: `Long à dire : ${syl} syllabes en tout.` })
  }

  // 5. Initiales.
  const ini = initialesDe(prenom, nf)
  const sigle = SIGLES[ini] ?? (ini.length >= 2 ? SIGLES[ini.slice(0, 2)] : undefined)
  if (sigle) {
    remarques.push({ gravite: 'accroche', court: `initiales : ${sigle}`,
      texte: `Les initiales donnent ${sigle}.` })
  }

  if (!remarques.length) {
    remarques.push({ gravite: 'bien', court: `rien n’accroche · ${syl} syllabes`,
      texte: `Rien n'accroche : ${syl} syllabes, l'enchaînement est net.` })
  }
  return {
    remarques,
    syllabes: syl,
    initiales: ini.split('').join('.') + '.',
    accroche: remarques.some(r => r.gravite === 'accroche')
  }
}

/** Les prénoms d'une liste qui passent le test sans accrocher. */
export function sansAccroche(liste: Prenom[], nomFamille: string): Prenom[] {
  if (!nomFamille?.trim()) return liste
  return liste.filter(p => !tester(p.l, nomFamille)?.accroche)
}

