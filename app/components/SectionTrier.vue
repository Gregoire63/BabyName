<script setup lang="ts">
import { filtrer, ordonner, frequenceLisible, type Prenom } from '~/composables/useCatalogue'
import { useGroupeCourant } from '~/composables/etatGroupe'

defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

const quota = computed(() => g.etat.value?.groupe?.quota_swipe_jour ?? 40)
const bonus = ref(0)
const faits = ref(0)
const match = ref<{ prenom: string; avec: string[] } | null>(null)
const retour = ref<{ prenom: string; votes: any[] } | null>(null)
const familleAEcarter = ref<Prenom[] | null>(null)
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

/** La ligne de contexte sous le nom de la liste : ou j'en suis, ce qui reste. */
const contexte = computed(() => g.pret.value
  ? `${faits.value}/${plafond.value} jugés · ${pioche.value.length.toLocaleString('fr-FR')} possibles`
  : '…')

onMounted(() => { faits.value = Number(localStorage.getItem(cleJour) ?? 0) })

// --- geste ----------------------------------------------------------------
const dx = ref(0), dy = ref(0), glisse = ref(false)
const envol = ref(false)
let x0 = 0, y0 = 0, axe: 'x' | 'y' | null = null
const SEUIL = 88

function debut(e: PointerEvent) {
  if (quotaAtteint.value) return
  // Un geste qui commence sur un bouton appartient au bouton. Sans ce
  // garde-fou, setPointerCapture detourne la suite des evenements vers la
  // carte et le clic n'arrive JAMAIS : « Favoris », « Tout voir » et
  // « Écarter la famille » etaient inertes.
  if ((e.target as HTMLElement)?.closest?.('button')) return
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
  ? {
      transform: `translate(${dx.value}px, ${dy.value}px) rotate(${dx.value / 24}deg)`,
      opacity: envol.value ? 0 : 1,
      transition: glisse.value
        ? 'none'
        : envol.value
          ? 'transform .34s cubic-bezier(.32,0,.4,1), opacity .34s ease-in'
          : 'transform .2s'
    }
  : {})

/** Envoie la carte hors de l'ecran dans la direction du vote. */
function envoler(valeur: 0 | 1 | 2) {
  const L = window.innerWidth || 400
  if (valeur === 2)      { dx.value = L * 1.15;  dy.value = -70 }
  else if (valeur === 0) { dx.value = -L * 1.15; dy.value = -70 }
  else                   { dx.value = 0;         dy.value = -(window.innerHeight || 800) }
  envol.value = true
}

