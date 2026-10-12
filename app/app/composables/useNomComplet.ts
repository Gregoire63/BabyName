import { bords, estVoyelle } from '~/composables/usePhonetique'
import type { Prenom } from '~/composables/useCatalogue'
import TEXTES from '../textes/useNomComplet'

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

/**
 * Les phrases viennent d'app/textes/useNomComplet.ts. Ce module n'importe PAS
 * useLangue : l'outil public et son essai le compilent seul avec esbuild
 * (scripts/seo-plus.mjs, essais/essai-nom-complet.mjs), sans Vite ni Nuxt.
 * L'app passe donc `t` (useLangue) en troisième argument de tester() ; sans
 * lui, c'est le français.
 */
export type Traduire = (cle: string, p?: Record<string, unknown>) => string
const enFrancais: Traduire = (cle, p = {}) => {
  const v = TEXTES.fr[cle.replace(/^useNomComplet\./, '') as keyof typeof TEXTES.fr] as string
  return v.replace(/\{(\w+)\}/g, (m, k: string) => p[k] === undefined ? m : String(p[k]))
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

/**
 * Le nombre de syllabes, compté comme le pipeline le compte
 * (pipeline/build_metrics.py, syllables_fr) : c'est sa colonne « y » qui
 * nourrit les filtres, et l'essai doit dire le même chiffre qu'eux.
 * essai-nom-complet le vérifie sur les 19 608 prénoms.
 *
 * Pas sur la clé de prononciation : elle efface accents et tréma, et
 * « Amaël Raturat » y faisait cinq syllabes (amael : deux), « Léo Roy » deux,
 * donc « très court ». Ici le tréma ouvre un noyau (A-ma-ël), une voyelle
 * accentuée aussi (Lé-o).
 */
const VOYELLES_ECRITES = new Set('aeiouyàâäéèêëîïôöùûüÿœ')
const TREMA = new Set('ëïü')
// noyaux de plusieurs lettres, du plus long au plus court (l'ordre compte)
const NOYAUX = ['eau', 'oeu', 'aient', 'ai', 'ei', 'au', 'ou', 'oi', 'eu',
                'ui', 'ay', 'oy', 'ea', 'ie', 'ye', 'aa']
// obstruante + liquide : force la diérèse (Ga-bri-el, mais Pierre)
const ATTAQUES = new Set(['br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr', 'vr', 'bl', 'cl', 'fl', 'gl', 'pl'])

export function syllabes(nom: string): number {
  let total = 0
  // NFC : un « ë » tapé en deux caractères (e + tréma) reste un ë.
  for (const mot of String(nom).normalize('NFC').toLowerCase().split(/[- ’']/)) {
    if (!mot) continue
    let n = 0, i = 0
    while (i < mot.length) {
      const c = mot[i]!
      if (!VOYELLES_ECRITES.has(c)) { i++; continue }
      if (TREMA.has(c)) { n++; i++; continue }
      let noyau = NOYAUX.find(d => mot.startsWith(d, i) && !(d.length > 1 && TREMA.has(mot[i + 1]!)))
      if ((noyau === 'ie' || noyau === 'ea') && i >= 2 && ATTAQUES.has(mot.slice(i - 2, i))) noyau = undefined
      n++
      i += noyau ? noyau.length : 1
    }
    // -e / -es final muet, sauf après une voyelle (Léa, Zoé) ou une attaque
    // obstruante + liquide (Lé-an-dre, Am-bre).
    if (mot.length > 2) {
      const q = mot.endsWith('es') ? 2 : 1
      const fin = mot.slice(-q)
      if ((fin === 'e' || fin === 'es') && !VOYELLES_ECRITES.has(mot[mot.length - q - 1]!)
          && !ATTAQUES.has(mot.slice(Math.max(0, mot.length - q - 2), mot.length - q))) n--
    }
    total += Math.max(n, 1)
  }
  return Math.max(total, 1)
}

export function tester(prenom: string, nomFamille: string, t: Traduire = enFrancais): VerdictNom | null {
  const nf = (nomFamille ?? '').trim()
  if (!nf || !prenom) return null

  const p = bords(prenom)
  const n = bords(nf)
  const remarques: Remarque[] = []

  // 1. Hiatus : deux voyelles qui se touchent. C'est le défaut le plus
  //    audible et celui que personne ne voit à l'écrit.
  if (estVoyelle(p.fin) && estVoyelle(n.debut)) {
    remarques.push({ gravite: 'accroche', court: t('useNomComplet.hiatusCourt'),
      texte: t('useNomComplet.hiatus', { prenom, nom: nf }) })
  }

  // 2. Même consonne de part et d'autre : on bafouille.
  if (!estVoyelle(p.fin) && p.fin === n.debut) {
    remarques.push({ gravite: 'accroche', court: t('useNomComplet.memeSonCourt'),
      texte: t('useNomComplet.memeSon') })
  }

  // 3. Rime : les deux se terminent pareil, sur au moins deux sons.
  const finP = p.cle.slice(-2), finN = n.cle.slice(-2)
  if (finP.length === 2 && finP === finN) {
    remarques.push({ gravite: 'attention', court: t('useNomComplet.rimeCourt'),
      texte: t('useNomComplet.rime') })
  }

  // 4. Longueur totale.
  const syl = syllabes(prenom) + syllabes(nf)
  if (syl <= 2) {
    remarques.push({ gravite: 'attention', court: t('useNomComplet.tresCourtCourt', { n: syl }),
      texte: t('useNomComplet.tresCourt', { n: syl }) })
  } else if (syl >= 8) {
    remarques.push({ gravite: 'attention', court: t('useNomComplet.longCourt', { n: syl }),
      texte: t('useNomComplet.long', { n: syl }) })
  }

  // 5. Initiales.
  const ini = initialesDe(prenom, nf)
  const sigle = SIGLES[ini] ?? (ini.length >= 2 ? SIGLES[ini.slice(0, 2)] : undefined)
  if (sigle) {
    remarques.push({ gravite: 'accroche', court: t('useNomComplet.initialesCourt', { sigle }),
      texte: t('useNomComplet.initiales', { sigle }) })
  }

  if (!remarques.length) {
    // Sur la carte, le verdict seul : le compte n'y apprend rien quand rien
    // n'accroche (il reste dans le texte long, et sur l'outil public).
    remarques.push({ gravite: 'bien', court: t('useNomComplet.rienCourt'),
      texte: t('useNomComplet.rien', { n: syl }) })
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

