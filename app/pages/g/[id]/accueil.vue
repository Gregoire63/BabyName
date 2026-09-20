<script setup lang="ts">
// L'accueil n'est plus un volet de la liste : il n'y a de barre du bas que
// dans une liste. L'ancienne adresse ressort simplement.
onMounted(() => navigateTo('/', { replace: true }))
</script>

<template>
  <Chargement plein />
</template>
