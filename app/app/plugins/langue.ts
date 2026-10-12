import { t, langue, type Langue } from '~/composables/useLangue'

/** `$t` et `$langue` dans les gabarits (composables/useLangue.ts). */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.globalProperties.$t = t
  Object.defineProperty(nuxtApp.vueApp.config.globalProperties, '$langue', { get: () => langue.value })
})

declare module 'vue' {
  interface ComponentCustomProperties {
    $t: typeof t
    readonly $langue: Langue
  }
}
