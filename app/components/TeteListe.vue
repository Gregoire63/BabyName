<script setup lang="ts">
/**
 * Le nom de la liste, en tete de chaque onglet qui vit DANS une liste.
 *
 * Sans lui, on ouvrait une liste et plus rien ne disait laquelle : la barre du
 * bas changeait d'un coup, sans expliquer pourquoi. Le nom defile avec le
 * contenu plutot que de tenir une barre fixe en haut — on ne perd pas 44 px
 * de hauteur utile sur un ecran de telephone.
 */
import { useGroupeCourant } from '~/composables/etatGroupe'
defineProps<{ onglet: string; info?: string; compact?: boolean }>()
const g = useGroupeCourant()
</script>

<template>
  <header class="tete" :class="{ compact }">
    <h1>{{ g.etat.value?.groupe?.nom ?? '…' }}</h1>
    <p class="mini doux">
      {{ onglet }}<template v-if="info"> · {{ info }}</template>
    </p>
    <slot />
  </header>
</template>

<style scoped>
.tete { display: flex; flex-direction: column; gap: 1px; }
.tete h1 { font-size: 1.42rem; letter-spacing: -.03em; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tete p { margin: 0; }
.tete.compact h1 { font-size: 1.1rem; letter-spacing: -.02em; }
</style>
