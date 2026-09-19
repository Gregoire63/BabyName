export interface Moi { id: string; email: string; pseudo: string }

export function useMoi() {
  return useState<Moi | null>('moi', () => null)
}

export async function rafraichirMoi() {
  const moi = useMoi()
  const r = await $fetch<{ connecte: boolean; utilisateur?: Moi }>('/api/auth/moi').catch(() => null)
  moi.value = r?.connecte ? r.utilisateur! : null
  return moi.value
}
