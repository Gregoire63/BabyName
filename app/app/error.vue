<script setup lang="ts">
import type { NuxtError } from '#app'

/**
 * La page d'erreur de l'app : une adresse qui ne mène à rien (404), ou une
 * erreur imprévue. Sans elle, Nuxt affichait sa page par défaut, en anglais
 * et sans aucun chemin pour repartir.
 *
 * Le code HTTP 404 lui-même est posé par le serveur (server/plugins/
 * introuvable.ts) : cette page ne fait que l'afficher.
 */
const props = defineProps<{ error: NuxtError }>()
const introuvable = computed(() => props.error?.statusCode === 404)

useHead({
  title: () => introuvable.value ? 'Page introuvable' : 'Une erreur est survenue',
  meta: [{ name: 'robots', content: 'noindex' }]
})

/** Vers l'app : clearError efface l'erreur avant de naviguer. */
const versApp = () => clearError({ redirect: '/' })
</script>

<template>
  <main id="contenu" class="erreur" tabindex="-1">
    <Ambiance />
    <div class="haut">
      <img src="/logo.png" alt="" width="66" height="66">
      <p class="code" aria-hidden="true">{{ introuvable ? '404' : 'Oups' }}</p>
      <h1>{{ introuvable ? 'Cette page n’existe pas' : 'Une erreur est survenue' }}</h1>
      <p class="doux">
        <template v-if="introuvable">
          L’adresse est peut-être mal recopiée, ou la page a changé de place.
        </template>
        <template v-else>
          Ce n’est pas vous. Réessayez dans un instant ; si ça recommence,
          écrivez-nous à <a class="lien" href="mailto:contact@babynamed.fr">contact@babynamed.fr</a>.
        </template>
      </p>
    </div>

    <div class="carte pile">
      <!-- les pages publiques sont statiques : un vrai lien, pas le routeur -->
      <a href="/prenoms/" class="btn btn-1">Parcourir les prénoms</a>
      <button type="button" class="btn" @click="versApp">Ouvrir l’app</button>
    </div>
  </main>
</template>

<style scoped>
.erreur { min-height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 22px;
  padding: max(24px, env(safe-area-inset-top)) max(18px, calc(50% - 230px))
    calc(28px + env(safe-area-inset-bottom)); }
.erreur:focus { outline: none; }
.haut { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.haut img { border-radius: 17px; }
.code { margin: 6px 0 0; font-size: 3.2rem; font-weight: 800; line-height: 1;
  color: var(--peche); letter-spacing: -.02em; }
.haut h1 { font-size: 1.5rem; margin: 0; }
.haut p.doux { margin: 0; max-width: 34ch; }
.pile .btn { text-align: center; text-decoration: none; }
</style>
