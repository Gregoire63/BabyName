<script setup lang="ts">
import type { NuxtError } from '#app'
import { t } from '~/composables/useLangue'

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
  title: () => introuvable.value ? t('PageErreur.titreIntrouvable') : t('PageErreur.titreErreur'),
  meta: [{ name: 'robots', content: 'noindex' }]
})

/** Vers l'app : clearError efface l'erreur avant de naviguer. */
const versApp = () => clearError({ redirect: '/' })
// Dans une app des stores, pas de lien vers les pages publiques (useCoquille).
const { dansApp } = useCoquille()
</script>

<template>
  <main id="contenu" class="erreur" tabindex="-1">
    <Ambiance />
    <div class="haut">
      <img src="/logo.png" alt="" width="66" height="66">
      <p class="code" aria-hidden="true">{{ introuvable ? '404' : $t('PageErreur.oups') }}</p>
      <h1>{{ introuvable ? $t('PageErreur.h1Introuvable') : $t('PageErreur.titreErreur') }}</h1>
      <p class="doux">
        <template v-if="introuvable">
          {{ $t('PageErreur.texteIntrouvable') }}
        </template>
        <template v-else>
          {{ $t('PageErreur.texteErreur') }} <a class="lien" href="mailto:contact@babynamed.fr">contact@babynamed.fr</a>{{ $t('PageErreur.point') }}
        </template>
      </p>
    </div>

    <div class="carte pile">
      <!-- les pages publiques sont statiques : un vrai lien, pas le routeur -->
      <a v-if="!dansApp" href="/prenoms/" class="btn btn-1">{{ $t('PageErreur.parcourir') }}</a>
      <!-- Dans l'app des stores, on y est déjà : « Ouvrir l'app » n'y voudrait
           rien dire, et c'est le seul chemin pour repartir. -->
      <button type="button" class="btn" :class="{ 'btn-1': dansApp }" @click="versApp">
        {{ dansApp ? $t('PageErreur.revenir') : $t('PageErreur.ouvrir') }}
      </button>
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
