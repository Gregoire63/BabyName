import { CLE_THEME } from '~/composables/useTheme'

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
