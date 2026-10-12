import { computed, reactive, watch } from 'vue'

/**
 * La langue de l'app : français, anglais, et celles des pays dont l'app
 * montre les chiffres (LANGUES ci-dessous).
 *
 * PAR DÉFAUT, CELLE DU SYSTÈME (« Automatique ») : la première langue du
 * navigateur — ou du téléphone, dans l'app des stores : sur iPhone, la vue
 * web reçoit la langue que iOS a choisie pour l'app parmi celles qu'elle
 * déclare (mobile/app.json), réglage « Langue » de l'app compris ; sur
 * Android, celle du système. Une langue que l'app ne parle pas donne
 * l'anglais. Le pays n'entre pas en compte
 * — un anglophone installé en France veut l'anglais.
 *
 * On peut la forcer dans le compte (FeuilleCompte). Le choix est gardé sur
 * l'appareil (pr_langue) et sur le compte : il suit sur les autres appareils,
 * et le serveur s'en sert pour les e-mails et les notifications.
 *
 * LES TEXTES. Un fichier par écran dans app/textes/ (le nom du fichier est
 * l'espace de noms) : `{ fr: {…}, en: {…} }`. Une valeur est un texte, avec
 * des {paramètres}, ou une fonction des paramètres (accords, pluriels, phrases
 * qui changent de forme) :
 *
 *     t('FeuilleCompte.titre')
 *     t('PanneauCommuns.nb', { n: 3 })
 *
 * Dans un gabarit : {{ $t('…') }}. Un texte absent en anglais retombe sur le
 * français ; absent partout, la clé s'affiche (et le signale en dev).
 * `node scripts/verifier-textes.mjs` vérifie que les deux langues ont les
 * mêmes clés (lancé par `npm run build`).
 */
export type Langue = 'fr' | 'en' | 'de' | 'nl' | 'sv' | 'nb' | 'pl' | 'lv'
export type ChoixLangue = Langue | 'auto'
export type Parametres = Record<string, unknown>
export type Texte = string | ((p: Parametres) => string)
/** Un fichier d'app/textes/ : le français et l'anglais, toujours ensemble. */
export interface Textes { fr: Record<string, Texte>; en: Record<string, Texte> }

/**
 * Les langues proposées, avec leur nom dans leur propre langue (le sélecteur
 * du compte) et leur forme pour Intl. Au-delà du français et de l'anglais :
 * celles des pays dont l'app montre les chiffres (DansLeMonde, data/pays) —
 * Belgique (nl), Autriche et Suisse (de), Suède, Norvège, Pologne, Lettonie.
 */
export const LANGUES: { code: Langue; nom: string; intl: string }[] = [
  { code: 'fr', nom: 'Français', intl: 'fr-FR' },
  { code: 'en', nom: 'English', intl: 'en-GB' },
  { code: 'de', nom: 'Deutsch', intl: 'de-DE' },
  { code: 'nl', nom: 'Nederlands', intl: 'nl-NL' },
  { code: 'sv', nom: 'Svenska', intl: 'sv-SE' },
  { code: 'nb', nom: 'Norsk', intl: 'nb-NO' },
  { code: 'pl', nom: 'Polski', intl: 'pl-PL' },
  { code: 'lv', nom: 'Latviešu', intl: 'lv-LV' }
]
const CODES = LANGUES.map(l => l.code)

/**
 * Le français et l'anglais sont dans chaque fichier d'app/textes/ (un par
 * écran ; le nom du fichier est l'espace de noms) et partent avec l'app. Les
 * autres langues sont chacune UN fichier plat, app/textes/_langues/<code>.ts
 * (`'Espace.cle': texte`), traduit de l'anglais, chargé seulement quand on
 * en a besoin. Ce qui y manque s'affiche en anglais, puis en français.
 */
const modules = import.meta.glob<{ default: Textes }>('../textes/*.ts', { eager: true })
const TEXTES: Record<string, Record<string, Texte>> = { fr: {}, en: {} }
for (const [chemin, m] of Object.entries(modules)) {
  const espace = chemin.split('/').pop()!.replace(/\.ts$/, '')
  for (const l of ['fr', 'en'] as const) {
    for (const [cle, v] of Object.entries(m.default?.[l] ?? {})) TEXTES[l]![`${espace}.${cle}`] = v
  }
}
const AUTRES = import.meta.glob<{ default: Record<string, Texte> }>('../textes/_langues/*.ts')

