<script setup lang="ts">
/**
 * Les textes légaux dans une feuille : elle monte du bas, se lit sans quitter
 * l'écran où l'on était, et redescend en se fermant (Feuille s'en charge, le
 * geste compris).
 *
 * On passait par des pages : l'écran d'avant disparaissait, et il fallait
 * « Retour » pour le retrouver. Les quatre textes sont ici, en onglets ; un
 * lien d'un texte vers un autre (« voir la politique de confidentialité »)
 * change d'onglet au lieu de quitter la feuille.
 *
 * Une seule dans l'app (app.vue), ouverte par useFeuilleLegale().
 */
import type { Component } from 'vue'
import LegalConfidentialite from '~/components/legal/Confidentialite.vue'
import LegalConditions from '~/components/legal/Conditions.vue'
import LegalMentions from '~/components/legal/Mentions.vue'
import LegalAccessibilite from '~/components/legal/Accessibilite.vue'

const props = defineProps<{ chemin: string }>()
const emit = defineEmits<{ fermer: [] }>()

const TEXTES: Record<string, Component> = {
  '/confidentialite': LegalConfidentialite,
  '/conditions': LegalConditions,
  '/mentions-legales': LegalMentions,
  '/accessibilite': LegalAccessibilite
}

const courant = ref(docLegal(props.chemin).chemin)
// Rouverte sur un autre texte (un lien du bas, dans la feuille elle-même).
watch(() => props.chemin, c => aller(c))
const doc = computed(() => docLegal(courant.value))
const depuis = computed(() => dateDeVersion(doc.value.version))

const texte = ref<HTMLElement>()
const onglets = ref<HTMLElement>()
/** L'onglet du texte montré reste en vue : sur un téléphone, les quatre ne
 *  tiennent pas sur une ligne, et la rangée défile. */
function montrerOnglet() {
  const el = onglets.value?.querySelector<HTMLElement>('[aria-current="page"]')
  const rangee = onglets.value
  if (!el || !rangee) return
  const r = rangee.getBoundingClientRect(), o = el.getBoundingClientRect()
  if (o.left < r.left || o.right > r.right) rangee.scrollLeft += o.left - r.left - 20
}
onMounted(() => nextTick(montrerOnglet))
watch(courant, () => nextTick(montrerOnglet))

function aller(chemin: string) {
  const c = docLegal(chemin).chemin
  if (c === courant.value) return
  courant.value = c
  // Un autre texte se lit depuis son début.
  nextTick(() => {
    const defile = texte.value?.closest('.feuille-dedans')
    if (defile) defile.scrollTop = 0
  })
}

/**
 * Un lien vers un autre texte légal reste dans la feuille. Attrapé AVANT le
 * lien lui-même (phase de capture) : sinon le routeur l'aurait déjà suivi.
 * Les autres liens (e-mail, sites extérieurs) vont où ils vont.
 */
function lien(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!a || (a.target && a.target !== '_self')) return
  const url = new URL(a.href, window.location.href)
  if (url.origin !== window.location.origin || !estPageLegale(url.pathname)) return
  e.preventDefault()
  e.stopPropagation()
  aller(url.pathname)
}
</script>

<template>
  <Feuille :titre="doc.titre" class="feuille-legale" @fermer="emit('fermer')">
    <nav ref="onglets" class="onglets-legaux" aria-label="Textes légaux">
      <button v-for="d in DOCS_LEGAUX" :key="d.chemin" type="button" class="onglet-legal"
              :aria-current="d.chemin === courant ? 'page' : undefined" @click="aller(d.chemin)">
        {{ d.court }}
      </button>
    </nav>
    <p v-if="depuis" class="maj">En vigueur depuis le {{ depuis }}.</p>
    <div ref="texte" class="texte-legal" @click.capture="lien">
      <component :is="TEXTES[courant]" />
    </div>
  </Feuille>
</template>

<style scoped>
.onglets-legaux { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none;
  margin: 0 -20px; padding: 2px 20px 4px; flex: none; }
.onglets-legaux::-webkit-scrollbar { display: none; }
.onglet-legal { flex: none; border: 1px solid var(--trait); background: var(--fond); color: var(--texte);
  border-radius: 999px; padding: 7px 13px; font: inherit; font-size: .8rem; font-weight: 700;
  cursor: pointer; white-space: nowrap; }
.onglet-legal[aria-current="page"] { background: var(--encre); border-color: var(--encre); color: var(--fond); }
.maj { color: var(--doux); font-size: .82rem; margin: 0; }
/* Dans la feuille, la carte est le fond : l'encadré s'en détache autrement. */
.texte-legal :deep(.encadre) { background: var(--fond); }
.texte-legal :deep(h2:first-child) { margin-top: 6px; }
</style>
