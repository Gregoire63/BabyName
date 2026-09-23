import { useGroupeCourant } from '~/composables/etatGroupe'

export interface Verdict {
  prenom: string
  /** Mon vote : 0 non, 1 neutre, 2 oui. null si je n'ai pas juge. */
  mien: number | null
  autres: { pseudo: string; valeur: number; observateur: boolean }[]
}

export const MOT = ['Non', 'Neutre', 'Oui'] as const

/**
 * Lecture des votes deja visibles, regroupes par prenom.
 *
 * Rien n'est calcule sur le serveur ici : /api/groupes/:id/votes applique deja
 * la regle du vote aveugle (on ne voit le vote d'un autre que sur un prenom
 * qu'on a soi-meme juge). Donc si un desaccord apparait dans cette liste,
 * c'est qu'on a le droit de le voir.
 */
export function useVerdicts() {
  const g = useGroupeCourant()
  const moiId = computed(() => g.etat.value?.moi?.user_id ?? null)

  /**
   * Les DECIDEURS, pas les membres.
   *
   * Un observateur est un membre comme les autres pour l'avancement, et rien
   * du tout pour le quorum : ni les accords ni les desaccords ne l'attendent.
   * Compter tout le monde ici faisait disparaitre « A revoir » des qu'on
   * invitait une grand-mere — un desaccord entre les deux parents cessait
   * d'apparaitre parce qu'elle n'avait pas encore juge.
   */
  const observateurs = computed(() => new Set(
    (g.etat.value?.avancement ?? [])
      .filter((m: any) => m.role === 'observateur')
      .map((m: any) => m.user_id)))
  const nbMembres = computed(() =>
    Math.max(1, (g.etat.value?.avancement?.length ?? 2) - observateurs.value.size))

  const parPrenom = computed(() => {
    const m = new Map<string, Verdict>()
    for (const v of g.votes.value) {
      let e = m.get(v.prenom)
      if (!e) { e = { prenom: v.prenom, mien: null, autres: [] }; m.set(v.prenom, e) }
      if (v.user_id === moiId.value) e.mien = v.valeur
      else e.autres.push({ pseudo: v.pseudo, valeur: v.valeur,
                           observateur: observateurs.value.has(v.user_id) })
    }
    return m
  })

  const tous = computed(() => [...parPrenom.value.values()])

  /** Mes prenoms, ranges par verdict, du plus recent au plus ancien. */
  const miens = (valeur: 0 | 1 | 2) =>
    computed(() => tous.value.filter(v => v.mien === valeur))

  /**
   * Les desaccords francs : quelqu'un a dit oui, quelqu'un a dit non, et tout
   * le monde s'est prononce. C'est la liste qui manquait — sans elle, un « non »
   * pose en trois secondes enterrait un prenom que l'autre adorait.
   *
   * Oui + neutre n'est PAS un desaccord : c'est deja un commun (v_matchs).
   * Un veto non plus : il est volontaire et definitif.
   */
  const aRevoir = computed(() => tous.value.filter(v => {
    if (v.mien === null) return false
    if (g.vetos.value.has(v.prenom)) return false
    // L'avis d'un observateur s'affiche mais ne fait pas un desaccord : son
    // non ne bloque rien, il n'y a donc rien a « revoir » a cause de lui.
    const decisifs = v.autres.filter(a => !a.observateur)
    if (decisifs.length < nbMembres.value - 1) return false
    const toutes = [v.mien, ...decisifs.map(a => a.valeur)]
    return toutes.includes(2) && toutes.includes(0)
  }))

  return { parPrenom, tous, miens, aRevoir, moiId, nbMembres, observateurs }
}
