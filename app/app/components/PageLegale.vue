<script setup lang="ts">
/**
 * Le gabarit des pages legales : barre de retour, texte lisible, liens du bas.
 * Dans l'app, ces textes s'ouvrent plutot en feuille (FeuilleLegale) ; les
 * pages servent a qui arrive par un lien direct.
 *
 * Ces pages s'ouvrent sans compte (on doit pouvoir lire les conditions AVANT
 * de s'inscrire) et depuis n'importe ou — y compris un onglet ouvert depuis
 * l'ecran de paiement. D'ou le retour : on revient dans l'app si on en vient,
 * sinon a l'accueil, jamais vers une page etrangere.
 */
const props = defineProps<{ titre: string; version?: string }>()
useHead({ title: () => props.titre })

const router = useRouter()
function retour() {
  if (typeof window !== 'undefined' && window.history.state?.back) router.back()
  else navigateTo('/')
}

const depuis = computed(() => dateDeVersion(props.version))
</script>

<template>
  <div class="page-legale">
    <Ambiance />
    <header class="barre">
      <button type="button" class="retour" @click="retour">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
        Retour
      </button>
      <NuxtLink to="/" class="marque">
        <img src="/logo.png" alt="" width="26" height="26">
        <span>babyNamed</span>
      </NuxtLink>
    </header>

    <main id="contenu" class="texte texte-legal" tabindex="-1">
      <h1>{{ titre }}</h1>
      <p v-if="version" class="maj">En vigueur depuis le {{ depuis }}.</p>
      <slot />
    </main>

    <footer class="bas">
      <PiedLegal />
    </footer>
  </div>
</template>

<style scoped>
.page-legale { height: 100%; overflow-y: auto; overscroll-behavior-y: contain;
  padding: max(10px, env(safe-area-inset-top)) 18px calc(26px + env(safe-area-inset-bottom)); }
.barre { max-width: 680px; margin: 0 auto 8px; display: flex; align-items: center;
  justify-content: space-between; gap: 12px; }
.retour { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none;
  padding: 10px 8px 10px 0; font-weight: 700; color: var(--texte); cursor: pointer; }
.retour svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.4;
  stroke-linecap: round; stroke-linejoin: round; }
.marque { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; }
.marque img { border-radius: 7px; }

.texte { max-width: 680px; margin: 0 auto; }
.texte:focus { outline: none; }
.texte h1 { font-size: 1.6rem; margin: 10px 0 4px; }
.maj { color: var(--doux); font-size: .85rem; margin: 0 0 18px; }
/* La typographie des textes eux-mêmes : .texte-legal, dans app.vue — la
   feuille des textes légaux la partage. */
.bas { max-width: 680px; margin: 34px auto 0; padding-top: 16px; border-top: 1px solid var(--trait); }
</style>
