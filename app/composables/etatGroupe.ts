import type { InjectionKey, Ref, ComputedRef } from 'vue'
import type { Prenom, Filtres } from '~/composables/useCatalogue'

/**
 * Etat partage d'une liste. Les cinq onglets vivent simultanement dans le
 * meme pager : ils ne peuvent pas chacun recharger /api/groupes/:id. Un seul
 * chargement, injecte, et chaque section n'appelle que ce qui lui est propre.
 */
export interface EtatGroupe {
  gid: string
  etat: Ref<any>
  catalogue: Ref<Prenom[]>
  parNom: ComputedRef<Map<string, Prenom>>
  origines: Ref<string[]>
  filtres: Ref<Filtres>
  dejaVotes: Ref<Set<string>>
  aimes: Ref<Prenom[]>
  vetos: Ref<Set<string>>
  favoris: Ref<Set<string>>
  pret: Ref<boolean>
  recharger: () => Promise<void>
  ouvrirFiche: (nom: string) => void
  ouvrirFiltres: () => void
  allerA: (onglet: string) => void
}

export const CLE_GROUPE = Symbol('groupe') as InjectionKey<EtatGroupe>
export const useGroupeCourant = () => inject(CLE_GROUPE)!
