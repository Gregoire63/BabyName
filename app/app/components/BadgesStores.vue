<script setup lang="ts">
/**
 * Les boutons vers les applications (mêmes que la vitrine DishRank et les
 * pages publiques, scripts/seo.mjs) : sur iPhone l'App Store seul, sur
 * Android Google Play seul, sur ordinateur les deux. Jamais dans l'app.
 * Google Play pas encore public : le bouton mène à la bêta (groupe des
 * testeurs), étiqueté comme tel.
 */
const coquille = useCoquille()
const os = ref<'ios' | 'android' | 'autre'>('autre')
onMounted(() => { os.value = systemeVisiteur() })

const ios = computed(() => !!APP_IOS && os.value !== 'android')
const android = computed(() => os.value !== 'ios')
const lienAndroid = APP_ANDROID || ANDROID_BETA
</script>

<template>
  <p v-if="!coquille.dansApp" class="stores">
    <a v-if="ios" class="store" :href="APP_IOS" target="_blank" rel="noopener"
       :aria-label="$t('BadgesStores.appStore')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.09-.5-2.09-.55-3.24 0-1.44.72-2.2.48-3.08-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.1zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
      App Store
    </a>
    <a v-if="android" class="store" :href="lienAndroid" target="_blank" rel="noopener"
       :aria-label="APP_ANDROID ? $t('BadgesStores.googlePlay') : $t('BadgesStores.beta')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.25-.84-.76-.84-1.35zM16.81 15.12L6.05 21.34l8.49-8.49 2.27 2.27zM20.16 10.81c.35.27.58.72.58 1.19 0 .47-.23.91-.57 1.18l-2.29 1.32-2.5-2.5 2.5-2.5 2.28 1.31zM6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z" /></svg>
      Google Play <small v-if="!APP_ANDROID">{{ $t('BadgesStores.betaCourt') }}</small>
    </a>
  </p>
</template>

<style scoped>
.stores { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin: 0; }
.store { display: inline-flex; align-items: center; gap: 8px; padding: 11px 20px; border-radius: 999px;
  background: var(--encre); color: var(--fond); font-weight: 700; font-size: .95rem;
  text-decoration: none; box-shadow: 0 6px 18px -8px rgba(0, 0, 0, .45); transition: transform .15s; }
.store:hover { transform: translateY(-1px); }
.store:active { transform: scale(.98); }
svg { width: 16px; height: 16px; fill: currentColor; }
small { font-weight: 600; font-size: .72em; padding: 2px 6px; border-radius: 999px;
  background: color-mix(in srgb, currentColor 18%, transparent); }
@media (prefers-reduced-motion: reduce) { .store { transition: none; } }
</style>
