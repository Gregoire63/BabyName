<script setup lang="ts">
import { passkeysPossibles, creerPasskey, signalerPasskeysRestantes } from '~/composables/usePasskey'

/**
 * « Se connecter » dans Mon compte : les passkeys, l'adresse e-mail,
 * l'ancienne clé, et « Déconnecter mes autres appareils ».
 *
 * La règle qui guide tout l'écran : ne jamais laisser quelqu'un retirer son
 * DERNIER moyen de revenir sans le lui dire en toutes lettres.
 */
const moi = useMoi()
const courrielPossible = useCourrielPossible()

interface Passkey { id: string; nom: string; synchronisee: boolean; cree_le: string; utilisee_le: string | null }
const passkeys = ref<Passkey[]>([])
const possible = ref(false)
const occupe = ref('')
const erreur = ref('')
const info = ref('')

async function chargerPasskeys() {
  const r = await $fetch<any>('/api/auth/passkeys').catch(() => null)
  passkeys.value = r?.passkeys ?? []
}
onMounted(() => { possible.value = passkeysPossibles(); chargerPasskeys() })

const date = (d: string | null) => d
  ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

const moyens = computed(() => moi.value?.moyens ?? 0)

async function ajouterPasskey() {
  if (occupe.value) return
  occupe.value = 'passkey'; erreur.value = ''; info.value = ''
  const r = await creerPasskey()
  occupe.value = ''
  if (r.ok) { info.value = `Passkey ajoutée (${r.nom}).`; await chargerPasskeys() }
  else erreur.value = r.message
}

