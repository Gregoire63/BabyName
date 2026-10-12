<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { portraits, divergence, MIN_OUI, type Trait } from '~/composables/usePortrait'
import { t } from '~/composables/useLangue'

/**
 * Ce que vos oui disent de vous.
 *
 * Tout se calcule ici, dans le navigateur, a partir des votes qu'on a deja le
 * droit de voir : pas de nouvel appel, et surtout pas de nouvelle fuite. On
 * ne peut donc rien apprendre ici qu'on ne puisse deja lire ailleurs dans
 * l'application — seulement le lire autrement.
 */
const g = useGroupeCourant()

const paye = computed(() => !!(g.etat.value?.groupe as any)?.paye)
// Là où rien ne se vend (useVente) : le volet n'est pas proposé sur une
// liste gratuite (SectionClassement), et ne présenterait rien.
const vente = useVente()
const moiId = computed(() => g.etat.value?.moi?.user_id ?? '')

const tous = computed(() => portraits(g.votes.value as any, g.parNom.value))
const moi = computed(() => tous.value.find(p => p.userId === moiId.value) ?? null)
const autres = computed(() => tous.value.filter(p => p.userId !== moiId.value))
const ecart = computed(() => divergence(g.votes.value as any, g.parNom.value))

/** Le trait de quelqu'un d'autre : la même phrase, à son nom. */
const traitDe = (tr: Trait, pseudo: string) => t(`usePortrait.${tr.cle}`, { ...tr.p, qui: pseudo })

/** Ce qu'il reste a juger avant que le portrait veuille dire quelque chose. */
const manquants = computed(() => Math.max(0, MIN_OUI - (moi.value?.nOui ?? 0)))
</script>

<template>
  <div class="pile">
    <template v-if="!paye">
      <section v-if="vente.ouverte" class="carte pile">
        <h2>{{ $t('PanneauPortrait.titreOffre') }}</h2>
        <p class="mini" style="margin:0">
          {{ $t('PanneauPortrait.offreDebut') }}
          <strong>{{ $t('PanneauPortrait.offreFort') }}</strong>{{ $t('PanneauPortrait.offreFin') }}
        </p>
        <p class="exemple mini">
          {{ $t('PanneauPortrait.exemple') }}
        </p>
        <button class="btn btn-1" @click="g.ouvrirDebloquer()">
          {{ $t('PanneauPortrait.voirOuvre') }}
        </button>
      </section>
    </template>

    <template v-else-if="!moi || !moi.assez">
      <section class="carte pile">
        <h2>{{ $t('PanneauPortrait.encore', { n: manquants }) }}</h2>
        <p class="mini doux" style="margin:0">
          {{ $t('PanneauPortrait.tropTot', { n: moi?.nOui ?? 0, min: MIN_OUI }) }}
        </p>
        <button class="btn btn-1" @click="g.allerA('swipe')">{{ $t('PanneauPortrait.continuer') }}</button>
      </section>
    </template>

    <template v-else>
      <section class="carte pile">
        <h2>{{ $t('PanneauPortrait.vous') }}</h2>
        <p class="mini doux" style="margin:0">
          {{ $t('PanneauPortrait.surMoi', { oui: moi.nOui, juges: moi.nJuges }) }}
        </p>
        <p v-for="tr in moi.traits" :key="tr.axe" class="trait">{{ tr.texte }}</p>
        <p v-if="!moi.traits.length" class="mini doux" style="margin:0">
          {{ $t('PanneauPortrait.rienMoi') }}
        </p>
      </section>

      <section v-for="a in autres" :key="a.userId" class="carte pile">
        <h2>{{ a.pseudo }}</h2>
        <template v-if="a.assez">
          <p class="mini doux" style="margin:0">
            {{ $t('PanneauPortrait.surAutre', { oui: a.nOui }) }}
          </p>
          <p v-for="tr in a.traits" :key="tr.axe" class="trait">
            {{ traitDe(tr, a.pseudo) }}
          </p>
          <p v-if="!a.traits.length" class="mini doux" style="margin:0">
            {{ $t('PanneauPortrait.rienAutre') }}
          </p>
        </template>
        <p v-else class="mini doux" style="margin:0">
          {{ $t('PanneauPortrait.pasAssez') }}
        </p>
      </section>

      <section v-if="ecart" class="carte pile ecart">
        <h2>{{ $t('PanneauPortrait.coince') }}</h2>
        <p class="trait" style="margin:0">{{ ecart }}</p>
        <p class="mini doux" style="margin:0">
          {{ $t('PanneauPortrait.seRegle') }}
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
