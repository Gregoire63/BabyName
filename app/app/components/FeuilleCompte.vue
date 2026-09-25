<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

/**
 * Le compte, au meme endroit que le nom sur lequel on a tape.
 *
 * C'etait au fond des reglages d'une liste, ce qui n'avait pas de sens : le
 * pseudo et la cle d'acces ne dependent d'aucune liste. On touche son nom sur
 * l'accueil, on tombe sur ce qui le concerne.
 */
const emit = defineEmits<{ fermer: [] }>()

const moi = useMoi()
const nom = ref(moi.value?.pseudo ?? '')
const enregistre = ref(false)
const erreur = ref('')

watch(moi, m => { if (m && !nom.value) nom.value = m.pseudo }, { immediate: true })

const change = computed(() =>
  !!nom.value.trim() && nom.value.trim() !== moi.value?.pseudo)

async function renommer() {
  if (!change.value) return
  erreur.value = ''
  try {
    await $fetch('/api/auth/pseudo', { method: 'POST', body: { pseudo: nom.value.trim() } })
    await rafraichirMoi()
    enregistre.value = true
    setTimeout(() => enregistre.value = false, 1600)
  } catch { erreur.value = 'Ce nom n’a pas pu être enregistré.' }
}

// --- cle d'acces ----------------------------------------------------------
const cleNeuve = ref('')
const demandeCle = ref(false)
const copiee = ref(false)

async function regenererCle() {
  const r = await $fetch<any>('/api/auth/cle', { method: 'POST' }).catch(() => null)
  if (r?.cle) { cleNeuve.value = r.cle; demandeCle.value = false }
}
async function copier() {
  try { await navigator.clipboard.writeText(cleNeuve.value) } catch { /* selection manuelle */ }
  copiee.value = true
  setTimeout(() => copiee.value = false, 1800)
}

async function sortir() {
  await $fetch('/api/auth/sortir', { method: 'POST' }).catch(() => null)
  viderStockageLocal()
  moi.value = null
  await navigateTo('/connexion')
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
    await $fetch('/api/moi/supprimer', { method: 'POST', body: { confirmation: 'SUPPRIMER' } })
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
      <label for="compte-nom" class="etiquette">Nom affiché</label>
      <div class="ligne">
        <input id="compte-nom" v-model="nom" class="champ" style="flex:1" maxlength="40"
               autocomplete="nickname" @keyup.enter="renommer">
        <button class="btn mini" :disabled="!change" @click="renommer">
          {{ enregistre ? 'Fait' : 'Changer' }}
        </button>
      </div>
      <p class="mini doux" style="margin:0">
        C’est ce que voient les autres membres de vos listes.
      </p>
      <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
    </section>

    <section class="pile">
      <p class="etiquette">Clé d’accès</p>
      <p class="mini doux" style="margin:0">
        Elle ne sert qu’à retrouver ce compte sur un autre téléphone. Il n’y a
        pas d’e-mail : cette clé est la seule façon de revenir.
      </p>

      <button v-if="cleNeuve" type="button" class="cle" @click="copier">
        <span class="sr-only">Nouvelle clé d’accès, touchez pour la copier : </span>{{ cleNeuve }}
      </button>
      <p v-if="cleNeuve" class="mini" :class="copiee ? '' : 'doux'" aria-live="polite"
         style="margin:0;text-align:center">
        {{ copiee ? 'Copiée' : 'Touchez pour copier' }} — notez-la, elle ne réapparaîtra pas.
      </p>

      <template v-else-if="demandeCle">
        <p class="mini" style="margin:0">
          Générer une nouvelle clé <strong>annule immédiatement l’ancienne</strong>.
          Un appareil qui s’en servait devra utiliser la nouvelle.
        </p>
        <div class="ligne">
          <button type="button" class="btn btn-1 mini" @click="regenererCle">Générer quand même</button>
          <button type="button" class="btn btn-0 mini doux" @click="demandeCle = false">Annuler</button>
        </div>
      </template>

      <button v-else class="btn btn-0 mini doux" style="align-self:flex-start"
              @click="demandeCle = true">
        J’ai perdu ma clé — en générer une nouvelle
      </button>
    </section>

    <section class="pile" aria-labelledby="compte-donnees">
      <h3 id="compte-donnees" class="etiquette">Mes données</h3>
      <p class="mini doux" style="margin:0">
        Tout ce que babyNames garde sur vous tient dans un fichier, que vous
        pouvez emporter ailleurs.
        <NuxtLink to="/confidentialite" class="lien">Ce qu’on en fait</NuxtLink>.
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
        <input id="compte-confirmation" v-model="confirmation" class="champ" autocomplete="off"
               autocapitalize="characters" spellcheck="false" @keyup.enter="supprimerCompte">
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

.cle { display: block; width: 100%; border: 1px dashed var(--trait); border-radius: 13px;
  background: var(--fond); padding: 15px 8px; cursor: pointer; font: inherit;
  font-size: 1.2rem; font-weight: 700; letter-spacing: .07em; text-align: center;
  color: var(--texte); }
</style>
