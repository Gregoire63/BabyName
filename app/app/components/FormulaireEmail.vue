<script setup lang="ts">
import { t, aTexte, langue } from '~/composables/useLangue'

/**
 * L'adresse, puis le code : le même formulaire pour les trois usages.
 *
 *  - `inscription` : le prénom (`pseudo`, champ fourni par la page dans le
 *    créneau `avant`) et l'adresse ; le compte naît du code ou du lien ;
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
const props = defineProps<{ but: 'inscription' | 'connexion' | 'verification'; adresse?: string; pseudo?: string }>()
const emit = defineEmits<{ fait: [email: string]; envoye: [email: string] }>()

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

onBeforeUnmount(() => clearInterval(minuteur))

function message(err: any): string {
  const c = err?.data?.statusMessage ?? err?.statusMessage
  const d = err?.data?.data
  const cle = `FormulaireEmail.erreur_${c}`
  if (!c || !aTexte(cle)) return t('FormulaireEmail.erreur')
  return t(cle, {
    m: Math.max(1, Math.ceil((d?.reessayer_dans ?? 60) / 60)),
    restants: d?.restants
  })
}

const ROUTES = { inscription: '/api/auth/inscription', connexion: '/api/auth/lien', verification: '/api/auth/email' }

async function envoyer() {
  if (envoi.value) return
  erreur.value = ''
  if (props.but === 'inscription' && (props.pseudo ?? '').trim().length < 2) {
    erreur.value = message({ statusMessage: 'pseudo_trop_court' })
    return
  }
  envoi.value = true
  try {
    const cible = email.value.trim()
    await $fetch(ROUTES[props.but], { method: 'POST',
      // La langue : celle de l'e-mail qui part.
      body: props.but === 'inscription'
        ? { email: cible, pseudo: props.pseudo, langue: langue.value }
        : { email: cible, langue: langue.value } })
    envoye.value = cible
    emit('envoye', cible)
    code.value = ''
    attente.value = 30
    clearInterval(minuteur)
    minuteur = setInterval(() => { if (--attente.value <= 0) clearInterval(minuteur) }, 1000)
    nextTick(() => champCode.value?.focus())
  } catch (err: any) {
    erreur.value = message(err)
  } finally { envoi.value = false }
}

/**
 * Le code : six chiffres, qu'on le tape ou qu'on le colle — avec un espace au
 * milieu, un blanc devant, un retour à la ligne derrière (ce que donne une
 * sélection faite à la main dans un e-mail). Le champ accepte donc plus long
 * que six caractères : c'est ici qu'on garde les chiffres, pas dans une
 * longueur maximale qui couperait le collage avant qu'on l'ait lu.
 */
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
    <!-- Un vrai formulaire : Entrée l'envoie depuis n'importe quel champ, et
         les gestionnaires de mots de passe reconnaissent l'adresse. -->
    <form v-if="!envoye" class="pile" style="gap:10px" novalidate @submit.prevent="envoyer">
      <slot name="avant" />
      <label :for="idEmail" class="mini doux">{{ $t('FormulaireEmail.votreAdresse') }}</label>
      <!-- Pas de v-model : le bouton se dégrise dès la première lettre, même
           si le clavier compose encore (utils/frappe.ts). `change` : un
           remplissage automatique ne passe pas toujours par `input`. -->
      <input :id="idEmail" :value="email" class="champ" type="email"
             inputmode="email" autocapitalize="off" spellcheck="false"
             :autocomplete="but === 'connexion' ? 'username webauthn' : 'email'"
             :placeholder="$t('FormulaireEmail.exempleAdresse')"
             @input="email = frappe($event)" @change="email = frappe($event)">
      <button type="submit" class="btn btn-1" :disabled="envoi || !email.trim()">
        {{ envoi ? $t('FormulaireEmail.envoi') : $t(`FormulaireEmail.but_${but}`) }}
      </button>
      <slot name="apres" />
    </form>

    <form v-else class="pile" style="gap:10px" @submit.prevent="valider">
      <p class="mini" style="margin:0" role="status">
        <template v-if="but === 'connexion'">
          {{ $t('FormulaireEmail.siCompte') }} <strong>{{ envoye }}</strong>{{ $t('FormulaireEmail.siCompteSuite') }}
        </template>
        <template v-else>
          {{ $t('FormulaireEmail.parti') }} <strong>{{ envoye }}</strong>{{ $t('FormulaireEmail.partiSuite') }}
        </template>
      </p>
      <label :for="idCode" class="sr-only">{{ $t('FormulaireEmail.codeLabel') }}</label>
      <input :id="idCode" ref="champCode" :value="code" class="champ code" inputmode="numeric"
             autocomplete="one-time-code" placeholder="123456" maxlength="24"
             @input="saisir">
      <button type="submit" class="btn btn-1" :disabled="envoi || code.length !== 6">
        {{ envoi ? $t('FormulaireEmail.verification') : $t('FormulaireEmail.valider') }}
      </button>
      <div class="ligne" style="justify-content:space-between;flex-wrap:wrap;gap:4px">
        <button type="button" class="btn btn-0 mini doux" :disabled="attente > 0 || envoi" @click="envoyer">
          {{ attente > 0 ? $t('FormulaireEmail.renvoyerDans', { n: attente }) : $t('FormulaireEmail.renvoyer') }}
        </button>
        <button type="button" class="btn btn-0 mini doux" @click="changer">{{ $t('FormulaireEmail.changer') }}</button>
      </div>
    </form>

    <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
  </div>
</template>

<style scoped>
.code { text-align: center; font-size: 1.5rem; font-weight: 800; letter-spacing: .32em;
  text-indent: .32em; font-variant-numeric: tabular-nums; }
</style>
