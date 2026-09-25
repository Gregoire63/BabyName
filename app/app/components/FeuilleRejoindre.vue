<script setup lang="ts">
/** Entrer dans la liste de quelqu'un d'autre avec son code (10 caracteres,
 *  ou 8 pour les listes d'avant — voir shared/utils/codes.ts). */
const emit = defineEmits<{ fermer: [] }>()

// On nettoie DANS le champ, pas seulement dans la variable : sinon on voit
// s'inscrire des caracteres que le serveur refusera (I, L, O, U, espaces,
// tirets), sans comprendre pourquoi le bouton reste gris.
const code = ref('')
function saisir(e: Event) {
  const champ = e.target as HTMLInputElement
  code.value = saisieCodeInvitation(champ.value)
  champ.value = code.value        // Vue ne repeint pas si la valeur n'a pas bouge
}
const envoi = ref(false)
const erreur = ref('')
const champ = ref<HTMLInputElement>()

onMounted(() => setTimeout(() => champ.value?.focus(), 380))   // apres l'animation

const pret = computed(() => !!normaliserCodeInvitation(code.value))

async function entrer() {
  if (!pret.value || envoi.value) return
  envoi.value = true
  erreur.value = ''
  try {
    const g = await $fetch<any>('/api/groupes/rejoindre',
      { method: 'POST', body: { code: code.value } })
    await navigateTo(`/g/${g.id}/swipe`)
  } catch (e: any) {
    const m = e?.data?.statusMessage
    erreur.value = m === 'trop_d_essais'
      ? 'Trop d’essais : réessayez dans une heure, ou demandez le lien de la liste.'
      : m === 'code_invalide'
        ? 'Ce code n’a pas le bon format : 10 caractères (8 pour les listes plus anciennes).'
        : 'Code inconnu. Vérifiez-le, ou demandez le lien de la liste.'
    envoi.value = false
  }
}
</script>

<template>
  <Feuille titre="Rejoindre une liste" @fermer="emit('fermer')">
    <p class="mini doux" style="margin:0 0 12px">
      Demandez son code à la personne qui a créé la liste : dans les réglages
      de sa liste, sous « Inviter quelqu’un ». Le plus simple reste le lien
      qu’elle peut vous envoyer.
    </p>
    <input ref="champ" :value="code" class="champ code" placeholder="Le code"
           aria-label="Code d’invitation"
           autocapitalize="characters" autocorrect="off" spellcheck="false"
           inputmode="latin" @input="saisir" @keyup.enter="entrer">
    <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:10px 0 0">{{ erreur }}</p>

    <template #pied>
      <button class="btn btn-1" :disabled="!pret || envoi" @click="entrer">
        {{ envoi ? 'Un instant…' : 'Entrer' }}
      </button>
    </template>
  </Feuille>
</template>

<style scoped>
.code { width: 100%; text-align: center; font-size: 1.3rem; font-weight: 700;
  letter-spacing: .2em; text-indent: .2em; }
</style>
