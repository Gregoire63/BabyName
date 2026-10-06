<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { useVerdicts } from '~/composables/useVerdicts'
import { tester } from '~/composables/useNomComplet'

/**
 * Le moment ou tout le monde a dit oui sur le meme prenom.
 *
 * C'est le seul evenement de l'application qui merite une celebration : le
 * reste du temps on trie, ici on trouve. L'effet reprend les etincelles du
 * logo, rien d'autre — pas de confettis multicolores qui n'appartiennent a
 * aucune identite.
 *
 * Il n'y en a qu'un, tenu par la liste (VueGroupe, `g.feter`) et non par
 * l'onglet qui a fait l'accord : la réponse du serveur peut arriver après
 * qu'on en est parti, et un dialogue ouvert dans un écran qu'on ne regarde
 * plus fige toute la page.
 */
const props = withDefaults(defineProps<{
  prenom: string
  avec: string[]
  /** Proposer « ce qui vous sépare » — pas quand on est déjà dans À revoir. */
  revoir?: boolean
}>(), { revoir: true })
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

/**
 * Ce que la liste débloquée ajoute à CE moment-là.
 *
 * Un accord est le pic de l'envie : le seul moment où l'app vient de rendre
 * son service. On y propose les deux fonctions qui le prolongent exactement —
 * le prénom avec votre nom de famille, et ce qui vous sépare encore — sans
 * cacher qu'elles sont payantes. Liste débloquée : elles s'ouvrent. Sinon :
 * la feuille « Débloquer », qui les décrit.
 *
 * Pas le blocage : il est gratuit, et il retire des prénoms — le contraire de
 * ce moment.
 */
const g = useGroupeCourant()
const { aRevoir } = useVerdicts()
const paye = computed(() => !!(g.etat.value?.groupe as any)?.paye)
// Un observateur donne son avis ; il ne décide pas, et n'achète pas pour les autres.
const decideur = computed(() => g.etat.value?.moi?.role !== 'observateur')
const nomFamille = computed(() => {
  const n = (g.etat.value?.groupe as any)?.nom_famille
  return paye.value && typeof n === 'string' ? n.trim() : ''
})
const essai = computed(() => nomFamille.value ? tester(props.prenom, nomFamille.value) : null)
const niveau = computed(() => !essai.value ? ''
  : essai.value.accroche ? 'accroche'
  : essai.value.remarques.some(r => r.gravite === 'attention') ? 'attention' : 'bien')
const separent = computed(() => props.revoir ? aRevoir.value.length : 0)

/** Fermer la fête, puis ouvrir la suite : la fête rend le focus en partant,
 *  la suite le reprend. Dans l'autre ordre, la fête le volerait. */
function puis(suite: () => void) {
  emit('fermer')
  nextTick(suite)
}
function essayerNom() {
  if (!paye.value) return puis(() => g.ouvrirDebloquer())
  puis(() => {
    g.allerA('reglages')
    // Le pager glisse jusqu'à « La liste » : on attend qu'il y soit.
    setTimeout(() => {
      const champ = document.getElementById('champ-nom-famille') as HTMLInputElement | null
      champ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      champ?.focus({ preventScroll: true })
    }, 450)
  })
}
function voirPourquoi() {
  puis(() => paye.value ? g.allerA('classement', 'revoir') : g.ouvrirDebloquer())
}

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

      <div v-if="decideur" class="plus">
        <!-- Débloquée, avec le nom : la réponse tout de suite, comme sur les cartes. -->
        <div v-if="essai" class="essai-nom" :class="niveau">
          <p class="complet"><strong>{{ prenom }} {{ nomFamille }}</strong><span>{{ essai.initiales }}</span></p>
          <p class="remarques">{{ essai.remarques.map(r => r.court).join(' · ') }}</p>
        </div>
        <button v-else type="button" class="offre" @click="essayerNom">
          <span>{{ paye ? `Essayer ${prenom} avec votre nom de famille`
                        : `${prenom} avec votre nom de famille : comment ça sonne ?` }}</span>
          <em v-if="!paye" class="tag">liste débloquée</em>
        </button>
        <button v-if="separent" type="button" class="offre" @click="voirPourquoi">
          <span>{{ separent }} prénom{{ separent > 1 ? 's' : '' }} vous
            {{ separent > 1 ? 'séparent' : 'sépare' }} : voir pourquoi</span>
          <em v-if="!paye" class="tag">liste débloquée</em>
        </button>
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

/* La suite payante : sous les deux boutons, plus discrète qu'eux — la fête
   reste la fête. */
.plus { display: flex; flex-direction: column; gap: 8px; margin-top: 18px;
  width: 100%; max-width: 300px; animation: monter .4s ease .55s backwards; }
.offre { display: flex; align-items: center; justify-content: space-between; gap: 10px;
  width: 100%; padding: 10px 12px; text-align: left; cursor: pointer;
  border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--carte);
  color: var(--texte); font: inherit; font-size: .88rem; font-weight: 650; line-height: 1.3; }
.offre:hover { border-color: color-mix(in srgb, var(--texte) 30%, var(--trait)); }
.tag { flex: none; font-style: normal; font-size: .7rem; font-weight: 800; white-space: nowrap;
  padding: 3px 8px; border-radius: 99px; color: var(--texte);
  background: color-mix(in srgb, var(--peche) 55%, transparent); }
.essai-nom { border-radius: var(--r-s); padding: 9px 12px; display: flex; flex-direction: column;
  gap: 2px; text-align: left; border: 1px solid var(--trait); background: var(--carte); }
.essai-nom p { margin: 0; }
.essai-nom .complet { display: flex; justify-content: space-between; gap: 8px; font-size: .95rem; }
.essai-nom .complet strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.essai-nom .complet span { font-size: .74rem; color: var(--doux); font-weight: 700; flex: none; }
.essai-nom .remarques { font-size: .8rem; line-height: 1.35; }
.essai-nom.bien { border-color: color-mix(in srgb, var(--oui) 40%, var(--trait)); }
.essai-nom.bien .remarques { color: var(--oui); }
.essai-nom.attention { background: color-mix(in srgb, var(--peche) 30%, var(--carte)); }
.essai-nom.accroche { border-color: color-mix(in srgb, var(--non) 50%, var(--trait));
  background: color-mix(in srgb, var(--non) 10%, var(--carte)); }
.essai-nom.accroche .remarques { color: var(--non); font-weight: 650; }
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
  .coeur, .fete, .nom, .actions, .plus { animation: none; }
}
</style>
