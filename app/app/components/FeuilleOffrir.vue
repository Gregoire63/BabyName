<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

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

const prix = (useRuntimeConfig().public.prixListe as string) || '6 €'
const tva = mentionTva()
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

async function offrir() {
  if (envoi.value || !accord.value) return
  envoi.value = true
  erreur.value = ''
  try {
    const r = await $fetch<any>('/api/cadeaux/acheter', {
      method: 'POST', body: { consentement: true, de_la_part: deLaPart.value, message: message.value }
    })
    if (r?.url) { window.location.href = r.url; return }
    erreur.value = 'Le paiement n’a pas pu s’ouvrir.'
  } catch (e: any) {
    const code = e?.data?.statusMessage
    erreur.value = code === 'paiement_non_configure' || code === 'vente_fermee'
      ? 'Le paiement n’est pas encore ouvert. Il le sera très bientôt.'
      : code === 'consentement_requis'
        ? 'Cochez la case d’accord pour continuer.'
        : code === 'trop_d_essais'
          ? 'Trop d’essais d’un coup : réessayez dans un moment.'
          : 'Le paiement est momentanément indisponible. Réessayez dans un instant.'
  } finally { envoi.value = false }
}
</script>

<template>
  <Feuille titre="Offrir babyNamed" @fermer="emit('fermer')">
    <p v-if="annule" class="mini note" role="status">
      Paiement annulé : rien n’a été débité.
    </p>

    <p class="prix">
      <strong>{{ prix }} TTC</strong><span class="doux"> : une liste débloquée pour la vie</span>
    </p>
    <p class="mini doux" style="margin:0">{{ tva }}.</p>

    <p class="portee mini">
      Un <strong>lien et un code</strong> à transmettre à de futurs parents. Ils
      débloquent <strong>une liste</strong>, déjà commencée ou nouvelle.
      Valables {{ ans }} ans.
    </p>

    <ul class="inclus">
      <li v-for="i in INCLUS" :key="i.titre">
        <Etincelles :taille="13" couleur="var(--peche)" une aria-hidden="true" />
        <span>{{ i.titre }}</span>
      </li>
    </ul>

    <div class="champs">
      <label class="pile" style="gap:6px">
        <span class="mini doux">De la part de (facultatif)</span>
        <input v-model="deLaPart" class="champ" maxlength="40" autocomplete="off"
               placeholder="Mamie, Julie et Tom…">
      </label>
      <label class="pile" style="gap:6px">
        <span class="mini doux">Un mot (facultatif)</span>
        <textarea v-model="message" class="champ mot" maxlength="200" rows="3"
                  placeholder="Pour choisir ensemble, sans vous fâcher." />
      </label>
    </div>

    <label class="accord">
      <input v-model="accord" type="checkbox" aria-describedby="accord-offrir">
      <span>
        J’accepte les
        <a href="/conditions" class="lien" aria-haspopup="dialog" @click.prevent="ouvrirLegal('/conditions')">conditions générales de vente</a>
        et je demande que la liste soit débloquée dès l’utilisation du code.
        <span id="accord-offrir" class="doux">
          Tant qu’il n’a pas servi, je peux me rétracter pendant 14 jours ; son
          utilisation vaut exécution, et ce droit s’arrête alors (art. L221-28 13° du
          Code de la consommation).
        </span>
      </span>
    </label>

    <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
    <component :is="OutilsDev" v-if="OutilsDev" :de-la-part="deLaPart" :message="message" />

    <template #pied>
      <button type="button" class="btn btn-1" style="width:100%" :disabled="envoi || !accord" @click="offrir">
        {{ envoi ? 'Ouverture…' : `Offrir (${prix})` }}
      </button>
      <p class="mini doux" style="margin:0;text-align:center">
        Paiement par Stripe. Le code s’affiche juste après, et arrive avec la facture.
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
</style>
