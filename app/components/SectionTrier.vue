<script setup lang="ts">
import { filtrer, ordonner, frequenceLisible, type Prenom } from '~/composables/useCatalogue'
import { useGroupeCourant } from '~/composables/etatGroupe'

defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

const quota = computed(() => g.etat.value?.groupe?.quota_swipe_jour ?? 40)
const bonus = ref(0)
const faits = ref(0)
const panneau = ref(false)
const retour = ref<{ prenom: string; votes: any[] } | null>(null)
const cleJour = `pr_${g.gid}_${new Date().toISOString().slice(0, 10)}`

const pioche = computed(() => {
  if (!g.pret.value) return []
  const dispo = filtrer(g.catalogue.value, g.filtres.value)
    .filter(p => !g.dejaVotes.value.has(p.l) && !g.vetos.value.has(p.l))
  return ordonner(dispo, g.aimes.value)
})
const carte = computed(() => pioche.value[0] ?? null)
const suivante = computed(() => pioche.value[1] ?? null)
const plafond = computed(() => quota.value + bonus.value)
const quotaAtteint = computed(() => faits.value >= plafond.value)

onMounted(() => { faits.value = Number(localStorage.getItem(cleJour) ?? 0) })

// --- geste ----------------------------------------------------------------
const dx = ref(0), dy = ref(0), glisse = ref(false)
let x0 = 0, y0 = 0, axe: 'x' | 'y' | null = null
const SEUIL = 88

