<script setup lang="ts">
/** Les trois memes verdicts que sur la carte de tri, en petit, pour changer
 *  d'avis sans revenir dans la pile. */
const props = defineProps<{ valeur: number | null; occupe?: boolean }>()
const emit = defineEmits<{ choisir: [v: 0 | 1 | 2] }>()
</script>

<template>
  <div class="trio">
    <button v-for="v in ([0, 1, 2] as const)" :key="v" class="petit" :class="[`v${v}`, { on: props.valeur === v }]"
            :disabled="props.occupe" :aria-label="v === 0 ? 'Non' : v === 1 ? 'Neutre' : 'Oui'"
            @click.stop="emit('choisir', v)">
      <svg v-if="v === 2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 21.2s-8.4-5-8.4-11A5 5 0 0 1 12 7.1a5 5 0 0 1 8.4 3.1c0 6-8.4 11-8.4 11Z" />
      </svg>
      <template v-else>{{ v === 0 ? '✕' : '~' }}</template>
    </button>
  </div>
</template>

<style scoped>
.trio { display: flex; gap: 4px; flex: none; }
.petit { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--trait);
  background: var(--fond); color: var(--doux); cursor: pointer; font: inherit;
  font-size: .82rem; line-height: 1; display: grid; place-items: center; padding: 0;
  transition: background .14s, color .14s, border-color .14s; }
.petit svg { width: 15px; height: 15px; }
.petit:disabled { opacity: .45; }
.petit.on.v0 { background: var(--non); border-color: var(--non); color: #fff; }
.petit.on.v1 { background: var(--encre); border-color: var(--encre); color: var(--fond); }
.petit.on.v2 { background: var(--oui); border-color: var(--oui); color: #fff; }
</style>
