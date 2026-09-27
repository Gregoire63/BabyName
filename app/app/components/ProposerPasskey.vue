<script setup lang="ts">
import { creerPasskey } from '~/composables/usePasskey'

/**
 * Juste après être entré par e-mail — l'inscription comprise : proposer la
 * passkey. C'est le bon moment : on vient d'aller chercher un code dans sa
 * boîte mail, et la prochaine fois le visage, l'empreinte ou le code du
 * téléphone suffiront.
 *
 * Proposée une fois : à un compte qui n'en a aucune, sur un navigateur qui
 * sait en créer, et pas sur un appareil où l'on a répondu « Plus tard » ces
 * trente derniers jours. Elle reste à un geste dans les Réglages et dans
 * Mon compte.
 *
 *   si fautProposerPasskey() (utils/propositionPasskey) :
 *   <ProposerPasskey @fini="suite" />
 */
const emit = defineEmits<{ fini: [] }>()
const occupe = ref(false)
const erreur = ref('')

async function creer() {
  if (occupe.value) return
  occupe.value = true
  erreur.value = ''
  const r = await creerPasskey()
  occupe.value = false
  if (r.ok) return emit('fini')
  // Annulée (le dialogue du téléphone refermé) : rien à dire, on reste là.
  erreur.value = r.message
}

function plusTard() {
  retenirPasskeyPlusTard()
  emit('fini')
}
</script>

<template>
  <div class="pile proposer" role="group" aria-labelledby="titre-passkey">
    <span class="icone" aria-hidden="true">
      <svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="4.5" /><path d="M11.2 11.2 20 20M16.5 16.5l2-2M18.6 18.6l1.6-1.6" /></svg>
    </span>
    <h2 id="titre-passkey">Connexion plus rapide</h2>
    <p class="mini doux" style="margin:0">
      Créez une passkey : la prochaine fois, votre visage, votre empreinte ou le code
      de votre téléphone suffiront.
    </p>
    <button type="button" class="btn btn-1" :disabled="occupe" @click="creer">
      {{ occupe ? 'Un instant…' : 'Créer une passkey' }}
    </button>
    <button type="button" class="btn btn-0 doux" :disabled="occupe" @click="plusTard">Plus tard</button>
    <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
  </div>
</template>

<style scoped>
.proposer { gap: 12px; text-align: center; align-items: stretch; }
.proposer h2 { font-size: 1.15rem; }
.icone { align-self: center; width: 48px; height: 48px; border-radius: 50%; display: grid;
  place-items: center; background: color-mix(in srgb, var(--menthe) 55%, var(--carte)); }
.icone svg { width: 24px; height: 24px; fill: none; stroke: var(--encre); stroke-width: 2;
  stroke-linecap: round; stroke-linejoin: round; }
</style>
