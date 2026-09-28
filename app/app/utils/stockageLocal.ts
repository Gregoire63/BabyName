import { CLE_THEME } from '~/composables/useTheme'
import { oublierListeCourante } from '~/composables/useListeCourante'

/**
 * Ce que l'app garde dans le navigateur (liste en cours, accords deja vus,
 * rappel de pause) appartient a la personne connectee. A la deconnexion ou a
 * l'effacement du compte, on le vide : sur un telephone partage, le suivant
 * n'a pas a heriter de la liste du precedent. La politique de
 * confidentialite le promet — c'est ici que la promesse est tenue.
 *
 * Le cache hors ligne (service worker) n'est pas touche : il ne contient que
 * l'application et le catalogue, rien de personnel. Le theme (clair, sombre)
 * non plus : c'est un reglage de l'APPAREIL, pas une donnee du compte.
 */
export function viderStockageLocal() {
  let theme: string | null = null
  try { theme = localStorage.getItem(CLE_THEME) } catch { /* stockage bloque */ }
  try { localStorage.clear() } catch { /* navigation privee, stockage bloque */ }
  try { if (theme) localStorage.setItem(CLE_THEME, theme) } catch { /* idem */ }
  try { sessionStorage.clear() } catch { /* idem */ }
}

/**
 * Ce que cet appareil gardait d'une liste supprimée : la liste en cours, les
 * accords déjà vus, le prénom épinglé, les compteurs du jour (VueGroupe,
 * SectionTrier). Les ids ne resservent pas (autoincrement) : rien ne se
 * mélangerait, mais une liste effacée n'a plus rien à faire sur l'appareil.
 */
export function oublierListe(gid: string) {
  oublierListeCourante(gid)
  try {
    for (const k of Object.keys(localStorage)) {
      if (k === `communs-vus:${gid}` || k === `pr_epingle_${gid}` || k.startsWith(`pr_${gid}_`)) {
        localStorage.removeItem(k)
      }
    }
  } catch { /* navigation privee, stockage bloque */ }
}
