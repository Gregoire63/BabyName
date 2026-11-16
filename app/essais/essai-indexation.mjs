/**
 * Ce que les fiches présentent à Google, et sous quel titre (plan B du
 * 16/11/2026, scripts/indexation.mjs), sans navigateur ni serveur : le module
 * que lit scripts/seo.mjs, sur le vrai catalogue.
 *
 * Ce qui se vérifie ici :
 *  - une fiche au sens fiable, donnée au moins cinq fois par an, est indexée
 *    (Alba, Louise, Avram, Alaz, Martine) ;
 *  - un prénom connu l'est même sans sens fiable (Izia, Cataleya), et un
 *    prénom ancien par son histoire depuis 1900 (Josette) ;
 *  - AUCUNE fiche que Google montrait avant la chute ne sort, même rare
 *    (Cathaleya, Daenerys : scripts/donnees/fiches-vues-google.json) ;
 *  - ne sont plus présentées à Google, quand il ne les a jamais montrées :
 *    une origine seule sur un prénom rare, un sens incertain sur un prénom
 *    rare, un prénom donné moins de cinq fois par an ; et toujours une fiche
 *    mince ;
 *  - l'élagage garde l'essentiel du site : entre 55 et 80 % des fiches
 *    indexables avant lui ;
 *  - le titre dit ce que la fiche apporte (« Alba : signification « blanche,
 *    aube », origine latine »), ne promet pas de signification sans sens,
 *    jamais un sens incertain, et tient en 65 caractères.
 * Les exemples nommés sont ceux du millésime 2025 : à revoir au suivant.
 *
 *   node essais/essai-indexation.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ficheIndexable, titreFiche, lireSens, TITRE_MAX, HISTOIRE_CONNUE, FICHES_VUES_FICHIER } from '../scripts/indexation.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }

const d = JSON.parse(readFileSync(resolve(RACINE, 'public/data/catalogue.json'), 'utf8'))
const c = d.cols
const sansAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const slugDe = s => sansAccent(s).replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')
// Une fiche par prénom : la graphie la plus donnée (comme scripts/seo.mjs).
const tetes = new Map()
for (let k = 0; k < d.n; k++) {
  const p = { l: c.l[k], slug: slugDe(c.l[k]), n: c.n[k], m: c.m[k], g: c.g[k].map(x => d.origines[x]), cf: c.cf ? c.cf[k] : null, sr: c.sr ? c.sr[k] : null, hf: !!c.hf?.[k] }
  if (!p.slug || p.hf) continue
  const e = tetes.get(p.slug)
  if (!e || e.n < p.n) tetes.set(p.slug, p)
}
const T = [...tetes.values()]
const pic = p => Array.isArray(p.sr) && p.sr.length ? Math.max(...p.sr) : 0
const VUES = new Set(JSON.parse(readFileSync(resolve(RACINE, FICHES_VUES_FICHIER), 'utf8')).slugs)
const indexee = p => ficheIndexable(p, { pic: pic(p), vue: VUES.has(p.slug) })
const fiche = slug => tetes.get(slug)
const decrit = p => p ? `${p.l} : ${p.n} naissances en trois ans, ${p.m ? `sens « ${p.m} »` : 'sans sens'}, confiance ${p.cf ?? '–'}` : '(absent)'

// 1. Ce qui reste présenté.
for (const s of ['alba', 'louise', 'avram', 'alaz', 'martine']) {
  const p = fiche(s)
  dit(!!p && indexee(p), `indexée : ${decrit(p)}`)
}
dit(!!fiche('izia') && !fiche('izia').m && indexee(fiche('izia')), `connue sans sens, indexée : ${decrit(fiche('izia'))}`)
dit(!!fiche('cataleya') && fiche('cataleya').cf === 0 && indexee(fiche('cataleya')), `connue au sens incertain, indexée : ${decrit(fiche('cataleya'))}`)
dit(ficheIndexable({ m: null, g: ['français'], cf: null, n: 0 }, { histoire: 300000 })
    && !ficheIndexable({ m: null, g: ['français'], cf: null, n: 0 }, { histoire: HISTOIRE_CONNUE - 1 }),
  `un prénom ancien sans sens est indexé par son histoire (Josette), à partir de ${HISTOIRE_CONNUE} naissances depuis 1900`)

// 2. Ce que Google montrait reste ; ce qu'il n'a jamais montré peut sortir.
const cathaleya = fiche('cathaleya')
dit(!!cathaleya && !cathaleya.m && cathaleya.n < 150 && VUES.has('cathaleya') && indexee(cathaleya),
  `une fiche que Google montrait reste indexée, même rare et sans sens (${decrit(cathaleya)})`)
const vuesSorties = [...VUES].map(fiche).filter(p => p && (p.m || p.g.length) && !indexee(p))
dit(VUES.size > 500 && vuesSorties.length === 0, `aucune des ${VUES.size} fiches vues dans Google ne sort (${vuesSorties.slice(0, 3).map(p => p.l).join(', ') || 'aucune'})`)
const jamaisVue = f => T.find(p => !VUES.has(p.slug) && f(p))
const origineSeule = jamaisVue(p => !p.m && p.g.length && p.n >= 15 && p.n < 150 && pic(p) < 2)
dit(!!origineSeule && !indexee(origineSeule), `origine seule, prénom rare, jamais vu dans Google : noindex (${decrit(origineSeule)})`)
const incertain = jamaisVue(p => p.m && p.g.length && p.cf === 0 && p.n >= 15 && p.n < 150 && pic(p) < 2)
dit(!!incertain && !indexee(incertain), `sens incertain, prénom rare : noindex (${decrit(incertain)})`)
const tresRare = jamaisVue(p => p.m && p.g.length && p.cf === 2 && p.n < 15 && pic(p) < 1)
dit(!!tresRare && !indexee(tresRare), `sens sûr mais moins de 5 naissances par an : noindex (${decrit(tresRare)})`)
dit(!ficheIndexable({ m: null, g: [], cf: null, n: 9000 }, { pic: 40, histoire: 900000 }), 'une fiche mince (ni sens, ni origine) ne l’est jamais')

// 3. L'élagage garde l'essentiel.
const avant = T.filter(p => p.m || p.g.length).length
const apres = T.filter(indexee).length
dit(apres >= avant * 0.55 && apres <= avant * 0.8, `fiches indexées : ${apres} sur ${avant} indexables avant le plan B (${Math.round(apres / avant * 100)} %)`)

// 4. Les titres.
const titre = p => titreFiche({ l: p.l, S: lireSens(p.m), cf: p.cf, origine: p.g[0] ?? null })
dit(titre(fiche('alba')).includes('« blanche, aube »') && /latin/.test(titre(fiche('alba'))), `Alba : « ${titre(fiche('alba'))} »`)
dit(/^Martine : signification/.test(titre(fiche('martine'))), `Martine : « ${titre(fiche('martine'))} »`)
const sansSens = T.filter(p => !p.m).map(titre).filter(t => /signification/.test(t))
dit(sansSens.length === 0, `aucun titre ne promet une signification sans sens (${sansSens.slice(0, 3).join(' ; ') || 'aucun'})`)
const douteux = T.filter(p => p.m && p.cf === 0 && titre(p).includes('« '))
dit(douteux.length === 0, `aucun sens incertain dans un titre (${douteux.slice(0, 3).map(titre).join(' ; ') || 'aucun'})`)
const longs = T.filter(indexee).map(titre).filter(t => t.length > TITRE_MAX)
dit(longs.length <= T.filter(indexee).length * 0.02, `titres de plus de ${TITRE_MAX} caractères : ${longs.length} (${longs.slice(0, 2).join(' ; ') || 'aucun'})`)
const generiques = T.filter(indexee).map(titre).filter(t => /: signification, origine et popularité du prénom$/.test(t)).length
dit(generiques <= T.filter(indexee).length * 0.25, `titres encore sur l’ancien gabarit : ${generiques} sur ${T.filter(indexee).length}`)

console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
