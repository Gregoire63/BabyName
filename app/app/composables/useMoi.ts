export interface Moi {
  id: string
  pseudo: string
  /** Adresse vérifiée, ou null : le lien de connexion part vers elle. */
  email: string | null
  /** Ancienne clé d'accès encore active (comptes d'avant les passkeys). */
  a_une_cle: boolean
  passkeys: number
  /** Combien de façons de retrouver ce compte ailleurs. 0 : il n'existe que
   *  sur cet appareil — l'accueil le signale. */
  moyens: number
}

export function useMoi() {
  return useState<Moi | null>('moi', () => null)
}

export async function rafraichirMoi() {
  const moi = useMoi()
  const r = await $fetch<{ connecte: boolean; utilisateur?: Moi }>('/api/auth/moi').catch(() => null)
  moi.value = r?.connecte ? r.utilisateur! : null
  return moi.value
}
