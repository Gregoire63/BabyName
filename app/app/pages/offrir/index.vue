<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

/**
 * Offrir babyNamed : une liste débloquée, en cadeau.
 *
 * Page publique, sans compte : qui offre n'est pas forcément qui trie — les
 * grands-parents, une amie, les collègues. On écrit (si l'on veut) de la
 * part de qui et un mot, on accepte les conditions, et Stripe encaisse. Le
 * code arrive à la page suivante, et sur la facture envoyée par e-mail.
 *
 * Ce qu'on vend est dit comme sur la feuille « Débloquer » (INCLUS_DEBLOCAGE,
 * une seule source) : un cadeau qui promettrait autre chose que ce que la
 * liste débloque se paierait en déception chez quelqu'un d'autre.
 */
useHead({ title: 'Offrir babyNamed' })
const route = useRoute()
const prix = (useRuntimeConfig().public.prixListe as string) || '6 €'
const tva = mentionTva()
const INCLUS = INCLUS_DEBLOCAGE
const ans = CONSERVATION.cadeauMois / 12

const deLaPart = ref('')
const message = ref('')
const accord = ref(false)
const envoi = ref(false)
const erreur = ref('')
const annule = computed(() => route.query.annule === '1')

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
  <main id="contenu" class="accueil" tabindex="-1">
    <div class="haut">
      <NuxtLink to="/" aria-label="babyNamed — accueil">
        <img src="/logo.png" alt="" width="66" height="66">
      </NuxtLink>
      <h1>Offrir babyNamed</h1>
      <p class="doux">À des futurs parents : choisir le prénom à deux, sans s’influencer.</p>
    </div>

    <p v-if="annule" class="carte mini note" role="status">
      Paiement annulé : rien n’a été débité. Vous pouvez recommencer quand vous voulez.
    </p>

    <section class="carte pile" aria-labelledby="titre-quoi">
      <h2 id="titre-quoi" class="sr-only">Ce que vous offrez</h2>
      <p style="margin:0">
        <strong style="font-size:1.3rem">{{ prix }} TTC</strong>
        <span class="doux">, une fois — pas d’abonnement</span>
      </p>
      <p class="mini doux" style="margin:0">{{ tva }}.</p>
      <p class="mini portee" style="margin:0">
        Vous recevez <strong>un lien et un code</strong> à transmettre — par message,
        dans une carte, à la baby shower. Ils débloquent <strong>une liste</strong> :
        celle que les parents ont déjà commencée, ou une nouvelle. Valables {{ ans }} ans.
      </p>
      <h3 class="titre-bloc">Ce que ça débloque</h3>
      <ul class="inclus">
        <li v-for="i in INCLUS" :key="i.titre">
          <Etincelles :taille="13" couleur="var(--peche)" une aria-hidden="true" />
          <span>{{ i.titre }}</span>
        </li>
      </ul>
      <p class="mini doux" style="margin:0">
        Le reste est gratuit pour eux, cadeau ou pas : trier, trouver leurs
        accords, écarter les prénoms déjà pris.
      </p>
    </section>

    <section class="carte pile" aria-labelledby="titre-cadeau">
      <h2 id="titre-cadeau" class="titre-bloc" style="margin:0">Votre cadeau</h2>
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
      <p class="mini doux" style="margin:0">Ils les liront en ouvrant le cadeau.</p>

      <label class="accord">
        <input v-model="accord" type="checkbox" aria-describedby="accord-detail">
        <span>
          J’accepte les
          <a href="/conditions" target="_blank" rel="noopener" class="lien">conditions générales de vente</a>
          et je demande que la liste soit débloquée dès l’utilisation du code.
          <span id="accord-detail" class="doux">
            Tant qu’il n’a pas servi, je peux me rétracter pendant 14 jours ; son
            utilisation vaut exécution, et ce droit s’arrête alors (art. L221-28 13° du
            Code de la consommation).
          </span>
        </span>
      </label>

      <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
      <button type="button" class="btn btn-1" :disabled="envoi || !accord" @click="offrir">
        {{ envoi ? 'Ouverture…' : `Offrir — ${prix}` }}
      </button>
      <p class="mini doux" style="margin:0">
        Paiement sur la page sécurisée de Stripe, sans créer de compte : babyNamed ne
        voit jamais votre carte. Le code s’affiche juste après, et figure sur la
        facture envoyée par e-mail.
      </p>
      <component :is="OutilsDev" v-if="OutilsDev" :de-la-part="deLaPart" :message="message" />
    </section>

    <PiedLegal compact />
  </main>
</template>

<style scoped>
.accueil { height: 100%; overflow-y: auto; display: flex; flex-direction: column;
  gap: 18px; max-width: 460px; margin: 0 auto;
  padding: max(24px, env(safe-area-inset-top)) 18px calc(28px + env(safe-area-inset-bottom)); }
.accueil:focus { outline: none; }
.haut { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.haut img { border-radius: 17px; display: block; }
.haut h1 { font-size: 1.7rem; }
.haut p { margin: 0; }
.note { margin: 0; padding: 12px 16px; text-align: center; }
.portee { padding: 10px 12px; border-radius: var(--r-s); line-height: 1.45;
  background: color-mix(in srgb, var(--menthe) 30%, transparent); }
.titre-bloc { margin: 6px 0 0; font-size: .72rem; text-transform: uppercase;
  letter-spacing: .05em; color: var(--doux); font-weight: 700; }
.inclus { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px;
  font-size: .9rem; }
.inclus li { display: flex; gap: 8px; align-items: center; }
.mot { resize: vertical; min-height: 72px; font: inherit; }
.accord { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px;
  border-radius: var(--r-s); border: 1px solid var(--trait); background: var(--fond);
  font-size: .84rem; line-height: 1.45; cursor: pointer; }
.accord input { width: 20px; height: 20px; flex: none; margin: 1px 0 0; accent-color: var(--encre); }
</style>
