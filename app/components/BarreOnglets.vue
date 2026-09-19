<script setup lang="ts">
const props = defineProps<{ gid: string | number }>()
const route = useRoute()
const onglets = [
  { id: 'swipe', icone: '◈', texte: 'Trier' },
  { id: 'communs', icone: '◆', texte: 'Communs' },
  { id: 'duels', icone: '⚔', texte: 'Duels' },
  { id: 'classement', icone: '☰', texte: 'Classement' },
  { id: 'groupe', icone: '◉', texte: 'Groupe' }
]
const actif = (id: string) => route.path.endsWith('/' + id)
</script>

<template>
  <nav class="onglets">
    <NuxtLink v-for="o in onglets" :key="o.id" :to="`/g/${props.gid}/${o.id}`"
              :class="{ actif: actif(o.id) }">
      <span class="pastille">{{ o.icone }}</span>{{ o.texte }}
    </NuxtLink>
  </nav>
</template>
