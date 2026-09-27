<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { portraits, divergence, MIN_OUI } from '~/composables/usePortrait'

/**
 * Ce que vos oui disent de vous.
 *
 * Tout se calcule ici, dans le navigateur, a partir des votes qu'on a deja le
 * droit de voir : pas de nouvel appel, et surtout pas de nouvelle fuite. On
 * ne peut donc rien apprendre ici qu'on ne puisse deja lire ailleurs dans
 * l'application — seulement le lire autrement.
 */
defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

const paye = computed(() => !!(g.etat.value?.groupe as any)?.paye)
const moiId = computed(() => g.etat.value?.moi?.user_id ?? '')

const tous = computed(() => portraits(g.votes.value as any, g.parNom.value))
const moi = computed(() => tous.value.find(p => p.userId === moiId.value) ?? null)
const autres = computed(() => tous.value.filter(p => p.userId !== moiId.value))
const ecart = computed(() => divergence(g.votes.value as any, g.parNom.value))

/** Ce qu'il reste a juger avant que le portrait veuille dire quelque chose. */
const manquants = computed(() => Math.max(0, MIN_OUI - (moi.value?.nOui ?? 0)))
</script>

<template>
  <div class="pile">
    <template v-if="!paye">
      <section class="carte pile">
        <h2>Ce que vos oui disent de vous</h2>
        <p class="mini" style="margin:0">
          Une époque, une longueur, des origines qui reviennent, et
          <strong>là où vous n'êtes pas d'accord</strong>.
        </p>
        <p class="exemple mini">
          « Vos oui ont eu leur heure vers 1948, une génération avant le reste
          de votre liste. »
        </p>
        <button class="btn btn-1" @click="g.ouvrirDebloquer()">
          Voir ce que ça ouvre
        </button>
      </section>
    </template>

    <template v-else-if="!moi || !moi.assez">
      <section class="carte pile">
        <h2>Encore {{ manquants }} oui</h2>
        <p class="mini doux" style="margin:0">
          Un portrait sur {{ moi?.nOui ?? 0 }} prénom{{ (moi?.nOui ?? 0) > 1 ? 's' : '' }}
          gardés ne dirait rien de vrai : il dirait ce que le hasard a laissé
          passer. À partir de {{ MIN_OUI }}, les écarts tiennent.
        </p>
        <button class="btn btn-1" @click="g.allerA('swipe')">Continuer à trier</button>
      </section>
    </template>

    <template v-else>
      <section class="carte pile">
        <h2>Vous</h2>
        <p class="mini doux" style="margin:0">
          Sur {{ moi.nOui }} oui, parmi {{ moi.nJuges }} prénoms jugés.
        </p>
        <p v-for="t in moi.traits" :key="t.axe" class="trait">{{ t.texte }}</p>
        <p v-if="!moi.traits.length" class="mini doux" style="margin:0">
          Vos oui ressemblent à ce qu'on vous a montré : pas de penchant
          marqué. Ce n'est pas un défaut : ça veut dire que vos filtres font
          déjà le travail.
        </p>
      </section>

      <section v-for="a in autres" :key="a.userId" class="carte pile">
        <h2>{{ a.pseudo }}</h2>
        <template v-if="a.assez">
          <p class="mini doux" style="margin:0">
            Sur {{ a.nOui }} oui parmi les prénoms que vous avez jugés tous les deux.
          </p>
          <p v-for="t in a.traits" :key="t.axe" class="trait">
            {{ t.texte.replace(/^Vous /, `${a.pseudo} `).replace(/^Vos /, `Les oui de ${a.pseudo} `) }}
          </p>
          <p v-if="!a.traits.length" class="mini doux" style="margin:0">
            Rien de marqué de son côté.
          </p>
        </template>
        <p v-else class="mini doux" style="margin:0">
          Pas encore assez de prénoms jugés par vous deux pour en dire quelque
          chose d'honnête.
        </p>
      </section>

      <section v-if="ecart" class="carte pile ecart">
        <h2>Là où ça coince</h2>
        <p class="trait" style="margin:0">{{ ecart }}</p>
        <p class="mini doux" style="margin:0">
          Ça ne se règle pas en votant plus : ça se règle en le sachant.
        </p>
      </section>

    </template>
  </div>
</template>

<style scoped>
.trait { margin: 0; font-size: .95rem; line-height: 1.42; padding-left: 12px;
  border-left: 2px solid var(--menthe); }
.ecart .trait { border-left-color: var(--peche); }
.exemple { margin: 0; padding: 10px 12px; border-radius: 12px; font-style: italic;
  background: var(--fond); border: 1px solid var(--trait); color: var(--doux); }
</style>
