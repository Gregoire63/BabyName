<script setup lang="ts">
/**
 * Le moment ou tout le monde a dit oui sur le meme prenom.
 *
 * C'est le seul evenement de l'application qui merite une celebration : le
 * reste du temps on trie, ici on trouve. L'effet reprend les etincelles du
 * logo, rien d'autre — pas de confettis multicolores qui n'appartiennent a
 * aucune identite.
 */
const props = defineProps<{ prenom: string; avec: string[] }>()
const emit = defineEmits<{ fermer: [] }>()

// Positions fixees une fois : un re-rendu ne doit pas faire sauter l'effet.
const pluie = Array.from({ length: 14 }, (_, i) => ({
  g: 3 + (i * 37) % 93,          // % depuis la gauche : le pas 37 balaie
                                 // toute la largeur au lieu d'empiler un escalier
  retard: (i % 7) * 0.13,        // s
  duree: 1.5 + (i % 5) * 0.28,   // s
  taille: 13 + (i % 4) * 9
}))

let minuteur: any = null
onMounted(() => { minuteur = setTimeout(() => emit('fermer'), 3200) })
onBeforeUnmount(() => clearTimeout(minuteur))

const qui = computed(() => {
  const n = props.avec
  if (!n.length) return ''
  if (n.length === 1) return `${n[0]} aussi.`
  return `${n.slice(0, -1).join(', ')} et ${n[n.length - 1]} aussi.`
})
</script>

<template>
  <div class="fete" @click="emit('fermer')">
    <i v-for="(e, i) in pluie" :key="i" class="goutte"
       :style="{ left: e.g + '%', animationDelay: e.retard + 's', animationDuration: e.duree + 's' }">
      <Etincelles :taille="e.taille" couleur="var(--peche)" une />
    </i>

    <div class="coeur">
      <Etincelles :taille="42" couleur="var(--peche)" />
      <p class="titre">Vous êtes d’accord</p>
      <h2 class="nom">{{ prenom }}</h2>
      <p class="qui">{{ qui }}</p>
      <p class="mini indice">Touchez pour continuer</p>
    </div>
  </div>
</template>

<style scoped>
.fete { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center;
  background: color-mix(in srgb, var(--fond) 93%, transparent);
  backdrop-filter: blur(10px); overflow: hidden; animation: entrer .2s ease; }
@keyframes entrer { from { opacity: 0 } }

.coeur { display: flex; flex-direction: column; align-items: center; gap: 6px;
  text-align: center; padding: 0 24px; animation: surgir .45s cubic-bezier(.2,1.2,.4,1); }
@keyframes surgir { from { transform: scale(.82); opacity: 0 } }
.titre { margin: 8px 0 0; font-size: .78rem; text-transform: uppercase; letter-spacing: .1em;
  font-weight: 800; color: var(--doux); }
.nom { font-size: 2.9rem; letter-spacing: -.04em; }
.qui { margin: 2px 0 0; font-size: 1.05rem; color: var(--doux); }
.indice { margin-top: 18px; color: var(--doux); opacity: .65; }

.goutte { position: absolute; top: -8%; animation-name: tomber;
  animation-timing-function: ease-in; animation-iteration-count: 1; opacity: 0; }
@keyframes tomber {
  0%   { transform: translateY(0) rotate(0deg); opacity: 0 }
  12%  { opacity: .95 }
  100% { transform: translateY(105vh) rotate(160deg); opacity: 0 }
}

/* Une animation qui donne la nausee n'est pas une fete. */
@media (prefers-reduced-motion: reduce) {
  .goutte { display: none; }
  .coeur { animation: none; }
  .fete { animation: none; }
}
</style>