function debut(e: PointerEvent) {
  if (quotaAtteint.value) return
  glisse.value = true; axe = null; x0 = e.clientX; y0 = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function bouge(e: PointerEvent) {
  if (!glisse.value) return
  const ax = e.clientX - x0, ay = e.clientY - y0
  if (!axe && Math.hypot(ax, ay) > 8) axe = Math.abs(ax) > Math.abs(ay) ? 'x' : 'y'
  dx.value = axe === 'y' ? 0 : ax
  dy.value = axe === 'x' ? 0 : Math.min(0, ay)
}
function fin() {
  if (!glisse.value) return
  glisse.value = false; axe = null
  if (dy.value < -SEUIL && Math.abs(dx.value) < SEUIL) voter(1)
  else if (dx.value > SEUIL) voter(2)
  else if (dx.value < -SEUIL) voter(0)
  else { dx.value = 0; dy.value = 0 }
}

const intention = computed(() => {
  if (dy.value < -SEUIL / 2 && Math.abs(dx.value) < SEUIL) return 'neutre'
  if (dx.value > SEUIL / 2) return 'oui'
  if (dx.value < -SEUIL / 2) return 'non'
  return null
})
const style = computed(() => glisse.value || dx.value || dy.value
  ? { transform: `translate(${dx.value}px, ${dy.value}px) rotate(${dx.value / 24}deg)`,
      transition: glisse.value ? 'none' : 'transform .2s' }
  : {})

// --- actions --------------------------------------------------------------
async function voter(valeur: 0 | 1 | 2) {
  const p = carte.value
  if (!p || quotaAtteint.value) return
  g.dejaVotes.value = new Set([...g.dejaVotes.value, p.l])
  if (valeur === 2) g.aimes.value = [...g.aimes.value, p]
  faits.value++
  localStorage.setItem(cleJour, String(faits.value))
  dx.value = 0; dy.value = 0
  const r = await $fetch<any>(`/api/groupes/${g.gid}/vote`,
    { method: 'POST', body: { prenom: p.l, valeur } }).catch(() => null)
  const autres = (r?.votes ?? []).filter((v: any) => v.valeur !== undefined && v.pseudo)
  if (autres.length > 1) retour.value = { prenom: p.l, votes: autres }
  setTimeout(() => { if (retour.value?.prenom === p.l) retour.value = null }, 2600)
}

async function basculerFavori() {
  const p = carte.value; if (!p) return
  const actif = !g.favoris.value.has(p.l)
  const s = new Set(g.favoris.value)
  actif ? s.add(p.l) : s.delete(p.l)
  g.favoris.value = s
  await $fetch(`/api/groupes/${g.gid}/favori`, { method: 'POST', body: { prenom: p.l, actif } })
}

async function rejeterFamille() {
  const p = carte.value; if (!p) return
  const racine = p.slug.slice(0, Math.max(4, Math.floor(p.slug.length * 0.7)))
  const cibles = pioche.value.filter(x => x.slug.startsWith(racine)).slice(0, 25)
  const s = new Set(g.dejaVotes.value)
  for (const c of cibles) s.add(c.l)
  g.dejaVotes.value = s
  await Promise.all(cibles.map(c =>
    $fetch(`/api/groupes/${g.gid}/vote`, { method: 'POST', body: { prenom: c.l, valeur: 0 } })
      .catch(() => null)))
}

async function enregistrerFiltres() {
  panneau.value = false
  await $fetch(`/api/groupes/${g.gid}/filtres`,
    { method: 'PUT', body: g.filtres.value }).catch(() => null)
}
</script>

<template>
  <div class="ecran">
    <div class="haut">
      <span class="puce">{{ faits }}/{{ plafond }}</span>
      <span class="mini doux" style="flex:1;text-align:center">
        {{ g.pret.value ? pioche.length.toLocaleString('fr-FR') + ' possibles' : '…' }}
      </span>
      <button class="btn btn-0 mini" style="padding:6px 10px" @click="panneau = true">
        Filtres
      </button>
    </div>

    <p v-if="!g.pret.value" class="doux" style="text-align:center">Chargement…</p>

    <template v-else>
      <FiltresPanneau v-if="panneau" v-model="g.filtres.value" :origines="g.origines.value"
                      :nb="pioche.length" @fermer="enregistrerFiltres" />

      <div v-if="quotaAtteint" class="vide">
        <h2>C’est assez pour aujourd’hui</h2>
        <p>{{ plafond }} prénoms jugés. Trier à la chaîne abîme le jugement :
           les vingt derniers ne valent pas les vingt premiers.</p>
        <button class="btn" @click="bonus += 20">Encore 20 quand même</button>
      </div>

      <div v-else-if="!carte" class="vide">
        <h2>Plus rien à trier</h2>
        <p>Vos filtres ne laissent passer aucun prénom non jugé.</p>
        <button class="btn" @click="panneau = true">Élargir les filtres</button>
      </div>

      <div v-else class="zone">
        <div class="cartes">
        <article v-if="suivante" class="carte fiche derriere">
          <h2 class="nom">{{ suivante.l }}</h2>
        </article>

        <article class="carte fiche" :style="style"
                 @pointerdown="debut" @pointermove="bouge"
                 @pointerup="fin" @pointercancel="fin">
          <div v-if="intention" class="verdict" :class="intention">
            {{ intention === 'oui' ? 'Oui' : intention === 'non' ? 'Non' : 'Neutre' }}
          </div>

          <div class="ligne" style="justify-content:space-between">
            <span class="puce">
              {{ carte.sexe === 'fm' ? 'mixte' : carte.sexe === 'f' ? 'fille' : 'garçon' }}
            </span>
            <button class="etoile" :class="{ on: g.favoris.value.has(carte.l) }"
                    :aria-label="g.favoris.value.has(carte.l) ? 'Retirer des gardés' : 'Garder'"
                    @click.stop="basculerFavori">
              {{ g.favoris.value.has(carte.l) ? '★' : '☆' }}
            </button>
          </div>

          <h2 class="nom">{{ carte.l }}</h2>
          <p v-if="carte.m" class="sens">« {{ carte.m }} »</p>
          <p v-else-if="carte.me" class="sens doux">« {{ carte.me }} »</p>

          <div class="ligne" style="flex-wrap:wrap;gap:6px">
            <span v-for="o in carte.g" :key="o" class="puce">{{ o }}</span>
          </div>

          <div class="ligne resume">
            <span>{{ frequenceLisible(carte.f) }}</span>
            <span :style="{ color: carte.t > 8 ? 'var(--non)' : carte.t < -5 ? 'var(--oui)' : 'inherit' }">
              {{ carte.t > 0 ? '+' : '' }}{{ carte.t.toFixed(0) }} %/an
            </span>
            <span>{{ carte.y }} syll.</span>
          </div>

          <p v-if="carte.r > 30" class="alerte">
            Rare et en forte hausse — il peut être partout dans cinq ans.
          </p>
          <p v-else-if="carte.rv" class="alerte">
            Prénom d’avant 1970 qui remonte.
          </p>
          <p v-else-if="carte.ob" class="alerte">
            Aussi : {{ carte.obn || 'un nom commun' }}.
          </p>

          <div v-if="carte.sr" class="graphe">
            <CourbePrenom :serie="carte.sr" :hauteur="78" />
            <span class="mini doux">1986 → 2025</span>
          </div>

          <div class="bas">
            <button class="btn btn-0 mini" @click.stop="g.ouvrirFiche(carte.l)">
              Tout voir
            </button>
            <button class="btn btn-0 mini doux" @click.stop="rejeterFamille">
              Écarter la famille
            </button>
          </div>
        </article>
        </div>

        <div class="boutons">
          <button class="rond non" aria-label="Non" @click="voter(0)">✕</button>
          <button class="rond neutre" aria-label="Neutre" @click="voter(1)">~</button>
          <button class="rond oui" aria-label="Oui" @click="voter(2)">♥</button>
        </div>
      </div>
    </template>

    <Transition name="fondu">
      <div v-if="retour" class="retour carte">
        <strong>{{ retour.prenom }}</strong>
        <span v-for="v in retour.votes" :key="v.user_id" class="mini doux">
          {{ v.pseudo }} : {{ v.valeur === 2 ? 'oui' : v.valeur === 1 ? 'neutre' : 'non' }}
        </span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ecran { display: flex; flex-direction: column; gap: 12px; height: 100%; min-height: 340px; }
.haut { display: flex; align-items: center; gap: 8px; }

.zone { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.cartes { position: relative; display: flex; flex: 1; min-height: 0; }
.fiche { touch-action: none; user-select: none; position: relative; flex: 1;
  display: flex; flex-direction: column; gap: 11px; min-height: 300px; }
.graphe { margin-top: auto; display: flex; flex-direction: column; gap: 2px; }
.graphe span { align-self: flex-end; }
.alerte { margin: 0; font-size: .84rem; padding: 9px 11px; border-radius: 11px;
  background: color-mix(in srgb, var(--peche) 45%, transparent); }
.fiche.derriere { position: absolute; inset: 0; z-index: -1; transform: scale(.955) translateY(12px);
  opacity: .45; pointer-events: none; z-index: -1; }
.nom { font-size: 2.4rem; letter-spacing: -.035em; margin: 2px 0 0; }
.sens { margin: 0; font-size: 1rem; font-style: italic; }
.resume { gap: 16px; font-size: .84rem; font-variant-numeric: tabular-nums;
  color: var(--doux); font-weight: 560; }
.bas { display: flex; justify-content: space-between; align-items: center; padding-top: 2px; }
.bas .btn { padding: 6px 0; }

.etoile { border: 0; background: none; font-size: 1.35rem; line-height: 1; cursor: pointer;
  color: var(--trait); padding: 2px 4px; transition: color .15s, transform .1s; }
.etoile.on { color: var(--peche); }
.etoile:not(.on) { color: var(--doux); opacity: .8; }
.etoile:active { transform: scale(.88); }

.verdict { position: absolute; top: 14px; left: 50%; translate: -50% 0; padding: 6px 18px;
  border-radius: 999px; font-weight: 700; letter-spacing: .03em; z-index: 2; color: #fff; }
.verdict.oui { background: var(--oui); }
.verdict.non { background: var(--non); }
.verdict.neutre { background: var(--neutre); }

.boutons { display: flex; justify-content: center; gap: 20px; margin: 18px 0 4px; flex: none; }
.rond { width: 62px; height: 62px; border-radius: 50%; font-size: 1.4rem; display: grid;
  place-items: center; border: 1px solid var(--trait); background: var(--carte);
  box-shadow: var(--ombre); cursor: pointer; transition: transform .08s; }
.rond:active { transform: scale(.93); }
.rond.non { color: var(--non); } .rond.oui { color: var(--oui); } .rond.neutre { color: var(--neutre); }

.retour { position: fixed; left: 16px; right: 16px; bottom: 86px; max-width: 528px;
  margin: 0 auto; display: flex; gap: 12px; align-items: center; padding: 10px 14px;
  z-index: 30; flex-wrap: wrap; }
.fondu-enter-active, .fondu-leave-active { transition: opacity .25s, translate .25s; }
.fondu-enter-from, .fondu-leave-to { opacity: 0; translate: 0 8px; }
</style>
