<script setup lang="ts">
import { chargerCatalogue, type Prenom } from '~/composables/useCatalogue'
const gid = useRoute().params.id as string
const duel = ref<{ a: string; b: string } | null>(null)
const raison = ref('')
const parNom = ref<Map<string, Prenom>>(new Map())
const faits = ref(0)
const pret = ref(false)

async function suivant() {
  const r = await $fetch<any>(`/api/groupes/${gid}/duel`)
  duel.value = r.duel
  raison.value = r.raison ?? ''
}

async function choisir(gagnant: string | null) {
  if (!duel.value) return
  const { a, b } = duel.value
  duel.value = null
  faits.value++
  await $fetch(`/api/groupes/${gid}/duel`, { method: 'POST', body: { a, b, gagnant } })
  await suivant()
}

onMounted(async () => {
  const cat = await chargerCatalogue()
  parNom.value = new Map(cat!.liste.map(p => [p.l, p]))
  await suivant()
  pret.value = true
})
</script>

<template>
  <div>
    <header class="entete"><h1>Duels</h1><span class="mini doux">{{ faits }} joués</span></header>

    <main class="page">
      <p v-if="!pret" class="doux">Chargement…</p>

      <div v-else-if="!duel" class="vide">
        <h2 v-if="raison === 'pas_assez_de_communs'">Pas encore assez de communs</h2>
        <h2 v-else>Tout a été départagé</h2>
        <p v-if="raison === 'pas_assez_de_communs'">
          Il faut au moins deux prénoms validés par tout le monde pour commencer à les départager.
        </p>
        <p v-else>Vous avez joué tous les duels utiles. Le classement est à jour.</p>
        <NuxtLink class="btn" :to="`/g/${gid}/classement`">Voir le classement</NuxtLink>
      </div>

      <template v-else>
        <p class="doux" style="text-align:center;margin:8px 0 20px">
          Lequel préférez-vous ? Un seul tap, pas de réflexion.
        </p>
        <div class="duel">
          <button v-for="cote in [duel.a, duel.b]" :key="cote" class="carte choix"
                  @click="choisir(cote)">
            <span class="nom">{{ cote }}</span>
            <span v-if="parNom.get(cote)?.m" class="mini doux">« {{ parNom.get(cote)!.m }} »</span>
          </button>
        </div>
        <button class="btn btn-fantome" style="display:block;margin:18px auto 0"
                @click="choisir(null)">Impossible de choisir</button>
      </template>
    </main>

    <BarreOnglets :gid="gid" />
  </div>
</template>

<style scoped>
.duel { display: grid; gap: 14px; }
.choix { display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; min-height: 150px; cursor: pointer; border: 1px solid var(--trait); }
.choix:active { transform: scale(.98); }
.nom { font-size: 1.9rem; font-weight: 650; letter-spacing: -.03em; }
</style>
