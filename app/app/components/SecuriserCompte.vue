<script setup lang="ts">
import { passkeysPossibles, creerPasskey } from '~/composables/usePasskey'

/**
 * Juste après la création du compte : comment le retrouver ailleurs.
 *
 * Remplace la clé d'accès qu'il fallait noter. Deux façons, sans mot de
 * passe ; aucune n'est obligatoire — on peut commencer à trier tout de suite,
 * l'accueil rappellera que le compte n'existe que sur cet appareil.
 */
const emit = defineEmits<{ suite: [] }>()
const moi = useMoi()
const courrielPossible = useCourrielPossible()

const possible = ref(false)
onMounted(() => { possible.value = passkeysPossibles() })

const passkey = ref('')          // le nom de la passkey créée
const emailOk = ref('')
const avecEmail = ref(false)
const occupe = ref(false)
const erreur = ref('')

async function creer() {
  if (occupe.value) return
  occupe.value = true; erreur.value = ''
  const r = await creerPasskey()
  occupe.value = false
  if (r.ok) passkey.value = r.nom || 'Passkey'
  else erreur.value = r.message
}

const fait = computed(() => !!passkey.value || !!emailOk.value)
</script>

<template>
  <div class="carte pile securiser">
    <div class="ligne">
      <Etincelles :taille="22" couleur="var(--peche)" />
      <h2>Pour retrouver votre compte</h2>
    </div>
    <p class="mini doux" style="margin:0">
      Sur un autre téléphone, ou si celui-ci est remis à zéro. Pas de mot de
      passe : {{ courrielPossible ? 'l’un ou l’autre, ou les deux.' : 'une passkey suffit.' }}
    </p>

    <!-- 1. la passkey -->
    <div class="moyen" :class="{ ok: passkey }">
      <template v-if="passkey">
        <p class="mini" style="margin:0" role="status">
          <strong>Passkey enregistrée</strong> ({{ passkey }}). Face ID, empreinte ou
          code du téléphone suffiront pour revenir.
        </p>
      </template>
      <template v-else-if="possible">
        <button type="button" class="btn btn-1" :disabled="occupe" @click="creer">
          {{ occupe ? 'Un instant…' : 'Créer une passkey' }}
        </button>
        <p class="mini doux" style="margin:0">
          Face ID, empreinte ou code de ce téléphone. Rien à retenir, rien à
          recopier ; elle suit dans votre trousseau (iCloud, Google).
        </p>
      </template>
      <p v-else class="mini doux" style="margin:0">
        Ce navigateur ne sait pas créer de passkey{{ courrielPossible ? ' : l’e-mail fera l’affaire' : '' }}.
      </p>
      <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
    </div>

    <!-- 2. l'adresse e-mail (si l'envoi est en place) -->
    <div v-if="courrielPossible || emailOk" class="moyen" :class="{ ok: emailOk }">
      <p v-if="emailOk" class="mini" style="margin:0" role="status">
        <strong>Adresse confirmée</strong> : {{ emailOk }}. Un lien de connexion
        pourra y partir.
      </p>
      <FormulaireEmail v-else-if="avecEmail" but="verification" @fait="emailOk = $event" />
      <button v-else type="button" class="btn" @click="avecEmail = true">
        Recevoir mes liens par e-mail
      </button>
    </div>

    <button type="button" class="btn" :class="fait ? 'btn-1' : 'btn-0 doux'" @click="emit('suite')">
      {{ fait ? 'Continuer' : 'Plus tard' }}
    </button>
    <p v-if="!fait" class="mini doux" style="margin:0;text-align:center">
      Sans l’un ou l’autre, {{ moi?.pseudo ? `le compte de ${moi.pseudo}` : 'ce compte' }}
      n’existe que sur cet appareil.
    </p>
  </div>
</template>

<style scoped>
.securiser { gap: 12px; }
.moyen { display: flex; flex-direction: column; gap: 8px; padding: 12px 13px; border-radius: var(--r-s);
  border: 1px solid var(--trait); background: var(--fond); }
.moyen.ok { border-color: color-mix(in srgb, var(--oui) 45%, var(--trait));
  background: color-mix(in srgb, var(--oui) 10%, var(--fond)); }
</style>
