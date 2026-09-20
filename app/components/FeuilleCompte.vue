<script setup lang="ts">
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
  moi.value = null
  await navigateTo('/connexion')
}
</script>

<template>
  <Feuille titre="Mon compte" @fermer="emit('fermer')">
    <section class="pile">
      <p class="etiquette">Nom affiché</p>
      <div class="ligne">
        <input v-model="nom" class="champ" style="flex:1" maxlength="40"
               @keyup.enter="renommer">
        <button class="btn mini" :disabled="!change" @click="renommer">
          {{ enregistre ? 'Fait' : 'Changer' }}
        </button>
      </div>
      <p class="mini doux" style="margin:0">
        C’est ce que voient les autres membres de vos listes.
      </p>
      <p v-if="erreur" class="mini" style="color:var(--non);margin:0">{{ erreur }}</p>
    </section>

    <section class="pile">
      <p class="etiquette">Clé d’accès</p>
      <p class="mini doux" style="margin:0">
        Elle ne sert qu’à retrouver ce compte sur un autre téléphone. Il n’y a
        pas d’e-mail : cette clé est la seule façon de revenir.
      </p>

      <button v-if="cleNeuve" class="cle" @click="copier">{{ cleNeuve }}</button>
      <p v-if="cleNeuve" class="mini" :class="copiee ? '' : 'doux'"
         style="margin:0;text-align:center">
        {{ copiee ? 'Copiée' : 'Touchez pour copier' }} — notez-la, elle ne réapparaîtra pas.
      </p>

      <template v-else-if="demandeCle">
        <p class="mini" style="margin:0">
          Générer une nouvelle clé <strong>annule immédiatement l’ancienne</strong>.
          Un appareil qui s’en servait devra utiliser la nouvelle.
        </p>
        <div class="ligne">
          <button class="btn btn-1 mini" @click="regenererCle">Générer quand même</button>
          <button class="btn btn-0 mini doux" @click="demandeCle = false">Annuler</button>
        </div>
      </template>

      <button v-else class="btn btn-0 mini doux" style="align-self:flex-start"
              @click="demandeCle = true">
        J’ai perdu ma clé — en générer une nouvelle
      </button>
    </section>

    <template #pied>
      <button class="btn btn-0 doux" @click="sortir">Se déconnecter</button>
    </template>
  </Feuille>
</template>

<style scoped>
.pile + .pile { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--trait); }
.etiquette { margin: 0; font-size: .68rem; text-transform: uppercase; letter-spacing: .07em;
  font-weight: 800; color: var(--doux); }
.cle { display: block; width: 100%; border: 1px dashed var(--trait); border-radius: 13px;
  background: var(--fond); padding: 15px 8px; cursor: pointer; font: inherit;
  font-size: 1.2rem; font-weight: 700; letter-spacing: .07em; text-align: center;
  color: var(--texte); }
</style>
