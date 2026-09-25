import type { Ref } from 'vue'

/**
 * Un dialogue qui en est un — pour le clavier et pour un lecteur d'écran.
 *
 * Les feuilles, la fiche d'un prénom, la fête d'un accord et la confirmation
 * « écarter la famille » se dessinaient par-dessus l'écran sans rien en dire :
 * au clavier on continuait de tabuler DERRIÈRE le voile, un lecteur d'écran
 * lisait la page du dessous, et Échap ne fermait rien. RGAA 7.1 et 12.8 ;
 * WCAG 2.1.2, 2.4.3, 4.1.2.
 *
 * Ce que fait ce composable, une fois l'élément du dialogue monté :
 *  - il retient l'élément qui avait le focus, et le lui rend à la fermeture ;
 *  - il met le focus DANS le dialogue (sur le dialogue lui-même : le lecteur
 *    annonce son titre, plutôt que de tomber au milieu d'un champ) ;
 *  - il rend le reste de la page inerte (`inert`) : ni tabulable, ni lu,
 *    ni cliquable — y compris pour VoiceOver, qui ignore parfois aria-modal ;
 *  - Tab et Maj+Tab bouclent à l'intérieur ;
 *  - Échap ferme — seulement le dialogue du dessus quand deux s'empilent.
 *
 * Le rôle, `aria-modal` et `aria-labelledby` restent dans le gabarit : c'est
 * là qu'on les lit.
 */
const pile: symbol[] = []

const FOCUSABLES = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
  'summary'
].join(',')

function visibles(racine: HTMLElement): HTMLElement[] {
  return [...racine.querySelectorAll<HTMLElement>(FOCUSABLES)]
    .filter(el => !el.closest('[inert]') && el.getClientRects().length > 0)
}

/** Rend inerte tout ce qui n'est pas `el` ni un de ses ancêtres. Renvoie de quoi défaire. */
function isoler(el: HTMLElement): () => void {
  const rendus: HTMLElement[] = []
  let noeud: HTMLElement | null = el
  while (noeud && noeud !== document.body) {
    const parent: HTMLElement | null = noeud.parentElement
    if (!parent) break
    for (const frere of Array.from(parent.children) as HTMLElement[]) {
      if (frere === noeud || frere.inert) continue
      // Les zones d'annonce restent vivantes : un message « Copiée » ou le
      // changement de page doit encore être lu pendant qu'un dialogue est ouvert.
      if (frere.matches('[aria-live], .nuxt-route-announcer')) continue
      frere.inert = true
      rendus.push(frere)
    }
    noeud = parent
  }
  return () => { for (const r of rendus) r.inert = false }
}

export function useDialogue(racine: Ref<HTMLElement | undefined | null>, fermer: () => void) {
  const moi = Symbol('dialogue')
  let precedent: HTMLElement | null = null
  let defaire: (() => void) | null = null

  function auClavier(e: KeyboardEvent) {
    const el = racine.value
    if (!el || pile[pile.length - 1] !== moi) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      fermer()
      return
    }
    if (e.key !== 'Tab') return
    const f = visibles(el)
    if (!f.length) { e.preventDefault(); el.focus(); return }
    const premier = f[0]!, dernier = f[f.length - 1]!
    const ici = document.activeElement
    if (e.shiftKey && (ici === premier || ici === el || !el.contains(ici))) {
      e.preventDefault(); dernier.focus()
    } else if (!e.shiftKey && (ici === dernier || !el.contains(ici))) {
      e.preventDefault(); premier.focus()
    }
  }

  function ouvrir(el: HTMLElement) {
    if (pile.includes(moi)) return
    precedent = document.activeElement instanceof HTMLElement ? document.activeElement : null
    pile.push(moi)
    defaire = isoler(el)
    document.addEventListener('keydown', auClavier, true)
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    // preventScroll : le dialogue arrive en glissant, un défilement forcé
    // pendant l'animation la ferait sauter.
    requestAnimationFrame(() => el.focus({ preventScroll: true }))
  }

  function refermer() {
    const i = pile.indexOf(moi)
    if (i < 0) return
    pile.splice(i, 1)
    document.removeEventListener('keydown', auClavier, true)
    defaire?.(); defaire = null
    // On rend le focus à ce qui l'avait — s'il existe encore et n'est pas
    // lui-même devenu inerte (un dialogue d'en dessous, par exemple).
    const cible = precedent
    precedent = null
    if (cible && cible.isConnected && !cible.closest('[inert]')) cible.focus({ preventScroll: true })
  }

  watch(racine, (el, avant) => {
    if (el && !avant) ouvrir(el)
    else if (!el && avant) refermer()
  }, { flush: 'post' })

  onMounted(() => { if (racine.value) ouvrir(racine.value) })
  onBeforeUnmount(refermer)
}
