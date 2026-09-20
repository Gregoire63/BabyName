<script setup lang="ts">
import { frequenceLisible, type Prenom } from '~/composables/useCatalogue'
import { useGroupeCourant } from '~/composables/etatGroupe'

/**
 * Le contenu d'une carte de tri.
 *
 * Extrait pour etre rendu DEUX fois : la carte de devant, et celle qu'on
 * apercoit derriere. La carte du fond n'affichait que le prenom — on voyait
 * arriver un mot nu, sans savoir s'il valait la peine qu'on s'y attarde.
 * Maintenant elle montre exactement la meme chose ; il n'y a plus qu'un seul
 * gabarit a tenir a jour.
 *
 * `interactif: false` pose `inert` : la carte du fond garde ses boutons pour
 * ne pas changer de hauteur, mais ni le doigt ni le clavier ne les atteignent.
 */
const props = withDefaults(defineProps<{ p: Prenom; interactif?: boolean }>(),
  { interactif: true })
const emit = defineEmits<{ fiche: []; favori: []; famille: []; veto: [] }>()
const g = useGroupeCourant()
</script>

<template>
  <div class="contenu" :inert="!props.interactif ? true : undefined">
    <div class="ligne" style="justify-content:space-between">
      <span class="puce">
        {{ p.sexe === 'fm' ? 'mixte' : p.sexe === 'f' ? 'fille' : 'garçon' }}
      </span>
      <button class="etoile" :class="{ on: g.favoris.value.has(p.l) }"
              @click.stop="emit('favori')">
        <Etincelles :taille="20" />
        <span>{{ g.favoris.value.has(p.l) ? 'Dans les favoris' : 'Favoris' }}</span>
      </button>
    </div>

    <h2 class="nom">{{ p.l }}</h2>
    <p v-if="p.m" class="sens">« {{ p.m }} »</p>
    <p v-else-if="p.me" class="sens doux">« {{ p.me }} »</p>

    <div class="ligne" style="flex-wrap:wrap;gap:6px">
      <span v-for="o in p.g" :key="o" class="puce">{{ o }}</span>
    </div>

    <div class="ligne resume">
      <span>{{ frequenceLisible(p.f) }}</span>
      <span :style="{ color: p.t > 8 ? 'var(--non)' : p.t < -5 ? 'var(--oui)' : 'inherit' }">
        {{ p.t > 0 ? '+' : '' }}{{ p.t.toFixed(0) }} %/an
      </span>
      <span>{{ p.y }} syll.</span>
    </div>

    <p v-if="p.r > 30" class="alerte">
      Rare et en forte hausse — il peut être partout dans cinq ans.
    </p>
    <p v-else-if="p.rv" class="alerte">
      Prénom d’avant 1970 qui remonte.
    </p>
    <p v-else-if="p.ob" class="alerte">
      Aussi : {{ p.obn || 'un nom commun' }}.
    </p>

    <div v-if="p.sr" class="graphe">
      <CourbePrenom :serie="p.sr" :hauteur="78" />
      <span class="mini doux">1986 → 2025</span>
    </div>

    <div class="bas">
      <button class="btn btn-0 mini" @click.stop="emit('fiche')">Plus d’informations</button>
      <button class="btn btn-0 mini doux" @click.stop="emit('famille')">Écarter la famille</button>
      <button class="btn btn-0 mini rouge" @click.stop="emit('veto')">Veto</button>
    </div>
  </div>
</template>

<style scoped>
/* La carte est la boite ; ce composant en est le contenu et doit en occuper
   toute la hauteur, sinon le graphe ne peut plus se caler en bas. */
.contenu { display: flex; flex-direction: column; gap: 11px; flex: 1; min-height: 0; }

.nom { font-size: 2.4rem; letter-spacing: -.035em; margin: 2px 0 0; }
.sens { margin: 0; font-size: 1rem; font-style: italic; }
.resume { gap: 16px; font-size: .84rem; font-variant-numeric: tabular-nums;
  color: var(--doux); font-weight: 560; }
.alerte { margin: 0; font-size: .84rem; padding: 9px 11px; border-radius: 11px;
  background: color-mix(in srgb, var(--peche) 45%, transparent); }
.graphe { margin-top: auto; display: flex; flex-direction: column; gap: 2px; }
.graphe span { align-self: flex-end; }

.bas { display: flex; justify-content: space-between; align-items: center;
  gap: 10px; flex-wrap: wrap; padding-top: 2px; }
.bas .btn { padding: 6px 0; }
.bas .rouge { color: var(--non); }

/* police heritee : le bouton est un <button>, il ne la prend pas tout seul */
.etoile { font: inherit; }
.etoile { border: 1px solid var(--trait); background: var(--carte); cursor: pointer;
  padding: 6px 13px 6px 10px; border-radius: var(--pastille); display: flex;
  align-items: center; gap: 6px; font-size: .76rem; font-weight: 700;
  transition: transform .12s, background .15s, border-color .15s; }
.etoile span { line-height: 1; }
.etoile:active { transform: scale(.95); }
.etoile.on { color: var(--encre); border-color: transparent;
  background: color-mix(in srgb, var(--peche) 55%, transparent); }
.etoile:not(.on) { color: var(--doux); }
.etoile:active { transform: scale(.88); }
</style>
