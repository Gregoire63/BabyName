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
 *  - Échap ferme — seulement le dialogue du dessus quand deux s'empilent ;
 *  - il se ferme de lui-même s'il devient inerte (voir lacherSiInerte).
 *
 * Le rôle, `aria-modal` et `aria-labelledby` restent dans le gabarit : c'est
 * là qu'on les lit.
 */
const pile: symbol[] = []

/**
 * « Un dialogue est ouvert », dit à la feuille de style : `html.dialogue`.
 *
 * Le fond qui respire se fige sous un dialogue (Ambiance.vue). Il le lisait
 * dans `body:has([aria-modal="true"])` — une règle que le navigateur doit
 * revérifier à CHAQUE changement de la page, en la parcourant tout entière
 * pour s'assurer qu'aucun dialogue n'y est apparu. Sur une liste bien
 * remplie, c'était l'essentiel du style recalculé après chaque vote : sept
 * parcours de milliers de nœuds par carte. Une classe posée ici, aux deux
 * seuls moments où la réponse change, ne coûte rien entre-temps.
 */
const marquer = () => document.documentElement.classList.toggle('dialogue', pile.length > 0)

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

  /**
   * Un dialogue qu'on ne peut plus toucher ne retient pas la page.
   *
   * Il rend inerte tout ce qui n'est pas lui. S'il le devient à son tour —
   * son onglet est passé de côté pendant qu'il était ouvert — plus rien ne
   * répond, ni lui ni le reste, et il faut recharger la page. Le cas existe :
   * la recherche ouverte dans le tri, la fête d'un accord qui arrive
   * par-dessus, et « Voir nos accords », qui change d'onglet (essai-fete).
   *
   * Plutôt que de compter sur chaque écran pour y penser, le dialogue du
   * DESSUS se ferme dès qu'un de ses ancêtres est inerte. Celui du dessous
   * l'est normalement, le temps que l'autre se ferme : on ne le touche pas.
   */
  let guet: MutationObserver | null = null
  function lacherSiInerte() {
    const el = racine.value
    if (el && pile[pile.length - 1] === moi && el.closest('[inert]')) fermer()
  }

  function ouvrir(el: HTMLElement) {
    if (pile.includes(moi)) return
    precedent = document.activeElement instanceof HTMLElement ? document.activeElement : null
    pile.push(moi)
    marquer()
    defaire = isoler(el)
    // Après isoler : ses propres `inert` ne sont pas des nouvelles.
    guet = new MutationObserver(lacherSiInerte)
    guet.observe(document.body, { attributes: true, attributeFilter: ['inert'], subtree: true })
    lacherSiInerte()
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
    marquer()
    document.removeEventListener('keydown', auClavier, true)
    guet?.disconnect(); guet = null
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
