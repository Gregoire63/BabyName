/**
 * Quelle liste on est en train de trier.
 *
 * L'accueil mettait en avant `groupes[0]` et rangeait tout le reste dans
 * « Mes autres listes » — si bien que la liste qu'on venait de quitter
 * s'affichait comme une AUTRE liste. Ce n'est pas l'ordre de creation qui fait
 * la liste courante, c'est la derniere ouverte.
 *
 * Stocke par appareil : c'est une commodite d'affichage, pas une donnee du
 * compte. Elle n'a aucune raison de traverser le reseau.
 */
const CLE = 'bn_liste_courante'

export function marquerListeCourante(gid: string) {
  try { localStorage.setItem(CLE, gid) } catch { /* navigation privee */ }
}

export function listeCourante(): string | null {
  try { return localStorage.getItem(CLE) } catch { return null }
}

/** Une liste supprimée ne reste pas « en cours » sur cet appareil. */
export function oublierListeCourante(gid: string) {
  try { if (localStorage.getItem(CLE) === gid) localStorage.removeItem(CLE) } catch { /* navigation privee */ }
}
