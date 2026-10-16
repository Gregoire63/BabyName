<script setup lang="ts">
import { t, locale, aTexte } from '~/composables/useLangue'

/**
 * « On vous offre babyNamed » — se servir d'un code cadeau.
 *
 * Le code débloque UNE liste : celle qu'on a déjà commencée, ou une nouvelle.
 * On montre d'abord de qui il vient et le mot qui l'accompagne (c'est un
 * cadeau, pas un bon de réduction), puis les listes qu'il peut débloquer —
 * seulement celles qui ne le sont pas encore : un cadeau dépensé sur une
 * liste déjà payée serait perdu.
 *
 * Une nouvelle liste passe par les mêmes questions qu'à l'ordinaire
 * (AssistantFiltres, sur l'accueil) : `nouvelle` rend la main à l'accueil,
 * qui créera la liste avec ce code.
 */
const props = defineProps<{ code: string }>()
const emit = defineEmits<{ fermer: []; nouvelle: [code: string] }>()

const lisible = computed(() => cadeauLisible(props.code))
const infos = ref<{ valide: boolean; raison: string | null; de_la_part: string | null;
                    message: string | null; expire_le?: string } | null>(null)
const listes = ref<any[]>([])
const charge = ref(false)
const envoi = ref('')
const erreur = ref('')

/** Le message d'un code d'erreur du serveur (textes : FeuilleCadeau.raison_<code>), ou undefined. */
const raison = (code: string | null | undefined) =>
  code && aTexte(`FeuilleCadeau.raison_${code}`) ? t(`FeuilleCadeau.raison_${code}`) : undefined

/** Les listes que ce cadeau peut débloquer : les miennes, pas encore payées. */
const aDebloquer = computed(() => listes.value.filter(g => !g.paye))
const toutesPayees = computed(() => listes.value.length > 0 && !aDebloquer.value.length)
const jusquau = computed(() => infos.value?.expire_le
  ? new Date(infos.value.expire_le).toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
  : '')

onMounted(async () => {
  const [v, l] = await Promise.all([
    $fetch<any>(`/api/cadeaux/verifier?code=${encodeURIComponent(props.code)}`).catch((e: any) =>
      ({ valide: false, raison: e?.data?.statusMessage ?? 'indisponible' })),
    $fetch<any[]>('/api/groupes').catch(() => [])
  ])
  infos.value = v
  listes.value = l
  charge.value = true
})

async function debloquer(gid: string) {
  if (envoi.value) return
  envoi.value = gid
  erreur.value = ''
  try {
    await $fetch('/api/cadeaux/utiliser', { method: 'POST', body: { code: props.code, groupe: Number(gid) } })
    oublierCadeauEnAttente()
    await navigateTo({ path: `/g/${gid}/swipe`, query: { offerte: '1' } })
  } catch (e: any) {
    const m = e?.data?.statusMessage
    erreur.value = raison(m) ?? t('FeuilleCadeau.erreurDefaut')
    envoi.value = ''
  }
}
</script>

<template>
  <Feuille :titre="$t('FeuilleCadeau.titre')" @fermer="emit('fermer')">
    <template v-if="!charge">
      <Squelette l="70%" :h="22" :r="8" />
      <Squelette l="90%" :h="14" :retard="0.06" />
    </template>

    <template v-else-if="!infos?.valide">
      <p class="mini" role="alert" style="margin:0">
        {{ raison(infos?.raison) ?? $t('FeuilleCadeau.invalide') }}
      </p>
      <p class="mini doux" style="margin:10px 0 0">{{ $t('FeuilleCadeau.codeSaisi', { code: lisible || code }) }}</p>
    </template>

    <template v-else>
      <div class="carte-cadeau">
        <Coeurs class="deco" :taille="26" couleur="var(--peche)" />
        <p class="qui">
          <strong>{{ infos.de_la_part ?? $t('FeuilleCadeau.quelquun') }}</strong> {{ $t('FeuilleCadeau.offre') }}
        </p>
        <p v-if="infos.message" class="mot">{{ $t('FeuilleCadeau.mot', { message: infos.message }) }}</p>
      </div>
      <p class="mini doux" style="margin:12px 0 0">
        {{ $t('FeuilleCadeau.valable', { date: jusquau }) }}
      </p>

      <h3 class="titre-bloc">{{ $t('FeuilleCadeau.quelleListe') }}</h3>
      <div class="pile" style="gap:8px">
        <button v-for="g in aDebloquer" :key="g.id" type="button" class="choix"
                :disabled="!!envoi" @click="debloquer(g.id)">
          <span class="nom">{{ envoi === g.id ? $t('FeuilleCadeau.unInstant') : $t('FeuilleCadeau.debloquerNom', { nom: g.nom }) }}</span>
          <span class="mini doux">{{ $t('FeuilleCadeau.votes', { n: g.mes_votes }) }} · {{ $t('FeuilleCadeau.membres', { n: g.nb_membres }) }}</span>
        </button>
        <button type="button" class="choix" :class="{ principal: !aDebloquer.length }"
                :disabled="!!envoi" @click="emit('nouvelle', code)">
          <span class="nom">{{ $t('FeuilleCadeau.nouvelle') }}</span>
          <span class="mini doux">{{ $t('FeuilleCadeau.nouvelleAide') }}</span>
        </button>
      </div>
      <p v-if="toutesPayees" class="mini doux" style="margin:10px 0 0">
        {{ $t('FeuilleCadeau.toutesPayees', { date: jusquau }) }}
      </p>
      <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:10px 0 0">{{ erreur }}</p>
    </template>
  </Feuille>
</template>

<style scoped>
.carte-cadeau { position: relative; padding: 16px 16px 14px; border-radius: var(--r-s);
  background: linear-gradient(160deg, color-mix(in srgb, var(--menthe) 40%, var(--carte)) 0%,
    color-mix(in srgb, var(--peche) 30%, var(--carte)) 100%); }
.carte-cadeau .deco { position: absolute; top: 10px; right: 12px; }
.qui { margin: 0; font-size: 1.08rem; padding-right: 36px; }
.mot { margin: 8px 0 0; font-style: italic; line-height: 1.45; }
.titre-bloc { margin: 18px 0 8px; font-size: .72rem; text-transform: uppercase;
  letter-spacing: .05em; color: var(--doux); font-weight: 700; }
.choix { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%;
  padding: 12px 14px; border: 1px solid var(--trait); border-radius: var(--r-s);
  background: var(--fond); font: inherit; color: var(--texte); text-align: left; cursor: pointer; }
.choix .nom { font-weight: 700; }
.choix.principal { border-color: var(--encre); box-shadow: inset 0 0 0 1px var(--encre); }
.choix:disabled { opacity: .6; cursor: default; }
</style>
