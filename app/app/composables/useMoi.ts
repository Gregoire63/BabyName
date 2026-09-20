export interface Moi { id: string; pseudo: string; a_une_cle: boolean }

export function useMoi() {
  return useState<Moi | null>('moi', () => null)
}

export async function rafraichirMoi() {
  const moi = useMoi()
  const r = await $fetch<{ connecte: boolean; utilisateur?: Moi }>('/api/auth/moi').catch(() => null)
  moi.value = r?.connecte ? r.utilisateur! : null
  return moi.value
}
