import { defineNuxtModule } from 'nuxt/kit'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ENTETES_COMMUNES, POLITIQUE_STATIQUE, PAGES_STATIQUES } from '../server/entetes-securite'

/**
 * En-tetes de cache (et de securite, voir server/entetes-securite.ts) pour
 * Vercel, ecrites a la main dans le Build Output.
 *
 * Pourquoi ne pas se contenter de `routeRules` : le preset vercel de Nitro
 * genere ces routes SANS `continue: true`. Or une route d'en-tete sans ce
 * drapeau interrompt le routage au lieu de le poursuivre (la documentation
 * Vercel le met explicitement sur chacune de ses routes d'exemple). Et ses
 * propres regles de fichiers publics collent `immutable` sur TOUT /_nuxt/,
 * y compris /_nuxt/builds/latest.json — le fichier dont le seul role est de
 * signaler qu'un nouveau build existe. Fige, il ne signale plus rien.
 *
 * On insere donc nos regles juste avant la phase « filesystem », apres
 * celles de Nitro : a drapeau `continue`, c'est la derniere qui gagne.
 */
const SANS_CACHE = 'no-cache, must-revalidate'
const IMMUABLE = 'public, max-age=31536000, immutable'

// Du plus general au plus precis : la derniere regle qui matche l'emporte.
const REGLES: [string, string][] = [
  ['/(.*)', SANS_CACHE],                    // la coquille HTML avant tout
  ['/_nuxt/(.*)', IMMUABLE],                // noms haches : vraiment immuables
  ['/_nuxt/builds/(.*)', SANS_CACHE],       // le signal de nouveau build
  ['/_nuxt/builds/meta/(.*)', IMMUABLE],    // un fichier par build : immuable
  ['/data/(.*)', SANS_CACHE],               // catalogue : nom fixe, contenu variable
  ['/sw\\.js', SANS_CACHE],                 // sinon aucune mise a jour ne passe
  ['/manifest\\.webmanifest', SANS_CACHE]
]

export default defineNuxtModule({
  meta: { name: 'entetes-cache' },
  setup(_options, nuxt) {
    nuxt.hook('nitro:init', nitro => {
      if (!String(nitro.options.preset).startsWith('vercel')) return

      nitro.hooks.hook('compiled', async () => {
        const chemin = resolve(nitro.options.output.dir, 'config.json')
        let config: any
        try { config = JSON.parse(await readFile(chemin, 'utf8')) }
        catch { return }                     // pas de Build Output : rien a faire
        if (!Array.isArray(config.routes)) return

        const nouvelles: any[] = REGLES.map(([src, valeur]) => ({
          src, headers: { 'cache-control': valeur }, continue: true
        }))
        // La securite, sur TOUTES les reponses (fichiers statiques compris :
        // server/middleware/entetes.ts ne voit que ce que le serveur rend).
        nouvelles.push({ src: '/(.*)', headers: { ...ENTETES_COMMUNES }, continue: true })
        // Les fiches statiques ont leur politique de contenu ; celle de l'app
        // est posee page par page, avec son nonce (server/plugins/securite.ts).
        nouvelles.push({ src: PAGES_STATIQUES,
                         headers: { 'content-security-policy': POLITIQUE_STATIQUE }, continue: true })

        const i = config.routes.findIndex((r: any) => r?.handle === 'filesystem')
        if (i === -1) config.routes.push(...nouvelles)
        else config.routes.splice(i, 0, ...nouvelles)

        await writeFile(chemin, JSON.stringify(config, null, 2))
        nitro.logger.success(`En-tetes de cache et de securite posees (${nouvelles.length} regles).`)
      })
    })
  }
})
