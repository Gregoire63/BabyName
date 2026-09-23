import { fileURLToPath } from 'node:url'

const VIDE = fileURLToPath(new URL('./vide.mjs', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-09-01',
  ssr: false,                     // le catalogue est statique et embarque : aucun SSR utile
  devtools: { enabled: true },
  app: {
    // Un seul nom : la direction est portee par [data-sens] sur <html>, pose
    // par app/middleware/glisse.global.ts avant chaque navigation.
    pageTransition: { name: 'page', mode: 'default' },
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

    // Stripe. Ces trois valeurs ne sont JAMAIS dans le dépôt : elles se posent
    // dans les variables d'environnement Vercel, et la clé secrète ne quitte
    // jamais le serveur. Le navigateur ne voit que l'URL de paiement que
    // Stripe renvoie — aucune donnée de carte ne traverse l'app.
    stripeSecretKey: '',          // NUXT_STRIPE_SECRET_KEY      (sk_live_… / sk_test_…)
    stripeWebhookSecret: '',      // NUXT_STRIPE_WEBHOOK_SECRET  (whsec_…)
    stripePriceId: '',            // NUXT_STRIPE_PRICE_ID        (price_…)

    public: { siteUrl: '', prixListe: '6 €' }   // NUXT_PUBLIC_SITE_URL / NUXT_PUBLIC_PRIX_LISTE
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
