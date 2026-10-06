<script setup lang="ts">
import { passkeysPossibles, creerPasskey, signalerPasskeysRestantes } from '~/composables/usePasskey'

/**
 * « Se connecter » dans Mon compte : les passkeys, l'adresse e-mail, et
 * « Déconnecter mes autres appareils ».
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

/**
 * Le message d'une action s'affiche SOUS elle : un seul emplacement en bas de
 * l'écran mettait l'échec d'une passkey sous « Vos appareils », loin du
 * bouton qu'on venait de toucher (vu en production le 28/09).
 */
type Section = 'passkey' | 'email' | 'partout'
const retour = ref<{ ou: Section; texte: string; ok: boolean } | null>(null)
const dire = (ou: Section, texte: string, ok = false) => { retour.value = texte ? { ou, texte, ok } : null }
const effacer = () => { retour.value = null }

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
  occupe.value = 'passkey'; effacer()
  const r = await creerPasskey()
  occupe.value = ''
  if (r.ok) { dire('passkey', `Passkey ajoutée (${r.nom}).`, true); await chargerPasskeys() }
  else dire('passkey', r.message)
}

// --- retirer une passkey (confirmation en place) -----------------------------
const aRetirer = ref('')
async function retirerPasskey(id: string) {
  occupe.value = id; effacer()
  try {
    const r = await $fetch<any>(`/api/auth/passkeys?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    signalerPasskeysRestantes({ rpID: r.rpID, userID: r.userID, restantes: r.restantes })
    dire('passkey', 'Passkey retirée. Elle ne permet plus d’entrer.', true)
    aRetirer.value = ''
    await Promise.all([chargerPasskeys(), rafraichirMoi()])
  } catch { dire('passkey', 'La passkey n’a pas pu être retirée.') }
  finally { occupe.value = '' }
}

// --- l'adresse e-mail ---------------------------------------------------------
const changeEmail = ref(false)
const ajoutEmail = ref(false)
const retirerEmailDemande = ref(false)
async function emailConfirme(e: string) {
  changeEmail.value = false
  ajoutEmail.value = false
  dire('email', `Adresse confirmée : ${e}.`, true)
}
async function retirerEmail() {
  occupe.value = 'email'; effacer()
  try {
    await $fetch('/api/auth/email', { method: 'DELETE' })
    retirerEmailDemande.value = false
    await rafraichirMoi()
    dire('email', 'Adresse retirée : plus aucun lien n’y partira.', true)
  } catch { dire('email', 'L’adresse n’a pas pu être retirée.') }
  finally { occupe.value = '' }
}

// --- les autres appareils -------------------------------------------------------
const partoutDemande = ref(false)
async function deconnecterPartout() {
  occupe.value = 'partout'; effacer()
  try {
    await $fetch('/api/auth/deconnecter-partout', { method: 'POST' })
    redonnerPush()   // app des stores : ce téléphone-ci reste à prévenir
    partoutDemande.value = false
    dire('partout', 'Tous vos autres appareils sont déconnectés. Celui-ci reste connecté.', true)
  } catch { dire('partout', 'Ça n’a pas marché. Réessayez dans un instant.') }
  finally { occupe.value = '' }
}

/** Retirer ceci laisserait-il le compte sans aucun moyen de revenir ? */
const dernier = (quoi: 'passkey' | 'email') => {
  const m = moi.value
  if (!m) return false
  const reste = (m.email && quoi !== 'email' ? 1 : 0)
    + ((quoi === 'passkey' ? m.passkeys - 1 : m.passkeys) > 0 ? 1 : 0)
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
      <p v-if="retour?.ou === 'passkey'" class="mini message" :class="{ ok: retour.ok }"
         :role="retour.ok ? 'status' : 'alert'">{{ retour.texte }}</p>
    </div>

    <!-- e-mail : l'adresse deja la se montre toujours ; en ajouter une
         suppose que l'envoi soit en place -->
    <div v-if="moi?.email || courrielPossible" class="pile" style="gap:8px">
      <p class="sous-titre">Adresse e-mail</p>
      <template v-if="moi?.email && !changeEmail">
        <p class="mini" style="margin:0"><strong>{{ moi.email }}</strong> : les liens de connexion partent ici.</p>
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
    <!-- Hors du bloc : il disparaît avec ce qu'il montrait (adresse retirée
         quand l'envoi n'est pas en place), et le message doit rester. -->
    <p v-if="retour?.ou === 'email'" class="mini message" :class="{ ok: retour.ok }"
       :role="retour.ok ? 'status' : 'alert'">{{ retour.texte }}</p>

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
      <p v-if="retour?.ou === 'partout'" class="mini message" :class="{ ok: retour.ok }"
         :role="retour.ok ? 'status' : 'alert'">{{ retour.texte }}</p>
    </div>
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
.message { margin: 0; color: var(--non); }
.message.ok { color: var(--oui); }
</style>
