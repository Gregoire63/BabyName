import { t, langue, locale } from '~/composables/useLangue'

/**
 * Ce que débloque l'achat d'une liste — une seule source pour les deux écrans
 * qui le disent (la feuille « Débloquer cette liste » et la carte des
 * réglages). Deux copies finiraient par ne plus dire la même chose, et c'est
 * précisément ce qu'on ne peut pas se permettre sur ce qui est vendu.
 *
 * `court` : le titre seul, pour la carte des réglages.
 *
 * Les textes sont dans app/textes/utilOffre.ts ; `titre` et `texte` sont lus
 * à l'affichage (des accesseurs), pour suivre la langue choisie.
 */
const ELEMENTS = ['illimites', 'nomFamille', 'classe', 'profil', 'desaccord', 'invites'] as const

export const INCLUS_DEBLOCAGE = ELEMENTS.map(id => ({
  id,
  get titre() { return t(`utilOffre.${id}_titre`) },
  get texte() { return t(`utilOffre.${id}_texte`) }
}))

/**
 * La mention TVA sous un prix, dans la langue affichée (mentionTva, dans
 * shared/utils/editeur.ts, reste en français : la facture et le serveur).
 */
export function mentionTvaLocale(): string {
  return t(`utilOffre.tva_${EDITEUR.tva}`)
}

/**
 * Le prix du site (« 6 € ») écrit à la manière de la langue affichée, en
 * euros toujours (« €6 » en anglais). En français, tel quel. Un prix qui ne se
 * lit pas (celui d'Apple, formulé par Apple) est rendu tel quel.
 */
export function prixLocal(prix: string): string {
  if (langue.value === 'fr') return prix
  const m = /^\s*(\d+(?:[.,]\d{1,2})?)\s*€\s*$/.exec(prix ?? '')
  if (!m) return prix
  const n = Number(m[1]!.replace(',', '.'))
  const entier = Number.isInteger(n)
  return n.toLocaleString(locale.value, {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: entier ? 0 : 2, maximumFractionDigits: 2
  })
}
