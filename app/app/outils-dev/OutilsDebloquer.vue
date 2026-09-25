<script setup lang="ts">
/**
 * Debloquer la liste locale sans Stripe (comme un code a 100 %).
 * DEVELOPPEMENT SEULEMENT : FeuilleDebloquer ne l'importe que si
 * `import.meta.dev`.
 */
const props = defineProps<{ gid: number }>()
const emit = defineEmits<{ fait: [] }>()
const envoi = ref(false)
const erreur = ref('')

async function debloquer() {
  envoi.value = true; erreur.value = ''
  try {
    await $fetch('/api/dev/base', { method: 'POST', body: { action: 'debloquer', groupe: props.gid } })
    emit('fait')
  } catch (e: any) {
    erreur.value = e?.data?.message || 'Déblocage local impossible.'
  } finally { envoi.value = false }
}
</script>

<template>
  <button type="button" class="btn mini dev" :disabled="envoi" @click="debloquer">
    Débloquer sans payer (base locale)
  </button>
  <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
</template>

<style scoped>
.dev { width: 100%; border-style: dashed; }
</style>
