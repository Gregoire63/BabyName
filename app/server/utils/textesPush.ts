import type { LangueCompte } from './langues'

/**
 * Les textes des notifications (push.ts), dans la langue de chaque
 * destinataire (utilisateurs.langue). Le titre des autres notifications est
 * le nom de la liste : il ne se traduit pas.
 *
 * Le français est la source, inchangé (essais/essai-notifications.mjs).
 * Jamais de prénom (voir push.ts) ; pas de verbe accordé au genre de celui
 * qui agit dans les langues qui l'accordent (polonais) : on ne le connaît pas.
 */
export interface TextesPush {
  accordTitre: string
  accordCorps: string
  arrivee: (pseudo: string) => string
  suit: (pseudo: string) => string
  deblocagePar: (pseudo: string) => string
  deblocage: string
  commentaire: (pseudo: string) => string
  /** `n` : 25 au moins (PALIERS_AVANCE). */
  avance: (pseudo: string, n: number) => string
}

const fr: TextesPush = {
  accordTitre: 'Nouvel accord',
  accordCorps: 'Vous êtes d’accord sur un prénom de plus.',
  arrivee: p => `${p} a rejoint votre liste.`,
  suit: p => `${p} suit maintenant votre liste.`,
  deblocagePar: p => `${p} a débloqué la liste : swipes illimités, pour vous aussi.`,
  deblocage: 'Votre liste est débloquée : swipes illimités.',
  commentaire: p => `${p} a laissé un commentaire.`,
  avance: (p, n) => `${p} a jugé ${n} prénoms de plus que vous. Les accords vous attendent.`
}

const en: TextesPush = {
  accordTitre: 'New match',
  accordCorps: 'You agree on one more name.',
  arrivee: p => `${p} has joined your list.`,
  suit: p => `${p} is now following your list.`,
  deblocagePar: p => `${p} unlocked the list: unlimited swipes, for you too.`,
  deblocage: 'Your list is unlocked: unlimited swipes.',
  commentaire: p => `${p} left a comment.`,
  avance: (p, n) => `${p} has rated ${n} more names than you. Your matches are waiting.`
}

const de: TextesPush = {
  accordTitre: 'Neues Match',
  accordCorps: 'Sie sind sich bei einem weiteren Namen einig.',
  arrivee: p => `${p} ist Ihrer Liste beigetreten.`,
  suit: p => `${p} folgt jetzt Ihrer Liste.`,
  deblocagePar: p => `${p} hat die Liste freigeschaltet: unbegrenzt swipen, auch für Sie.`,
  deblocage: 'Ihre Liste ist freigeschaltet: unbegrenzt swipen.',
  commentaire: p => `${p} hat einen Kommentar hinterlassen.`,
  avance: (p, n) => `${p} hat ${n} Namen mehr bewertet als Sie. Ihre Matches warten auf Sie.`
}

const nl: TextesPush = {
  accordTitre: 'Nieuwe match',
  accordCorps: 'U bent het eens over nog een naam.',
  arrivee: p => `${p} doet nu mee met uw lijst.`,
  suit: p => `${p} volgt nu uw lijst.`,
  deblocagePar: p => `${p} heeft de lijst ontgrendeld: onbeperkt swipen, ook voor u.`,
  deblocage: 'Uw lijst is ontgrendeld: onbeperkt swipen.',
  commentaire: p => `${p} heeft een reactie achtergelaten.`,
  avance: (p, n) => `${p} heeft ${n} namen meer beoordeeld dan u. De matches wachten op u.`
}

const sv: TextesPush = {
  accordTitre: 'Ny match',
  accordCorps: 'Ni är överens om ett namn till.',
  arrivee: p => `${p} har gått med i er lista.`,
  suit: p => `${p} följer nu er lista.`,
  deblocagePar: p => `${p} har låst upp listan: obegränsat med swipes, för dig också.`,
  deblocage: 'Er lista är upplåst: obegränsat med swipes.',
  commentaire: p => `${p} har lämnat en kommentar.`,
  avance: (p, n) => `${p} har bedömt ${n} namn fler än du. Matcherna väntar på dig.`
}

const nb: TextesPush = {
  accordTitre: 'Ny match',
  accordCorps: 'Dere er enige om ett navn til.',
  arrivee: p => `${p} har blitt med i listen deres.`,
  suit: p => `${p} følger nå listen deres.`,
  deblocagePar: p => `${p} har låst opp listen: ubegrenset med sveip, for deg også.`,
  deblocage: 'Listen deres er låst opp: ubegrenset med sveip.',
  commentaire: p => `${p} har lagt igjen en kommentar.`,
  avance: (p, n) => `${p} har vurdert ${n} flere navn enn deg. Matchene venter på deg.`
}

/** « 25 ocenionych imion » / « 22 ocenione imiona ». */
const imionPl = (n: number) => n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
  ? `${n} ocenione imiona` : `${n} ocenionych imion`

const pl: TextesPush = {
  accordTitre: 'Nowe dopasowanie',
  accordCorps: 'Zgadzacie się co do kolejnego imienia.',
  arrivee: p => `${p} jest teraz na Waszej liście.`,
  suit: p => `${p} obserwuje teraz Waszą listę.`,
  deblocagePar: p => `Lista odblokowana przez: ${p}. Przesuwanie bez limitu, także dla Ciebie.`,
  deblocage: 'Wasza lista jest odblokowana: przesuwanie bez limitu.',
  commentaire: p => `Nowy komentarz od: ${p}.`,
  avance: (p, n) => `${p} ma o ${imionPl(n)} więcej niż Ty. Dopasowania czekają.`
}

/** « par 25 vārdiem » / « par 21 vārdu ». */
const vardiemLv = (n: number) => n % 10 === 1 && n % 100 !== 11 ? `${n} vārdu` : `${n} vārdiem`

const lv: TextesPush = {
  accordTitre: 'Jauna sakritība',
  accordCorps: 'Jūs esat vienisprātis vēl par vienu vārdu.',
  arrivee: p => `${p} pievienojās Jūsu sarakstam.`,
  suit: p => `${p} tagad seko Jūsu sarakstam.`,
  deblocagePar: p => `${p} atbloķēja sarakstu: neierobežota vērtēšana arī Jums.`,
  deblocage: 'Jūsu saraksts ir atbloķēts: neierobežota vērtēšana.',
  commentaire: p => `${p} atstāja komentāru.`,
  avance: (p, n) => `${p} Jūs apsteidz par ${vardiemLv(n)}. Sakritības Jūs gaida.`
}

const TEXTES_PUSH: Record<LangueCompte, TextesPush> = { fr, en, de, nl, sv, nb, pl, lv }

/** Les textes des notifications dans une langue (inconnue : le français). */
export function textesPush(l: LangueCompte | string | null | undefined): TextesPush {
  return TEXTES_PUSH[l as LangueCompte] ?? fr
}
