import { passkeysPossibles } from '~/composables/usePasskey'

/**
 * Quand proposer la passkey (ProposerPasskey) : juste après être entré par
 * e-mail, à un compte qui n'en a aucune, sur un navigateur qui sait en
 * créer — et pas sur un appareil où l'on a répondu « Plus tard » ces trente
 * derniers jours.
 */
const CLE = 'passkey-plus-tard'
const TRENTE_JOURS = 30 * 86400e3

export function retenirPasskeyPlusTard() {
  try { localStorage.setItem(CLE, String(Date.now())) } catch { /* mode privé */ }
}

export function fautProposerPasskey(): boolean {
  if (!passkeysPossibles()) return false
  const moi = useMoi().value
  if (!moi || moi.passkeys > 0) return false
  try {
    const le = Number(localStorage.getItem(CLE))
    if (le && Date.now() - le < TRENTE_JOURS) return false
  } catch { /* stockage indisponible : on propose */ }
  return true
}
