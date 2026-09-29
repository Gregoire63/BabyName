/**
 * La recherche de prénom des pages publiques (fiches, listes, /chercher-un-prenom/).
 *
 * Deux fichiers texte, servis depuis /statique/ sous un nom qui porte leur
 * empreinte, et lus par le navigateur seulement quand on s'en sert :
 *
 *   - l'INDEX : une ligne par graphie qui mène à une fiche
 *     (libellé, adresse de la fiche, sexe, naissances des 3 dernières années,
 *     groupe de prononciation). Trié par naissances : les suggestions sortent
 *     dans l'ordre où on les cherche (Louise avant Louisette).
 *   - l'INSEE complet, découpé par première lettre : tous les prénoms donnés
 *     en France depuis 1900, même ceux qui n'ont pas de fiche. C'est ce qui
 *     répond à « ce prénom existe-t-il ? ». Une lettre ne pèse que quelques
 *     dizaines de Ko et ne se charge que si l'index ne connaît pas le prénom.
 *
 * Le moteur est dans recherche-client.js (sans dépendance, pas de script en
 * ligne : la politique de contenu des pages statiques l'interdit).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export function construireRecherche({ tous, pages, slugDe, racine }) {
  // L'index : chaque graphie qui a une fiche, ou dont la graphie principale
  // (même prononciation) en a une — « Maëlys » mène à sa fiche, « Maelys »
  // aussi si elle n'a pas la sienne.
  const ficheDuGroupe = new Map()
  for (const p of [...tous].sort((a, b) => b.n - a.n)) {
    if (pages.has(p.slug) && !ficheDuGroupe.has(p.gp)) ficheDuGroupe.set(p.gp, p.slug)
  }
  const vus = new Set()
  const lignes = []
  for (const p of [...tous].sort((a, b) => b.n - a.n)) {
    const cle = `${p.l}|${p.sexe}`
    if (vus.has(cle)) continue
    const fiche = pages.has(p.slug) ? p.slug : ficheDuGroupe.get(p.gp)
    if (!fiche) continue
    vus.add(cle)
    lignes.push([p.l, fiche === p.slug ? '' : fiche, p.sexe, Math.round(p.n), p.gp].join('\t'))
  }
  const index = lignes.join('\n')

  // L'INSEE complet, par première lettre du prénom sans accent.
  const brut = resolve(racine, '../data/raw/prenoms_insee_2025_packed.csv')
  const lettres = new Map()
  if (existsSync(brut)) {
    const tot = new Map()
    const txt = readFileSync(brut, 'utf8').split('\n')
    for (let i = 1; i < txt.length; i++) {
      if (!txt[i]) continue
      const [, prenom, first, vals] = txt[i].split(';')
      const v = vals.split(',').map(x => Number(x) * 5)
      let e = tot.get(prenom)
      if (!e) tot.set(prenom, e = { n: 0, a: 9999, b: 0 })
      v.forEach((x, k) => {
        if (!x) return
        e.n += x
        const an = Number(first) + k
        if (an < e.a) e.a = an
        if (an > e.b) e.b = an
      })
    }
    for (const [prenom, e] of tot) {
      if (!e.n) continue
      const s = slugDe(prenom)
      const l = s[0]
      if (!l || !/[a-z]/.test(l)) continue
      const ligne = `${prenom}\t${e.n}\t${e.a}\t${e.b}`
      const t = lettres.get(l); t ? t.push(ligne) : lettres.set(l, [ligne])
    }
  }
  return { index, lettres: new Map([...lettres].map(([l, t]) => [l, t.join('\n')])) }
}

export const CLIENT = readFileSync(new URL('./recherche-client.js', import.meta.url), 'utf8')
