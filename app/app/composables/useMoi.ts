import type { Langue } from '~/composables/useLangue'

export interface Moi {
  id: string
  pseudo: string
  /** Adresse vérifiée, ou null : le lien de connexion part vers elle. */
  email: string | null
  passkeys: number
  /** Combien de façons de retrouver ce compte ailleurs. 0 : il n'existe que
   *  sur cet appareil — l'accueil le signale. */
  moyens: number
  /** Langue affichée la dernière fois (e-mails, notifications). */
  langue: Langue
  /** Langue choisie dans le compte ; null : automatique (useLangue). */
  langue_choix: Langue | null
}

export function useMoi() {
  return useState<Moi | null>('moi', () => null)
}

export async function rafraichirMoi() {
  const moi = useMoi()
  const r = await $fetch<{ connecte: boolean; utilisateur?: Moi }>('/api/auth/moi').catch(() => null)
  moi.value = r?.connecte ? r.utilisateur! : null
  if (moi.value) accorderLangue(moi.value)
  return moi.value
}

/**
 * Le compte et l'appareil d'accord sur la langue : un choix fait sur un autre
 * appareil s'applique ici ; et le serveur apprend la langue affichée, s'il ne
 * la connaît pas encore (e-mails, notifications).
 */
function accorderLangue(m: Moi) {
  const choix = m.langue_choix ?? 'auto'
  if (choix !== etatLangue.choix) choisirLangue(choix, { enregistrer: false })
  if (m.langue !== langue.value) enregistrerLangue()
}
