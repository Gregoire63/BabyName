<script setup lang="ts">
import { LANGUES, etatLangue, choisirLangue, type ChoixLangue } from '~/composables/useLangue'

/**
 * Le choix de la langue (composables/useLangue.ts). Une liste déroulante,
 * pas des boutons : neuf options ne tiennent pas sur une ligne. Chaque
 * langue s'écrit dans sa propre langue — on la reconnaît même quand l'app
 * parle une langue qu'on ne lit pas. « Automatique » suit le téléphone.
 */
const id = useId()
const valeur = computed({
  get: () => etatLangue.choix,
  set: (v: ChoixLangue) => choisirLangue(v)
})
</script>

<template>
  <div class="pile" style="gap:6px">
    <label :for="id" class="sr-only">{{ $t('ChoixLangue.etiquette') }}</label>
    <select :id="id" v-model="valeur" class="champ">
      <option value="auto">{{ $t('ChoixLangue.auto') }}</option>
      <option v-for="l in LANGUES" :key="l.code" :value="l.code" :lang="l.code">{{ l.nom }}</option>
    </select>
  </div>
</template>
