<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { t } from '~/composables/useLangue'
import { prixLocal, mentionTvaLocale } from '~/utils/offre'

/**
 * Offrir babyNamed : une liste débloquée, en cadeau.
 *
 * Une feuille, ouverte depuis l'accueil ou les réglages, et sur /offrir pour
 * qui arrive sans compte (une fiche publique, le retour d'un paiement
 * annulé) : qui offre n'est pas forcément qui trie — les grands-parents, une
 * amie, les collègues. On écrit, si l'on veut, de la part de qui et un mot,
 * on accepte les conditions, et Stripe encaisse. Le code arrive sur la page
 * suivante (/offrir/merci), et sur la facture envoyée par e-mail.
 *
 * Ce qu'on vend est dit comme sur la feuille « Débloquer » (INCLUS_DEBLOCAGE,
 * une seule source) : un cadeau qui promettrait autre chose que ce que la
 * liste débloque se paierait en déception chez quelqu'un d'autre.
 */
defineProps<{ annule?: boolean }>()
const emit = defineEmits<{ fermer: [] }>()
const { ouvrir: ouvrirLegal } = useFeuilleLegale()

const prixSite = (useRuntimeConfig().public.prixListe as string) || '6 €'
const prix = computed(() => prixLocal(prixSite))
const tva = computed(() => mentionTvaLocale())
const INCLUS = INCLUS_DEBLOCAGE
const ans = CONSERVATION.cadeauMois / 12

const deLaPart = ref('')
const message = ref('')
const accord = ref(false)
const envoi = ref(false)
const erreur = ref('')

/** En développement, pas de Stripe : un code se crée d'un geste (base locale). */
const OutilsDev = import.meta.dev
  ? defineAsyncComponent(() => import('~/outils-dev/OutilsCadeau.vue')) : null

/**
 * Le bouton n'est jamais grisé (comme dans FeuilleDebloquer) : sans la case,
 * il l'amène sous les yeux, la signale et lui donne le focus. Elle reste dans
 * le texte, après le mot : ici on tape, et un pied plus haut mangerait la
 * place au-dessus du clavier.
 */
const accordManque = ref(false)
const caseAccord = ref<HTMLInputElement>()
watch(accord, (v) => { if (v) accordManque.value = false })

async function offrir() {
  if (envoi.value) return
  if (!accord.value) {
    accordManque.value = true
    caseAccord.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    caseAccord.value?.focus({ preventScroll: true })
    try { navigator.vibrate?.(25) } catch { /* pas de vibreur : le contour suffit */ }
    return
  }
  envoi.value = true
  erreur.value = ''
  try {
    const r = await $fetch<any>('/api/cadeaux/acheter', {
      method: 'POST', body: { consentement: true, de_la_part: deLaPart.value, message: message.value, provenance: provenanceLue() }
    })
    if (r?.url) { window.location.href = r.url; return }
    erreur.value = t('FeuilleOffrir.paiementPasOuvert')
  } catch (e: any) {
    const code = e?.data?.statusMessage
    erreur.value = code === 'paiement_non_configure' || code === 'vente_fermee'
      ? t('FeuilleOffrir.paiementFerme')
      : code === 'consentement_requis'
        ? t('FeuilleOffrir.consentement')
        : code === 'trop_d_essais'
          ? t('FeuilleOffrir.tropDEssais')
          : t('FeuilleOffrir.paiementIndispo')
  } finally { envoi.value = false }
}
</script>

