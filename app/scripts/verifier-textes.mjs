#!/usr/bin/env node
/**
 * Les textes de l'app (app/textes, voir app/composables/useLangue.ts) :
 * chaque fichier a le français ET l'anglais, avec les mêmes clés ; un texte
 * à {paramètres} garde les mêmes paramètres d'une langue à l'autre ; les
 * autres langues (app/textes/_langues/<code>.ts) n'ont pas de clé inconnue.
 * Une clé manquante ailleurs que dans _langues fait échouer le build : elle
 * s'afficherait telle quelle. Lancé par `npm run build`.
 */
import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DOSSIER = resolve(dirname(fileURLToPath(import.meta.url)), '../app/textes')
const fautes = []
const toutes = new Set()
const params = (v) => typeof v === 'string' ? [...v.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',') : null

async function charger(f) {
  // Les fichiers sont du TypeScript sans types à l'exécution : Node 22.6+ les lit.
  return (await import(pathToFileURL(f).href)).default
}

for (const f of readdirSync(DOSSIER).filter(n => n.endsWith('.ts')).sort()) {
  const espace = f.replace(/\.ts$/, '')
  const m = await charger(resolve(DOSSIER, f))
  if (!m?.fr || !m?.en) { fautes.push(`${f} : il faut fr ET en`); continue }
  for (const k of Object.keys(m.fr)) {
    toutes.add(`${espace}.${k}`)
    if (!(k in m.en)) fautes.push(`${espace}.${k} : manque en anglais`)
    else if (params(m.fr[k]) !== null && params(m.en[k]) !== null && params(m.fr[k]) !== params(m.en[k])) {
      fautes.push(`${espace}.${k} : paramètres différents (fr {${params(m.fr[k])}} / en {${params(m.en[k])}})`)
    }
  }
  for (const k of Object.keys(m.en)) if (!(k in m.fr)) fautes.push(`${espace}.${k} : manque en français`)
}
const AUTRES = resolve(DOSSIER, '_langues')
let manquants = 0
for (const f of readdirSync(AUTRES).filter(n => n.endsWith('.ts')).sort()) {
  const m = await charger(resolve(AUTRES, f))
  for (const k of Object.keys(m ?? {})) if (!toutes.has(k)) fautes.push(`_langues/${f} : clé inconnue ${k}`)
  const absents = [...toutes].filter(k => !(k in m)).length
  if (absents) { manquants += absents; console.warn(`[textes] _langues/${f} : ${absents} texte(s) en anglais faute de traduction`) }
}
if (fautes.length) {
  console.error('Textes de l’app :\n  ' + fautes.slice(0, 60).join('\n  ') + (fautes.length > 60 ? `\n  … et ${fautes.length - 60} de plus` : ''))
  process.exit(1)
}
console.log(`[textes] ${toutes.size} textes, fr et en complets`)
