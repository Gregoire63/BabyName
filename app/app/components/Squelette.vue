<script setup lang="ts">
/**
 * Une barre grise qui balaie, a la place du texte qui va arriver.
 *
 * Pourquoi plutot qu'un « Chargement… » : la page garde sa forme. Rien ne
 * saute quand les donnees arrivent, et on voit tout de suite de quoi l'ecran
 * sera fait. Un mot au centre d'une page vide ne dit ni l'un ni l'autre.
 */
withDefaults(defineProps<{
  /** largeur CSS : '60%', '120px'… */
  l?: string
  /** hauteur en px */
  h?: number
  /** rayon en px ; par defaut la moitie de la hauteur (barre a bouts ronds) */
  r?: number
  /** decalage de l'animation, pour que les barres ne clignotent pas en choeur */
  retard?: number
}>(), { l: '100%', h: 12, retard: 0 })
</script>

<template>
  <span class="squelette" :style="{
    width: l, height: h + 'px',
    borderRadius: (r ?? Math.min(h / 2, 10)) + 'px',
    animationDelay: retard + 's'
  }" />
</template>

<style scoped>
.squelette { display: block; flex: none;
  background:
    linear-gradient(100deg,
      transparent 20%, var(--lueur) 48%, transparent 76%),
    color-mix(in srgb, var(--sable) 46%, transparent);
  background-size: 260% 100%, 100% 100%;
  background-repeat: no-repeat;
  animation: balayer 1.5s linear infinite;
}
@keyframes balayer {
  from { background-position: 170% 0, 0 0 }
  to   { background-position: -70% 0, 0 0 }
}
@media (prefers-reduced-motion: reduce) {
  .squelette { animation: none; background: color-mix(in srgb, var(--sable) 46%, transparent); }
}
</style>
