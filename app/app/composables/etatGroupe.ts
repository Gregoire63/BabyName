import type { InjectionKey, Ref, ComputedRef, ShallowRef } from 'vue'
import type { Prenom, Filtres } from '~/composables/useCatalogue'

/** Un prénom « déjà pris » : retiré pour toute la liste, et dit. */
export interface EntreeDejaPris {
  /** La graphie choisie. */
  prenom: string
  /** Les autres graphies, retirées avec elle. */
  variantes: string[]
  /** Qui le porte, pourquoi — visible de toute la liste. */
  motif: string | null
  /** Le nom affiché de qui l'a ajouté ; null si son compte a été effacé. */
  auteur: string | null
  mien: boolean
  pose_le?: string
}

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
  /** TOUT ce qui est retire du jeu, graphies comprises : les blocages
   *  secrets (qui les a poses ne sort pas du serveur) et les deja pris. Il
   *  faut les connaitre pour les retirer de la pile, des accords, de « A
   *  revoir ». */
  vetos: ComputedRef<Set<string>>
  /** Mes blocages secrets, avec leur motif et leurs graphies — les seuls que
   *  j'ai le droit de voir. */
  mesVetos: Ref<{ prenom: string; motif: string | null; variantes: string[] }[]>
  /** Bloquer en secret (le prenom et toutes ses graphies, un seul blocage). */
  poserVeto: (prenom: string, motif?: string) => Promise<void>
  retirerVeto: (prenom: string) => Promise<void>
  /** Les prenoms deja pris de la liste, visibles de tous ses membres. */
  dejaPris: Ref<EntreeDejaPris[]>
  /** Chaque graphie d'un prenom deja pris → son entree. */
  parDejaPris: ComputedRef<Map<string, EntreeDejaPris>>
  ajouterDejaPris: (prenom: string, motif?: string) => Promise<void>
  retirerDejaPris: (prenom: string) => Promise<void>
  /** Les autres graphies d'un prenom (meme prononciation), filtres ignores. */
  graphiesDe: (prenom: string) => string[]
  favoris: Ref<Set<string>>
  basculerFavori: (prenom: string) => Promise<void>
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
  /** Changer mon vote sur un prenom, depuis n'importe quel ecran. Vrai si ce
   *  vote vient de FAIRE un accord (le prénom n'en était pas un, il en est un). */
  voter: (prenom: string, valeur: 0 | 1 | 2) => Promise<boolean>
  /** Fêter un accord, où qu'on soit dans la liste : la fête vit au-dessus des
   *  onglets (voir VueGroupe). `revoir` : y proposer « ce qui vous sépare ». */
  feter: (prenom: string, avec: string[], revoir?: boolean) => void
  pret: Ref<boolean>
  recharger: () => Promise<void>
  ouvrirFiche: (nom: string) => void
  ouvrirFiltres: () => void
  /** Ouvre la feuille « Debloquer » — appelee depuis le tri, les reglages
   *  et la fiche, donc elle vit au-dessus d'eux. */
  ouvrirDebloquer: () => void
  /**
   * Relit l'etat du paiement (une seule ligne cote serveur). Si l'autre parent
   * vient de debloquer la liste, recharge tout et le dit. Renvoie le statut.
   */
  verifierPaiement: () => Promise<StatutPaiement | null>
  /** allerA('classement', 'revoir') : onglet, et volet si le tiroir en a. */
  allerA: (onglet: string, segment?: string) => void
}

export interface StatutPaiement {
  paye: boolean
  /** Qui a paye (pseudo), une fois payee. */
  par: string | null
  /** Une page de paiement ouverte, pas encore payee. */
  en_cours: { par: string | null; moi: boolean; jusqu: string | null } | null
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
  'aimes', 'vetos', 'mesVetos', 'poserVeto', 'retirerVeto', 'dejaPris',
  'parDejaPris', 'ajouterDejaPris', 'retirerDejaPris', 'graphiesDe', 'favoris',
  'basculerFavori', 'communs', 'rechargerCommuns', 'votes', 'rechargerVotes',
  'voter', 'feter', 'pret', 'recharger', 'ouvrirFiche', 'ouvrirFiltres', 'allerA',
  'ouvrirDebloquer'
] as const

/**
 * LE MÊME ÉTAT, « EN VEILLE » : il ne bouge que pendant qu'on le regarde.
 *
 * Les onglets d'une liste et les volets du classement restent montés une fois
 * ouverts. Branchés en direct sur les votes, ils recalculaient et
 * redessinaient à chaque geste du tri des écrans que personne ne voyait
 * (voir EnVeille.vue, qui pose cet état pour tout ce qu'il contient).
 *
 * Ce qui change à chaque geste — les votes, les accords, les prénoms déjà
 * jugés, les oui, les favoris — est donc servi par une copie qui ne suit sa
 * source que tant que `actif()` est vrai, et la rattrape d'un coup quand il le
 * redevient. Hors de vue, l'effet ne lit même plus la source : zéro travail.
 *
 * Écrire dans la copie écrit dans la source (« l'ordre des accords », rangé
 * depuis un volet). Le reste — `etat`, les filtres, les fonctions — passe tel
 * quel : ça change rarement, et tout le monde doit le voir tout de suite.
 *
 * Une précaution pour ce qui vit dessous : une fonction qui attend le serveur
 * peut reprendre après qu'on a quitté son écran, et ce qu'elle relit alors
 * date du départ. On lit et on écrit dans le même geste, avant d'attendre
 * (PanneauMesChoix.remettre) ; ou on demande à la liste, qui sait toujours
 * (`voter` dit lui-même s'il vient de faire un accord).
 */
export function enVeille(g: EtatGroupe, actif: () => boolean): EtatGroupe {
  const suivre = <T>(source: Ref<T>): Ref<T> => {
    const vu = shallowRef(source.value) as ShallowRef<T>
    // `sync` : ce qu'un volet vient d'écrire, ou ce que le serveur vient de
    // répondre, se relit à la ligne suivante — pas au prochain rendu.
    watchEffect(() => { if (actif()) vu.value = source.value }, { flush: 'sync' })
    return computed({ get: () => vu.value, set: (v: T) => { source.value = v } }) as unknown as Ref<T>
  }
  return {
    ...g,
    votes: suivre(g.votes), communs: suivre(g.communs), dejaVotes: suivre(g.dejaVotes),
    aimes: suivre(g.aimes), favoris: suivre(g.favoris)
  }
}

/**
 * Meme etat, mais tolere l'absence.
 *
 * La fiche d'un prenom s'ouvre depuis l'accueil, qui est HORS liste : elle
 * doit pouvoir s'afficher sans groupe, en version publique.
 */
export function useGroupeSiPresent(): EtatGroupe | null {
  return inject(CLE_GROUPE, null)
}

export function useGroupeCourant(): EtatGroupe {
  const g = inject(CLE_GROUPE)
  if (!g) throw new Error('useGroupeCourant() appele hors d\'une VueGroupe')
  if (import.meta.dev) {
    const manque = CHAMPS.filter(c => !(c in g))
    if (manque.length) {
      throw new Error(
        `Etat de groupe incomplet : ${manque.join(', ')} : VueGroupe ne le(s) fournit pas.`)
    }
  }
  return g
}
