<script setup lang="ts">
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

const RAISONS: Record<string, string> = {
  code_invalide: 'Ce code n’a pas le bon format : douze caractères, comme K7QM-X3PD-9RTA.',
  cadeau_inconnu: 'Code inconnu. Vérifiez-le ; s’il vient d’être acheté, le paiement est peut-être encore en cours.',
  cadeau_utilise: 'Ce code cadeau a déjà servi.',
  cadeau_annule: 'Ce code cadeau a été annulé (l’achat a été remboursé).',
  cadeau_expire: 'Ce code cadeau a expiré.',
  liste_deja_debloquee: 'Cette liste est déjà débloquée : le cadeau n’a pas été utilisé.',
  trop_d_essais: 'Trop d’essais d’un coup : réessayez dans un moment.'
}

/** Les listes que ce cadeau peut débloquer : les miennes, pas encore payées. */
const aDebloquer = computed(() => listes.value.filter(g => !g.paye))
const toutesPayees = computed(() => listes.value.length > 0 && !aDebloquer.value.length)
const jusquau = computed(() => infos.value?.expire_le
  ? new Date(infos.value.expire_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
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
    erreur.value = RAISONS[m] ?? 'Le cadeau n’a pas pu être utilisé. Réessayez dans un instant.'
    envoi.value = ''
  }
}
</script>

<template>
  <Feuille titre="Un cadeau pour vous" @fermer="emit('fermer')">
    <template v-if="!charge">
      <Squelette l="70%" :h="22" :r="8" />
      <Squelette l="90%" :h="14" :retard="0.06" />
    </template>

    <template v-else-if="!infos?.valide">
      <p class="mini" role="alert" style="margin:0">
        {{ RAISONS[infos?.raison ?? ''] ?? 'Ce code cadeau ne peut pas être utilisé.' }}
      </p>
      <p class="mini doux" style="margin:10px 0 0">Code saisi : {{ lisible || code }}</p>
    </template>

    <template v-else>
      <div class="carte-cadeau">
        <Etincelles class="deco" :taille="26" couleur="var(--peche)" />
        <p class="qui">
          <strong>{{ infos.de_la_part ?? 'Quelqu’un' }}</strong> vous offre babyNamed
        </p>
        <p v-if="infos.message" class="mot">« {{ infos.message }} »</p>
      </div>
      <p class="mini doux" style="margin:12px 0 0">
        Une liste débloquée, pour vous deux. Valable jusqu’au {{ jusquau }}.
      </p>

      <h3 class="titre-bloc">Quelle liste débloquer ?</h3>
      <div class="pile" style="gap:8px">
        <button v-for="g in aDebloquer" :key="g.id" type="button" class="choix"
                :disabled="!!envoi" @click="debloquer(g.id)">
          <span class="nom">{{ envoi === g.id ? 'Un instant…' : `Débloquer « ${g.nom} »` }}</span>
          <span class="mini doux">{{ g.mes_votes }} {{ pluriel(g.mes_votes, 'jugé', 'jugés') }} · {{ g.nb_membres }} {{ g.nb_membres > 1 ? 'membres' : 'membre' }}</span>
        </button>
        <button type="button" class="choix" :class="{ principal: !aDebloquer.length }"
                :disabled="!!envoi" @click="emit('nouvelle', code)">
          <span class="nom">Créer une nouvelle liste, déjà débloquée</span>
          <span class="mini doux">Quelques questions, puis vous triez</span>
        </button>
      </div>
      <p v-if="toutesPayees" class="mini doux" style="margin:10px 0 0">
        Vos listes sont déjà débloquées : ce cadeau peut en ouvrir une nouvelle,
        ou attendre : le code reste valable jusqu’au {{ jusquau }}.
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