const CLE_LOCALE = 'pr_langue'

/** La langue du système (navigateur ou téléphone), ramenée à fr ou en. */
export function langueSysteme(): Langue {
  if (typeof navigator === 'undefined') return 'fr'
  const liste = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const l of liste) {
    let c = String(l ?? '').slice(0, 2).toLowerCase()
    if (c === 'no' || c === 'nn') c = 'nb'          // norvégien : une seule forme
    if ((CODES as string[]).includes(c)) return c as Langue
  }
  return 'en'
}

function lireChoix(): ChoixLangue {
  try {
    const v = localStorage.getItem(CLE_LOCALE)
    if ((CODES as string[]).includes(v ?? '')) return v as Langue
  } catch { /* stockage indisponible : automatique */ }
  return 'auto'
}

export const etatLangue = reactive<{ choix: ChoixLangue; systeme: Langue }>({
  choix: typeof window === 'undefined' ? 'auto' : lireChoix(),
  systeme: langueSysteme()
})

/** La langue affichée. */
export const langue = computed<Langue>(() => etatLangue.choix === 'auto' ? etatLangue.systeme : etatLangue.choix)

/** Pour Intl et toLocale…String : dates, nombres, prix. */
export const locale = computed(() => LANGUES.find(l => l.code === langue.value)?.intl ?? 'en-GB')

/** Une langue autre que fr/en est-elle chargée ? (Réactif : l'écran se redessine à l'arrivée.) */
const chargees = reactive<Record<string, boolean>>({ fr: true, en: true })
async function charger(l: Langue) {
  if (chargees[l]) return
  const f = AUTRES[`../textes/_langues/${l}.ts`]
  if (!f) { chargees[l] = true; return }
  try { TEXTES[l] = (await f()).default } catch { TEXTES[l] = {} }
  chargees[l] = true
}

/** Le texte `cle` dans la langue affichée. */
export function t(cle: string, p: Parametres = {}): string {
  const l = langue.value
  // Lu pour la réactivité : une langue qui arrive redessine ce qui l'attendait.
  const prete = chargees[l]
  const v = (prete ? TEXTES[l]?.[cle] : undefined) ?? TEXTES.en![cle] ?? TEXTES.fr![cle]
  if (v === undefined) {
    if (import.meta.dev) console.warn(`[langue] texte introuvable : ${cle}`)
    return cle
  }
  if (typeof v === 'function') return v(p)
  return v.replace(/\{(\w+)\}/g, (m, k: string) => p[k] === undefined || p[k] === null ? m : String(p[k]))
}

/** Le texte existe-t-il ? (Pour un code d'erreur du serveur sans traduction.) */
export function aTexte(cle: string): boolean {
  return cle in TEXTES.fr! || cle in TEXTES.en!
}

/** Un nombre dans la langue affichée (1 234 / 1,234). */
export const nombre = (n: number, o?: Intl.NumberFormatOptions) => n.toLocaleString(locale.value, o)

/**
 * Changer la langue. 'auto' : celle du système. Gardé sur l'appareil, et sur
 * le compte quand on est connecté (voir enregistrerLangue, useMoi).
 */
export function choisirLangue(c: ChoixLangue, o: { enregistrer?: boolean } = {}) {
  etatLangue.choix = c
  try {
    if (c === 'auto') localStorage.removeItem(CLE_LOCALE)
    else localStorage.setItem(CLE_LOCALE, c)
  } catch { /* rien */ }
  if (o.enregistrer !== false) enregistrerLangue()
}

/** Le compte apprend la langue choisie et celle affichée (e-mails, notifications). */
export function enregistrerLangue() {
  if (!useMoi().value) return Promise.resolve()
  return $fetch('/api/moi/langue', {
    method: 'POST',
    body: { choix: etatLangue.choix === 'auto' ? null : etatLangue.choix, langue: langue.value }
  }).catch(() => null)
}

/** Dans un composant : `const { t, langue } = useLangue()`. */
export function useLangue() {
  return { t, langue, locale, nombre, choix: computed(() => etatLangue.choix), choisirLangue }
}

if (typeof window !== 'undefined') {
  // La langue du système peut changer pendant que l'app tourne.
  window.addEventListener('languagechange', () => { etatLangue.systeme = langueSysteme() })
  watch(langue, (l) => { document.documentElement.lang = l; charger(l) }, { immediate: true })
}
