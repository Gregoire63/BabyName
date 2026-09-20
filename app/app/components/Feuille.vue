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

// Monte puis s'affiche : sans ce temps mort, l'etat initial de la transition
// n'est jamais peint et la feuille apparait deja en place.
onMounted(() => requestAnimationFrame(() => { visible.value = true }))

function fermer() { visible.value = false }
const geste = useFeuille(fermer, dedans)

defineExpose({ fermer })
</script>

<template>
  <Transition name="feuille" @after-leave="emit('fermer')">
    <div v-if="visible" class="feuille-voile" @click.self="fermer">
      <section class="feuille-corps" :class="{ plein: props.plein }" :style="geste.style.value">
        <div class="feuille-prise" @pointerdown="geste.debut" @pointermove="geste.bouge"
             @pointerup="geste.fin" @pointercancel="geste.fin">
          <div class="feuille-poignee" />
          <div v-if="props.titre || $slots.action" class="ligne feuille-tete">
            <h2 style="flex:1;min-width:0">{{ props.titre }}</h2>
            <slot name="action" :fermer="fermer" />
            <button class="feuille-x" aria-label="Fermer" @click="fermer">✕</button>
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
.feuille-enter-active, .feuille-leave-active { transition: opacity .24s ease; }
.feuille-enter-from, .feuille-leave-to { opacity: 0; }
.feuille-enter-active .feuille-corps, .feuille-leave-active .feuille-corps {
  transition: transform .3s cubic-bezier(.2,.86,.3,1); }
.feuille-enter-from .feuille-corps, .feuille-leave-to .feuille-corps {
  transform: translateY(100%); }

@media (prefers-reduced-motion: reduce) {
  .feuille-enter-active, .feuille-leave-active,
  .feuille-enter-active .feuille-corps, .feuille-leave-active .feuille-corps {
    transition-duration: .01ms; }
}
</style>
