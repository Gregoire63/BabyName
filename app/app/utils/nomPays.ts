import { aTexte, langue, locale, t } from '~/composables/useLangue'

/**
 * Le nom d'un pays dans la langue affichée. data/pays/index.json les donne en
 * français (« Belgique », « Écosse ») : un pays simple passe par Intl (son
 * code est un code ISO), une sous-région (gb-sct, ca-on, qc…) par les textes
 * (app/textes/Pays.ts). `repli` : le nom français, gardé tel quel en
 * français, et si rien ne répond.
 */
export function nomPays(code: string, repli = code): string {
  // En français, le nom des données, tel quel.
  if (langue.value === 'fr' && repli !== code) return repli
  const cle = `Pays.${code}`
  if (aTexte(cle)) return t(cle)
  if (/^[a-z]{2}$/.test(code)) {
    try {
      const n = new Intl.DisplayNames([locale.value], { type: 'region' }).of(code.toUpperCase())
      if (n && n.toUpperCase() !== code.toUpperCase()) return n
    } catch { /* Intl incomplet : le nom français */ }
  }
  return repli
}

/** Le groupe d'un pays (« Francophonie », « Europe »…), dans la langue affichée. */
export function groupePays(nom: string): string {
  const cle = `Pays.groupe_${nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')}`
  return aTexte(cle) ? t(cle) : nom
}

/** La note d'un pays (« accents non publiés »…), dans la langue affichée. */
export function notePays(code: string, note: string): string {
  const cle = `Pays.note_${code}`
  return aTexte(cle) ? t(cle) : note
}
