/**
 * Clair, sombre, ou comme le téléphone.
 *
 * Un réglage de l'APPAREIL, pas du compte : on peut vouloir du sombre le soir
 * sur son téléphone et du clair sur l'ordinateur du bureau. Il vit donc dans
 * le navigateur (localStorage), pas en base.
 *
 * Trois états, un seul attribut sur <html> :
 *  - « Système » : pas d'attribut, la media query prefers-color-scheme décide
 *    (et suit le téléphone quand il bascule le soir) ;
 *  - « Clair » : data-theme="light", qui neutralise la media query ;
 *  - « Sombre » : data-theme="dark", qui pose les couleurs sombres même sur un
 *    téléphone réglé en clair.
 * Les couleurs elles-mêmes sont dans app.vue. Le même choix est relu AVANT le
 * premier affichage par le petit script de nuxt.config (sinon un « Sombre »
 * s'affichait une fraction de seconde en clair au chargement).
 *
 * DANS L'APP DES STORES, « SYSTÈME » NE PEUT PAS S'EN REMETTRE À LA MEDIA
 * QUERY : la vue web ne connaît pas toujours l'apparence du téléphone (celle
 * d'Android répond d'après le thème de l'app qui l'héberge — « clair » sur un
 * téléphone en sombre, vu le 07/10/2026). Le natif, lui, la connaît, et la
 * dit : à l'ouverture dans son agent utilisateur, puis par le pont quand le
 * téléphone bascule (`apparenceDuTelephone`). « Système » pose alors
 * l'attribut lui-même, d'après le téléphone, sans que ce soit un choix : le
 * réglage affiché reste « Système », et rien n'est écrit dans le navigateur.
 */
export type Theme = 'clair' | 'systeme' | 'sombre'

export const CLE_THEME = 'pr_theme'

/** Une seule valeur pour toute l'app : les réglages et « Mon compte » se suivent. */
const choix = ref<Theme>('systeme')
let lu = false

/**
 * L'apparence du téléphone, dite par l'app des stores. Null : un navigateur,
 * ou une app d'avant qui ne la dit pas — la media query décide, comme toujours.
 */
const telephone = ref<'sombre' | 'claire' | null>(
  typeof navigator === 'undefined' ? null : coquilleDepuis(navigator.userAgent)?.apparence ?? null)

function lire(): Theme {
  try {
    const v = localStorage.getItem(CLE_THEME)
    return v === 'clair' || v === 'sombre' ? v : 'systeme'
  } catch { return 'systeme' }
}

export function appliquerTheme(t: Theme) {
  const r = document.documentElement
  const sombre = t === 'systeme' ? (telephone.value === null ? null : telephone.value === 'sombre') : t === 'sombre'
  if (sombre === null) r.removeAttribute('data-theme')
  else r.setAttribute('data-theme', sombre ? 'dark' : 'light')
}

/**
 * Le téléphone vient de changer d'apparence (le soir, ou dans ses réglages) :
 * le natif le dit par le pont (plugins/coquille). « Système » suit aussitôt ;
 * un choix « Clair » ou « Sombre » ne bouge pas. Vrai si c'est une nouvelle.
 */
export function apparenceDuTelephone(sombre: boolean): boolean {
  const dite = sombre ? 'sombre' : 'claire'
  if (telephone.value === dite) return false
  telephone.value = dite
  if (!lu) { choix.value = lire(); lu = true }
  if (choix.value === 'systeme') appliquerTheme('systeme')
  return true
}

export function useTheme() {
  if (import.meta.client && !lu) { choix.value = lire(); lu = true }

  function choisir(t: Theme) {
    choix.value = t
    try {
      if (t === 'systeme') localStorage.removeItem(CLE_THEME)
      else localStorage.setItem(CLE_THEME, t)
    } catch { /* navigation privée : le choix vaut pour cette visite */ }
    appliquerTheme(t)
  }
  return { choix: readonly(choix), choisir }
}
