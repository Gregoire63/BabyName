<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
const props = defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

const duel = ref<{ a: string; b: string } | null>(null)
const raison = ref('')
const faits = ref(0)
const charge = ref(false)

async function suivant() {
  const r = await $fetch<any>(`/api/groupes/${g.gid}/duel`).catch(() => null)
  duel.value = r?.duel ?? null
  raison.value = r?.raison ?? ''
  charge.value = true
}
watch([() => props.actif, g.pret], ([a, p]) => { if (a && p && !charge.value) suivant() },
  { immediate: true })

async function choisir(gagnant: string | null) {
  if (!duel.value) return
  const { a, b } = duel.value
  duel.value = null
  faits.value++
  await $fetch(`/api/groupes/${g.gid}/duel`, { method: 'POST', body: { a, b, gagnant } })
    .catch(() => null)
  await suivant()
}
</script>

<template>
  <div class="pile">
    <div class="haut">
      <h1>Duels</h1>
      <span class="puce">{{ faits }} joués</span>
    </div>

    <p v-if="!charge" class="doux">Chargement…</p>

    <div v-else-if="!duel" class="vide">
      <template v-if="raison === 'pas_assez_de_communs'">
        <h2>Pas encore assez de communs</h2>
        <p>Il faut au moins deux prénoms validés par tout le monde avant de pouvoir
           les départager.</p>
        <button class="btn" @click="g.allerA('swipe')">Continuer à trier</button>
      </template>
      <template v-else>
        <h2>Tout est départagé</h2>
        <p>Vous avez joué tous les duels utiles. Le classement est à jour.</p>
        <button class="btn" @click="g.allerA('classement')">Voir le classement</button>
      </template>
    </div>

    <template v-else>
      <p class="doux" style="text-align:center;margin:2px 0 4px">
        Lequel préférez-vous ? Un tap, sans réfléchir.
      </p>
      <div class="duel">
        <button v-for="cote in [duel.a, duel.b]" :key="cote" class="carte choix"
                @click="choisir(cote)">
          <span class="nom">{{ cote }}</span>
          <span v-if="g.parNom.value.get(cote)?.m" class="mini doux">
            « {{ g.parNom.value.get(cote)!.m }} »
          </span>
        </button>
      </div>
      <button class="btn btn-0 doux" style="align-self:center" @click="choisir(null)">
        Impossible de choisir
      </button>
    </template>
  </div>
</template>

<style scoped>
.haut { display: flex; align-items: center; justify-content: space-between; }
.duel { display: grid; gap: 14px; }
.choix { display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; min-height: 152px; cursor: pointer; }
.choix:active { transform: scale(.98); }
.nom { font-size: 1.95rem; font-weight: 650; letter-spacing: -.03em; }
</style>
