<script setup lang="ts">
/**
 * /offrir : l'adresse publique du cadeau — celle des fiches publiques, et du
 * retour d'un paiement annulé (`?annule=1`).
 *
 * Tout se passe dans la feuille (FeuilleOffrir), qui s'ouvre d'elle-même sur
 * un fond calme ; refermée, un bouton la rouvre. Depuis l'app, la même
 * feuille s'ouvre sur place, depuis l'accueil ou les réglages : pas de page
 * à quitter.
 */
useHead({ title: 'Offrir babyNamed' })
const route = useRoute()
const annule = computed(() => route.query.annule === '1')
const prix = (useRuntimeConfig().public.prixListe as string) || '6 €'
const ouvert = ref(false)
onMounted(() => { ouvert.value = true })
</script>

<template>
  <main id="contenu" class="offrir" tabindex="-1">
    <!-- en tête : la feuille est fixe, et le pied reste le dernier élément -->
    <FeuilleOffrir v-if="ouvert" :annule="annule" @fermer="ouvert = false" />
    <div class="haut">
      <NuxtLink to="/" aria-label="babyNamed — accueil">
        <img src="/logo.png" alt="" width="66" height="66">
      </NuxtLink>
      <h1>Offrir babyNamed</h1>
      <p class="doux">Choisir un prénom à deux, sans s’influencer.</p>
    </div>

    <div class="pile actions">
      <button type="button" class="btn btn-1" @click="ouvert = true">Offrir — {{ prix }}</button>
      <NuxtLink to="/" class="btn btn-0 doux">Découvrir babyNamed</NuxtLink>
    </div>

    <PiedLegal compact />
  </main>
</template>

<style scoped>
/* Toute la largeur défile (la barre de défilement au bord de la fenêtre, pas
   au milieu de l'écran), la colonne reste étroite. */
.offrir { height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 22px;
  padding: max(clamp(24px, 12vh, 120px), env(safe-area-inset-top)) max(18px, calc(50% - 230px))
    calc(28px + env(safe-area-inset-bottom)); }
.offrir:focus { outline: none; }
.offrir > :last-child { margin-top: auto; }
.haut { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.haut img { border-radius: 17px; display: block; }
.haut h1 { font-size: 1.7rem; }
.haut p { margin: 0; }
.actions { gap: 10px; }
.actions .btn { text-align: center; }
</style>
