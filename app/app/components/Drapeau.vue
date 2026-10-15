<script setup lang="ts">
/**
 * Le drapeau d'un pays de data/pays (index.json), dessiné ici en SVG.
 *
 * Pas d'emoji : « 🇫🇷 » s'affiche en deux lettres « FR » sous Windows, et le
 * Québec, l'Ontario ou l'Irlande du Nord n'en ont nulle part. Tous au même
 * format (3:2), simplifiés pour se lire à 20 px de large.
 *
 * Une sous-région prend le drapeau sous lequel on la reconnaît : le Québec le
 * fleurdelisé, l'Écosse sa croix de Saint-André ; l'Ontario et la
 * Colombie-Britannique, celui du Canada ; l'Angleterre-et-pays-de-Galles et
 * l'Irlande du Nord, celui du Royaume-Uni (les chiffres de l'ONS couvrent
 * deux nations, et l'Irlande du Nord n'a pas de drapeau à elle qui fasse
 * consensus). Le nom, à côté, dit toujours de quoi il s'agit.
 *
 * Un code sans dessin (un pays ajouté plus tard) : rien, plutôt qu'un faux.
 * Décoratif : le nom du pays est écrit juste à côté (aria-hidden).
 */
const props = defineProps<{ code: string }>()

const rect = (x: number, y: number, w: number, h: number, c: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`
const bandesV = (a: string, b: string, c: string) => rect(0, 0, 10, 20, a) + rect(10, 0, 10, 20, b) + rect(20, 0, 10, 20, c)
const bandesH = (...c: string[]) => c.map((x, i) => rect(0, i * 20 / c.length, 30, 20 / c.length + .01, x)).join('')
/** Croix scandinave : barre verticale de x0 à x1, horizontale de y0 à y1. */
const croix = (x0: number, x1: number, y0: number, y1: number, c: string) => rect(x0, 0, x1 - x0, 20, c) + rect(0, y0, 30, y1 - y0, c)

const UNION = rect(0, 0, 30, 20, '#012169')
  + '<path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/>'
  + '<path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.4"/>'
  + '<path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6.6"/>'
  + '<path d="M15 0V20M0 10H30" stroke="#C8102E" stroke-width="4"/>'

/** Étoile à cinq branches, de rayon r, centrée en (x, y). */
function etoile(x: number, y: number, r: number, attributs: string): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, ri = i % 2 ? r * .4 : r
    pts.push(`${(x + ri * Math.cos(a)).toFixed(2)},${(y + ri * Math.sin(a)).toFixed(2)}`)
  }
  return `<polygon points="${pts.join(' ')}" ${attributs}/>`
}

function etatsUnis(): string {
  let s = rect(0, 0, 30, 20, '#fff')
  const h = 20 / 13
  for (let i = 0; i < 13; i += 2) s += rect(0, i * h, 30, h, '#B22234')
  s += rect(0, 0, 12, 7 * h, '#3C3B6E')
  for (let r = 0; r < 9; r++) {
    const n = r % 2 ? 5 : 6
    for (let k = 0; k < n; k++) s += `<circle cx="${(r % 2 ? 2 : 1) + k * 2}" cy="${(.62 + r * 1.18).toFixed(2)}" r=".38" fill="#fff"/>`
  }
  return s
}

// La feuille d'érable : onze pointes, moitié droite puis son miroir.
const ERABLE_DROITE: [number, number][] = [[0, -50], [9, -32], [19, -37], [14, -9], [34, -26], [31, -16], [48, -19],
  [41, -4], [46, 0], [23, 18], [27, 26], [3, 22], [4, 48]]
const ERABLE = [...ERABLE_DROITE, ...ERABLE_DROITE.slice(1).reverse().map(([x, y]) => [-x, y] as [number, number])]
const canada = () => rect(0, 0, 7.5, 20, '#D80621') + rect(7.5, 0, 15, 20, '#fff') + rect(22.5, 0, 7.5, 20, '#D80621')
  + `<polygon fill="#D80621" transform="translate(15 10) scale(.092)" points="${ERABLE.map(p => p.join(',')).join(' ')}"/>`

// Le fleurdelisé : une croix blanche et quatre fleurs de lys.
const LYS = '<path d="M0-12C4-7 4-2 1.5 2h-3C-4-2-4-7 0-12z'
  + 'M1.6 2.4C3-1 8-3 9 1c.6 2.6-2 4.4-4.2 2.8 1.6-.4 2.2-1.9 1.2-2.8C4.8.1 3.2 1.5 2.6 3z'
  + 'M-1.6 2.4C-3-1-8-3-9 1c-.6 2.6 2 4.4 4.2 2.8-1.6-.4-2.2-1.9-1.2-2.8C-4.8.1-3.2 1.5-2.6 3z'
  + 'M-6 3h12v2H-6zM-1.5 5h3l1.4 5.5C1.5 9.6-1.5 9.6-2.9 10.5z" fill="#fff"/>'
const quebec = () => rect(0, 0, 30, 20, '#003DA5') + croix(13.4, 16.6, 8.4, 11.6, '#fff')
  + [[6.7, 4.2], [23.3, 4.2], [6.7, 15.8], [23.3, 15.8]]
    .map(([x, y]) => `<g transform="translate(${x} ${y}) scale(.22)">${LYS}</g>`).join('')

const DESSINS: Record<string, string> = {
  fr: bandesV('#002395', '#fff', '#ED2939'),
  be: bandesV('#1A1A1A', '#FDDA24', '#EF3340'),
  ch: rect(0, 0, 30, 20, '#DA291C') + rect(13, 3.33, 4, 13.34, '#fff') + rect(8.33, 8, 13.34, 4, '#fff'),
  qc: quebec(),
  'ca-on': canada(),
  'ca-bc': canada(),
  us: etatsUnis(),
  'gb-eaw': UNION,
  'gb-sct': rect(0, 0, 30, 20, '#005EB8') + '<path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="3.6"/>',
  'gb-nir': UNION,
  ie: bandesV('#169B62', '#fff', '#FF883E'),
  at: bandesH('#ED2939', '#fff', '#ED2939'),
  se: rect(0, 0, 30, 20, '#006AA7') + croix(9.4, 13.1, 8, 12, '#FECC00'),
  no: rect(0, 0, 30, 20, '#BA0C2F') + croix(8.2, 13.6, 7.5, 12.5, '#fff') + croix(9.5, 12.3, 8.75, 11.25, '#00205B'),
  pl: bandesH('#fff', '#DC143C'),
  lv: rect(0, 0, 30, 20, '#9E3039') + rect(0, 8, 30, 4, '#fff'),
  nz: rect(0, 0, 30, 20, '#012169') + `<svg width="15" height="10" viewBox="0 0 30 20">${UNION}</svg>`
    + [[22.5, 4, 1.4], [19.6, 9.4, 1.3], [25.6, 8.3, 1.35], [22.5, 15.6, 1.55]]
      .map(([x, y, r]) => etoile(x!, y!, r!, 'fill="#C8102E" stroke="#fff" stroke-width=".28"')).join('')
}

// Posé par v-html : ce sont les dessins écrits ci-dessus, aucune donnée venue d'ailleurs.
const dessin = computed(() => DESSINS[props.code] ?? null)
</script>

<template>
  <svg v-if="dessin" class="drapeau" :data-pays="props.code" viewBox="0 0 30 20"
       aria-hidden="true" focusable="false" v-html="dessin" />
</template>

<style scoped>
/* La hauteur d'une majuscule, à peu près ; un liseré pour que le blanc de la
   Pologne ou de l'Autriche ne se fonde pas dans la carte. */
.drapeau { display: inline-block; width: 1.35em; height: .9em; flex: none; vertical-align: -.1em;
  border-radius: 2.5px; overflow: hidden;
  outline: 1px solid color-mix(in srgb, var(--texte) 16%, transparent); outline-offset: -1px; }
</style>
