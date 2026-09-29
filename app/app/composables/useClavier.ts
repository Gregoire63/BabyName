/**
 * La partie de l'ecran que le clavier du telephone laisse visible.
 *
 * Une feuille est posee en bas de l'ecran (`position: fixed; inset: 0`). Quand
 * le clavier se pose PAR-DESSUS la page au lieu de la redimensionner (iPhone,
 * et Android selon le navigateur), la feuille — le champ ou l'on tape et les
 * resultats — passait dessous. Seule la « vue visible » (VisualViewport) sait
 * ce qui reste a l'ecran.
 *
 * Premiere version : on mesurait la hauteur cachee EN BAS
 * (innerHeight - vv.height - vv.offsetTop) et la feuille remontait d'autant.
 * Faux des que le navigateur fait defiler la vue pour montrer le champ
 * (vv.offsetTop > 0, iPhone surtout) : la soustraction ramenait la hauteur
 * cachee vers 0, rien ne remontait, et les resultats restaient sous le
 * clavier. On ne calcule donc plus un ecart : on donne a la feuille le
 * RECTANGLE visible lui-meme (haut + hauteur), quel que soit le defilement.
 *
 * Quand la page se redimensionne elle-meme (Android + `interactive-widget=
 * resizes-content`, nuxt.config), innerHeight suit le clavier : `ouvert`
 * reste faux et rien n'est compense deux fois.
 */
export function useClavier() {
  /** Le clavier cache une partie de la page (> 60 px : pas juste une barre du navigateur). */
  const ouvert = ref(false)
  /** Haut de la partie visible, en px depuis le haut de la page fixe. */
  const haut = ref(0)
  /** Hauteur de la partie visible, en px. */
  const visible = ref(0)
  if (!import.meta.client) return { ouvert, haut, visible }

  const vv = window.visualViewport
  if (!vv) return { ouvert, haut, visible }

  let image = 0
  const mesurer = () => {
    cancelAnimationFrame(image)
    image = requestAnimationFrame(() => {
      ouvert.value = window.innerHeight - vv.height > 60
      haut.value = Math.max(0, Math.round(vv.offsetTop))
      visible.value = Math.round(vv.height)
    })
  }
  onMounted(() => {
    mesurer()
    vv.addEventListener('resize', mesurer)
    vv.addEventListener('scroll', mesurer)
  })
  onBeforeUnmount(() => {
    cancelAnimationFrame(image)
    vv.removeEventListener('resize', mesurer)
    vv.removeEventListener('scroll', mesurer)
  })
  return { ouvert, haut, visible }
}
