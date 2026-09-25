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
        // Nunito est servie par l'app (app/assets/fonts, @font-face dans
        // app.vue) : plus aucune requete vers Google a l'ouverture.
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
    // Jamais a changer en production. Existe pour que les essais parlent a un
    // faux Stripe local : sans lui, tout le chemin du paiement echappait aux
    // essais — et c'est le seul chemin ou une erreur coute de l'argent.
    stripeApiBase: 'https://api.stripe.com/v1',   // NUXT_STRIPE_API_BASE
    // Stripe vendeur officiel (merchant of record) : TVA, litiges, support et
    // droit de retractation geres par Stripe, pour 3,5 % de plus. A n'allumer
    // qu'APRES l'avoir active dans le Dashboard (Parametres → Managed Payments)
    // et avoir donne un code fiscal eligible au produit — sinon Stripe refuse
    // la session et l'ecran d'achat affiche « momentanement indisponible ».
    stripeManagedPayments: '',    // NUXT_STRIPE_MANAGED_PAYMENTS=1
    // Seulement si l'on est assujetti a la TVA (voir shared/utils/editeur.ts) :
    // l'id du taux « TVA FR 20 % » inclusive cree dans le Dashboard (txr_…).
    stripeTaxRateId: '',          // NUXT_STRIPE_TAX_RATE_ID

    // La purge quotidienne (RGPD). Vercel lit CRON_SECRET directement et
    // l'envoie au cron : c'est CE nom-la qu'il faut poser, sans prefixe.
    cronSecret: '',               // CRON_SECRET (lu aussi tel quel)

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
