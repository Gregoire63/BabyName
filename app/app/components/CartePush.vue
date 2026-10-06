<script setup lang="ts">
/**
 * Les notifications du téléphone — dans l'app des stores seulement (usePush).
 *
 * Un bouton, pas un interrupteur trompeur : iOS ne pose sa question qu'UNE
 * fois, et un refus ne se rattrape que dans les réglages du téléphone. La
 * carte dit donc où on en est et propose le geste qui reste possible. Ailleurs
 * que dans l'app, ou sur un téléphone qui ne peut pas : rien, pas même la
 * carte.
 *
 * Ce qui arrive : « Vous avez un nouvel accord », « Alice a rejoint votre
 * liste ». Jamais le prénom — il s'afficherait sur un écran verrouillé.
 */
const { etat, activer, couper } = usePush()
const occupe = ref(false)
async function faire(f: () => Promise<void>) {
  if (occupe.value) return
  occupe.value = true
  try { await f() } finally { occupe.value = false }
}
</script>

<template>
  <section v-if="etat !== 'absent'" class="carte pile" aria-labelledby="titre-push">
    <div class="ligne">
      <h2 id="titre-push" style="flex:1">Notifications</h2>
      <span class="mini doux" role="status">{{ etat === 'actif' ? 'Activées' : '' }}</span>
    </div>
    <button v-if="etat === 'actif'" type="button" class="btn btn-0 mini" style="align-self:flex-start"
            :disabled="occupe" @click="faire(couper)">
      Ne plus me prévenir
    </button>
    <button v-else type="button" class="btn" :disabled="occupe" @click="faire(activer)">
      {{ etat === 'refuse' ? 'Autoriser dans les réglages du téléphone' : 'Me prévenir d’un nouvel accord' }}
    </button>
  </section>
</template>
