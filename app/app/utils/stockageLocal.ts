/**
 * Ce que l'app garde dans le navigateur (liste en cours, accords deja vus,
 * rappel de pause) appartient a la personne connectee. A la deconnexion ou a
 * l'effacement du compte, on le vide : sur un telephone partage, le suivant
 * n'a pas a heriter de la liste du precedent. La politique de
 * confidentialite le promet — c'est ici que la promesse est tenue.
 *
 * Le cache hors ligne (service worker) n'est pas touche : il ne contient que
 * l'application et le catalogue, rien de personnel.
 */
export function viderStockageLocal() {
  try { localStorage.clear() } catch { /* navigation privee, stockage bloque */ }
  try { sessionStorage.clear() } catch { /* idem */ }
}
