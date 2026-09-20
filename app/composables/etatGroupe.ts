import type { InjectionKey, Ref, ComputedRef } from 'vue'
import type { Prenom, Filtres } from '~/composables/useCatalogue'

/**
 * Etat partage d'une liste. Les quatre onglets vivent simultanement dans le
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
  /** Les prenoms sur lesquels tout le monde s'accorde. Charges avec le reste :
   *  l'onglet Classement en a besoin pour sa pastille avant meme d'etre ouvert. */
  communs: Ref<any[]>
  rechargerCommuns: () => Promise<void>
  /**
   * TOUS les votes que j'ai le droit de voir : les miens, plus ceux des autres
   * sur les prenoms que j'ai deja juges. C'est le serveur qui applique la regle
   * du vote aveugle (server/utils/votes.ts) ; ici on ne fait que lire.
   */
  votes: Ref<{ prenom: string; user_id: string; pseudo: string; valeur: number }[]>
  rechargerVotes: () => Promise<void>
  /** Changer mon vote sur un prenom, depuis n'importe quel ecran. */
  voter: (prenom: string, valeur: 0 | 1 | 2) => Promise<void>
  pret: Ref<boolean>
  recharger: () => Promise<void>
  ouvrirFiche: (nom: string) => void
  ouvrirFiltres: () => void
  /** allerA('classement', 'revoir') : onglet, et volet si le tiroir en a. */
  allerA: (onglet: string, segment?: string) => void
}

export const CLE_GROUPE = Symbol('groupe') as InjectionKey<EtatGroupe>

/**
 * Le build ne fait pas de verification de types (vue-tsc et TypeScript ne
 * s'accordent pas sur cette version). Resultat : oublier un champ dans le
 * `provide` de VueGroupe passait la compilation, et l'ecran se cassait a
 * l'execution sur un « Cannot read properties of undefined ». Le garde-fou
 * ci-dessous nomme le champ manquant. Il ne coute rien : `import.meta.dev`
 * vaut false a la compilation, le bloc disparait du bundle.
 */
const CHAMPS = [
  'gid', 'etat', 'catalogue', 'parNom', 'origines', 'filtres', 'dejaVotes',
  'aimes', 'vetos', 'favoris', 'communs', 'rechargerCommuns', 'votes',
  'rechargerVotes', 'voter', 'pret', 'recharger', 'ouvrirFiche',
  'ouvrirFiltres', 'allerA'
] as const

export function useGroupeCourant(): EtatGroupe {
  const g = inject(CLE_GROUPE)
  if (!g) throw new Error('useGroupeCourant() appele hors d\'une VueGroupe')
  if (import.meta.dev) {
    const manque = CHAMPS.filter(c => !(c in g))
    if (manque.length) {
      throw new Error(
        `Etat de groupe incomplet : ${manque.join(', ')} — VueGroupe ne le(s) fournit pas.`)
    }
  }
  return g
}
