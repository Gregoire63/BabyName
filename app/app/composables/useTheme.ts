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
 */
export type Theme = 'clair' | 'systeme' | 'sombre'

export const CLE_THEME = 'pr_theme'

/** Une seule valeur pour toute l'app : les réglages et « Mon compte » se suivent. */
const choix = ref<Theme>('systeme')
let lu = false

function lire(): Theme {
  try {
    const v = localStorage.getItem(CLE_THEME)
    return v === 'clair' || v === 'sombre' ? v : 'systeme'
  } catch { return 'systeme' }
}

export function appliquerTheme(t: Theme) {
  const r = document.documentElement
  if (t === 'systeme') r.removeAttribute('data-theme')
  else r.setAttribute('data-theme', t === 'sombre' ? 'dark' : 'light')
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
