<script setup lang="ts">
import { chargerCatalogue, filtrer, ordonner, filtresParDefaut, type Prenom, type Filtres } from '~/composables/useCatalogue'

const route = useRoute()
const gid = route.params.id as string

const catalogue = ref<Prenom[]>([])
const origines = ref<string[]>([])
const filtres = ref<Filtres>(filtresParDefaut())
const dejaVotes = ref<Set<string>>(new Set())
const aimes = ref<Prenom[]>([])
const vetos = ref<Set<string>>(new Set())
const favoris = ref<Set<string>>(new Set())
const quota = ref(40)
const faitsAujourdhui = ref(0)
const pret = ref(false)
const panneau = ref(false)
const retour = ref<{ prenom: string; votes: any[] } | null>(null)

const cleJour = `pr_${gid}_${new Date().toISOString().slice(0, 10)}`

const pioche = computed(() => {
  const dispo = filtrer(catalogue.value, filtres.value)
    .filter(p => !dejaVotes.value.has(p.l) && !vetos.value.has(p.l))
  return ordonner(dispo, aimes.value)
})
const carte = computed(() => pioche.value[0] ?? null)
const suivante = computed(() => pioche.value[1] ?? null)
const quotaAtteint = computed(() => faitsAujourdhui.value >= quota.value)

onMounted(async () => {
  const c = await chargerCatalogue()
  catalogue.value = c!.liste
  origines.value = c!.origines

  const [etat, mesVotes] = await Promise.all([
    $fetch<any>(`/api/groupes/${gid}`),
    $fetch<any>(`/api/groupes/${gid}/votes`)
  ]).catch(() => [null, null] as any)
  if (!etat) return navigateTo('/')

  quota.value = etat.groupe.quota_swipe_jour
  if (etat.groupe.filtres && Object.keys(etat.groupe.filtres).length) {
    filtres.value = { ...filtres.value, ...etat.groupe.filtres }
  }
  vetos.value = new Set(etat.vetos.map((v: any) => v.prenom))
  favoris.value = new Set(etat.mes_favoris)

  const moiId = etat.moi.user_id
  const miens = (mesVotes?.votes ?? []).filter((v: any) => v.user_id === moiId)
  dejaVotes.value = new Set(miens.map((v: any) => v.prenom))
  const parNom = new Map(catalogue.value.map(p => [p.l, p]))
  aimes.value = miens.filter((v: any) => v.valeur === 2).map((v: any) => parNom.get(v.prenom)!).filter(Boolean)

  faitsAujourdhui.value = Number(localStorage.getItem(cleJour) ?? 0)
  pret.value = true
})

// --- geste -------------------------------------------------------------
const dx = ref(0), dy = ref(0), glisse = ref(false)
let x0 = 0, y0 = 0
const SEUIL = 90

