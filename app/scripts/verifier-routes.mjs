// Compare app/pages/ a la liste de server/plugins/introuvable.ts : une page
// oubliee la-bas repondrait 404 aux robots tout en s'affichant.
//   node scripts/verifier-routes.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const racine = new URL('../app/pages/', import.meta.url).pathname
const pages = []
const parcourir = d => readdirSync(d).forEach(f => {
  const p = join(d, f)
  if (statSync(p).isDirectory()) return parcourir(p)
  if (f.endsWith('.vue')) pages.push(relative(racine, p))
})
parcourir(racine)

const src = readFileSync(new URL('../server/plugins/introuvable.ts', import.meta.url), 'utf8')
const regex = [...src.matchAll(/^\s*(\/\^.*\$\/),?$/gm)].map(m => eval(m[1]))

let ko = 0
for (const f of pages) {
  const chemin = '/' + f.replace(/\.vue$/, '').replace(/(^|\/)index$/, '').replace(/\[[^\]]+\]/g, 'x')
  const c = chemin.replace(/\/+$/, '') || '/'
  if (!regex.some(r => r.test(c))) { console.log('absente de introuvable.ts :', f, '->', c); ko++ }
}
console.log(ko ? `${ko} page(s) a ajouter` : `${pages.length} pages, toutes connues`)
process.exit(ko ? 1 : 0)
