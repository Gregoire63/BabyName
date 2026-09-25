// Le domaine public, pour les balises Open Graph de la coquille (meme regle que
// scripts/seo.mjs).
const SITE = (process.env.NUXT_PUBLIC_SITE_URL || 'https://babynamed.fr').replace(/\/$/, '')
const DESCRIPTION = 'Choisir le prénom de bébé à deux, sans s’influencer : chacun trie de son côté, '
  + 'babyNamed ne montre que les prénoms que vous aimez tous les deux. Gratuit, sans mot de passe.'

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
      // Le titre de la coquille : chaque page le remplace aussitot, mais c'est
      // lui que lisent les robots qui n'executent pas le JavaScript.
      title: 'babyNamed — choisir le prénom de bébé à deux',
      meta: [
        // resizes-content : sur Android, le clavier redimensionne la page au
        // lieu de se poser dessus — les feuilles restent visibles. iPhone
        // l'ignore ; useClavier y supplee.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content' },
        { name: 'theme-color', content: '#1a234e' },
        { name: 'description', content: DESCRIPTION },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'babyNamed' },
        { property: 'og:title', content: 'babyNamed — choisir le prénom de bébé à deux' },
        { property: 'og:description', content: DESCRIPTION },
        { property: 'og:image', content: `${SITE}/icone-512.png` },
        { property: 'og:locale', content: 'fr_FR' }
      ],
      // « / » est une coquille JavaScript : un robot qui ne l'execute pas
      // (la plupart des robots d'IA) n'y voyait rien. Il trouve ici de quoi
      // savoir ce qu'est l'app, et ou lire la suite.
      noscript: [{
        tagPosition: 'bodyOpen',
        innerHTML: '<h1>babyNamed — choisir le prénom de bébé à deux</h1>'
          + `<p>${DESCRIPTION}</p>`
          + '<p><a href="/choisir-un-prenom-a-deux/">Comment ça marche, prix et confidentialité</a> · '
          + '<a href="/prenoms/">Signification, origine et popularité des prénoms donnés en France</a></p>'
          + '<p>L’application elle-même demande JavaScript.</p>'
      }],
      // Le theme choisi dans les reglages (voir useTheme), pose AVANT le premier
      // affichage : sans lui, « Sombre » sur un telephone en clair clignotait
      // en clair a chaque ouverture, le temps que Vue demarre. Rien d'autre.
      script: [{
        tagPosition: 'head',
        innerHTML: "try{var t=localStorage.getItem('pr_theme');if(t==='sombre'||t==='clair')"
          + "document.documentElement.setAttribute('data-theme',t==='sombre'?'dark':'light')}catch(e){}"
      }],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        // Nunito est servie par l'app (app/assets/fonts, @font-face dans
        // app.vue) : plus aucune requete vers Google a l'ouverture.
        { rel: 'icon', href: '/logo.png', type: 'image/png' },
        { rel: 'apple-touch-icon', href: '/logo.png' }
      ]
    }
  },
  // Les valeurs se posent sur le Worker : les secrets par `wrangler secret put`
  // (ou le tableau de bord Cloudflare), le reste dans wrangler.jsonc (vars).
  // La base n'est pas une valeur : c'est la liaison D1 « DB » de wrangler.jsonc.
  runtimeConfig: {
    sessionSecret: '',            // NUXT_SESSION_SECRET

    // Les e-mails de connexion (lien + code). Le prestataire est nomme dans
    // shared/utils/editeur.ts (COURRIEL) ; ici, seulement la cle et
    // l'expediteur. Sans eux, l'app ne propose simplement pas le lien par
    // e-mail — les passkeys marchent sans.
    emailCle: '',                 // NUXT_EMAIL_CLE         (cle d'API du prestataire)
    emailExpediteur: '',          // NUXT_EMAIL_EXPEDITEUR  (« babyNamed <connexion@babynamed.fr> »)

    // Stripe. Ces trois valeurs ne sont JAMAIS dans le dépôt : elles se posent
    // en secrets du Worker, et la clé secrète ne quitte jamais le serveur. Le navigateur ne voit que l'URL de paiement que
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

    // La purge quotidienne (RGPD) tourne seule, chaque nuit (scheduledTasks
    // ci-dessous). CRON_SECRET ouvre en plus /api/admin/purger, pour la
    // declencher a la main.
    cronSecret: '',               // CRON_SECRET (lu aussi tel quel)

    public: { siteUrl: '', prixListe: '6 €' }   // NUXT_PUBLIC_SITE_URL / NUXT_PUBLIC_PRIX_LISTE
  },
  /**
   * Cloudflare Workers : l'API et la coquille dans le Worker, les fichiers
   * statiques servis directement par Cloudflare (sans le Worker), la base en
   * D1 (liaison DB, wrangler.jsonc). Pas de démarrage à froid.
   *
   * En développement, `nuxt dev` passe par wrangler, qui fournit les mêmes
   * liaisons en local : la base D1 locale vit dans .data/wrangler.
   */
  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
      dev: { persistDir: '.data/wrangler' }
    },
    experimental: { tasks: true },
    // La purge RGPD, chaque nuit à 3 h 17 UTC. La MÊME expression doit figurer
    // dans wrangler.jsonc (triggers.crons) : c'est elle qui réveille le Worker.
    scheduledTasks: { '17 3 * * *': ['purge'] }
  }
})
