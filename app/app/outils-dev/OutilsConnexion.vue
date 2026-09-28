<script setup lang="ts">
/**
 * Entrer d'un geste avec un compte du jeu d'essai. DEVELOPPEMENT SEULEMENT :
 * la page de connexion ne l'importe que si `import.meta.dev`. Les comptes
 * viennent du serveur (/api/dev/base), et l'on y entre par leur prenom
 * (/api/dev/entrer) : deux routes qui ne repondent qu'en developpement, sur
 * la base locale.
 */
defineProps<{ occupe?: boolean }>()
const emit = defineEmits<{ entre: [] }>()
const comptes = ref<{ pseudo: string; role: string }[]>([])
const envoi = ref(false)
const erreur = ref('')
onMounted(async () => {
  comptes.value = (await $fetch<any>('/api/dev/base').catch(() => null))?.comptes ?? []
})

async function entrer(pseudo: string) {
  envoi.value = true
  erreur.value = ''
  try {
    await $fetch('/api/dev/entrer', { method: 'POST', body: { pseudo } })
    emit('entre')
  } catch (e: any) {
    erreur.value = e?.data?.statusMessage === 'compte_absent'
      ? `${pseudo} n’est plus dans la base : Mon compte → Outils → Base neuve.`
      : 'Entrée impossible.'
  } finally { envoi.value = false }
}
</script>

<template>
  <section v-if="comptes.length" class="carte pile dev" aria-labelledby="titre-dev">
    <h2 id="titre-dev" class="mini">Base locale : entrer comme</h2>
    <div class="ligne" style="flex-wrap:wrap;gap:8px">
      <button v-for="c in comptes" :key="c.pseudo" type="button" class="btn mini"
              :title="c.role" :disabled="occupe || envoi" @click="entrer(c.pseudo)">
        {{ c.pseudo }}
      </button>
    </div>
    <p v-if="erreur" class="mini" role="alert" style="margin:0;color:var(--non)">{{ erreur }}</p>
    <p class="mini doux" style="margin:0">
      Développement seulement. Base neuve, nouvelle journée, déblocage : Mon compte → Outils.
    </p>
  </section>
</template>

<style scoped>
.dev { border-style: dashed; gap: 10px; padding: 14px 16px; }
.dev h2 { font-size: .8rem; }
</style>
