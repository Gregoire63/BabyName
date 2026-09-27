/**
 * Où allait-on avant d'entrer ? Une liste partagée (`?code=`), un prénom venu
 * d'une fiche publique (`?prenom=`) : /connexion les porte jusqu'à l'accueil.
 *
 * Mais le lien de l'e-mail (inscription ou connexion) s'ouvre dans un nouvel
 * onglet, sans eux : l'appareil les garde le temps que l'e-mail arrive — une
 * heure au plus — et la page du lien les reprend (connexion/lien.vue). Le
 * code cadeau a sa propre mémoire, plus longue (cadeauEnAttente).
 */
const CLE = 'entree-en-attente'
const DUREE = 3600e3

export interface Entree { code?: string; prenom?: string }

export function retenirEntree(e: Entree) {
  try {
    if (!e.code && !e.prenom) return oublierEntree()
    localStorage.setItem(CLE, JSON.stringify({ ...e, le: Date.now() }))
  } catch { /* mode privé : le lien mènera à l'accueil, sans plus */ }
}

/** La reprendre, une fois : elle est oubliée aussitôt. */
export function reprendreEntree(): Entree {
  let v: any = null
  try { v = JSON.parse(localStorage.getItem(CLE) ?? 'null') } catch { /* illisible */ }
  oublierEntree()
  if (!v || Date.now() - Number(v.le) > DUREE) return {}
  const code = normaliserCodeInvitation(v.code)
  const prenom = typeof v.prenom === 'string' ? v.prenom.trim().slice(0, 60) : ''
  return { ...(code ? { code } : {}), ...(prenom ? { prenom } : {}) }
}

export function oublierEntree() {
  try { localStorage.removeItem(CLE) } catch { /* mode privé */ }
}