// --- retirer une passkey (confirmation en place) -----------------------------
const aRetirer = ref('')
async function retirerPasskey(id: string) {
  occupe.value = id; erreur.value = ''; info.value = ''
  try {
    const r = await $fetch<any>(`/api/auth/passkeys?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    signalerPasskeysRestantes({ rpID: r.rpID, userID: r.userID, restantes: r.restantes })
    info.value = 'Passkey retirée. Elle ne permet plus d’entrer.'
    aRetirer.value = ''
    await Promise.all([chargerPasskeys(), rafraichirMoi()])
  } catch { erreur.value = 'La passkey n’a pas pu être retirée.' }
  finally { occupe.value = '' }
}

// --- l'adresse e-mail ---------------------------------------------------------
const changeEmail = ref(false)
const ajoutEmail = ref(false)
const retirerEmailDemande = ref(false)
async function emailConfirme(e: string) {
  changeEmail.value = false
  ajoutEmail.value = false
  info.value = `Adresse confirmée : ${e}.`
}
async function retirerEmail() {
  occupe.value = 'email'; erreur.value = ''; info.value = ''
  try {
    await $fetch('/api/auth/email', { method: 'DELETE' })
    retirerEmailDemande.value = false
    await rafraichirMoi()
    info.value = 'Adresse retirée : plus aucun lien n’y partira.'
  } catch { erreur.value = 'L’adresse n’a pas pu être retirée.' }
  finally { occupe.value = '' }
}

// --- l'ancienne clé -------------------------------------------------------------
const desactiverDemande = ref(false)
async function desactiverCle() {
  occupe.value = 'cle'; erreur.value = ''; info.value = ''
  try {
    await $fetch('/api/auth/cle', { method: 'DELETE' })
    desactiverDemande.value = false
    await rafraichirMoi()
    info.value = 'Clé d’accès désactivée : elle ne permet plus d’entrer.'
  } catch { erreur.value = 'La clé n’a pas pu être désactivée.' }
  finally { occupe.value = '' }
}

// --- les autres appareils -------------------------------------------------------
const partoutDemande = ref(false)
async function deconnecterPartout() {
  occupe.value = 'partout'; erreur.value = ''; info.value = ''
  try {
    await $fetch('/api/auth/deconnecter-partout', { method: 'POST' })
    partoutDemande.value = false
    info.value = 'Tous vos autres appareils sont déconnectés. Celui-ci reste connecté.'
  } catch { erreur.value = 'Ça n’a pas marché. Réessayez dans un instant.' }
  finally { occupe.value = '' }
}

/** Retirer ceci laisserait-il le compte sans aucun moyen de revenir ? */
const dernier = (quoi: 'passkey' | 'email' | 'cle') => {
  const m = moi.value
  if (!m) return false
  const reste = (m.email && quoi !== 'email' ? 1 : 0)
    + ((quoi === 'passkey' ? m.passkeys - 1 : m.passkeys) > 0 ? 1 : 0)
    + (m.a_une_cle && quoi !== 'cle' ? 1 : 0)
  return reste === 0
}
</script>

<template>
  <div class="pile" style="gap:14px">
    <p v-if="moyens === 0" class="mini alerte" style="margin:0">
      <strong>Ce compte n’existe que sur cet appareil.</strong> Ajoutez une passkey
      ou une adresse e-mail pour ne pas le perdre.
    </p>

    <!-- passkeys -->
    <div class="pile" style="gap:8px">
      <p class="sous-titre">Passkeys</p>
      <p v-if="!passkeys.length" class="mini doux" style="margin:0">
        Face ID, empreinte ou code du téléphone, à la place d’un mot de passe.
      </p>
      <ul v-else class="liste">
        <li v-for="p in passkeys" :key="p.id">
          <div style="flex:1;min-width:0">
            <strong>{{ p.nom }}</strong>
            <p class="mini doux" style="margin:0">
              créée le {{ date(p.cree_le) }}<template v-if="p.utilisee_le"> · utilisée le {{ date(p.utilisee_le) }}</template>
            </p>
            <template v-if="aRetirer === p.id">
              <p v-if="dernier('passkey')" class="mini" style="margin:6px 0 0;color:var(--non)">
                C’est votre dernier moyen de revenir sur un autre appareil.
              </p>
              <div class="ligne" style="margin-top:6px">
                <button type="button" class="btn mini btn-danger" :disabled="!!occupe"
                        @click="retirerPasskey(p.id)">Retirer</button>
                <button type="button" class="btn btn-0 mini doux" @click="aRetirer = ''">Annuler</button>
              </div>
            </template>
          </div>
          <button v-if="aRetirer !== p.id" type="button" class="btn btn-0 mini doux"
                  :aria-label="`Retirer la passkey ${p.nom}`" @click="aRetirer = p.id">Retirer</button>
        </li>
      </ul>
      <button v-if="possible" type="button" class="btn mini" style="align-self:flex-start"
              :disabled="occupe === 'passkey'" @click="ajouterPasskey">
        {{ occupe === 'passkey' ? 'Un instant…' : passkeys.length ? 'Ajouter une passkey' : 'Créer une passkey' }}
      </button>
    </div>

    <!-- e-mail : l'adresse deja la se montre toujours ; en ajouter une
         suppose que l'envoi soit en place -->
    <div v-if="moi?.email || courrielPossible" class="pile" style="gap:8px">
      <p class="sous-titre">Adresse e-mail</p>
      <template v-if="moi?.email && !changeEmail">
        <p class="mini" style="margin:0"><strong>{{ moi.email }}</strong> — les liens de connexion partent ici.</p>
        <template v-if="retirerEmailDemande">
          <p v-if="dernier('email')" class="mini" style="margin:0;color:var(--non)">
            C’est votre dernier moyen de revenir sur un autre appareil.
          </p>
          <div class="ligne">
            <button type="button" class="btn mini btn-danger" :disabled="!!occupe" @click="retirerEmail">Retirer l’adresse</button>
            <button type="button" class="btn btn-0 mini doux" @click="retirerEmailDemande = false">Annuler</button>
          </div>
        </template>
        <div v-else class="ligne">
          <button type="button" class="btn btn-0 mini" @click="changeEmail = true">Changer</button>
          <button type="button" class="btn btn-0 mini doux" @click="retirerEmailDemande = true">Retirer</button>
        </div>
      </template>
      <template v-else-if="changeEmail || !moi?.email">
        <p v-if="!moi?.email && !changeEmail" class="mini doux" style="margin:0">
          Pour recevoir un lien de connexion. Elle ne sert qu’à ça.
        </p>
        <FormulaireEmail v-if="changeEmail || ajoutEmail" but="verification" @fait="emailConfirme" />
        <button v-else type="button" class="btn mini" style="align-self:flex-start" @click="ajoutEmail = true">
          Ajouter une adresse
        </button>
        <button v-if="changeEmail" type="button" class="btn btn-0 mini doux" style="align-self:flex-start"
                @click="changeEmail = false">Annuler</button>
      </template>
    </div>

    <!-- l'ancienne cle -->
    <div v-if="moi?.a_une_cle" class="pile" style="gap:8px">
      <p class="sous-titre">Ancienne clé d’accès</p>
      <p class="mini doux" style="margin:0">
        Encore active. Une passkey ou une adresse la remplacent.
      </p>
      <template v-if="desactiverDemande">
        <p v-if="dernier('cle')" class="mini" style="margin:0;color:var(--non)">
          Ajoutez d’abord une passkey ou une adresse : c’est votre seul moyen de revenir.
        </p>
        <div class="ligne">
          <button type="button" class="btn mini btn-danger" :disabled="!!occupe || dernier('cle')"
                  @click="desactiverCle">Désactiver la clé</button>
          <button type="button" class="btn btn-0 mini doux" @click="desactiverDemande = false">Annuler</button>
        </div>
      </template>
      <button v-else type="button" class="btn btn-0 mini doux" style="align-self:flex-start"
              @click="desactiverDemande = true">Désactiver la clé</button>
    </div>

    <!-- les autres appareils -->
    <div class="pile" style="gap:8px">
      <p class="sous-titre">Vos appareils</p>
      <template v-if="partoutDemande">
        <p class="mini" style="margin:0">
          Tous vos autres appareils devront se reconnecter. Après un téléphone
          perdu, retirez aussi les passkeys que vous ne reconnaissez pas.
        </p>
        <div class="ligne">
          <button type="button" class="btn mini btn-danger" :disabled="!!occupe"
                  @click="deconnecterPartout">Déconnecter les autres</button>
          <button type="button" class="btn btn-0 mini doux" @click="partoutDemande = false">Annuler</button>
        </div>
      </template>
      <button v-else type="button" class="btn btn-0 mini doux" style="align-self:flex-start"
              @click="partoutDemande = true">Déconnecter mes autres appareils</button>
    </div>

    <p v-if="info" class="mini" role="status" style="margin:0;color:var(--oui)">{{ info }}</p>
    <p v-if="erreur" class="mini" role="alert" style="margin:0;color:var(--non)">{{ erreur }}</p>
  </div>
</template>

<style scoped>
.sous-titre { margin: 0; font-weight: 800; font-size: .88rem; }
.liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.liste li { display: flex; align-items: flex-start; gap: 10px; padding: 9px 0;
  border-top: 1px solid var(--trait); }
.liste li:last-child { border-bottom: 1px solid var(--trait); }
.alerte { padding: 10px 12px; border-radius: var(--r-s); line-height: 1.45;
  background: color-mix(in srgb, var(--peche) 40%, transparent); }
.btn-danger { background: var(--non); border-color: var(--non); color: var(--fond); }
</style>