<template>
  <Feuille :titre="$t('FeuilleOffrir.titre')" @fermer="emit('fermer')">
    <p v-if="annule" class="mini note" role="status">
      {{ $t('FeuilleOffrir.annule') }}
    </p>

    <p class="prix">
      <strong>{{ $t('FeuilleOffrir.ttc', { prix }) }}</strong><span class="doux">{{ $t('FeuilleOffrir.pourLaVie') }}</span>
    </p>
    <p class="mini doux" style="margin:0">{{ tva }}.</p>

    <p class="portee mini">
      {{ $t('FeuilleOffrir.porteeA') }} <strong>{{ $t('FeuilleOffrir.porteeB') }}</strong> {{ $t('FeuilleOffrir.porteeC') }}
      <strong>{{ $t('FeuilleOffrir.porteeD') }}</strong>{{ $t('FeuilleOffrir.porteeE', { ans }) }}
    </p>

    <ul class="inclus">
      <li v-for="i in INCLUS" :key="i.id">
        <Etincelles :taille="13" couleur="var(--peche)" une aria-hidden="true" />
        <span>{{ i.titre }}</span>
      </li>
    </ul>

    <div class="champs">
      <label class="pile" style="gap:6px">
        <span class="mini doux">{{ $t('FeuilleOffrir.deLaPart') }}</span>
        <input v-model="deLaPart" class="champ" maxlength="40" autocomplete="off"
               :placeholder="$t('FeuilleOffrir.deLaPartExemple')">
      </label>
      <label class="pile" style="gap:6px">
        <span class="mini doux">{{ $t('FeuilleOffrir.unMot') }}</span>
        <textarea v-model="message" class="champ mot" maxlength="200" rows="3"
                  :placeholder="$t('FeuilleOffrir.unMotExemple')" />
      </label>
    </div>

    <label class="accord" :class="{ manque: accordManque }">
      <input ref="caseAccord" v-model="accord" type="checkbox"
             :aria-invalid="accordManque || undefined"
             :aria-describedby="accordManque ? 'accord-offrir accord-offrir-requis' : 'accord-offrir'">
      <span>
        {{ $t('FeuilleOffrir.accordA') }}
        <a href="/conditions" class="lien" aria-haspopup="dialog" @click.prevent="ouvrirLegal('/conditions')">{{ $t('FeuilleOffrir.cgv') }}</a>
        {{ $t('FeuilleOffrir.accordB') }}
        <span id="accord-offrir" class="doux">
          {{ $t('FeuilleOffrir.accordDetail') }}
        </span>
      </span>
    </label>

    <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
    <component :is="OutilsDev" v-if="OutilsDev" :de-la-part="deLaPart" :message="message" />

    <template #pied>
      <p v-if="accordManque" id="accord-offrir-requis" class="mini" role="alert"
         style="color:var(--non);margin:0;text-align:center">
        {{ $t('FeuilleOffrir.accordRequis') }}
      </p>
      <button type="button" class="btn btn-1" style="width:100%" :disabled="envoi" @click="offrir">
        {{ envoi ? $t('FeuilleOffrir.ouverture') : $t('FeuilleOffrir.offrirPrix', { prix }) }}
      </button>
      <p class="mini doux" style="margin:0;text-align:center">
        {{ $t('FeuilleOffrir.pied') }}
      </p>
    </template>
  </Feuille>
</template>

<style scoped>
.note { margin: 0 0 12px; padding: 10px 12px; border-radius: var(--r-s); background: var(--fond);
  border: 1px solid var(--trait); }
.prix { margin: 0; font-size: 1rem; }
.prix strong { font-size: 1.3rem; }
.portee { margin: 12px 0 14px; padding: 10px 12px; border-radius: var(--r-s); line-height: 1.45;
  background: color-mix(in srgb, var(--menthe) 30%, transparent); }
.inclus { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 7px;
  font-size: .9rem; }
.inclus li { display: flex; gap: 8px; align-items: center; }
.champs { display: flex; flex-direction: column; gap: 12px; margin: 0 0 14px; }
.mot { resize: vertical; min-height: 72px; font: inherit; }
.accord { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; margin: 0 0 10px;
  border-radius: var(--r-s); border: 1px solid var(--trait); background: var(--fond);
  font-size: .84rem; line-height: 1.45; cursor: pointer; }
.accord input { width: 20px; height: 20px; flex: none; margin: 1px 0 0; accent-color: var(--encre); }
.accord { transition: border-color .15s, background .15s; }
.accord.manque { border-color: var(--non); background: color-mix(in srgb, var(--non) 9%, var(--fond));
  animation: secoue .32s ease-in-out; }
@keyframes secoue { 25% { transform: translateX(-5px) } 50% { transform: translateX(5px) } 75% { transform: translateX(-3px) } }
@media (prefers-reduced-motion: reduce) { .accord.manque { animation: none; } }
</style>
