<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { signalerNom, signalerPasskeysRestantes } from '~/composables/usePasskey'
import { useEnregistrementDiffere, type OptionsEnvoi } from '~/composables/useEnregistrementDiffere'

/**
 * Le compte, au meme endroit que le nom sur lequel on a tape.
 *
 * Le nom et les facons de se connecter ne dependent d'aucune liste : on
 * touche son nom sur l'accueil, on tombe sur ce qui le concerne. Les Reglages
 * d'une liste y menent aussi (« Mon compte ») : c'est la qu'on cherche la
 * passkey.
 */
const emit = defineEmits<{ fermer: [] }>()
const { ouvrir: ouvrirLegal } = useFeuilleLegale()

const moi = useMoi()
const nom = ref(moi.value?.pseudo ?? '')
const enregistre = ref(false)
const erreur = ref('')

watch(moi, m => { if (m && !nom.value) nom.value = m.pseudo }, { immediate: true })

/**
 * Enregistré seul, pendant la frappe et en fermant la feuille : le blur seul
 * perdait le nom quand on la fermait par le bouton retour
 * (useEnregistrementDiffere). Deux lettres au moins, comme le veut le
 * serveur : on n'affiche pas d'erreur au milieu d'un mot.
 */
let envoye = ''
async function renommer(o: OptionsEnvoi = {}) {
  const p = nom.value.trim()
  if (p.length < 2 || p === moi.value?.pseudo || p === envoye) return
  envoye = p
  erreur.value = ''
  try {
    await $fetch('/api/auth/pseudo', { method: 'POST', body: { pseudo: p }, keepalive: o.keepalive })
  } catch {
    envoye = ''
    if (!o.keepalive) erreur.value = 'Ce nom n’a pas pu être enregistré.'
    return
  }
  if (o.keepalive) { rafraichirMoi().then(() => signalerNom()).catch(() => {}); return }
  await rafraichirMoi()
  signalerNom()
  enregistre.value = true
  setTimeout(() => enregistre.value = false, 1600)
}
const nomAuto = useEnregistrementDiffere(renommer)

async function sortir() {
  await $fetch('/api/auth/sortir', { method: 'POST' }).catch(() => null)
  viderStockageLocal()
  moi.value = null
  // Qui vient de se déconnecter veut revenir : l'onglet Connexion, pas Inscription.
  await navigateTo('/connexion?mode=connexion')
}

// --- mes donnees (RGPD) ---------------------------------------------------
/**
 * Acces, portabilite, effacement : depuis l'app, sans ecrire a personne.
 *
 * La suppression demande de taper le mot en entier. Un bouton « Etes-vous
 * sur ? » se valide par reflexe ; un mot a ecrire, non — et c'est
 * irreversible, pour soi comme pour les listes ou l'on est seul.
 */
const demandeSuppression = ref(false)
const confirmation = ref('')
const suppressionEnCours = ref(false)
const erreurSuppression = ref('')
const confirme = computed(() => confirmation.value.trim().toUpperCase() === 'SUPPRIMER')

function annulerSuppression() {
  demandeSuppression.value = false
  confirmation.value = ''
  erreurSuppression.value = ''
}

// --- outils de developpement ----------------------------------------------
/**
 * La base locale se gere d'ici (outils-dev/OutilsCompte.vue). Le composant
 * n'est importe qu'en developpement : au build, `import.meta.dev` vaut false,
 * l'import disparait, et rien de ces outils n'entre dans le bundle.
 */
const OutilsDev = import.meta.dev
  ? defineAsyncComponent(() => import('~/outils-dev/OutilsCompte.vue')) : null

async function supprimerCompte() {
  if (!confirme.value || suppressionEnCours.value) return
  suppressionEnCours.value = true
  erreurSuppression.value = ''
  try {
    // De quoi dire ensuite au trousseau que ces passkeys ne servent plus.
    const pk = await $fetch<any>('/api/auth/passkeys').catch(() => null)
    await $fetch('/api/moi/supprimer', { method: 'POST', body: { confirmation: 'SUPPRIMER' } })
    if (pk?.userID) signalerPasskeysRestantes({ rpID: pk.rpID, userID: pk.userID, restantes: [] })
    viderStockageLocal()
    moi.value = null
    await navigateTo('/connexion?compte=supprime')
  } catch {
    erreurSuppression.value = 'La suppression n’a pas abouti. Rien n’a été effacé ; réessayez dans un instant.'
  } finally {
    suppressionEnCours.value = false
  }
}
</script>

