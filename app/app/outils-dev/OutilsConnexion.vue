<script setup lang="ts">
/**
 * Entrer d'un geste avec un compte du jeu d'essai. DEVELOPPEMENT SEULEMENT :
 * la page de connexion ne l'importe que si `import.meta.dev`. Les cles
 * viennent du serveur (/api/dev/base), qui ne les donne qu'en developpement
 * et sur la base locale.
 */
defineProps<{ occupe?: boolean }>()
const emit = defineEmits<{ entrer: [cle: string] }>()
const comptes = ref<{ pseudo: string; cle: string; role: string }[]>([])
onMounted(async () => {
  comptes.value = (await $fetch<any>('/api/dev/base').catch(() => null))?.comptes ?? []
})
</script>

<template>
  <section v-if="comptes.length" class="carte pile dev" aria-labelledby="titre-dev">
    <h2 id="titre-dev" class="mini">Base locale — entrer comme</h2>
    <div class="ligne" style="flex-wrap:wrap;gap:8px">
      <button v-for="c in comptes" :key="c.cle" type="button" class="btn mini"
              :title="c.role" :disabled="occupe" @click="emit('entrer', c.cle)">
        {{ c.pseudo }}
      </button>
    </div>
    <p class="mini doux" style="margin:0">
      Développement seulement. Base neuve, nouvelle journée, déblocage : Mon compte → Outils.
    </p>
  </section>
</template>

<style scoped>
.dev { border-style: dashed; gap: 10px; padding: 14px 16px; }
.dev h2 { font-size: .8rem; }
</style>
