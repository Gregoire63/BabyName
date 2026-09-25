<script setup lang="ts">
/**
 * L'adresse, puis le code : le même formulaire pour les deux usages.
 *
 *  - `connexion` : recevoir un lien pour entrer sur cet appareil ;
 *  - `verification` : ajouter (ou changer) l'adresse du compte connecté.
 *
 * Toujours le CODE en plus du lien : l'app installée sur l'écran d'accueil
 * n'est pas le navigateur où le lien s'ouvrirait. On tape le code ici, sans
 * quitter l'app.
 *
 * En connexion, le champ porte `autocomplete="username webauthn"` : le
 * clavier y propose aussi les passkeys du téléphone (voir connexion.vue).
 */
const props = defineProps<{ but: 'connexion' | 'verification'; adresse?: string }>()
const emit = defineEmits<{ fait: [email: string] }>()

const email = ref(props.adresse ?? '')
const code = ref('')
const envoye = ref('')          // l'adresse vers laquelle un e-mail est parti
const envoi = ref(false)
const erreur = ref('')
const attente = ref(0)          // secondes avant de pouvoir renvoyer
let minuteur: any = null
const idEmail = useId()
const idCode = useId()
const champCode = ref<HTMLInputElement>()
const minutes = CONSERVATION.lienMinutes

onBeforeUnmount(() => clearInterval(minuteur))

function message(err: any): string {
  const c = err?.data?.statusMessage ?? err?.statusMessage
  const d = err?.data?.data
  switch (c) {
    case 'email_invalide': return 'Cette adresse n’a pas l’air complète.'
    case 'trop_d_essais': {
      const m = Math.max(1, Math.ceil((d?.reessayer_dans ?? 60) / 60))
      return `Trop d’essais d’un coup. Réessayez dans ${m} minute${m > 1 ? 's' : ''}.`
    }
    case 'courriel_non_configure': return 'L’envoi d’e-mails n’est pas encore en place. Utilisez une passkey.'
    case 'courriel_indisponible': return 'L’e-mail n’a pas pu partir. Réessayez dans un instant.'
    case 'code_faux': return `Ce n’est pas le bon code${d?.restants ? ` (encore ${d.restants} essai${d.restants > 1 ? 's' : ''})` : ''}.`
    case 'code_epuise': return 'Trop d’erreurs sur ce code : demandez un nouvel e-mail.'
    case 'code_aucun': return 'Ce code a expiré ou a déjà servi : demandez un nouvel e-mail.'
    case 'adresse_prise': return 'Cette adresse est déjà celle d’un autre compte.'
    default: return 'Ça n’a pas marché. Réessayez dans un instant.'
  }
}

async function envoyer() {
  if (envoi.value) return
  erreur.value = ''
  envoi.value = true
  try {
    const cible = email.value.trim()
    await $fetch(props.but === 'connexion' ? '/api/auth/lien' : '/api/auth/email',
      { method: 'POST', body: { email: cible } })
    envoye.value = cible
    code.value = ''
    attente.value = 30
    clearInterval(minuteur)
    minuteur = setInterval(() => { if (--attente.value <= 0) clearInterval(minuteur) }, 1000)
    nextTick(() => champCode.value?.focus())
  } catch (err: any) {
    erreur.value = message(err)
  } finally { envoi.value = false }
}

/** Le code : six chiffres, qu'on le tape avec ou sans espace. */
function saisir(e: Event) {
  const c = e.target as HTMLInputElement
  code.value = c.value.replace(/\D/g, '').slice(0, 6)
  c.value = code.value
  if (code.value.length === 6) valider()
}

async function valider() {
  if (envoi.value || code.value.length !== 6) return
  erreur.value = ''
  envoi.value = true
  try {
    await $fetch('/api/auth/code', { method: 'POST',
      body: { email: envoye.value, code: code.value, but: props.but } })
    // Prévenir AVANT de rafraîchir : le parent peut retirer ce formulaire dès
    // que le compte a une adresse, et un composant démonté n'émet plus rien.
    emit('fait', envoye.value)
    await rafraichirMoi()
  } catch (err: any) {
    erreur.value = message(err)
    code.value = ''
    nextTick(() => champCode.value?.focus())
  } finally { envoi.value = false }
}

function changer() { envoye.value = ''; code.value = ''; erreur.value = '' }
</script>

<template>
  <div class="pile" style="gap:10px">
    <template v-if="!envoye">
      <label :for="idEmail" class="mini doux">Votre adresse e-mail</label>
      <div class="ligne">
        <input :id="idEmail" v-model="email" class="champ" style="flex:1" type="email"
               inputmode="email" autocapitalize="off" spellcheck="false"
               :autocomplete="but === 'connexion' ? 'username webauthn' : 'email'"
               placeholder="vous@exemple.fr" @keyup.enter="envoyer">
      </div>
      <button type="button" class="btn btn-1" :disabled="envoi || !email.trim()" @click="envoyer">
        {{ envoi ? 'Envoi…' : but === 'connexion' ? 'Recevoir un lien' : 'Envoyer la confirmation' }}
      </button>
      <p v-if="but === 'connexion'" class="mini doux" style="margin:0">
        Un lien et un code, valables {{ minutes }} minutes. Pas de mot
        de passe, pas de lettre d’information.
      </p>
    </template>

    <template v-else>
      <p class="mini" style="margin:0" role="status">
        <template v-if="but === 'connexion'">
          Si un compte utilise <strong>{{ envoye }}</strong>, l’e-mail arrive dans la
          minute. Ouvrez le lien — ou tapez le code ici :
        </template>
        <template v-else>
          Un e-mail vient de partir vers <strong>{{ envoye }}</strong>. Ouvrez le lien,
          ou tapez le code ici :
        </template>
      </p>
      <label :for="idCode" class="sr-only">Code à 6 chiffres reçu par e-mail</label>
      <input :id="idCode" ref="champCode" :value="code" class="champ code" inputmode="numeric"
             autocomplete="one-time-code" placeholder="123456" maxlength="7"
             @input="saisir" @keyup.enter="valider">
      <button type="button" class="btn btn-1" :disabled="envoi || code.length !== 6" @click="valider">
        {{ envoi ? 'Vérification…' : 'Valider le code' }}
      </button>
      <div class="ligne" style="justify-content:space-between;flex-wrap:wrap;gap:4px">
        <button type="button" class="btn btn-0 mini doux" :disabled="attente > 0 || envoi" @click="envoyer">
          {{ attente > 0 ? `Renvoyer (${attente} s)` : 'Renvoyer l’e-mail' }}
        </button>
        <button type="button" class="btn btn-0 mini doux" @click="changer">Changer d’adresse</button>
      </div>
    </template>

    <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
  </div>
</template>

<style scoped>
.code { text-align: center; font-size: 1.5rem; font-weight: 800; letter-spacing: .32em;
  text-indent: .32em; font-variant-numeric: tabular-nums; }
</style>
