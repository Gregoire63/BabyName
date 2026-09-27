<script setup lang="ts">
/**
 * Un code cadeau sans Stripe (base locale), pour essayer /?cadeau=… d'un
 * geste. DEVELOPPEMENT SEULEMENT : la page /offrir ne l'importe que si
 * `import.meta.dev`.
 */
const props = defineProps<{ deLaPart?: string; message?: string }>()
const envoi = ref(false)
const code = ref('')
const erreur = ref('')

async function creer() {
  envoi.value = true; erreur.value = ''
  try {
    const r = await $fetch<any>('/api/dev/base', { method: 'POST',
      body: { action: 'cadeau', de_la_part: props.deLaPart, message: props.message } })
    code.value = r.code
  } catch (e: any) {
    erreur.value = e?.data?.message || 'Création locale impossible.'
  } finally { envoi.value = false }
}
</script>

<template>
  <button type="button" class="btn mini dev" :disabled="envoi" @click="creer">
    Créer un code sans payer (base locale)
  </button>
  <p v-if="code" class="mini" style="margin:0">
    <strong>{{ code }}</strong> —
    <NuxtLink :to="`/?cadeau=${code.replace(/-/g, '')}`" class="lien">l’ouvrir comme le destinataire</NuxtLink>
  </p>
  <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
</template>

<style scoped>
.dev { width: 100%; border-style: dashed; }
</style>
