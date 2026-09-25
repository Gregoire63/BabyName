<script setup lang="ts">
/**
 * Le gabarit des pages legales : barre de retour, texte lisible, liens du bas.
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

const depuis = computed(() => props.version
  ? new Date(`${props.version}T12:00:00`).toLocaleDateString('fr-FR',
      { day: 'numeric', month: 'long', year: 'numeric' })
  : '')
</script>

<template>
  <div class="page-legale">
    <header class="barre">
      <button type="button" class="retour" @click="retour">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
        Retour
      </button>
      <NuxtLink to="/" class="marque">
        <img src="/logo.png" alt="" width="26" height="26">
        <span>babyNames</span>
      </NuxtLink>
    </header>

    <main id="contenu" class="texte" tabindex="-1">
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

.texte { max-width: 680px; margin: 0 auto; line-height: 1.6; }
.texte:focus { outline: none; }
.texte h1 { font-size: 1.6rem; margin: 10px 0 4px; }
.maj { color: var(--doux); font-size: .85rem; margin: 0 0 18px; }
.texte :deep(h2) { font-size: 1.12rem; margin: 30px 0 8px; }
.texte :deep(h3) { font-size: .98rem; margin: 20px 0 6px; }
.texte :deep(p) { margin: 0 0 12px; }
.texte :deep(ul), .texte :deep(ol) { margin: 0 0 12px; padding-left: 22px; }
.texte :deep(li) { margin: 0 0 6px; }
.texte :deep(a) { text-decoration: underline; text-underline-offset: 3px; }
.texte :deep(.encadre) { background: var(--carte); border: 1px solid var(--trait);
  border-radius: var(--r-s); padding: 14px 16px; margin: 0 0 14px; }
.texte :deep(.encadre > :last-child) { margin-bottom: 0; }
.texte :deep(dl) { margin: 0 0 14px; display: grid; grid-template-columns: minmax(0, 1fr);
  gap: 2px; }
.texte :deep(dt) { font-weight: 800; font-size: .82rem; color: var(--doux); margin-top: 8px;
  text-transform: uppercase; letter-spacing: .04em; }
.texte :deep(dd) { margin: 0; }
.bas { max-width: 680px; margin: 34px auto 0; padding-top: 16px; border-top: 1px solid var(--trait); }
</style>
