<script setup lang="ts">
import { CLE_GROUPE, enVeille, useGroupeCourant } from '~/composables/etatGroupe'

/**
 * Ce qu'on ne regarde pas ne travaille pas.
 *
 * Les trois onglets d'une liste restent montés une fois ouverts (on glisse de
 * l'un à l'autre), et les volets du classement aussi. Ils lisaient tous les
 * votes en direct : chaque geste du tri recalculait et redessinait « À
 * revoir », « Mes choix », le portrait — des écrans qu'on ne voyait pas.
 * Avec quelques centaines de votes, dès qu'on avait ouvert le classement une
 * fois, chaque swipe attendait qu'ils aient fini.
 *
 * Tout ce qui est rangé dans ce composant reçoit l'état de la liste « en
 * veille » (enVeille, dans etatGroupe.ts) : il ne suit les votes, les
 * accords, les favoris que pendant que `actif` est vrai, et rattrape d'un
 * coup quand il le redevient.
 *
 *   <EnVeille :actif="index === 1"><SectionClassement … /></EnVeille>
 *
 * Les gardes s'emboîtent : un volet du classement ne suit que s'il est le
 * volet affiché ET que le classement est l'onglet affiché.
 */
const props = defineProps<{ actif: boolean }>()
provide(CLE_GROUPE, enVeille(useGroupeCourant(), () => props.actif))
</script>

<template>
  <slot />
</template>