// --- actions --------------------------------------------------------------
async function voter(valeur: 0 | 1 | 2) {
  const p = carte.value
  if (!p || quotaAtteint.value || envol.value) return

  // On laisse la carte partir AVANT de toucher a la pile : si on retire le
  // prenom tout de suite, le noeud est remplace et il n'y a plus rien a
  // animer — c'est ce qui donnait l'impression que la carte « saute ».
  envoler(valeur)
  await new Promise(r => setTimeout(r, 330))

  g.dejaVotes.value = new Set([...g.dejaVotes.value, p.l])
  if (valeur === 2) g.aimes.value = [...g.aimes.value, p]
  faits.value++
  localStorage.setItem(cleJour, String(faits.value))
  dx.value = 0; dy.value = 0; envol.value = false
  const r = await $fetch<any>(`/api/groupes/${g.gid}/vote`,
    { method: 'POST', body: { prenom: p.l, valeur } }).catch(() => null)

  // Le serveur ne renvoie les votes des autres QUE parce qu'on vient de voter
  // (regle du vote aveugle, cf. server/utils/votes.ts).
  const tous = (r?.votes ?? []).filter((v: any) => v.valeur !== undefined && v.pseudo)
  const moiId = g.etat.value?.moi?.user_id
  const autres = tous.filter((v: any) => v.user_id !== moiId)
  if (!autres.length) return

  // Accord total : j'ai dit oui, et tous ceux qui ont vote ont dit oui aussi.
  const nbMembres = g.etat.value?.avancement?.length ?? 2
  const accord = valeur === 2 && autres.every((v: any) => v.valeur === 2)
                 && tous.length >= nbMembres
  if (accord) {
    match.value = { prenom: p.l, avec: autres.map((v: any) => v.pseudo) }
    return
  }
  // Le reste : on dit ce qui s'est dit, sans en faire un evenement.
  retour.value = { prenom: p.l, votes: autres }
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

/** Racine commune d'une famille : 70 % du début du slug, 4 lettres minimum. */
function racineDe(p: Prenom): string {
  return p.slug.slice(0, Math.max(4, Math.floor(p.slug.length * 0.7)))
}

/** Ce que « écarter la famille » va réellement balayer. */
function familleDe(p: Prenom): Prenom[] {
  const racine = racineDe(p)
  return pioche.value.filter(x => x.slug.startsWith(racine)).slice(0, 25)
}

function demanderFamille() {
  const p = carte.value; if (!p) return
  racineBalayage = racineDe(p)
  familleAEcarter.value = familleDe(p)
}
let racineBalayage = ''

// Un non sur vingt-cinq prénoms d'un coup, sans retour possible : ça se
// confirme, et en voyant la liste. Sinon on découvre trop tard ce qu'on a
// balayé.
async function confirmerFamille() {
  const cibles = familleAEcarter.value
  familleAEcarter.value = null
  if (!cibles?.length) return
  const s = new Set(g.dejaVotes.value)
  for (const c of cibles) s.add(c.l)
  g.dejaVotes.value = s
  // La racine part avec chaque vote : c'est elle qui permettra de remettre
  // exactement ce groupe-là, et pas un ensemble recalculé plus tard.
  await Promise.all(cibles.map(c =>
    $fetch(`/api/groupes/${g.gid}/vote`,
      { method: 'POST', body: { prenom: c.l, valeur: 0, balayage: racineBalayage } })
      .catch(() => null)))
}
</script>

<template>
  <div class="ecran">
    <div class="haut">
      <TeteListe class="titre" onglet="Swipe" compact :info="contexte" />
      <button class="btn btn-0 mini" style="padding:6px 10px;flex:none"
              @click="g.ouvrirFiltres()">
        Filtres
      </button>
    </div>

    <p v-if="!g.pret.value" class="doux" style="text-align:center">Chargement…</p>

    <template v-else>
      <div v-if="quotaAtteint" class="vide">
        <Etincelles :taille="34" couleur="var(--peche)" />
        <h2>C’est assez pour aujourd’hui</h2>
        <p>{{ plafond }} prénoms jugés. Trier à la chaîne abîme le jugement :
           les vingt derniers ne valent pas les vingt premiers.</p>
        <button class="btn" @click="bonus += 20">Encore 20 quand même</button>
      </div>

      <div v-else-if="!carte" class="vide">
        <h2>Plus rien à trier</h2>
        <p>Vos filtres ne laissent passer aucun prénom non jugé.</p>
        <button class="btn" @click="g.ouvrirFiltres()">Élargir les filtres</button>
      </div>

      <div v-else class="zone">
        <div class="cartes">
        <article v-if="suivante" class="carte fiche derriere" :class="{ monte: envol }">
          <h2 class="nom">{{ suivante.l }}</h2>
        </article>

        <Transition name="neuve">
        <article :key="carte.l" class="carte fiche" :style="style"
                 @pointerdown="debut" @pointermove="bouge"
                 @pointerup="fin" @pointercancel="fin">
          <div v-if="intention" class="verdict" :class="intention">
            <Etincelles v-if="intention === 'oui'" :taille="16" />
            {{ intention === 'oui' ? 'Oui' : intention === 'non' ? 'Non' : 'Neutre' }}
          </div>

          <div class="ligne" style="justify-content:space-between">
            <span class="puce">
              {{ carte.sexe === 'fm' ? 'mixte' : carte.sexe === 'f' ? 'fille' : 'garçon' }}
            </span>
            <button class="etoile" :class="{ on: g.favoris.value.has(carte.l) }"
                    @click.stop="basculerFavori">
              <Etincelles :taille="20" />
              <span>{{ g.favoris.value.has(carte.l) ? 'Dans les favoris' : 'Favoris' }}</span>
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
            <button class="btn btn-0 mini doux" @click.stop="demanderFamille">
              Écarter la famille
            </button>
          </div>
        </article>
        </Transition>
        </div>

        <div class="boutons">
          <button class="rond non" aria-label="Non" @click="voter(0)">✕</button>
          <button class="rond neutre" aria-label="Neutre" @click="voter(1)">~</button>
          <button class="rond oui" aria-label="Oui" @click="voter(2)">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 21.2s-8.4-5-8.4-11A5 5 0 0 1 12 7.1a5 5 0 0 1 8.4 3.1c0 6-8.4 11-8.4 11Z" />
            </svg>
          </button>
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

    <EffetMatch v-if="match" :prenom="match.prenom" :avec="match.avec"
                @fermer="match = null" />

    <div v-if="familleAEcarter" class="voile-confirme" @click.self="familleAEcarter = null">
      <div class="carte pile confirme">
        <h2>Écarter toute la famille ?</h2>
        <p class="mini doux" style="margin:0">
          {{ familleAEcarter.length }} prénom{{ familleAEcarter.length > 1 ? 's' : '' }}
          {{ familleAEcarter.length > 1 ? 'passeront' : 'passera' }} en « non » d’un coup.
          C’est définitif : ils ne réapparaîtront plus dans votre tri.
        </p>
        <div class="ligne noms">
          <span v-for="f in familleAEcarter" :key="f.l" class="puce">{{ f.l }}</span>
        </div>
        <div class="ligne" style="gap:8px">
          <button class="btn btn-1" style="flex:1" @click="confirmerFamille">
            Écarter {{ familleAEcarter.length }}
          </button>
          <button class="btn btn-0 doux" @click="familleAEcarter = null">Annuler</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ecran { display: flex; flex-direction: column; gap: 12px; height: 100%; min-height: 340px; }
.haut { display: flex; align-items: center; gap: 8px; }
.haut .titre { flex: 1; min-width: 0; }

.zone { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.cartes { position: relative; display: flex; flex: 1; min-height: 0; }
.cartes > .fiche:not(.derriere) { position: relative; z-index: 1; width: 100%; }

/* La carte suivante arrive : elle grandit depuis l'etat de la pile, elle ne
   surgit pas de nulle part. */
.neuve-enter-active { transition: transform .3s cubic-bezier(.2,.9,.3,1), opacity .26s ease-out; }
.neuve-enter-from { transform: scale(.94) translateY(16px); opacity: .25; }
.neuve-leave-active { position: absolute; inset: 0; }
.fiche { touch-action: none; user-select: none; position: relative; flex: 1;
  display: flex; flex-direction: column; gap: 11px; min-height: 300px; }
.graphe { margin-top: auto; display: flex; flex-direction: column; gap: 2px; }
.graphe span { align-self: flex-end; }
.alerte { margin: 0; font-size: .84rem; padding: 9px 11px; border-radius: 11px;
  background: color-mix(in srgb, var(--peche) 45%, transparent); }
.fiche.derriere { position: absolute; inset: 0; z-index: 0;
  transform: scale(.94) translateY(16px); opacity: .4; pointer-events: none;
  transition: transform .34s cubic-bezier(.2,.9,.3,1), opacity .34s; }
.fiche.derriere.monte { transform: scale(1) translateY(0); opacity: 1; }
.nom { font-size: 2.4rem; letter-spacing: -.035em; margin: 2px 0 0; }
.sens { margin: 0; font-size: 1rem; font-style: italic; }
.resume { gap: 16px; font-size: .84rem; font-variant-numeric: tabular-nums;
  color: var(--doux); font-weight: 560; }
.bas { display: flex; justify-content: space-between; align-items: center; padding-top: 2px; }
.bas .btn { padding: 6px 0; }

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

.verdict { position: absolute; top: 14px; left: 50%; translate: -50% 0; padding: 7px 20px;
  border-radius: var(--pastille); font-weight: 800; letter-spacing: .02em; z-index: 2;
  color: #fff; display: flex; align-items: center; gap: 7px; }
.verdict.oui { background: var(--oui); }
.verdict.non { background: var(--non); }
.verdict.neutre { background: var(--neutre); }

.boutons { display: flex; justify-content: center; gap: 20px; margin: 18px 0 4px; flex: none; }
.rond { width: 62px; height: 62px; border-radius: 50%; font-size: 1.4rem; display: grid;
  place-items: center; border: 1px solid var(--trait); background: var(--carte);
  box-shadow: var(--ombre); cursor: pointer; transition: transform .08s; }
.rond:active { transform: scale(.93); }
.rond.non { color: var(--non); } .rond.oui { color: var(--oui); } .rond.neutre { color: var(--neutre); }
.rond svg { width: 30px; height: 30px; }

.retour { position: fixed; left: 16px; right: 16px; bottom: 86px; max-width: 528px;
  margin: 0 auto; display: flex; gap: 12px; align-items: center; padding: 10px 14px;
  z-index: 30; flex-wrap: wrap; }
.fondu-enter-active, .fondu-leave-active { transition: opacity .25s, translate .25s; }
.fondu-enter-from, .fondu-leave-to { opacity: 0; translate: 0 8px; }

.voile-confirme { position: fixed; inset: 0; z-index: 65; background: rgba(26,35,78,.42);
  backdrop-filter: blur(3px); display: flex; align-items: flex-end;
  justify-content: center; padding: 16px; }
.confirme { width: 100%; max-width: 520px; margin-bottom: calc(8px + env(safe-area-inset-bottom));
  animation: monter .22s cubic-bezier(.2,.8,.3,1); }
@keyframes monter { from { transform: translateY(14px); opacity: .5 } }
.noms { flex-wrap: wrap; gap: 6px; max-height: 148px; overflow-y: auto; }
</style>
