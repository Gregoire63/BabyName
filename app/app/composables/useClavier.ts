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
 * Deuxieme version : « le clavier est sorti » se lisait dans
 * `innerHeight - vv.height`. Or innerHeight n'est pas la meme chose partout :
 * certains navigateurs le font suivre la vue visible sans redimensionner la
 * page (Firefox sur iPhone, des navigateurs integres), et l'ecart reste a 0
 * alors que la feuille est bel et bien sous le clavier. On mesure donc ce
 * qu'on veut vraiment savoir : la hauteur du cadre des elements fixes — une
 * sonde `position: fixed; top: 0; bottom: 0` — face a la vue visible.
 *
 * Quand la page se redimensionne elle-meme (Android + `interactive-widget=
 * resizes-content`, nuxt.config), la sonde retrecit avec elle : `ouvert`
 * reste faux et rien n'est compense deux fois.
 *
 * Et quand le navigateur ne dit RIEN (ni page redimensionnee, ni vue visible
 * a jour), aucun calcul ne sauve la feuille : c'est a elle de garder ce qui
 * compte en haut de l'ecran. Voir la prop `haute` de Feuille.vue.
 */

/** Ce que couvre `position: fixed; inset: 0`, mesure et non suppose. */
let sonde: HTMLElement | null = null
function hauteurDuCadre(): number {
  if (!sonde || !sonde.isConnected) {
    sonde = document.createElement('div')
    sonde.setAttribute('aria-hidden', 'true')
    sonde.style.cssText = 'position:fixed;top:0;bottom:0;left:0;width:0;visibility:hidden;pointer-events:none'
    document.body.appendChild(sonde)
  }
  return sonde.offsetHeight || window.innerHeight
}

export function useClavier() {
  /** Le clavier cache une partie de la page (> 60 px : pas juste une barre du navigateur). */
  const ouvert = ref(false)
  /** Haut de la partie visible, en px depuis le haut de la page fixe. */
  const haut = ref(0)
  /** Hauteur de la partie visible, en px. */
  const visible = ref(0)
  /** Hauteur du cadre des elements fixes : la ou une feuille se pose, clavier ou pas. */
  const cadre = ref(0)
  if (!import.meta.client) return { ouvert, haut, visible, cadre }

  const vv = window.visualViewport
  if (!vv) return { ouvert, haut, visible, cadre }

  let image = 0
  let retard = 0
  const mesurer = () => {
    cancelAnimationFrame(image)
    image = requestAnimationFrame(() => {
      // (Zoome au doigt, la vue visible retrecit aussi : la feuille se range
      // alors dans ce qu'on voit, comme derriere un clavier — ca convient.)
      cadre.value = hauteurDuCadre()
      ouvert.value = cadre.value - vv.height > 60
      haut.value = Math.max(0, Math.round(vv.offsetTop))
      visible.value = Math.round(vv.height)
    })
  }
  // Le clavier sort apres le focus, en glissant : on remesure une fois pose.
  // (Et un navigateur qui oublie l'evenement de la vue visible est rattrape.)
  const plusTard = () => {
    mesurer()
    clearTimeout(retard)
    retard = window.setTimeout(mesurer, 350)
  }
  onMounted(() => {
    mesurer()
    vv.addEventListener('resize', mesurer)
    vv.addEventListener('scroll', mesurer)
    window.addEventListener('resize', mesurer)
    document.addEventListener('focusin', plusTard)
    document.addEventListener('focusout', plusTard)
  })
  onBeforeUnmount(() => {
    cancelAnimationFrame(image)
    clearTimeout(retard)
    vv.removeEventListener('resize', mesurer)
    vv.removeEventListener('scroll', mesurer)
    window.removeEventListener('resize', mesurer)
    document.removeEventListener('focusin', plusTard)
    document.removeEventListener('focusout', plusTard)
  })
  return { ouvert, haut, visible, cadre }
}
