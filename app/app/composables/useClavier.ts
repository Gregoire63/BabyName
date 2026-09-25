/**
 * La place que le clavier du telephone prend en bas de l'ecran.
 *
 * Une feuille est posee en bas de l'ecran (`position: fixed; bottom: 0`). Sur
 * iPhone, le clavier ne redimensionne pas la page : il se pose PAR-DESSUS, et
 * la feuille — avec le champ ou l'on tape et les resultats — passait dessous.
 * Seule la « vue visible » (VisualViewport) sait ce qui reste a l'ecran : on
 * en tire la hauteur cachee en bas, et la feuille remonte d'autant.
 *
 * Sur Android, la balise viewport demande `interactive-widget=resizes-content`
 * (nuxt.config) : la page se redimensionne elle-meme, l'ecart mesure ici y
 * vaut 0 et rien n'est compense deux fois.
 *
 * `bas` : les pixels caches en bas. `visible` : la hauteur encore visible —
 * une feuille haute doit y tenir, sinon son haut sort par le haut.
 */
export function useClavier() {
  const bas = ref(0)
  const visible = ref(0)
  if (!import.meta.client) return { bas, visible }

  const vv = window.visualViewport
  if (!vv) return { bas, visible }

  const mesurer = () => {
    const cache = window.innerHeight - vv.height - vv.offsetTop
    // Sous 60 px, ce sont les barres du navigateur qui bougent, pas un clavier.
    bas.value = cache > 60 ? Math.round(cache) : 0
    visible.value = Math.round(vv.height)
  }
  onMounted(() => {
    mesurer()
    vv.addEventListener('resize', mesurer)
    vv.addEventListener('scroll', mesurer)
  })
  onBeforeUnmount(() => {
    vv.removeEventListener('resize', mesurer)
    vv.removeEventListener('scroll', mesurer)
  })
  return { bas, visible }
}
