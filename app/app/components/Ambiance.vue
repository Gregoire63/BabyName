<script setup lang="ts">
/**
 * LE FOND QUI RESPIRE.
 *
 * Le lavis d'ambiance (menthe en haut à gauche, pêche en haut à droite, voir
 * --lavis dans app.vue) était posé là, immobile. Ici il bouge à peine : deux
 * halos qui dérivent et respirent, et deux reflets — un menthe, un pêche —
 * qui se croisent dans le bas de l'écran. Assez lent pour ne jamais tirer
 * l'œil pendant qu'on juge une carte ; on le remarque en levant les yeux.
 *
 * Trois choix qui tiennent le reste :
 *  - RIEN NE SE REPEINT. On ne fait varier que `translate`, `scale`,
 *    `rotate` et `opacity` de taches déjà peintes : le compositeur les
 *    déplace, le processeur ne fait rien, la pile de cartes ne saccade pas.
 *    Animer les dégradés eux-mêmes (background-position, @property)
 *    repeindrait l'écran entier soixante fois par seconde.
 *  - DES PÉRIODES QUI NE TOMBENT JAMAIS JUSTE (11, 13, 15, 17, 19 s…) et une
 *    animation par propriété : les mouvements se composent en courbes qui ne
 *    se répètent pas, au lieu d'un aller-retour qu'on finit par voir.
 *  - UN FOND PAR PAGE, pas un pour l'app : il glisse avec sa page pendant les
 *    transitions (app.vue isole la page qui bouge). Un seul fond global
 *    sautait deux fois par navigation — la page devenait opaque au départ,
 *    transparente à l'arrivée, sur un halo qui avait bougé entre-temps.
 *
 * Au repos (le début des animations), les deux halos sont exactement le
 * lavis : c'est lui qu'on voit sur les écrans sans ce composant, et quand le
 * système demande de réduire les animations — le fond s'arrête alors là. Le mouvement s'arrête aussi
 * sous une feuille ou une fiche ouverte : leur voile floute ce qu'il y a
 * derrière, et un fond qui bouge obligerait à recalculer ce flou à chaque
 * image.
 *
 * Chaque page part d'un instant pris au hasard dans ses cycles : on va et
 * vient sans cesse entre l'accueil et la liste, et un fond qui repartait
 * toujours du même geste finissait par se voir.
 */
const decalage = `-${(Math.random() * 40).toFixed(1)}s`
</script>

<template>
  <div class="ambiance" aria-hidden="true" :style="{ '--decalage': decalage }">
    <i class="halo menthe" />
    <i class="halo peche" />
    <i class="halo reflet reflet-menthe" />
    <i class="halo reflet reflet-peche" />
  </div>
</template>

<style scoped>
.ambiance { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none;
  background: var(--fond); contain: strict;
  /* Les reflets, avivés : le menthe et le pêche du thème sombre sont trop
     éteints pour qu'on les voie bouger. On les tire vers le vert et le
     corail de l'app (--oui, --non), en clair comme en sombre. Une teinte par
     reflet : mêlés dans une même tache, menthe et pêche donnaient du gris. */
  --reflet-menthe: color-mix(in srgb, var(--oui) 22%, var(--menthe));
  --reflet-peche: color-mix(in srgb, var(--non) 18%, var(--peche)); }
.halo { position: absolute; display: block; border-radius: 50%;
  will-change: transform, opacity; transform-origin: 50% 50%; }
/* Après les `animation:` de chaque tache, qu'il complète. */
.ambiance .halo { animation-delay: var(--decalage, 0s); }

/* Au repos, les ellipses de --lavis : rayon × arrêt de couleur, centrées au
   même endroit (12 % -8 %, et 95 % -4 %). */
.menthe { width: 149vw; height: 68vh; left: -62.5vw; top: -42vh;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--menthe) 55%, transparent), transparent);
  animation: glisse-menthe 15s ease-in-out infinite alternate,
             souffle-menthe 21s ease-in-out infinite alternate; }
.peche { width: 128vw; height: 58vh; left: 31vw; top: -33vh;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--peche) 48%, transparent), transparent);
  animation: glisse-peche 17s ease-in-out infinite alternate,
             souffle-peche 25s ease-in-out infinite alternate; }

/* Les reflets : deux lueurs couchées qui se croisent dans le bas de l'écran
   — là où, sous la carte, le fond se voit encore —, chacune s'allumant et
   s'éteignant à son rythme. Là où elles se rencontrent, on retrouve le
   dégradé du logo. */
.reflet { opacity: .45; }
.reflet-menthe { width: 96vw; height: 34vh; left: -34vw; top: 62vh; rotate: -10deg;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--reflet-menthe) 68%, transparent), transparent);
  animation: glisse-reflet-menthe 21s ease-in-out infinite alternate,
             souffle-reflet-menthe 14s ease-in-out infinite alternate,
             lueur 12s ease-in-out infinite alternate; }
.reflet-peche { width: 90vw; height: 32vh; left: 46vw; top: 74vh; rotate: 8deg;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--reflet-peche) 62%, transparent), transparent);
  animation: glisse-reflet-peche 25s ease-in-out infinite alternate,
             souffle-reflet-peche 17s ease-in-out infinite alternate,
             lueur 15s ease-in-out infinite alternate; }

@keyframes glisse-menthe { to { translate: 22vw 12vh; } }
@keyframes souffle-menthe { to { scale: 1.25; rotate: 10deg; } }
@keyframes glisse-peche { to { translate: -24vw 14vh; } }
@keyframes souffle-peche { to { scale: 1.28; rotate: -12deg; } }
@keyframes glisse-reflet-menthe { to { translate: 66vw -14vh; } }
@keyframes souffle-reflet-menthe { from { scale: .85; rotate: -10deg; } to { scale: 1.2; rotate: 4deg; } }
@keyframes glisse-reflet-peche { to { translate: -74vw -20vh; } }
@keyframes souffle-reflet-peche { from { scale: .9; rotate: 8deg; } to { scale: 1.22; rotate: -6deg; } }
@keyframes lueur { to { opacity: 1; } }

/* Réduire les animations : le lavis, immobile, comme avant. */
@media (prefers-reduced-motion: reduce) {
  .halo { animation: none !important; }
}
</style>

<!-- Hors du style « scoped » : `:global(body:has(…)) .halo` y perdait sa fin
     (Vue ne gardait que `body:has(…)`), et rien ne se figeait. -->
<style>
/* Sous un voile qui floute (feuille, fiche, effet d'accord) : on fige. */
body:has([aria-modal="true"]) .ambiance .halo { animation-play-state: paused; }
</style>
