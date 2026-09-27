/**
 * Le sens du glissement entre deux pages.
 *
 * Entrer dans une liste, c'est aller plus profond : elle arrive par la droite
 * et pousse l'accueil vers la gauche. En ressortir fait l'inverse — la liste
 * repart a droite, l'accueil revient de la gauche. La barre du bas vit DANS
 * la page de la liste, donc elle glisse avec elle : on sent qu'on entre
 * quelque part, au lieu de voir un ecran etre remplace.
 *
 * Pourquoi un attribut plutot que deux noms de transition : Vue fige le nom
 * sur l'element au moment ou il est MONTE. Avec « avant » et « arriere »
 * comme noms, la liste — montee avec « avant » — ressortait en jouant
 * `avant-leave`, donc vers la gauche, quoi qu'on mette dans le meta de la
 * route d'arrivee. Un seul nom, et la direction lue au dernier moment dans
 * l'attribut : les deux pages s'accordent forcement.
 *
 * Les onglets d'une liste ne passent pas par ici : le pager reecrit l'adresse
 * avec history.replaceState, sans navigation. Seul le passage accueil <-> liste
 * glisse, et c'est bien le seul qui change de niveau.
 */
const profondeur = (chemin: string) => chemin.startsWith('/g/') ? 1 : 0

/**
 * La connexion et les pages légales ne glissent pas : un fondu, l'une APRÈS
 * l'autre (`out-in`), dans les deux sens. Revenir des conditions à la
 * connexion faisait arriver le formulaire d'un coup, par le bas, sur certains
 * navigateurs — deux pages superposées le temps d'une image. Ici il n'y en a
 * jamais deux à la fois, et rien ne bouge : on n'entre nulle part, on lit un
 * texte et on revient.
 */
const calme = (chemin: string) => estPageLegale(chemin) || chemin.startsWith('/connexion')
const FONDU = { name: 'fondu', mode: 'out-in' } as const

export default defineNuxtRouteMiddleware((vers, depuis) => {
  if (!import.meta.client || vers.fullPath === depuis.fullPath) return
  if (calme(vers.path) || calme(depuis.path)) {
    vers.meta.pageTransition = { ...FONDU }
    return
  }
  document.documentElement.dataset.sens =
    profondeur(vers.path) >= profondeur(depuis.path) ? 'avant' : 'arriere'
})
