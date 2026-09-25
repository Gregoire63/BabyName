<script setup lang="ts">
/**
 * Outils de la base locale, dans « Mon compte ». DEVELOPPEMENT SEULEMENT :
 * FeuilleCompte ne l'importe que si `import.meta.dev`, donc ce fichier
 * n'existe pas dans le build de production — et les routes /api/dev y
 * repondent 404 (403 si le serveur de dev parle a une base distante).
 *
 * Base neuve, nouvelle journee, quotas, deblocage d'une liste : sans arreter
 * le serveur ni toucher aux fichiers.
 */
const moi = useMoi()

const baseLocale = ref<any>(null)
const messageDev = ref('')
const occupeDev = ref('')
const confirmerBaseNeuve = ref(false)

async function lireBaseLocale() {
  baseLocale.value = await $fetch('/api/dev/base').catch((e: any) =>
    ({ erreur: e?.data?.message || 'Outils indisponibles.' }))
}
/** La boite de developpement : les e-mails que l'app aurait envoyes. */
const courriels = ref<any[]>([])
async function lireCourriels() {
  courriels.value = await $fetch<any[]>('/api/dev/courriels').catch(() => [])
}
onMounted(() => { lireBaseLocale(); lireCourriels() })

const dateSemence = computed(() => baseLocale.value?.semence?.semee_le
  ? new Date(baseLocale.value.semence.semee_le).toLocaleDateString('fr-FR') : '')

async function gesteDev(action: string, groupe?: number, fait = 'Fait.') {
  occupeDev.value = `${action}${groupe ?? ''}`
  messageDev.value = ''
  try {
    await $fetch('/api/dev/base', { method: 'POST', body: { action, groupe } })
    if (action === 'base-neuve') {
      viderStockageLocal()
      moi.value = null
      await navigateTo('/connexion')
      return
    }
    // Le compteur d'hygiene des listes payees vit dans le navigateur.
    if (action === 'nouvelle-journee' || action === 'quotas-a-zero') {
      try {
        for (const k of Object.keys(localStorage)) {
          if (/^pr_\d+_\d{4}-\d{2}-\d{2}/.test(k)) localStorage.removeItem(k)
        }
      } catch { /* stockage bloque */ }
    }
    messageDev.value = fait
    await lireBaseLocale()
  } catch (e: any) {
    messageDev.value = e?.data?.message || 'Échec.'
  } finally { occupeDev.value = '' }
}
</script>

<template>
  <section class="pile outils-dev" aria-labelledby="compte-dev">
    <h3 id="compte-dev" class="etiquette">Outils de développement</h3>
    <p class="mini doux" style="margin:0">
      Base locale seulement : ce bloc n’existe pas en production.
    </p>
    <p v-if="baseLocale?.erreur" class="mini" role="alert" style="margin:0;color:var(--non)">
      {{ baseLocale.erreur }}
    </p>
    <template v-else-if="baseLocale">
      <p class="mini" style="margin:0">
        Jeu d’essai v{{ baseLocale.semence.version }}<template v-if="dateSemence">, semé le {{ dateSemence }}</template>.
        <strong v-if="!baseLocale.semence.a_jour" class="perime">
          Périmé (actuel : v{{ baseLocale.semence.actuelle }}) : repartez d’une base neuve.
        </strong>
      </p>
      <div class="ligne gestes">
        <button v-if="!confirmerBaseNeuve" type="button" class="btn mini"
                @click="confirmerBaseNeuve = true">
          Base neuve
        </button>
        <template v-else>
          <button type="button" class="btn mini btn-danger" :disabled="!!occupeDev"
                  @click="gesteDev('base-neuve')">
            {{ occupeDev === 'base-neuve' ? 'Un instant…' : 'Tout effacer et resemer' }}
          </button>
          <button type="button" class="btn btn-0 mini doux" @click="confirmerBaseNeuve = false">
            Annuler
          </button>
        </template>
        <button type="button" class="btn mini" :disabled="!!occupeDev"
                @click="gesteDev('nouvelle-journee', undefined, 'Nouvelle journée : le filet du jour est revenu.')">
          Nouvelle journée
        </button>
        <button type="button" class="btn mini" :disabled="!!occupeDev"
                @click="gesteDev('quotas-a-zero', undefined, 'Quotas à zéro : départ et jour, pour tout le monde.')">
          Quotas à zéro
        </button>
      </div>
      <ul class="listes-dev">
        <li v-for="l in baseLocale.listes" :key="l.id" class="ligne">
          <span class="nom-dev">
            {{ l.nom }}
            <span class="mini doux">· {{ l.code_invitation }} · {{ l.paye ? (l.offert ? 'offerte' : 'payée') : 'gratuite' }}</span>
          </span>
          <button type="button" class="btn btn-0 mini" :disabled="!!occupeDev"
                  :aria-label="`${l.paye ? 'Rebloquer' : 'Débloquer'} ${l.nom}`"
                  @click="gesteDev(l.paye ? 'rebloquer' : 'debloquer', l.id,
                                   l.paye ? `${l.nom} est redevenue gratuite.` : `${l.nom} est débloquée.`)">
            {{ l.paye ? 'Rebloquer' : 'Débloquer' }}
          </button>
        </li>
      </ul>
      <div class="pile" style="gap:4px">
        <div class="ligne">
          <p class="mini" style="margin:0;flex:1"><strong>E-mails envoyés</strong> (boîte locale, rien ne part)</p>
          <button type="button" class="btn btn-0 mini" @click="lireCourriels">Relire</button>
        </div>
        <p v-if="!courriels.length" class="mini doux" style="margin:0">
          Aucun pour l’instant. Audrey a une adresse vérifiée : audrey@exemple.test.
        </p>
        <p v-for="c in courriels.slice(0, 3)" :key="c.le" class="mini" style="margin:0">
          {{ c.a }} · code <code>{{ c.code }}</code> ·
          <a :href="c.lien" class="lien">ouvrir le lien</a>
        </p>
      </div>
      <p class="mini doux" style="margin:0">
        Clés :
        <template v-for="(c, i) in baseLocale.comptes" :key="c.cle">
          {{ i ? ' · ' : '' }}{{ c.pseudo }} <code>{{ c.cle }}</code>
        </template>
      </p>
    </template>
    <p v-if="messageDev" class="mini" role="status" style="margin:0">{{ messageDev }}</p>
  </section>
</template>

<style scoped>
/* Le filet du dessus (pose par FeuilleCompte) passe en tirets : ce bloc
   n'est pas le compte, c'est l'atelier. */
.outils-dev { border-top-style: dashed !important; }
.etiquette { margin: 0; font-size: .68rem; text-transform: uppercase; letter-spacing: .07em;
  font-weight: 800; color: var(--doux); line-height: 1.5; }
.btn-danger { background: var(--non); border-color: var(--non); color: var(--fond); }
.gestes { flex-wrap: wrap; gap: 8px; }
.listes-dev { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.nom-dev { flex: 1; min-width: 0; font-size: .9rem; }
.perime { color: var(--non); }
code { font-size: .78rem; }
</style>
