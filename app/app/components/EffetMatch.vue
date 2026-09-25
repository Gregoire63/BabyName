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
const emit = defineEmits<{ fermer: []; communs: [] }>()

// Positions fixees une fois : un re-rendu ne doit pas faire sauter l'effet.
const pluie = Array.from({ length: 14 }, (_, i) => ({
  g: 3 + (i * 37) % 93,          // % depuis la gauche : le pas 37 balaie
                                 // toute la largeur au lieu d'empiler un escalier
  retard: (i % 7) * 0.13,        // s
  duree: 1.5 + (i % 5) * 0.28,   // s
  taille: 13 + (i % 4) * 9
}))

/**
 * Il ne se ferme pas tout seul.
 *
 * Il partait au bout de 3,2 s, comme une notification. Un accord sur un
 * prenom n'est pas une notification : c'est le seul moment ou l'app a rendu
 * son service. Le faire disparaitre pendant qu'on le lit, c'est le rabaisser
 * au rang d'information. On attend un geste.
 */
const entre = ref(false)
const boite = ref<HTMLElement>()
const idTitre = useId()
const idNom = useId()
useDialogue(boite, () => emit('fermer'))
onMounted(() => {
  // Un match se sent avant de se lire. Deux coups brefs, pas une sonnerie.
  try { navigator.vibrate?.([18, 60, 26]) } catch { /* pas de vibreur */ }
  requestAnimationFrame(() => { entre.value = true })
})

const qui = computed(() => {
  const n = props.avec
  if (!n.length) return ''
  if (n.length === 1) return `${n[0]} aussi.`
  return `${n.slice(0, -1).join(', ')} et ${n[n.length - 1]} aussi.`
})
</script>

<template>
  <div ref="boite" class="fete" :class="{ entre }" role="dialog" aria-modal="true"
       :aria-labelledby="`${idTitre} ${idNom}`" tabindex="-1" @click.self="emit('fermer')">
    <i v-for="(e, i) in pluie" :key="i" class="goutte" aria-hidden="true"
       :style="{ left: e.g + '%', animationDelay: e.retard + 's', animationDuration: e.duree + 's' }">
      <Etincelles :taille="e.taille" couleur="var(--peche)" une />
    </i>

    <div class="coeur">
      <Etincelles :taille="42" couleur="var(--peche)" aria-hidden="true" />
      <p :id="idTitre" class="titre">Vous êtes d’accord</p>
      <h2 :id="idNom" class="nom">{{ prenom }}</h2>
      <p class="qui">{{ qui }}</p>

      <div class="actions">
        <button class="btn btn-1" @click="emit('fermer')">Continuer à trier</button>
        <button class="btn btn-0" @click="emit('communs')">Voir nos accords</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fete:focus { outline: none; }
.fete { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center;
  background: color-mix(in srgb, var(--fond) 93%, transparent);
  backdrop-filter: blur(10px); overflow: hidden; animation: entrer .2s ease; }
@keyframes entrer { from { opacity: 0 } }

.coeur { display: flex; flex-direction: column; align-items: center; gap: 6px;
  text-align: center; padding: 0 24px; animation: surgir .45s cubic-bezier(.2,1.2,.4,1); }
@keyframes surgir { from { transform: scale(.82); opacity: 0 } }
.titre { margin: 8px 0 0; font-size: .78rem; text-transform: uppercase; letter-spacing: .1em;
  font-weight: 800; color: var(--doux); }
/* Le prenom arrive APRES le reste, et il depasse un peu : c'est lui qu'on
   vient de trouver, pas le bandeau au-dessus. */
.nom { font-size: 2.9rem; letter-spacing: -.04em;
  animation: atterrir .52s cubic-bezier(.16,1.3,.3,1) .12s backwards; }
@keyframes atterrir {
  from { transform: scale(.6); opacity: 0; filter: blur(6px) }
  60%  { transform: scale(1.06); opacity: 1; filter: blur(0) }
  to   { transform: scale(1) }
}
.actions { display: flex; flex-direction: column; gap: 8px; margin-top: 22px;
  width: 100%; max-width: 280px;
  animation: monter .4s ease .38s backwards; }
@keyframes monter { from { transform: translateY(10px); opacity: 0 } }
.actions .btn { width: 100%; }
.qui { margin: 2px 0 0; font-size: 1.05rem; color: var(--doux); }
.indice { margin-top: 18px; color: var(--doux); }

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
  .coeur, .fete, .nom, .actions { animation: none; }
}
</style>
