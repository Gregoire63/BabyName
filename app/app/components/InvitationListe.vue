<script setup lang="ts">
import { t } from '~/composables/useLangue'

/**
 * UNE invitation, deux facons — le contenu, sans son cadre.
 *
 * « Inviter quelqu'un » et « Les observateurs » etaient deux blocs ; c'est
 * pourtant le meme geste — envoyer un lien — avec un seul choix a faire :
 * la personne decide-t-elle avec vous, ou regarde-t-elle en lecture seule
 * (elle donne son avis, qui ne compte pas dans les accords, sans veto) ?
 *
 * Deux cadres l'affichent : la carte « Inviter quelqu'un » des reglages
 * (SectionReglages) et la feuille de partage rapide de l'accueil
 * (FeuillePartage). Le meme composant, pour que les deux ne divergent pas :
 * l'avertissement d'un membre de plus doit etre dit AVANT le partage,
 * d'ou qu'on partage.
 *
 * Le code des observateurs se genere a la demande, et une seule fois : les
 * liens deja envoyes doivent continuer de marcher.
 */
const props = defineProps<{
  gid: string | number
  /** Le code de la liste : il fait entrer un decideur. */
  code: string
  codeObs: string | null
  paye: boolean
  /** Decideurs deja dans la liste (observateurs exclus). */
  nbDecideurs: number
  nbCommuns: number
}>()
const emit = defineEmits<{
  /** La lecture seule demande une liste debloquee : au cadre de l'ouvrir. */
  debloquer: []
  /** Le code des observateurs vient d'etre cree. */
  'code-obs': [code: string]
}>()

const vente = useVente()
// Là où rien ne se vend (useVente), la lecture seule — réservée aux listes
// débloquées — ne se propose pas.
const montrerPayant = computed(() => props.paye || vente.ouverte)

const typeInvit = ref<'membre' | 'lecture'>('membre')
const copie = ref(false)
const copieObs = ref(false)
const demandeObs = ref(false)
// Le code cree ici se montre tout de suite, sans attendre que le cadre recharge.
const codeObsCree = ref<string | null>(null)
const codeObs = computed(() => codeObsCree.value ?? props.codeObs)

// /rejoindre/<code> : l'adresse que l'app des stores ouvre elle-même quand
// elle est installée (pages/rejoindre/[code].vue) ; sinon, le navigateur.
const lien = (code: string) => `${location.origin}/rejoindre/${code}`

async function partager() {
  // La feuille de partage du téléphone — dans l'app des stores, c'est le
  // natif qui l'ouvre (partagerLien, useCoquille) ; à défaut, le lien copié.
  const r = await partagerLien({ titre: 'babyNamed', texte: t('SectionReglages.partageTexte'), url: lien(props.code) })
  if (!r.copie) return
  copie.value = true; setTimeout(() => copie.value = false, 1800)
}

async function creerCodeObs() {
  if (demandeObs.value) return
  demandeObs.value = true
  try {
    const r = await $fetch<{ code: string }>(`/api/groupes/${props.gid}/observateurs`, { method: 'POST' })
    codeObsCree.value = r.code
    emit('code-obs', r.code)
  } catch (err: any) {
    if (err?.statusMessage === 'liste_non_debloquee' || err?.data?.statusMessage === 'liste_non_debloquee') emit('debloquer')
  } finally { demandeObs.value = false }
}

async function partagerObs() {
  if (!codeObs.value) return
  const url = lien(codeObs.value)
  const r = await partagerLien({ texte: t('SectionReglages.partageObs', { url }), url })
  if (!r.copie) return
  copieObs.value = true
  setTimeout(() => { copieObs.value = false }, 1600)
}
</script>

<template>
  <div v-if="montrerPayant" class="deux-facons" role="group" :aria-label="$t('SectionReglages.typeInvit')">
    <button type="button" class="facon" :aria-pressed="typeInvit === 'membre'"
            @click="typeInvit = 'membre'">
      <strong>{{ $t('SectionReglages.membreTitre') }}</strong>
      <span>{{ $t('SectionReglages.membreAide') }}</span>
    </button>
    <button type="button" class="facon" :aria-pressed="typeInvit === 'lecture'"
            @click="typeInvit = 'lecture'">
      <strong>{{ $t('SectionReglages.lectureTitre') }}</strong>
      <span>{{ $t('SectionReglages.lectureAide') }}</span>
    </button>
  </div>

  <!-- Pour choisir avec vous : le code de la liste. -->
  <template v-if="typeInvit === 'membre'">
    <div class="lien-invit degrade">
      <strong class="code">{{ codeLisible(code) }}</strong>
      <button class="btn" @click="partager">
        {{ copie ? $t('SectionReglages.lienCopie') : $t('SectionReglages.partagerLien') }}
      </button>
    </div>
    <!-- Dit avant le partage, pas découvert après. -->
    <div v-if="nbDecideurs >= 2" class="avert pile">
      <p class="mini" style="margin:0">
        <strong>{{ $t('SectionReglages.troisieme') }}</strong>{{ $t('SectionReglages.troisiemeSuite', { n: nbCommuns }) }}
      </p>
      <button v-if="montrerPayant" type="button" class="btn btn-0 mini" style="align-self:flex-start;padding-left:0"
              @click="typeInvit = 'lecture'">
        {{ $t('SectionReglages.simpleAvis') }}
      </button>
    </div>
  </template>

  <!-- En lecture seule : le code des observateurs (liste débloquée). -->
  <template v-else>
    <template v-if="paye">
      <div v-if="codeObs" class="lien-invit degrade">
        <strong class="code">{{ codeLisible(codeObs) }}</strong>
        <button class="btn" @click="partagerObs">
          {{ copieObs ? $t('SectionReglages.lienCopie') : $t('SectionReglages.partagerLien') }}
        </button>
      </div>
      <button v-else class="btn" :disabled="demandeObs" @click="creerCodeObs">
        {{ demandeObs ? $t('SectionReglages.unInstant') : $t('SectionReglages.creerLienLecture') }}
      </button>
    </template>
    <template v-else>
      <p class="mini doux" style="margin:0">{{ $t('SectionReglages.compris') }}</p>
      <button class="btn btn-1" @click="emit('debloquer')">
        {{ $t('SectionReglages.voirCeQueCaOuvre') }}
      </button>
    </template>
  </template>
</template>

<style scoped>
.deux-facons { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.facon { display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 11px 12px;
  border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--fond);
  font: inherit; color: var(--texte); cursor: pointer; }
.facon strong { font-size: .88rem; }
.facon span { font-size: .72rem; color: var(--doux); line-height: 1.3; }
.facon[aria-pressed="true"] { border-color: var(--encre); box-shadow: inset 0 0 0 1px var(--encre); }
.lien-invit { display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 16px; border-radius: var(--r-s); color: var(--encre); }
.code { font-size: clamp(1.25rem, 6.4vw, 1.7rem); letter-spacing: .12em; font-weight: 700;
  white-space: nowrap; }
/* Le fond suit le thème : un blanc translucide fixe portait, en sombre, un
   texte clair — illisible (vu le 25/10 sur la feuille de partage). */
.lien-invit .btn { background: color-mix(in srgb, var(--carte) 82%, transparent);
  color: var(--texte); border-color: transparent; }
.avert { gap: 6px; padding: 11px 13px; border-radius: var(--r-s);
  border: 1px solid color-mix(in srgb, var(--peche) 55%, var(--trait)); }
</style>
