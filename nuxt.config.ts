export default defineNuxtConfig({
  compatibilityDate: '2025-09-01',
  ssr: false,                     // le catalogue est statique et embarque : aucun SSR utile
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'babyNames',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#1a234e' },
        { name: 'description', content: 'Choisir un prénom à plusieurs, sans s’influencer.' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', href: '/logo.png', type: 'image/png' },
        { rel: 'apple-touch-icon', href: '/logo.png' }
      ]
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