function debut(e: PointerEvent) {
  if (quotaAtteint.value) return
  glisse.value = true; x0 = e.clientX; y0 = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function bouge(e: PointerEvent) {
  if (!glisse.value) return
  dx.value = e.clientX - x0; dy.value = Math.min(0, e.clientY - y0)
}
function fin() {
  if (!glisse.value) return
  glisse.value = false
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

// --- actions -----------------------------------------------------------
async function voter(valeur: 0 | 1 | 2) {
  const p = carte.value
  if (!p || quotaAtteint.value) return
  dejaVotes.value = new Set([...dejaVotes.value, p.l])
  if (valeur === 2) aimes.value = [...aimes.value, p]
  faitsAujourdhui.value++
  localStorage.setItem(cleJour, String(faitsAujourdhui.value))
  dx.value = 0; dy.value = 0
  const r = await $fetch<any>(`/api/groupes/${gid}/vote`, {
    method: 'POST', body: { prenom: p.l, valeur }
  }).catch(() => null)
  // Le vote aveugle se lève : on peut montrer l'avis des autres sur ce prénom.
  const autres = (r?.votes ?? []).filter((v: any) => v.valeur !== undefined && v.pseudo)
  if (autres.length > 1) retour.value = { prenom: p.l, votes: autres }
  setTimeout(() => { if (retour.value?.prenom === p.l) retour.value = null }, 2600)
}

async function basculerFavori() {
  const p = carte.value; if (!p) return
  const actif = !favoris.value.has(p.l)
  const s = new Set(favoris.value)
  actif ? s.add(p.l) : s.delete(p.l)
  favoris.value = s
  await $fetch(`/api/groupes/${gid}/favori`, { method: 'POST', body: { prenom: p.l, actif } })
}

async function rejeterFamille() {
  const p = carte.value; if (!p) return
  const racine = p.slug.slice(0, Math.max(4, Math.floor(p.slug.length * 0.7)))
  const cibles = pioche.value.filter(x => x.slug.startsWith(racine)).slice(0, 25)
  const s = new Set(dejaVotes.value)
  for (const c of cibles) s.add(c.l)
  dejaVotes.value = s
  await Promise.all(cibles.map(c =>
    $fetch(`/api/groupes/${gid}/vote`, { method: 'POST', body: { prenom: c.l, valeur: 0 } }).catch(() => null)))
}

const style = computed(() => glisse.value || dx.value || dy.value
  ? { transform: `translate(${dx.value}px, ${dy.value}px) rotate(${dx.value / 22}deg)`,
      transition: glisse.value ? 'none' : 'transform .2s' }
  : {})
</script>

<template>
  <div>
    <header class="entete">
      <h1>Trier</h1>
      <span class="mini doux">{{ faitsAujourdhui }}/{{ quota }}</span>
      <button class="btn btn-fantome mini" @click="panneau = !panneau">Filtres</button>
    </header>

    <main class="page">
      <p v-if="!pret" class="doux">Chargement du catalogue…</p>

      <template v-else>
        <FiltresPanneau v-if="panneau" v-model="filtres" :origines="origines"
                        :nb="pioche.length" @fermer="panneau = false" />

        <div v-if="quotaAtteint" class="vide">
          <h2>C’est assez pour aujourd’hui</h2>
          <p>{{ quota }} prénoms jugés. Revenez demain — trier à la chaîne fatigue le jugement.</p>
          <button class="btn btn-fantome" @click="quota += 20">Encore 20</button>
        </div>

        <div v-else-if="!carte" class="vide">
          <h2>Plus rien à trier</h2>
          <p>Vos filtres ne laissent passer aucun prénom non jugé. Élargissez-les.</p>
          <button class="btn" @click="panneau = true">Ouvrir les filtres</button>
        </div>

        <div v-else class="zone">
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
              <span class="etiq">{{ carte.sexe === 'fm' ? 'mixte' : carte.sexe === 'f' ? 'fille' : 'garçon' }}</span>
              <button class="btn btn-fantome mini" style="padding:4px 10px" @click="basculerFavori">
                {{ favoris.has(carte.l) ? '★ gardé' : '☆ garder' }}
              </button>
            </div>

            <h2 class="nom">{{ carte.l }}</h2>
            <p v-if="carte.m" class="sens">« {{ carte.m }} »</p>
            <p v-else-if="carte.me" class="sens doux">« {{ carte.me }} » <span class="mini">(en anglais)</span></p>

            <div class="ligne" style="flex-wrap:wrap;gap:6px">
              <span v-for="o in carte.g" :key="o" class="etiq">{{ o }}</span>
              <span v-if="!carte.g.length" class="mini doux">origine inconnue</span>
            </div>

            <dl class="chiffres">
              <div><dt>Fréquence</dt><dd>{{ carte.f.toFixed(1) }} ‰</dd></div>
              <div><dt>Tendance</dt>
                <dd :style="{ color: carte.t > 8 ? 'var(--non)' : carte.t < -5 ? 'var(--oui)' : 'inherit' }">
                  {{ carte.t > 0 ? '+' : '' }}{{ carte.t.toFixed(0) }} %/an
                </dd></div>
              <div><dt>Originalité</dt><dd>{{ carte.o.toFixed(0) }}/100</dd></div>
              <div><dt>Syllabes</dt><dd>{{ carte.y }}</dd></div>
            </dl>

            <p v-if="carte.r > 25" class="alerte">
              Risque d’explosion {{ carte.r.toFixed(0) }}/100 — il pourrait être partout dans cinq ans.
            </p>
            <p v-if="carte.ob" class="alerte doux">Aussi : {{ carte.obn || 'un nom commun' }}.</p>
            <p v-if="carte.rv" class="alerte doux">Prénom d’avant 1970 qui remonte.</p>

            <button class="btn btn-fantome mini famille" @click.stop="rejeterFamille">
              Écarter toute la famille
            </button>
          </article>

          <div class="boutons">
            <button class="btn rond non" @click="voter(0)">✕</button>
            <button class="btn rond neutre" @click="voter(1)">~</button>
            <button class="btn rond oui" @click="voter(2)">♥</button>
          </div>

          <Transition name="fondu">
            <div v-if="retour" class="retour carte">
              <strong>{{ retour.prenom }}</strong>
              <span v-for="v in retour.votes" :key="v.user_id" class="mini">
                {{ v.pseudo }} : {{ v.valeur === 2 ? 'oui' : v.valeur === 1 ? 'neutre' : 'non' }}
              </span>
            </div>
          </Transition>

          <p class="mini doux" style="text-align:center;margin-top:14px">
            {{ pioche.length }} prénoms passent vos filtres
          </p>
        </div>
      </template>
    </main>

    <BarreOnglets :gid="gid" />
  </div>
</template>

<style scoped>
.zone { position: relative; padding-top: 8px; }
.fiche { touch-action: none; user-select: none; cursor: grab; position: relative;
  display: flex; flex-direction: column; gap: 12px; min-height: 380px; }
.fiche.derriere { position: absolute; inset: 8px 0 auto; transform: scale(.96) translateY(10px);
  opacity: .5; pointer-events: none; z-index: -1; }
.nom { font-size: 2.3rem; letter-spacing: -.03em; margin: 2px 0 0; }
.sens { margin: 0; font-size: 1.02rem; color: var(--doux); font-style: italic; }
.chiffres { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin: 4px 0 0; }
.chiffres dt { font-size: .72rem; color: var(--doux); text-transform: uppercase; letter-spacing: .04em; }
.chiffres dd { margin: 1px 0 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.alerte { margin: 0; font-size: .84rem; padding: 8px 10px; border-radius: 9px;
  background: var(--accent-doux); color: var(--accent); }
.alerte.doux { background: transparent; color: var(--doux); padding: 0; }
.famille { align-self: flex-start; margin-top: auto; }

.verdict { position: absolute; top: 14px; left: 50%; translate: -50% 0; padding: 6px 18px;
  border-radius: 999px; font-weight: 700; font-size: 1rem; letter-spacing: .04em; z-index: 2; }
.verdict.oui { background: var(--oui); color: #fff; }
.verdict.non { background: var(--non); color: #fff; }
.verdict.neutre { background: var(--neutre); color: #fff; }

.boutons { display: flex; justify-content: center; gap: 18px; margin-top: 18px; }
.rond { width: 60px; height: 60px; border-radius: 50%; font-size: 1.35rem; display: grid;
  place-items: center; padding: 0; }
.rond.non { color: var(--non); } .rond.oui { color: var(--oui); } .rond.neutre { color: var(--neutre); }

.retour { position: fixed; left: 16px; right: 16px; bottom: 80px; max-width: 528px;
  margin: 0 auto; display: flex; gap: 12px; align-items: center; padding: 10px 14px; z-index: 30; }
.fondu-enter-active, .fondu-leave-active { transition: opacity .25s, translate .25s; }
.fondu-enter-from, .fondu-leave-to { opacity: 0; translate: 0 8px; }
</style>
