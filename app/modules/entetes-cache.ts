import { defineNuxtModule } from 'nuxt/kit'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ENTETES_COMMUNES, POLITIQUE_STATIQUE, SECTIONS_STATIQUES } from '../server/entetes-securite'

/**
 * En-têtes de cache et de sécurité des fichiers STATIQUES, pour Cloudflare :
 * le fichier `_headers` à la racine des fichiers publics.
 *
 * Cloudflare sert ces fichiers sans passer par le Worker : ni le middleware
 * des en-têtes (server/middleware/entetes.ts) ni la politique de contenu de
 * la coquille (server/plugins/securite.ts) ne les voient. Tout se dit donc
 * ici — et seulement ici pour eux.
 *
 * Nitro écrit son propre `_headers`, qu'on remplace : ses règles se
 * chevauchent (/_nuxt/* et /_nuxt/builds/*), et Cloudflare JOINT par une
 * virgule deux valeurs du même en-tête — « immutable, …, max-age=1 » ne veut
 * plus rien dire. On n'écrit donc que des règles disjointes : `:fichier` ne
 * traverse pas les « / ».
 *
 * Tout le reste garde la règle par défaut de Cloudflare : revalider à chaque
 * fois (`public, max-age=0, must-revalidate` + ETag) — la coquille, le
 * catalogue (nom fixe, contenu variable), sw.js, le manifeste, les fiches.
 */
const IMMUABLE = 'public, max-age=31536000, immutable'
const SANS_CACHE = 'no-cache, must-revalidate'

function fichierEntetes(): string {
  const regle = (chemin: string, entetes: Record<string, string>) =>
    [chemin, ...Object.entries(entetes).map(([k, v]) => `  ${k}: ${v}`)].join('\n')
  const regles = [
    // La sécurité, sur tout.
    regle('/*', ENTETES_COMMUNES),
    // Noms hachés : vraiment immuables. Tous à plat dans /_nuxt/.
    regle('/_nuxt/:fichier', { 'cache-control': IMMUABLE }),
    // Le signal de nouveau build (latest.json) : jamais figé.
    regle('/_nuxt/builds/:fichier', { 'cache-control': SANS_CACHE }),
    // Un fichier par build : immuable.
    regle('/_nuxt/builds/meta/:fichier', { 'cache-control': IMMUABLE }),
    // Les fiches statiques : aucun script exécutable en ligne. La coquille de
    // l'app a sa politique à elle, avec son nonce (server/plugins/securite.ts).
    ...SECTIONS_STATIQUES.map(s => regle(`/${s}/*`, { 'content-security-policy': POLITIQUE_STATIQUE }))
  ]
  return regles.join('\n\n') + '\n'
}

export default defineNuxtModule({
  meta: { name: 'entetes-cache' },
  setup(_options, nuxt) {
    if (nuxt.options.dev) return
    nuxt.hook('nitro:init', nitro => {
      if (!String(nitro.options.preset).startsWith('cloudflare')) return
      nitro.hooks.hook('compiled', async () => {
        await writeFile(resolve(nitro.options.output.publicDir, '_headers'), fichierEntetes())
        nitro.logger.success(`En-tetes de cache et de securite poses (_headers, ${4 + SECTIONS_STATIQUES.length} regles).`)
      })
    })
  }
})
