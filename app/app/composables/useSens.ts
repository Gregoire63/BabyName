import { chargerJson } from '~/composables/useCatalogue'
import { langue, type Langue } from '~/composables/useLangue'

/**
 * Le sens d'un prénom dans la langue de l'app. Les sens du catalogue sont en
 * français (Wiktionnaire, relus) ; leur traduction vit dans
 * /data/sens/<langue>.json, une table « sens français → traduction »,
 * chargée à la demande (≈ 80 Ko gzip) : un francophone ne la télécharge
 * jamais. Tant qu'elle n'est pas là, ou pour un sens qu'elle n'a pas, on
 * montre le français plutôt que rien.
 *
 * Seul l'anglais est traduit pour l'instant : les autres langues de l'app le
 * prennent, plus lisible pour elles que le français.
 */
const TRADUITES: readonly Langue[] = ['en']
const tables = reactive<Partial<Record<Langue, Record<string, string>>>>({})
const enCours = new Set<Langue>()

function tableDe(l: Langue): Langue | null {
  if (l === 'fr') return null
  return TRADUITES.includes(l) ? l : 'en'
}

function charger(l: Langue) {
  if (tables[l] || enCours.has(l)) return
  enCours.add(l)
  chargerJson(`/data/sens/${l}.json`)
    .then((d: Record<string, string>) => { tables[l] = d })
    .catch(() => { /* on garde le français */ })
    .finally(() => enCours.delete(l))
}

/** Réactif : se met à jour quand la table arrive ou que la langue change. */
export function sens(m: string | null | undefined): string {
  if (!m) return ''
  const l = tableDe(langue.value)
  if (!l) return m
  const t = tables[l]
  if (!t) { if (import.meta.client) charger(l); return m }
  return t[m] ?? m
}

/**
 * LE sens d'un prénom à montrer, un seul, dans la langue de l'app — ou rien.
 *
 * Le catalogue en a deux : `m`, en français, relu (et traduit par `sens`),
 * et `me`, une glose du Wiktionnaire anglais. Les deux s'affichaient : sous
 * Gabriel, « force de Dieu » puis « strong man », en anglais dans l'app en
 * français. Et pour une centaine de prénoms sans `m`, la glose seule, souvent
 * fausse (Mya « mussel », Anthony « flower »).
 *
 * Donc : `m` d'abord, partout. `me` seulement à défaut, et jamais en
 * français — l'app dit plutôt qu'elle n'a pas d'étymologie fiable. Ailleurs
 * qu'en français, elle reste, marquée (`anglais`) : c'est une autre source.
 */
export function sensDe(p: { m: string | null; me: string | null }): { texte: string; anglais: boolean } | null {
  if (p.m) return { texte: sens(p.m), anglais: false }
  if (p.me && langue.value !== 'fr') return { texte: p.me, anglais: true }
  return null
}

/** Entre guillemets, à la façon de la langue : « … » en français, “…” sinon. */
export function citer(s: string): string {
  return langue.value === 'fr' ? `« ${s} »` : `“${s}”`
}
