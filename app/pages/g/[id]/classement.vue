<script setup lang="ts">
const gid = useRoute().params.id as string
const general = ref<any[]>([])
const monTop = ref<string[]>([])
const monRang = ref<any[]>([])
const pret = ref(false)
const sauve = ref(false)

async function charger() {
  const r = await $fetch<any>(`/api/groupes/${gid}/classement`)
  general.value = r.general
  monRang.value = r.mon_rang
  monTop.value = r.mon_top.length
    ? r.mon_top.map((x: any) => x.prenom)
    : r.mon_rang.slice(0, 10).map((x: any) => x.prenom)
  pret.value = true
}

let tire = -1
function prendre(i: number) { tire = i }
function deposer(i: number) {
  if (tire === -1 || tire === i) return
  const l = [...monTop.value]
  const [x] = l.splice(tire, 1)
  l.splice(i, 0, x)
  monTop.value = l
  tire = -1
}
function monter(i: number) { if (i > 0) deposer2(i, i - 1) }
function descendre(i: number) { if (i < monTop.value.length - 1) deposer2(i, i + 1) }
function deposer2(de: number, vers: number) {
  const l = [...monTop.value]; const [x] = l.splice(de, 1); l.splice(vers, 0, x); monTop.value = l
}

async function enregistrer() {
  await $fetch(`/api/groupes/${gid}/classement`, { method: 'PUT', body: { ordre: monTop.value } })
  sauve.value = true; setTimeout(() => sauve.value = false, 2000)
  await charger()
}
onMounted(charger)
</script>

<template>
  <div>
    <header class="entete"><h1>Classement</h1></header>

    <main class="page pile">
      <p v-if="!pret" class="doux">Chargement…</p>

      <template v-else>
        <section class="carte pile">
          <h2>Mon podium</h2>
          <p class="mini doux" style="margin:0">
            Glissez pour réordonner. Ce top prime sur les duels dans le calcul général.
          </p>
          <ol class="liste">
            <li v-for="(p, i) in monTop" :key="p" draggable="true"
                @dragstart="prendre(i)" @dragover.prevent @drop="deposer(i)">
              <span class="rang">{{ i + 1 }}</span>
              <span style="flex:1">{{ p }}</span>
              <button class="btn btn-fantome mini" @click="monter(i)">↑</button>
              <button class="btn btn-fantome mini" @click="descendre(i)">↓</button>
            </li>
          </ol>
          <p v-if="!monTop.length" class="mini doux" style="margin:0">
            Jouez quelques duels : votre podium se remplira tout seul.
          </p>
          <button v-else class="btn btn-principal" @click="enregistrer">
            {{ sauve ? 'Enregistré' : 'Enregistrer mon podium' }}
          </button>
        </section>

        <section class="carte pile">
          <h2>Classement général</h2>
          <p class="mini doux" style="margin:0">
            Le consensus dit si tout le monde est d’accord, ou si un seul porte le prénom à bout de bras.
          </p>
          <ol class="liste">
            <li v-for="(g, i) in general.slice(0, 30)" :key="g.prenom">
              <span class="rang">{{ i + 1 }}</span>
              <span style="flex:1">{{ g.prenom }}</span>
              <span class="etiq" :style="{ opacity: Number(g.consensus) }">
                consensus {{ (Number(g.consensus) * 100).toFixed(0) }}%
              </span>
            </li>
          </ol>
          <p v-if="!general.length" class="mini doux" style="margin:0">
            Le classement général apparaît dès que chacun a joué quelques duels.
          </p>
        </section>
      </template>
    </main>

    <BarreOnglets :gid="gid" />
  </div>
</template>

<style scoped>
.liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.liste li { display: flex; align-items: center; gap: 10px; padding: 9px 10px;
  border: 1px solid var(--trait); border-radius: 10px; background: var(--fond); cursor: grab; }
.rang { width: 24px; text-align: center; color: var(--doux); font-variant-numeric: tabular-nums;
  font-weight: 700; font-size: .85rem; }
</style>
