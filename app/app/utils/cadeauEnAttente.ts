/**
 * Un code cadeau arrivé par lien (`/?cadeau=…`) doit survivre à la connexion.
 *
 * Le paramètre traverse /connexion comme un code d'invitation ; mais un lien
 * de connexion reçu par e-mail s'ouvre ailleurs, sans lui. Le code est donc
 * aussi gardé sur l'appareil, le temps d'arriver sur l'accueil — puis oublié
 * dès qu'il a servi, ou qu'on a refermé la feuille. Un mois au plus : un
 * cadeau oublié ne doit pas ressurgir des mois plus tard.
 */
const CLE = 'cadeau-en-attente'
const DUREE = 30 * 86400e3

export function retenirCadeauEnAttente(code: string) {
  try { localStorage.setItem(CLE, JSON.stringify({ code, le: Date.now() })) } catch { /* mode privé */ }
}

export function lireCadeauEnAttente(): string {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? 'null')
    if (v && typeof v.code === 'string' && Date.now() - Number(v.le) < DUREE) {
      return normaliserCodeCadeau(v.code)
    }
  } catch { /* illisible : on l'oublie */ }
  oublierCadeauEnAttente()
  return ''
}

export function oublierCadeauEnAttente() {
  try { localStorage.removeItem(CLE) } catch { /* mode privé */ }
}
