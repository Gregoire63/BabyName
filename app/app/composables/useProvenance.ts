/**
 * D'où arrive la personne : un mot (seo, tiktok, google, outil-nom…), gardé
 * dans le navigateur à la PREMIÈRE visite, puis rattaché au compte à
 * l'inscription (api/moi/provenance.post.ts) ou à l'achat d'un cadeau.
 * Première visite et pas dernière : c'est la vidéo ou la page qui a fait
 * découvrir l'app qui compte.
 *
 * Sources, dans l'ordre : `?ref=` (nos liens : fiches, outil, cadeau),
 * `?utm_source=` (liens mis en bio TikTok, Instagram…), puis le site d'où
 * l'on vient (document.referrer), réduit à un mot : jamais l'adresse
 * complète de la page d'origine.
 */
const CLE = 'bn-provenance'
const CLE_ENVOYEE = 'bn-provenance-envoyee'
const REFERENTS: [RegExp, string][] = [
  [/(^|\.)google\./, 'google'], [/(^|\.)bing\.com$/, 'bing'], [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)qwant\.com$/, 'qwant'], [/(^|\.)ecosia\.org$/, 'ecosia'], [/(^|\.)yahoo\./, 'yahoo'],
  [/(^|\.)tiktok\.com$/, 'tiktok'], [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com)$/, 'facebook'], [/(^|\.)pinterest\./, 'pinterest'],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, 'chatgpt'], [/(^|\.)perplexity\.ai$/, 'perplexity'],
  [/(^|\.)reddit\.com$/, 'reddit'], [/(^|\.)doctissimo\.fr$/, 'doctissimo']
]

const propre = (x: string | null | undefined) => {
  const s = (x ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
  return s || null
}

function lire(cle: string): string | null {
  try { return localStorage.getItem(cle) } catch { return null }
}
function poser(cle: string, v: string) {
  try { localStorage.setItem(cle, v) } catch { /* stockage bloqué : tant pis pour la statistique */ }
}

/** À l'ouverture : note la provenance si rien n'est encore noté. */
export function noterProvenance() {
  if (lire(CLE)) return
  const q = new URLSearchParams(location.search)
  let p = propre(q.get('ref')) ?? propre(q.get('utm_source'))
  if (!p && document.referrer) {
    try {
      const h = new URL(document.referrer).hostname
      if (h && h !== location.hostname) p = REFERENTS.find(([re]) => re.test(h))?.[1] ?? 'autre-site'
    } catch { /* referrer illisible */ }
  }
  poser(CLE, p ?? 'direct')
}

export function provenanceLue(): string | null {
  return lire(CLE)
}

/** Une fois connecté : envoie la provenance, une seule fois par appareil. */
export async function envoyerProvenance() {
  const p = lire(CLE)
  if (!p || lire(CLE_ENVOYEE)) return
  const r = await $fetch<{ ok: boolean }>('/api/moi/provenance', { method: 'POST', body: { provenance: p } })
    .catch(() => null)
  if (r) poser(CLE_ENVOYEE, '1')
}
