/**
 * Ce qu'il y a dans un champ, à chaque frappe.
 *
 *   <input :value="recherche" @input="recherche = frappe($event)">
 *
 * À la place de `v-model`, pour tout champ auquel l'écran RÉPOND pendant
 * qu'on écrit : une liste qui se filtre, un bouton qui se dégrise.
 *
 * `v-model` attend la fin d'une « composition » pour mettre son modèle à
 * jour. C'est prévu pour les claviers chinois ou japonais, où plusieurs
 * touches font un caractère ; mais un clavier Android compose AUSSI le mot
 * français en cours (il le souligne, les suggestions défilent) et ne le
 * valide qu'à l'espace, à Entrée ou quand on le range. Avec v-model, on
 * tapait « mar » dans la recherche d'un prénom, le champ l'affichait, et la
 * liste restait vide tant que le clavier était sorti ; Entrée validait le mot
 * et prenait dans la foulée un premier résultat que personne n'avait vu.
 *
 * L'événement `input`, lui, part à chaque lettre, composition ou pas.
 *
 * Un champ qu'on ne lit qu'à l'envoi (un nom, un commentaire) peut garder
 * v-model : quitter le champ ou toucher le bouton termine la composition.
 */
export const frappe = (e: Event) => (e.target as HTMLInputElement).value
