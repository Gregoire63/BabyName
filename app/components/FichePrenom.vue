<script setup lang="ts">
import { frequenceLisible, type Prenom } from '~/composables/useCatalogue'
const props = defineProps<{ p: Prenom }>()
defineEmits<{ fermer: [] }>()

const AN0 = 1986, AN1 = 2025

/** Sommet de la fenetre 1986-2025 (a ne pas confondre avec le pic historique). */
const sommet = computed(() => {
  const s = props.p.sr
  if (!s || s.length < 4) return null
  const max = Math.max(...s)
  if (max <= 0) return null
  return { an: AN0 + s.indexOf(max), v: max }
})

const sexeTexte = computed(() =>
  props.p.sexe === 'fm' ? 'mixte' : props.p.sexe === 'f' ? 'fille' : 'garçon')

/** Une phrase, pas un tableau : ce que le chiffre veut dire concretement. */
const lecture = computed(() => {
  const p = props.p
  const base = `${frequenceLisible(p.f)} le reçoit aujourd’hui.`
  if (p.t > 15) return `${base} Il grimpe vite (+${p.t.toFixed(0)} %/an).`
  if (p.t > 5) return `${base} Il monte doucement.`
  if (p.t < -10) return `${base} Il recule nettement (${p.t.toFixed(0)} %/an).`
  if (p.t < -3) return `${base} Il s’efface lentement.`
  return `${base} Sa cote est stable.`
})
</script>

<template>
  <div class="voile" @click.self="$emit('fermer')">
    <div class="feuille">
      <div class="poignee" />
      <div class="dedans">
        <header class="tete">
          <div>
            <h2 class="nom">{{ p.l }}</h2>
            <p class="mini doux" style="margin:4px 0 0">
              {{ sexeTexte }} · {{ p.y }} syllabe{{ p.y > 1 ? 's' : '' }} · {{ p.c }} lettres
            </p>
          </div>
          <button class="btn btn-0 rond" aria-label="Fermer" @click="$emit('fermer')">✕</button>
        </header>

        <p v-if="p.m" class="sens">« {{ p.m }} »</p>
        <p v-else-if="p.me" class="sens doux">« {{ p.me }} » <span class="mini">(source anglaise)</span></p>

        <div v-if="p.g.length" class="ligne" style="flex-wrap:wrap;gap:6px">
          <span v-for="o in p.g" :key="o" class="puce">{{ o }}</span>
        </div>

        <section v-if="sommet" class="bloc">
          <h3>Depuis {{ AN0 }}</h3>
          <CourbePrenom :serie="p.sr" :hauteur="88" pic />
          <div class="ligne mini doux" style="justify-content:space-between">
            <span>{{ AN0 }}</span>
            <span>Sommet {{ sommet.an }} · {{ frequenceLisible(sommet.v) }}</span>
            <span>{{ AN1 }}</span>
          </div>
        </section>

        <p class="lecture">{{ lecture }}</p>

        <dl class="chiffres">
          <div><dt>Fréquence</dt><dd>{{ frequenceLisible(p.f) }}</dd></div>
          <div><dt>Tendance</dt>
            <dd :style="{ color: p.t > 8 ? 'var(--non)' : p.t < -5 ? 'var(--oui)' : 'inherit' }">
              {{ p.t > 0 ? '+' : '' }}{{ p.t.toFixed(0) }} %/an</dd></div>
          <div><dt>Originalité</dt><dd>{{ p.o.toFixed(0) }}/100</dd></div>
          <div><dt>Pic historique</dt><dd>{{ p.p || '—' }}<span v-if="p.p && p.p < 1986" class="mini doux"> (avant 1986)</span></dd></div>
          <div><dt>Naissances 3 ans</dt><dd>{{ p.n.toLocaleString('fr-FR') }}</dd></div>
          <div><dt>Risque d’explosion</dt>
            <dd :style="{ color: p.r > 40 ? 'var(--non)' : 'inherit' }">{{ p.r.toFixed(0) }}/100</dd></div>
        </dl>

        <p v-if="p.u > 0.12 && p.u < 0.88" class="note">
          Porté par les deux sexes ({{ (p.u * 100).toFixed(0) }} % de filles).
        </p>
        <p v-if="p.rv" class="note">
          Prénom d’avant 1970 qui remonte : il sonnera « ancien » à vos parents, neuf à ses camarades.
        </p>
        <p v-if="p.r > 30" class="note alerte">
          Il grimpe et reste rare : il peut être partout dans cinq ans. C’est le profil typique
          du prénom qu’on croit unique et qu’on retrouve en triple dans la classe.
        </p>
        <p v-if="p.ob" class="note alerte">
          Homonyme repéré : {{ p.obn || 'un nom commun ou une marque' }}.
        </p>
        <p v-if="p.dm?.length" class="note">
          Diminutifs probables : {{ p.dm.join(', ') }}.
        </p>
        <p v-if="!p.m && !p.me" class="note doux">
          Aucune étymologie fiable trouvée pour ce prénom.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voile { position: fixed; inset: 0; z-index: 60; background: rgba(26,35,78,.42);
  backdrop-filter: blur(3px); display: flex; align-items: flex-end; justify-content: center;
  animation: fondu .18s ease; }
@keyframes fondu { from { opacity: 0 } }
.feuille { width: 100%; max-width: 560px; max-height: 92%; background: var(--carte);
  border-radius: 22px 22px 0 0; display: flex; flex-direction: column;
  animation: monte .24s cubic-bezier(.2,.8,.3,1); }
@keyframes monte { from { transform: translateY(16px); opacity: .6 } }
.poignee { width: 38px; height: 4px; border-radius: 999px; background: var(--trait);
  margin: 9px auto 2px; flex: none; }
.dedans { overflow-y: auto; overscroll-behavior: contain; padding: 10px 20px 28px;
  display: flex; flex-direction: column; gap: 14px; }
.tete { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.nom { font-size: 2rem; letter-spacing: -.03em; }
.rond { width: 34px; height: 34px; border-radius: 50%; padding: 0; flex: none;
  background: var(--fond); color: var(--doux); }
.sens { margin: 0; font-size: 1.05rem; font-style: italic; }
.bloc { display: flex; flex-direction: column; gap: 6px; }
.bloc h3 { color: var(--doux); text-transform: uppercase; font-size: .7rem; letter-spacing: .06em; }
.lecture { margin: 0; padding: 12px 14px; border-radius: 13px; background: var(--fond);
  border: 1px solid var(--trait); font-size: .92rem; }
.chiffres { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; margin: 0; }
.chiffres dt { font-size: .7rem; color: var(--doux); text-transform: uppercase; letter-spacing: .04em; }
.chiffres dd { margin: 2px 0 0; font-weight: 640; font-variant-numeric: tabular-nums; }
.note { margin: 0; font-size: .86rem; color: var(--doux); }
.note.alerte { color: var(--texte); background: color-mix(in srgb, var(--peche) 40%, transparent);
  padding: 10px 12px; border-radius: 11px; }
</style>
