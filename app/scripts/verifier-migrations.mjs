#!/usr/bin/env node
/**
 * Les migrations passent aussi par l'API de D1 : `npm run base:migrer`
 * (wrangler … --remote) lui envoie chaque fichier, et c'est elle qui découpe
 * le SQL en instructions. Elle ne reconnaît le corps d'un déclencheur
 * (create trigger … BEGIN … END;) qu'en MAJUSCULES : en minuscules, elle
 * coupe au premier « ; » du corps et répond « incomplete input », pour un
 * fichier que SQLite, wrangler en local et l'app appliquent sans broncher.
 * L'erreur ne se voyait donc qu'en production. Lancé par `npm run build`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOSSIER = resolve(dirname(fileURLToPath(import.meta.url)), '../server/assets/migrations')
const fautes = []
for (const f of readdirSync(DOSSIER).filter(n => n.endsWith('.sql')).sort()) {
  // Sans les commentaires (les fichiers n'ont pas de « -- » dans une chaîne,
  // voir l'en-tête de 0001_initial.sql).
  const sql = readFileSync(resolve(DOSSIER, f), 'utf8').replace(/--[^\n]*/g, '')
  for (const m of sql.matchAll(/create\s+trigger\s+(?:if\s+not\s+exists\s+)?(\w+)[\s\S]*?\b(begin)\b[\s\S]*?\b(end)\s*;/gi)) {
    if (m[2] !== 'BEGIN' || m[3] !== 'END') fautes.push(`${f} : déclencheur ${m[1]}, « ${m[2]} … ${m[3]} »`)
  }
}
if (fautes.length) {
  console.error('Migrations : BEGIN et END d’un déclencheur s’écrivent en MAJUSCULES '
    + '(sinon l’API de D1 coupe le corps : « incomplete input »).\n  ' + fautes.join('\n  '))
  process.exit(1)
}
