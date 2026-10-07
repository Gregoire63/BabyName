<script setup lang="ts">
/** Entrer dans la liste de quelqu'un d'autre avec son code (10 caracteres,
 *  ou 8 pour les listes d'avant — voir shared/utils/codes.ts).
 *
 *  Un code CADEAU (12 caracteres) se tape ici aussi : c'est le seul champ
 *  « code » de l'accueil, celui qu'on cherche quand quelqu'un vous en a dicte
 *  un. Il ouvre alors la feuille du cadeau (`cadeau`). */
const emit = defineEmits<{ fermer: []; cadeau: [code: string] }>()
// Dans une app des stores, on n'annonce pas le code cadeau : il s'utilise sur
// le site (l'accueil le dit à qui en tape un quand même — voirCadeau).
const vente = useVente()

// On nettoie DANS le champ, pas seulement dans la variable : sinon on voit
// s'inscrire des caracteres que le serveur refusera (I, L, O, U, espaces,
// tirets), sans comprendre pourquoi le bouton reste gris.
const code = ref('')
function saisir(e: Event) {
  const champ = e.target as HTMLInputElement
  code.value = champ.value.toUpperCase().replace(/[^0-9A-HJKMNP-TV-Z]/g, '').slice(0, LONGUEUR_CADEAU)
  champ.value = code.value        // Vue ne repeint pas si la valeur n'a pas bouge
}
const cadeau = computed(() => normaliserCodeCadeau(code.value))
const envoi = ref(false)
const erreur = ref('')
const champ = ref<HTMLInputElement>()

onMounted(() => setTimeout(() => champ.value?.focus(), 380))   // apres l'animation

const pret = computed(() => !!normaliserCodeInvitation(code.value) || !!cadeau.value)

async function entrer() {
  if (!pret.value || envoi.value) return
  if (cadeau.value) { emit('cadeau', cadeau.value); return }
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
        ? `Ce code n’a pas le bon format : 10 caractères (8 pour les listes plus anciennes${vente.cadeaux ? ', 12 pour un code cadeau' : ''}).`
        : 'Code inconnu. Vérifiez-le, ou demandez le lien de la liste.'
    envoi.value = false
  }
}
</script>

<template>
  <Feuille titre="Rejoindre une liste" @fermer="emit('fermer')">
    <p class="mini doux" style="margin:0 0 12px">
      {{ vente.cadeaux ? 'Le code d’une liste, ou un code cadeau.' : 'Le code d’une liste.' }}
    </p>
    <input ref="champ" :value="code" class="champ code" placeholder="Le code"
           :aria-label="vente.cadeaux ? 'Code d’invitation ou code cadeau' : 'Code d’invitation'"
           autocapitalize="characters" autocorrect="off" spellcheck="false"
           inputmode="latin" @input="saisir" @keyup.enter="entrer">
    <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:10px 0 0">{{ erreur }}</p>

    <template #pied>
      <button class="btn btn-1" :disabled="!pret || envoi" @click="entrer">
        {{ envoi ? 'Un instant…' : cadeau && vente.cadeaux ? 'Voir le cadeau' : 'Entrer' }}
      </button>
    </template>
  </Feuille>
</template>

<style scoped>
.code { width: 100%; text-align: center; font-size: 1.3rem; font-weight: 700;
  letter-spacing: .2em; text-indent: .2em; }
</style>
