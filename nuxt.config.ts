import { fileURLToPath } from 'node:url'

const VIDE = fileURLToPath(new URL('./vide.mjs', import.meta.url))

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
        // Apple a deja SF Pro Rounded (ui-rounded) : Nunito n'est la que pour
        // les autres. Chargee sans bloquer le rendu, la fonte systeme sert
        // en attendant.
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', media: 'print', onload: "this.media='all'",
          href: 'https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;800&display=swap' },
        { rel: 'icon', href: '/logo.png', type: 'image/png' },
        { rel: 'apple-touch-icon', href: '/logo.png' }
      ]
    }
  },
  runtimeConfig: {
    databaseUrl: '',              // NUXT_DATABASE_URL (injecte par Neon sur Vercel)
    sessionSecret: '',            // NUXT_SESSION_SECRET
    migrationSecret: '',          // NUXT_MIGRATION_SECRET : à retirer une fois la migration faite
    public: { siteUrl: '' }       // NUXT_PUBLIC_SITE_URL
  },
  nitro: { preset: 'vercel' },

  // Le Postgres embarque du developpement n'a rien a faire dans la fonction
  // serverless : son code y est deja mort, mais le traceur recopiait quand
  // meme le paquet et ses deux .wasm. Voir vide.mjs.
  $production: {
    nitro: {
      alias: {
        '@electric-sql/pglite': VIDE,
        '@electric-sql/pglite/contrib/pgcrypto': VIDE
      }
    }
  }
})