<template>
  <Feuille titre="Mon compte" @fermer="emit('fermer')">
    <section class="pile">
      <div class="ligne">
        <label for="compte-nom" class="etiquette" style="flex:1">Nom affiché</label>
        <span class="mini doux" role="status">{{ enregistre ? 'Enregistré' : '' }}</span>
      </div>
      <!-- enregistré en quittant le champ (ou par Entrée) : pas de bouton -->
      <input id="compte-nom" v-model="nom" class="champ" maxlength="40"
             autocomplete="nickname" @input="nomAuto.planifier" @blur="nomAuto.maintenant()"
             @keyup.enter="($event.target as HTMLInputElement).blur()">
      <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
    </section>

    <section class="pile" aria-labelledby="compte-connexion">
      <h3 id="compte-connexion" class="etiquette">Se connecter</h3>
      <MoyensConnexion />
    </section>

    <section class="pile" aria-labelledby="compte-theme">
      <h3 id="compte-theme" class="etiquette">Apparence</h3>
      <ChoixTheme />
      <p class="mini doux" style="margin:0">Sur cet appareil.</p>
    </section>

    <section class="pile" aria-labelledby="compte-donnees">
      <h3 id="compte-donnees" class="etiquette">Mes données</h3>
      <p class="mini doux" style="margin:0">
        <a href="/confidentialite" class="lien" aria-haspopup="dialog" @click.prevent="ouvrirLegal('/confidentialite')">Ce qu’on garde, et pourquoi</a>.
      </p>
      <a class="btn mini telecharger" href="/api/moi/donnees" download>Télécharger mes données</a>

      <button v-if="!demandeSuppression" type="button" class="btn btn-0 mini danger"
              style="align-self:flex-start" @click="demandeSuppression = true">
        Supprimer mon compte
      </button>

      <div v-else class="pile suppression" role="group" aria-labelledby="titre-suppression">
        <p id="titre-suppression" class="mini" style="margin:0">
          <strong>Suppression définitive et immédiate</strong> de votre compte, de vos votes,
          vetos, favoris et commentaires, dans toutes vos listes. Les listes où vous êtes
          seul(e) disparaissent aussi, même débloquées. Les autres membres gardent leurs
          listes et leurs votes.
        </p>
        <label for="compte-confirmation" class="mini">
          Pour confirmer, tapez <strong>SUPPRIMER</strong>
        </label>
        <!-- Pas de v-model : le bouton se dégrise dès le mot écrit (utils/frappe.ts). -->
        <input id="compte-confirmation" :value="confirmation" class="champ" autocomplete="off"
               autocapitalize="characters" spellcheck="false"
               @input="confirmation = frappe($event)" @keyup.enter="supprimerCompte">
        <p v-if="erreurSuppression" class="mini" role="alert" style="color:var(--non);margin:0">
          {{ erreurSuppression }}
        </p>
        <div class="ligne">
          <button type="button" class="btn mini btn-danger" :disabled="!confirme || suppressionEnCours"
                  @click="supprimerCompte">
            {{ suppressionEnCours ? 'Suppression…' : 'Supprimer définitivement' }}
          </button>
          <button type="button" class="btn btn-0 mini doux" @click="annulerSuppression">Annuler</button>
        </div>
      </div>
    </section>

    <component :is="OutilsDev" v-if="OutilsDev" />

    <template #pied>
      <button type="button" class="btn btn-0 doux" @click="sortir">Se déconnecter</button>
      <PiedLegal compact />
    </template>
  </Feuille>
</template>

<style scoped>
.pile + .pile { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--trait); }
.etiquette { margin: 0; font-size: .68rem; text-transform: uppercase; letter-spacing: .07em;
  font-weight: 800; color: var(--doux); }
.etiquette:is(h3) { line-height: 1.5; }
.telecharger { align-self: flex-start; text-decoration: none; }
.danger { color: var(--non); padding-left: 0; }
.suppression { padding: 12px 14px; border-radius: var(--r-s);
  border: 1px solid color-mix(in srgb, var(--non) 45%, var(--trait)); gap: 10px; }
.btn-danger { background: var(--non); border-color: var(--non); color: var(--fond); }

</style>
