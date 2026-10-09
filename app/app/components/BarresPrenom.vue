<script setup lang="ts">
/**
 * Les naissances année par année, en barres : pour les prénoms trop peu
 * donnés pour une courbe (moins de 60 bébés en trois ans, jamais plus de 60
 * dans l'année).
 *
 * Une courbe en « pour 10 000 » dessinerait l'arrondi à 5 de l'INSEE en dents
 * de scie ; un pourcentage par an ferait croire à une précision que ces
 * chiffres n'ont pas. Les barres montrent les vrais nombres — Elïa passe de
 * 5 à 15 bébés par an — et chacun juge.
 *
 * Lisible sans légende : le nombre sur chaque barre, les années dessous
 * (la première, la dernière, et tous les cinq ans). Des barres muettes, sans
 * chiffres ni années, on « ne comprenait pas grand-chose ». En HTML plutôt
 * qu'en SVG étiré : les chiffres restent nets à toutes les largeurs. La carte
 * de tri lui donne la hauteur qui reste (`remplir`).
 *
 * `pas: 10` : une barre par DÉCENNIE, pour l'historique d'un prénom ajouté
 * hors catalogue (useHistorique) — 1900 à 2020, une année sur deux dessous,
 * et un seul chiffre, court, sur la plus haute (« 90 k ») : treize nombres
 * de six chiffres sur des barres de 20 pixels se marchaient dessus.
 */
const props = withDefaults(defineProps<{ valeurs: number[] | null; an0: number; hauteur?: number
  remplir?: boolean; pas?: number }>(), { pas: 1 })

const court = (x: number) => new Intl.NumberFormat('fr-FR',
  { notation: 'compact', maximumFractionDigits: x >= 10000 ? 0 : 1 }).format(x)

const d = computed(() => {
  const v = props.valeurs
  if (!v?.length) return null
  const max = Math.max(...v)
  if (max <= 0) return null
  const pas = props.pas
  const dernier = props.an0 + (v.length - 1) * pas
  return {
    max,
    barres: v.map((x, i) => {
      const an = props.an0 + i * pas
      const montre = pas > 1
        ? i % 2 === 0
        : i === 0 || i === v.length - 1 || (an % 5 === 0 && dernier - an >= 3 && an - props.an0 >= 3)
      const texte = pas > 1 ? (x === max ? (x >= 1000 ? court(x) : String(x)) : '') : String(x)
      return { an, v: x, texte,
               pct: x > 0 ? Math.max(4, (x / max) * 100) : 0, etiquette: montre ? String(an) : '' }
    })
  }
})
defineExpose({ d })

/** Ce que les barres disent, en mots (RGAA 1.3), comme pour la courbe. */
const resume = computed(() => {
  const v = props.valeurs
  if (!d.value || !v) return ''
  const an1 = props.an0 + (v.length - 1) * props.pas
  if (props.pas > 1) {
    const pic = props.an0 + v.indexOf(d.value.max) * props.pas
    return `Naissances par décennie de ${props.an0} à ${an1}, selon l’Insee : `
      + `au plus ${d.value.max.toLocaleString('fr-FR')}, dans les années ${pic}.`
  }
  return `Naissances par an de ${props.an0} à ${an1}, arrondies à 5 par l’Insee : `
    + `au plus ${d.value.max}, et ${v[v.length - 1]} en ${an1}.`
})
</script>

<template>
  <div v-if="d" class="barres" :class="{ remplir: props.remplir }"
       :style="props.remplir ? undefined : { height: `${props.hauteur ?? 110}px` }"
       role="img" :aria-label="resume">
    <div v-for="(b, i) in d.barres" :key="b.an" class="col" aria-hidden="true">
      <div class="zone">
        <span v-if="b.v" class="barre" :style="{ height: `${b.pct}%` }" />
        <span v-if="b.v && b.texte" class="val" :style="{ bottom: `${b.pct}%` }">{{ b.texte }}</span>
      </div>
      <span class="an" :class="{ premier: i === 0, dernier: i === d.barres.length - 1 }">{{ b.etiquette }}</span>
    </div>
  </div>
</template>

<style scoped>
.barres { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); column-gap: 3px;
  width: 100%; min-height: 64px; }
.barres.remplir { position: absolute; inset: 0; }
.col { display: flex; flex-direction: column; min-width: 0; }
/* la place du chiffre au-dessus de la plus haute barre */
.zone { flex: 1; position: relative; min-height: 0; margin-top: 14px; border-bottom: 1px solid var(--trait); }
.barre { position: absolute; left: 12%; right: 12%; bottom: 0; min-height: 3px;
  background: var(--menthe); border: 1.4px solid var(--encre); border-bottom: 0;
  border-radius: 4px 4px 0 0; }
.val { position: absolute; left: 50%; transform: translate(-50%, -2px); font-size: 10px;
  line-height: 1; font-weight: 800; color: var(--texte); white-space: nowrap;
  font-variant-numeric: tabular-nums; }
.an { height: 14px; line-height: 14px; font-size: 10px; font-weight: 600; color: var(--doux);
  text-align: center; white-space: nowrap; overflow: visible; display: flex; justify-content: center; }
.an.premier { justify-content: flex-start; }
.an.dernier { justify-content: flex-end; }
</style>
