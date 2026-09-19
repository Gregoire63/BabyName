<script setup lang="ts">
const gid = useRoute().params.id as string
const etat = ref<any>(null)
const copie = ref(false)

async function charger() { etat.value = await $fetch(`/api/groupes/${gid}`) }

const lien = computed(() =>
  etat.value ? `${location.origin}/?code=${etat.value.groupe.code_invitation}` : '')

async function copier() {
  await navigator.clipboard.writeText(lien.value)
  copie.value = true; setTimeout(() => copie.value = false, 1800)
}

async function retirerVeto(prenom: string) {
  await $fetch(`/api/groupes/${gid}/veto?prenom=${encodeURIComponent(prenom)}`, { method: 'DELETE' })
    .catch(() => alert('Seul celui qui a posé ce veto peut le retirer.'))
  await charger()
}
onMounted(charger)
</script>

<template>
  <div>
    <header class="entete"><h1>{{ etat?.groupe?.nom ?? 'Groupe' }}</h1></header>

    <main class="page pile">
      <template v-if="etat">
        <section class="carte pile">
          <h2>Inviter</h2>
          <p class="mini doux" style="margin:0">Code : <strong>{{ etat.groupe.code_invitation }}</strong></p>
          <button class="btn" @click="copier">{{ copie ? 'Lien copié' : 'Copier le lien d’invitation' }}</button>
        </section>

        <section class="carte pile">
          <h2>Qui en est</h2>
          <div v-for="m in etat.avancement" :key="m.user_id" class="ligne">
            <span style="flex:1">{{ m.pseudo }}</span>
            <span class="mini doux">{{ m.votes }} prénoms jugés</span>
          </div>
        </section>

        <section v-if="etat.vetos.length" class="carte pile">
          <h2>Vetos</h2>
          <p class="mini doux" style="margin:0">
            Définitifs. {{ etat.groupe.nb_vetos_max }} par personne, pas un de plus.
          </p>
          <div v-for="v in etat.vetos" :key="v.prenom" class="ligne">
            <span style="flex:1"><strong>{{ v.prenom }}</strong>
              <span class="mini doux"> — {{ v.pseudo }}<template v-if="v.motif"> : {{ v.motif }}</template></span>
            </span>
            <button class="btn btn-fantome mini" @click="retirerVeto(v.prenom)">Retirer</button>
          </div>
        </section>

        <section v-if="etat.mes_favoris.length" class="carte pile">
          <h2>Mes gardés</h2>
          <p class="mini doux" style="margin:0">
            Ceux que vous gardez sous le coude, même s’ils ne font pas l’unanimité.
          </p>
          <div class="ligne" style="flex-wrap:wrap;gap:6px">
            <span v-for="f in etat.mes_favoris" :key="f" class="etiq">{{ f }}</span>
          </div>
        </section>

        <NuxtLink class="btn btn-fantome" to="/">Toutes mes listes</NuxtLink>
      </template>
    </main>

    <BarreOnglets :gid="gid" />
  </div>
</template>
