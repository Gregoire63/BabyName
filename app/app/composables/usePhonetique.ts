/**
 * La clé de prononciation, côté navigateur.
 *
 * Le pipeline la calcule en Python (pipeline/phonetique.py) pour grouper les
 * graphies du catalogue. Ici on en a besoin pour un mot qui n'est PAS dans le
 * catalogue : le nom de famille. D'où ce portage — les deux doivent donner
 * exactement la même clé, et un essai le vérifie sur les 19 608 prénoms en
 * comparant au groupe calculé par le pipeline.
 *
 * Le biais est le même et il est écrit là-bas : on neutralise ce qui ne
 * s'entend pas (accents, h, lettres doublées, y/i, k/c/qu, ph/f, tréma, e muet
 * final), on ne réinterprète jamais un digramme vocalique.
 */
const VOYELLES = new Set('aeiou')

function mot(m: string): string {
  if (!m) return ''
  let s = m.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
  s = s.replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ç/g, 's')

  s = s.replace(/sch/g, 'C').replace(/sh/g, 'C')
  s = s.replace(/ch([lr])/g, 'k$1')
  s = s.replace(/ch/g, 'C')
  s = s.replace(/ph/g, 'f')
  s = s.replace(/th/g, 't')
  s = s.replace(/gn/g, 'N')
  s = s.replace(/h/g, '')

  s = s.replace(/([aeiouy])s(?=[aeiouy])/g, '$1z')
  s = s.replace(/y/g, 'i')

  s = s.replace(/qu/g, 'k').replace(/q/g, 'k').replace(/ck/g, 'k')
  s = s.replace(/c(?=[ei])/g, 's')
  s = s.replace(/c/g, 'k')
  s = s.replace(/g(?=[ei])/g, 'J')
  s = s.replace(/gu/g, 'g')
  s = s.replace(/j/g, 'J')
  s = s.replace(/x/g, 'ks')
  s = s.replace(/w/g, 'v')

  s = s.replace(/(.)\1+/g, '$1')

  // e muet final, sauf après n ou m où il dénasalise (Manon ≠ Manone)
  if (s.length > 2 && s.endsWith('e') && !VOYELLES.has(s[s.length - 2]!)
      && !'nm'.includes(s[s.length - 2]!)) {
    s = s.slice(0, -1)
  }
  return s
}

/** Clé de prononciation. Deux mots qui la partagent se disent pareil. */
export function prononciation(nom: string): string {
  return String(nom).split(/[-\s’']+/).filter(Boolean).map(mot).join('-')
}

/** Le dernier son d'un mot, et le premier : c'est là que ça se télescope. */
export function bords(nom: string) {
  const p = prononciation(nom).replace(/-/g, '')
  return { debut: p[0] ?? '', fin: p[p.length - 1] ?? '', cle: p }
}

export const estVoyelle = (c: string) => VOYELLES.has(c)
