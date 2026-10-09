/**
 * Les prénoms AJOUTÉS à une liste : ceux que le catalogue n'a pas (migration
 * 0013) — le prénom d'une arrière-grand-mère, une graphie à soi, un prénom
 * inventé. Ce qui suit vaut dans l'app ET sur le serveur : les deux doivent
 * écrire le même prénom de la même façon, sans quoi la liste aurait deux
 * cartes pour un seul.
 */

/** Au plus, par liste. La borne protège la base, pas l'usage (trigger
 *  trg_prenoms_ajoutes_plein) : deux cents, c'est bien plus qu'on n'en propose. */
export const AJOUTS_MAX = 200

/** Le mot qui accompagne un prénom ajouté (« le prénom de mon arrière-grand-mère ») :
 *  il doit tenir sur la carte, à côté du prénom. */
export const MOT_AJOUT_MAX = 140

/**
 * L'écriture d'un prénom tapé, telle qu'elle deviendra la clé de ses votes.
 *
 * « jeannine » et « JEANNINE » proposent le même prénom : sans règle commune,
 * la liste aurait deux cartes, et deux décisions pour une. Donc :
 *  - les blancs : aucun aux bords, un seul dedans, aucun autour d'un trait
 *    d'union ou d'une apostrophe (« Marie - Rose » → Marie-Rose) ;
 *  - l'apostrophe droite, celle de l'INSEE (M'Mah) : un clavier de téléphone
 *    tape « M’Mah », c'est le même prénom ; les tirets typographiques
 *    deviennent des traits d'union ;
 *  - les capitales : tout en minuscules ou tout en capitales — ce qu'on tape
 *    sans y penser —, chaque partie prend la sienne, comme dans le catalogue
 *    (titlecase_fr, pipeline/build_metrics.py) ; une casse voulue (McKenzie)
 *    reste telle quelle, première lettre en capitale.
 *
 * Rend '' si ce n'est pas un prénom possible : deux lettres au moins ; des
 * lettres, des apostrophes, des traits d'union et des espaces ; 60 caractères
 * au plus (la règle des votes, server/utils/validation.ts). Réécrire ce qu'elle
 * rend le rend tel quel.
 */
export function ecrireAjout(brut: unknown): string {
  if (typeof brut !== 'string') return ''
  let s = brut.normalize('NFC')
    .replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, '\'')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ').trim()
    .replace(/ ?- ?/g, '-').replace(/ ?' ?/g, '\'')
    .replace(/-{2,}/g, '-').replace(/'{2,}/g, '\'')
  const lettres = s.replace(/[^\p{L}]/gu, '')
  if (lettres.length < 2) return ''
  if (lettres === lettres.toLowerCase() || lettres === lettres.toUpperCase()) {
    s = s.toLowerCase().split(/([- '])/)
      .map(p => /^[- ']?$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('')
  } else {
    s = s.charAt(0).toUpperCase() + s.slice(1)
  }
  return /^[\p{L}](?:[\p{L}\p{M}' -]{0,58}[\p{L}\p{M}])?$/u.test(s) ? s : ''
}

/** Deux prénoms ajoutés sont le même s'ils ne diffèrent que par la casse
 *  (les accents, eux, font un autre prénom : Jeannïne n'est pas Jeannine). */
export const memeAjout = (a: string, b: string) =>
  a.toLocaleLowerCase('fr') === b.toLocaleLowerCase('fr')
