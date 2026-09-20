<script setup lang="ts">
/** Entrer dans la liste de quelqu'un d'autre avec son code a 8 caracteres. */
const emit = defineEmits<{ fermer: [] }>()

// Le serveur n'accepte que 8 caracteres hexadecimaux. On nettoie DANS le champ,
// pas seulement dans la variable : sinon on voit s'inscrire des lettres que le
// serveur refusera, sans comprendre pourquoi le bouton reste gris.
const code = ref('')
function saisir(e: Event) {
  const champ = e.target as HTMLInputElement
  code.value = champ.value.toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 8)
  champ.value = code.value        // Vue ne repeint pas si la valeur n'a pas bouge
}
const envoi = ref(false)
const erreur = ref('')
const champ = ref<HTMLInputElement>()

onMounted(() => setTimeout(() => champ.value?.focus(), 380))   // apres l'animation

const pret = computed(() => code.value.length === 8)

async function entrer() {
  if (!pret.value || envoi.value) return
  envoi.value = true
  erreur.value = ''
  try {
    const g = await $fetch<any>('/api/groupes/rejoindre',
      { method: 'POST', body: { code: code.value } })
    await navigateTo(`/g/${g.id}/swipe`)
  } catch (e: any) {
    erreur.value = e?.data?.statusMessage === 'code_invalide'
      ? 'Un code ne contient que des chiffres et les lettres a à f.'
      : 'Code inconnu. Vérifiez les 8 caractères.'
    envoi.value = false
  }
}
</script>

<template>
  <Feuille titre="Rejoindre une liste" @fermer="emit('fermer')">
    <p class="mini doux" style="margin:0 0 12px">
      Demandez son code à la personne qui a créé la liste : 8 caractères, dans
      les paramètres de sa liste.
    </p>
    <input ref="champ" :value="code" class="champ code" placeholder="8 caractères"
           maxlength="8" autocapitalize="off" autocorrect="off" spellcheck="false"
           inputmode="latin" @input="saisir" @keyup.enter="entrer">
    <p v-if="erreur" class="mini" style="color:var(--non);margin:10px 0 0">{{ erreur }}</p>

    <template #pied>
      <button class="btn btn-1" :disabled="!pret || envoi" @click="entrer">
        {{ envoi ? 'Un instant…' : 'Entrer' }}
      </button>
    </template>
  </Feuille>
</template>

<style scoped>
.code { width: 100%; text-align: center; font-size: 1.4rem; font-weight: 700;
  letter-spacing: .28em; text-indent: .28em; }
</style>
