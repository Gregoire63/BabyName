<script setup lang="ts">
/**
 * Feuille generique : le tiroir qui monte du bas.
 *
 * Trois choses qu'aucun appelant ne devrait avoir a refaire :
 *  - l'animation d'ouverture ET de fermeture. La fermeture est la partie
 *    qu'on rate : un `v-if` coupe le composant net, la feuille disparait d'un
 *    coup. Ici la feuille garde la main — elle joue sa sortie, puis previent
 *    le parent. D'ou la regle d'usage ci-dessous.
 *  - le geste : on la tire vers le bas pour la fermer, avec la resistance et
 *    le seuil de useFeuille.
 *  - le decor : voile, poignee, titre, corps qui defile, pied fixe.
 *
 * USAGE — le parent ne coupe jamais la feuille lui-meme :
 *
 *   <Feuille v-if="ouvert" titre="…" @fermer="ouvert = false">…</Feuille>
 *
 * Tout ce qui ferme (voile, bouton, geste, contenu) passe par la feuille, qui
 * emet `fermer` une fois l'animation finie. Le contenu recupere la fonction
 * par le slot : <template #defaut="{ fermer }">
 */
const props = withDefaults(defineProps<{
  titre?: string
  /** Occupe tout l'ecran plutot que de s'arreter a 92 % : pour un parcours
   *  en plusieurs etapes, ou une demi-hauteur donne l'impression d'un bout. */
  plein?: boolean
}>(), { plein: false })

const emit = defineEmits<{ fermer: [] }>()

const visible = ref(false)
const dedans = ref<HTMLElement>()
const corps = ref<HTMLElement>()
const idTitre = useId()

// Monte puis s'affiche : sans ce temps mort, l'etat initial de la transition
// n'est jamais peint et la feuille apparait deja en place.
onMounted(() => requestAnimationFrame(() => { visible.value = true }))

function fermer() { visible.value = false }
const geste = useFeuille(fermer, dedans)

/**
 * Au-dessus du clavier. Quand il sort, le voile epouse exactement la partie
 * visible de l'ecran (son haut et sa hauteur) : la feuille, posee en bas du
 * voile, s'arrete au ras du clavier, et le champ ou l'on tape comme les
 * resultats restent sous les yeux. Voir useClavier.
 */
const clavier = useClavier()
const styleVoile = computed(() => clavier.ouvert.value
  ? { top: `${clavier.haut.value}px`, bottom: 'auto', height: `${clavier.visible.value}px` } : {})
const styleCorps = computed(() => {
  const s: Record<string, string> = { ...(geste.style.value as Record<string, string>) }
  if (clavier.ouvert.value) {
    const h = `${Math.max(160, clavier.visible.value - (props.plein ? 0 : 12))}px`
    s.maxHeight = h
    if (props.plein) s.height = h
  }
  return s
})
// Clavier et lecteur d'ecran : focus dedans, fond inerte, Echap, retour du
// focus a la fermeture. Voir useDialogue.
useDialogue(corps, fermer)

defineExpose({ fermer })
</script>

<template>
  <Transition name="feuille" @after-leave="emit('fermer')">
    <div v-if="visible" class="feuille-voile" :style="styleVoile" @click.self="fermer">
      <section ref="corps" class="feuille-corps" :class="{ plein: props.plein }" :style="styleCorps"
               role="dialog" aria-modal="true" tabindex="-1"
               :aria-labelledby="props.titre ? idTitre : undefined"
               :aria-label="props.titre ? undefined : 'Fenêtre'">
        <div class="feuille-prise" @pointerdown="geste.debut" @pointermove="geste.bouge"
             @pointerup="geste.fin" @pointercancel="geste.fin">
          <div class="feuille-poignee" />
          <div v-if="props.titre || $slots.action" class="ligne feuille-tete">
            <h2 :id="idTitre" style="flex:1;min-width:0">{{ props.titre }}</h2>
            <slot name="action" :fermer="fermer" />
            <button type="button" class="feuille-x" aria-label="Fermer" @click="fermer">
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>

        <div ref="dedans" class="feuille-dedans pile">
          <slot :fermer="fermer" />
        </div>

        <div v-if="$slots.pied" class="feuille-pied">
          <slot name="pied" :fermer="fermer" />
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.feuille-voile { position: fixed; inset: 0; z-index: 60; background: rgba(26,35,78,.42);
  backdrop-filter: blur(3px); display: flex; align-items: flex-end; justify-content: center; }
.feuille-corps { width: 100%; max-width: 560px; max-height: 92%; background: var(--carte);
  border-radius: 22px 22px 0 0; display: flex; flex-direction: column; min-height: 0; }
.feuille-corps.plein { max-height: 100%; height: 100%; border-radius: 0; max-width: none; }
/* Le conteneur recoit le focus a l'ouverture (pour que le titre soit lu) :
   il n'a pas a s'encadrer, ce n'est pas une commande. */
.feuille-corps:focus { outline: none; }

/* la prise seule capte le geste : dans le corps, le doigt doit pouvoir defiler */
.feuille-prise { touch-action: none; flex: none; }
.feuille-poignee { width: 42px; height: 5px; border-radius: 999px; background: var(--trait);
  margin: 10px auto 2px; }
.feuille-tete { padding: 6px 14px 4px 20px; gap: 8px; }
.feuille-tete h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.feuille-x { border: 0; background: none; color: var(--doux); font-size: 1rem; line-height: 1;
  padding: 8px 10px; cursor: pointer; border-radius: 50%; flex: none; }
.feuille-x:active { background: var(--fond); }

.feuille-dedans { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  touch-action: pan-y; padding: 8px 20px 18px; }
.feuille-pied { flex: none; padding: 10px 20px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--trait); touch-action: auto;
  display: flex; flex-direction: column; gap: 10px; }

/* ------------------------------------------------- ouverture et fermeture */
/* La fermeture ne se voyait pas, pour deux raisons :
   - le voile s'effacait en OPACITE, et la feuille est dedans : elle devenait
     transparente avant d'avoir eu le temps de descendre ;
   - Vue retire l'element quand la transition de la RACINE (le voile) finit :
     .24 s, alors que la feuille en demandait .3. Elle etait coupee en route.
   Le voile ne fond donc que sa couleur et son flou, et il dure au moins
   autant que la descente. En sortie, la feuille accelere (on la jette) au
   lieu de freiner (on la pose). */
.feuille-enter-active { transition: background-color .3s ease, backdrop-filter .3s ease; }
.feuille-leave-active { transition: background-color .28s ease, backdrop-filter .28s ease; }
.feuille-enter-from, .feuille-leave-to { background-color: transparent; backdrop-filter: blur(0); }
.feuille-enter-active .feuille-corps { transition: transform .3s cubic-bezier(.2,.86,.3,1); }
.feuille-leave-active .feuille-corps { transition: transform .26s cubic-bezier(.5,0,.9,.55); }
.feuille-enter-from .feuille-corps, .feuille-leave-to .feuille-corps {
  transform: translateY(100%); }

@media (prefers-reduced-motion: reduce) {
  .feuille-enter-active, .feuille-leave-active,
  .feuille-enter-active .feuille-corps, .feuille-leave-active .feuille-corps {
    transition-duration: .01ms; }
}
</style>
