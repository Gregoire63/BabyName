<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'

/**
 * Qui traîne : un commun ne sort que si tout le monde a voté dessus.
 *
 * Un composant à lui seul, et c'est voulu. Il lit le nombre de prénoms jugés
 * par chacun, qui bouge à chaque geste du tri : resté dans PanneauCommuns,
 * c'est toute la liste des accords qui se redessinait avec lui à chaque vote
 * dès qu'un des deux avait du retard.
 */
const g = useGroupeCourant()
const enRetard = computed(() => {
  // Les décideurs seulement : un observateur (Mamie) n'est pas attendu par
  // les accords — dire « la liste reste incomplète tant qu'elle n'a pas
  // rattrapé » était faux, et culpabilisait la personne qui n'y peut rien.
  const a = (g.etat.value?.avancement ?? []).filter((x: any) => x.role !== 'observateur')
  if (a.length < 2) return null
  const max = Math.max(...a.map((x: any) => x.votes))
  const lent = a.find((x: any) => x.votes < max * 0.6)
  return lent ? { pseudo: lent.pseudo, manque: max - lent.votes } : null
})
</script>

<template>
  <p v-if="enRetard" class="rappel mini">
    {{ enRetard.manque }} votes manquent à {{ enRetard.pseudo }} : la liste reste incomplète
    tant que {{ enRetard.pseudo }} n’a pas rattrapé.
  </p>
</template>

<style scoped>
.rappel { margin: 0; padding: 10px 13px; border-radius: 12px;
  background: color-mix(in srgb, var(--peche) 42%, transparent); }
</style>
