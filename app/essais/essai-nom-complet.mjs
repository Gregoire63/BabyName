/**
 * « Ça donne quoi avec notre nom ? » (app/composables/useNomComplet.ts), sans
 * navigateur : le même module que la carte, compilé ici par esbuild comme le
 * fait l'outil public (scripts/seo-plus.mjs).
 *
 * Ce qui se vérifie ici :
 *  - le nombre de syllabes est celui du pipeline : sur les 19 608 prénoms, il
 *    redonne la colonne « y » du catalogue, celle des filtres ;
 *  - le tréma et la voyelle accentuée ouvrent une syllabe : Amaël Raturat en
 *    fait six (la clé de prononciation, qui les efface, en comptait cinq), et
 *    Léo Roy n'est plus « très court » ;
 *  - les verdicts qui font l'essai tiennent toujours (hiatus, son répété,
 *    rime, longueur, sigle) ;
 *  - quand rien n'accroche, la carte dit seulement « rien n’accroche » : ni
 *    le compte, ni les initiales.
 *
 *   node essais/essai-nom-complet.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }

const esbuild = await import('esbuild')
const r = await esbuild.build({
  stdin: { contents: `import { tester, syllabes } from '~/composables/useNomComplet'\nglobalThis.__nom = { tester, syllabes }`,
           resolveDir: RACINE, loader: 'ts' },
  bundle: true, write: false, format: 'iife', target: 'es2019',
  plugins: [{ name: 'alias-nuxt', setup(b) {
    b.onResolve({ filter: /^~\// }, a => {
      const base = resolve(RACINE, 'app', a.path.slice(2))
      return { path: existsSync(base + '.ts') ? base + '.ts' : base }
    })
  } }]
})
new Function(r.outputFiles[0].text)()
const { tester, syllabes } = globalThis.__nom

// ---------- 1. le compte du pipeline -------------------------------------
const d = JSON.parse(readFileSync(resolve(RACINE, 'public/data/catalogue.json'), 'utf8'))
const ecarts = []
for (let k = 0; k < d.n; k++) {
  const n = syllabes(d.cols.l[k])
  if (n !== d.cols.y[k]) ecarts.push(`${d.cols.l[k]} ${n} au lieu de ${d.cols.y[k]}`)
}
dit(d.champs.y === 'nb_syllabes' && ecarts.length === 0,
  `syllabes : le compte du pipeline sur les ${d.n} prénoms (${ecarts.length} écart${ecarts.length > 1 ? 's' : ''}${ecarts.length ? ' : ' + ecarts.slice(0, 5).join(', ') : ''})`)
dit(syllabes('Amaël') === 3, 'un « ë » tapé en deux caractères reste un tréma (Amaël : 3)')

// ---------- 2. le tréma, l'accent ----------------------------------------
const amael = tester('Amaël', 'Raturat')
dit(amael.syllabes === 6, `Amaël Raturat : ${amael.syllabes} syllabes (A-ma-ël Ra-tu-rat : 6)`)
const leo = tester('Léo', 'Roy')
dit(leo.syllabes === 3 && !leo.remarques.some(x => /court/.test(x.court)),
  `Léo Roy : ${leo.syllabes} syllabes, pas « très court » (${leo.remarques.map(x => x.court).join(' · ')})`)

// ---------- 3. les verdicts ----------------------------------------------
const cas = [
  ['Léa', 'Arnaud', 'accroche', /deux voyelles/],
  ['Paul', 'Lemoine', 'accroche', /même son/],
  ['Ethan', 'Nathan', 'attention', /riment/],
  ['Marie-Charlotte', 'Arnaud-Durand', 'attention', /long à dire : 8 syllabes/],
  ['Paul', 'Dupont', 'accroche', /initiales : P\.D\./]
]
for (const [p, n, gravite, motif] of cas) {
  const v = tester(p, n)
  dit(v.remarques.some(x => x.gravite === gravite && motif.test(x.court)),
    `${p} ${n} : ${v.remarques.map(x => x.court).join(' · ')}`)
}

// ---------- 4. ce que dit la carte quand tout va bien ----------------------
dit(amael.remarques.length === 1 && amael.remarques[0].court === 'rien n’accroche'
    && /6 syllabes/.test(amael.remarques[0].texte),
  `rien n’accroche : la carte le dit seul, le texte long garde le compte (« ${amael.remarques[0].texte} »)`)

console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
