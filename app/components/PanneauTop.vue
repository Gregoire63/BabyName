<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
const props = defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

const general = ref<any[]>([])
const monTop = ref<string[]>([])
const mesOui = ref<string[]>([])
const mesFavoris = ref<Set<string>>(new Set())
const charge = ref(false)
const sauve = ref(false)
const modifie = ref(false)

async function charger() {
  const r = await $fetch<any>(`/api/groupes/${g.gid}/classement`).catch(() => null)
  if (!r) { charge.value = true; return }
  general.value = r.general
  mesOui.value = r.mes_oui ?? []
  mesFavoris.value = new Set(r.mes_favoris ?? [])

  // Trois sources, de la plus explicite a la plus implicite. Sans la
  // troisieme, quelqu'un qui a dit oui a trente prenoms voyait un podium
  // vide : ses choix existaient, on ne les montrait pas.
  monTop.value = r.mon_top.length
    ? r.mon_top.map((x: any) => x.prenom)
    : r.mon_rang.length
      ? r.mon_rang.slice(0, 12).map((x: any) => x.prenom)
      : mesOui.value.slice(0, 12)
  modifie.value = false
  charge.value = true
}
watch([() => props.actif, g.pret], ([a, p]) => { if (a && p) charger() }, { immediate: true })

// Glisser-deposer au doigt : HTML5 drag ne marche pas sur mobile.
const tire = ref(-1)
const survol = ref(-1)

function deplacer(de: number, vers: number) {
  if (de < 0 || vers < 0 || de === vers) return
  const l = [...monTop.value]
  const [x] = l.splice(de, 1)
  l.splice(vers, 0, x!)
  monTop.value = l
  modifie.value = true
}

function debut(i: number, e: PointerEvent) {
  tire.value = i
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function bouge(e: PointerEvent) {
  if (tire.value < 0) return
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-rang]')
  survol.value = el ? Number((el as HTMLElement).dataset.rang) : -1
}
function fin() {
  if (tire.value >= 0 && survol.value >= 0) deplacer(tire.value, survol.value)
  tire.value = -1; survol.value = -1
}

function retirerDuPodium(i: number) {
  const l = [...monTop.value]
  l.splice(i, 1)
  monTop.value = l
  modifie.value = true
}

async function enregistrer() {
  await $fetch(`/api/groupes/${g.gid}/classement`,
    { method: 'PUT', body: { ordre: monTop.value } })
  sauve.value = true; modifie.value = false
  setTimeout(() => sauve.value = false, 1800)
  await charger()
}
</script>

<template>
  <div class="pile">
    <p v-if="!charge" class="doux">Chargement…</p>

    <template v-else>
      <section class="carte pile">
        <div class="ligne">
          <h2 style="flex:1">Mon podium</h2>
          <button v-if="modifie" class="btn btn-1 mini" @click="enregistrer">Enregistrer</button>
          <span v-else-if="sauve" class="puce">Enregistré</span>
        </div>
        <p class="mini doux" style="margin:0">
          Tirez la poignée pour réordonner. C’est ce podium, et lui seul, qui
          construit le classement général.
        </p>

        <ol v-if="monTop.length" class="liste">
          <li v-for="(p, i) in monTop" :key="p" :data-rang="i"
              :class="{ tire: tire === i, cible: survol === i && tire !== i }">
            <span class="rang">{{ i + 1 }}</span>
            <span class="nom" @click="g.ouvrirFiche(p)">
              {{ p }}<Etincelles v-if="mesFavoris.has(p)" class="fav" :taille="13"
                                 couleur="var(--peche)" une />
            </span>
            <button class="retirer" aria-label="Retirer du podium"
                    @click="retirerDuPodium(i)">−</button>
            <button class="poignee" aria-label="Déplacer"
                    @pointerdown="debut(i, $event)" @pointermove="bouge"
                    @pointerup="fin" @pointercancel="fin">⋮⋮</button>
          </li>
        </ol>
        <p v-else class="mini doux" style="margin:0">
          Dites oui à quelques prénoms : ils remplissent votre podium tout seuls.
          Vous pouvez ensuite les remettre dans l’ordre.
        </p>
      </section>

      <section class="carte pile">
        <h2>Classement général</h2>
        <p class="mini doux" style="margin:0">
          Le consensus dit si tout le monde est d’accord, ou si un seul porte le prénom
          à bout de bras.
        </p>
        <ol v-if="general.length" class="liste">
          <li v-for="(x, i) in general.slice(0, 30)" :key="x.prenom">
            <span class="rang">{{ i + 1 }}</span>
            <span class="nom" @click="g.ouvrirFiche(x.prenom)">{{ x.prenom }}</span>
            <span class="jauge" :aria-label="`consensus ${(Number(x.consensus)*100).toFixed(0)}%`">
              <i :style="{ width: (Number(x.consensus) * 100) + '%' }" />
            </span>
          </li>
        </ol>
        <p v-else class="mini doux" style="margin:0">
          Il apparaît dès que chacun a posé son podium.
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.liste li { display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border: 1px solid var(--trait); border-radius: 12px; background: var(--fond);
  transition: transform .12s, border-color .12s; }
.liste li.tire { opacity: .45; }
.liste li.cible { border-color: var(--encre); transform: scale(1.015); }
.rang { width: 22px; text-align: center; color: var(--doux); font-variant-numeric: tabular-nums;
  font-weight: 700; font-size: .82rem; flex: none; }
.nom { flex: 1; min-width: 0; cursor: pointer; font-weight: 560; }
.poignee { border: 0; background: none; color: var(--doux); cursor: grab;
  touch-action: none; padding: 4px 2px; letter-spacing: -2px; font-size: .9rem; }
.retirer { border: 0; background: none; color: var(--doux); cursor: pointer;
  font-size: 1.1rem; line-height: 1; padding: 2px 6px; opacity: .55; }
.nom { display: flex; align-items: center; gap: 5px; }
.fav { display: inline-block; }

.jauge { width: 54px; height: 5px; border-radius: 999px; background: var(--trait);
  overflow: hidden; flex: none; }
.jauge i { display: block; height: 100%; background: var(--encre); }
</style>
