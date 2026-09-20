<script setup lang="ts">
/**
 * L'attente, quand on ne connait pas encore la forme de ce qui arrive.
 *
 * Le motif du logo plutot qu'un disque qui tourne : c'est la seule fioriture
 * de l'identite, et une attente est exactement l'endroit ou elle sert a
 * quelque chose. La grande etincelle tourne lentement, les deux petites
 * scintillent a contretemps — on voit que ca travaille sans que ca s'agite.
 *
 * Quand la forme de l'ecran est connue, prefere Squelette : la page garde sa
 * mise en page et rien ne saute a l'arrivee des donnees.
 */
withDefaults(defineProps<{ texte?: string; plein?: boolean }>(), { plein: false })
</script>

<template>
  <div class="attente" :class="{ plein }">
    <div class="astre">
      <Etincelles class="grande" :taille="46" couleur="var(--encre)" une />
      <Etincelles class="p1" :taille="16" couleur="var(--menthe)" une />
      <Etincelles class="p2" :taille="12" couleur="var(--peche)" une />
    </div>
    <p v-if="texte" class="mini doux">{{ texte }}</p>
  </div>
</template>

<style scoped>
.attente { display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 34px 16px; }
.attente.plein { height: 100%; }
.attente p { margin: 0; }

.astre { position: relative; width: 74px; height: 74px; }
.grande { position: absolute; left: 14px; top: 14px;
  animation: tourne 5.5s cubic-bezier(.5,0,.5,1) infinite, respire 2.2s ease-in-out infinite; }
.p1 { position: absolute; right: 4px; top: 6px; animation: scintille 1.9s ease-in-out infinite; }
.p2 { position: absolute; left: 2px; bottom: 10px;
  animation: scintille 1.9s ease-in-out .95s infinite; }

/* un quart de tour par cycle : l'etoile a quatre branches retombe sur
   elle-meme, la rotation se lit sans jamais paraitre saccadee */
@keyframes tourne { to { transform: rotate(90deg) } }
@keyframes respire { 0%, 100% { opacity: .78 } 50% { opacity: 1 } }
@keyframes scintille {
  0%, 100% { opacity: .18; transform: scale(.7) }
  45%      { opacity: 1;   transform: scale(1) }
}

@media (prefers-reduced-motion: reduce) {
  .grande, .p1, .p2 { animation: none; opacity: .9; }
}
</style>
