import type { Ref } from 'vue'

/**
 * Feuille que l'on tire vers le bas pour fermer.
 *
 * Trois pieges evites ici :
 *  - un geste qui demarre sur un bouton n'est pas un geste : voir `debut`.
 *  - le contenu de la feuille defile. Tirer vers le bas au milieu d'une liste
 *    deja defilee doit faire remonter la liste, pas fermer la feuille : on
 *    n'arme le geste que si le contenu est en haut (scrollTop a 0).
 *  - un relachement sous le seuil doit revenir en place en douceur, sinon la
 *    feuille « colle » au doigt et parait cassee.
 */
export function useFeuille(fermer: () => void, contenu?: Ref<HTMLElement | undefined>) {
  const y = ref(0)
  const glisse = ref(false)
  const SEUIL = 110          // px avant de considerer que l'on veut fermer
  const VITESSE = 0.55       // px/ms : un geste vif ferme meme sans aller loin

  let y0 = 0
  let t0 = 0
  let arme = false

  function debut(e: PointerEvent) {
    // Un geste qui commence sur une commande appartient a la commande. Sans ce
    // garde-fou, setPointerCapture detourne la suite des evenements vers la
    // zone de prise et le clic n'arrive JAMAIS au bouton : la croix de
    // fermeture ne fermait rien.
    if ((e.target as HTMLElement)?.closest?.('button, a, input, label, select, textarea')) return
    // On ne prend la main que si rien n'est defile au-dessus.
    arme = (contenu?.value?.scrollTop ?? 0) <= 0
    if (!arme) return
    glisse.value = true
    y0 = e.clientY
    t0 = performance.now()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  function bouge(e: PointerEvent) {
    if (!glisse.value) return
    // Vers le haut : resistance, la feuille ne monte pas indefiniment.
    const d = e.clientY - y0
    y.value = d > 0 ? d : d / 4
  }

  function fin(e: PointerEvent) {
    if (!glisse.value) return
    glisse.value = false
    const vitesse = y.value / Math.max(1, performance.now() - t0)
    if (y.value > SEUIL || (y.value > 40 && vitesse > VITESSE)) {
      y.value = window.innerHeight        // on laisse la transition l'emporter
      setTimeout(fermer, 180)
      return
    }
    y.value = 0
  }

  const style = computed(() => y.value
    ? { transform: `translateY(${Math.max(0, y.value)}px)`,
        transition: glisse.value ? 'none' : 'transform .22s cubic-bezier(.2,.8,.3,1)' }
    : {})

  return { y, glisse, debut, bouge, fin, style }
}
