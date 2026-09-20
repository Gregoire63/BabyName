<script setup lang="ts">
/**
 * « La barre du bas apparait quand on entre dans une liste » : c'est ce qui
 * rendait la navigation bizarre. Elle est maintenant permanente, donc la
 * racine renvoie vers l'accueil DANS la derniere liste ouverte. Sans liste —
 * premiere venue, ou lien d'invitation en cours — il n'y a pas d'onglets a
 * montrer : on rend l'accueil nu.
 */
const nu = ref(false)

onMounted(async () => {
  if (useRoute().query.code) { nu.value = true; return }
  const groupes = await $fetch<any[]>('/api/groupes').catch(() => null)
  if (!groupes?.length) { nu.value = true; return }
  let derniere: string | null = null
  try { derniere = localStorage.getItem('derniere-liste') } catch { /* mode prive */ }
  const cible = groupes.find(g => String(g.id) === derniere) ?? groupes[0]
  await navigateTo(`/g/${cible.id}/accueil`, { replace: true })
})
</script>

<template>
  <SectionAccueil v-if="nu" />
  <p v-else class="doux" style="padding:28px;text-align:center">Chargement…</p>
</template>
