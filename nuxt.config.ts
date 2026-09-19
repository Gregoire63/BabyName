export default defineNuxtConfig({
  compatibilityDate: '2025-09-01',
  ssr: false,                     // le catalogue est statique et embarque : aucun SSR utile
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Prénoms',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#1b1b1f' },
        { name: 'description', content: 'Choisir un prénom à plusieurs, sans s’influencer.' }
      ],
      link: [{ rel: 'manifest', href: '/manifest.webmanifest' }]
    }
  },
  runtimeConfig: {
    databaseUrl: '',              // NUXT_DATABASE_URL (injecte par Neon sur Vercel)
    resendApiKey: '',             // NUXT_RESEND_API_KEY
    mailFrom: 'Prénoms <onboarding@resend.dev>',
    sessionSecret: '',            // NUXT_SESSION_SECRET
    magicLinkDebug: '',           // NUXT_MAGIC_LINK_DEBUG=1 : renvoie le lien au lieu de l'envoyer
    migrationSecret: '',          // NUXT_MIGRATION_SECRET : à retirer une fois la migration faite
    public: { siteUrl: '' }       // NUXT_PUBLIC_SITE_URL
  },
  nitro: { preset: 'vercel' }
})
