<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'

/**
 * « Bloquer ce prénom » — deux raisons, deux gestes.
 *
 * On bloquait pour tout : le prénom de la cousine comme celui d'un ex, avec
 * deux blocages en tout. Or ces deux cas n'ont rien en commun. La cousine, on
 * peut le dire, et on veut que l'autre le sache : c'est « déjà pris », partagé,
 * sans quota. L'ex, non : c'est le blocage secret, compté pour rester
 * l'exception.
 *
 * Aucun des deux n'est coché d'avance. Cocher « déjà pris » par défaut
 * aurait fait publier « mon ex » à qui tape vite ; cocher le secret aurait
 * brûlé un blocage pour une cousine. On choisit, puis la note s'ouvre avec
 * sa visibilité écrite dessus.
 *
 * Les deux emportent les graphies (même son) : sinon Cloé arrivait à la carte
 * d'après Chloé.
 */
const props = defineProps<{ prenom: string }>()
const emit = defineEmits<{ fermer: []; fait: [nature: 'pris' | 'secret'] }>()
const g = useGroupeCourant()

const nature = ref<'pris' | 'secret' | null>(null)
const note = ref('')
const erreur = ref('')
const envoi = ref(false)

const graphies = computed(() => g.graphiesDe(props.prenom))
/** « Cloé, Chloe, Khloé et 3 autres » : de quoi reconnaître le groupe, sans
 *  vider le catalogue à l'écran pour Isaac et ses 32 graphies. */
const graphiesLisibles = computed(() => {
  const v = graphies.value
  if (v.length <= 4) return v.join(', ')
  return `${v.slice(0, 3).join(', ')} et ${v.length - 3} autres`
})
const max = computed(() => g.etat.value?.groupe?.nb_vetos_max ?? BLOCAGES_SECRETS)
const restants = computed(() => Math.max(0, max.value - g.mesVetos.value.length))

const bouton = computed(() => envoi.value ? 'Un instant…'
  : nature.value === 'pris' ? `Ajouter ${props.prenom} aux déjà pris`
  : nature.value === 'secret' ? `Bloquer ${props.prenom} en secret`
  : 'Choisissez une raison')

async function confirmer(fermer: () => void) {
  if (!nature.value || envoi.value) return
  envoi.value = true
  erreur.value = ''
  try {
    const n = note.value.trim() || undefined
    if (nature.value === 'pris') await g.ajouterDejaPris(props.prenom, n)
    else await g.poserVeto(props.prenom, n)
    emit('fait', nature.value)
    fermer()
  } catch (e: any) {
    const code = e?.data?.statusMessage
    erreur.value = code === 'quota_veto_atteint'
      ? `Vos ${max.value} blocages secrets sont utilisés : retirez-en un dans Classement › Mes choix — ou dites-le : « déjà pris » n’a pas de limite.`
      : code === 'deja_veto' || code === 'deja_pris'
        ? `${props.prenom} est déjà retiré du jeu.`
        : code === 'deja_pris_plein'
          ? 'Cette liste a déjà deux cents prénoms « déjà pris ».'
          : code === 'trop_d_essais'
            ? 'Beaucoup de prénoms retirés d’un coup : réessayez dans un moment.'
            : 'Rien n’a pu être enregistré. Réessayez.'
  } finally { envoi.value = false }
}
</script>

<template>
  <!-- « Veto » ne se comprenait pas : on BLOQUE un prénom. Le mot technique
       reste dans le code et l'API (vetos, poserVeto) ; l'écran dit ce qui
       arrive. -->
  <Feuille titre="Bloquer ce prénom" @fermer="emit('fermer')">
    <p style="margin:0 0 2px">
      <strong style="font-size:1.35rem">{{ prenom }}</strong>
    </p>
    <p v-if="graphies.length" class="mini doux" style="margin:0 0 12px">
      Avec {{ graphies.length > 1 ? 'ses graphies' : 'sa graphie' }} :
      {{ graphiesLisibles }}. Même son, même sort.
    </p>
    <p v-else class="mini doux" style="margin:0 0 12px">
      Il ne sera jamais dans vos accords, quoi que votent les autres.
    </p>

    <fieldset class="raisons">
      <legend class="mini doux">Pourquoi ?</legend>
      <label class="raison" :class="{ choisie: nature === 'pris' }">
        <input v-model="nature" type="radio" name="raison" value="pris">
        <span class="texte">
          <strong>Déjà pris</strong>
          <span>La famille, des amis, quelqu’un qu’on connaît trop. Toute la
            liste le voit, avec votre note — sans limite.</span>
        </span>
      </label>
      <label class="raison" :class="{ choisie: nature === 'secret' }">
        <input v-model="nature" type="radio" name="raison" value="secret">
        <span class="texte">
          <strong>En secret</strong>
          <span>Personne ne saura que c’est vous, ni pourquoi. Il vous en reste
            <b>{{ restants }}</b> sur {{ max }}.</span>
        </span>
      </label>
    </fieldset>

    <input v-if="nature === 'pris'" v-model="note" class="champ" maxlength="200"
           aria-label="Qui le porte ? (facultatif, visible de toute la liste)"
           placeholder="Qui le porte ? La cousine, le fils de Paul…">
    <input v-else-if="nature === 'secret'" v-model="note" class="champ" maxlength="200"
           aria-label="Pourquoi le bloquer ? (facultatif, visible de vous seul)"
           placeholder="Pourquoi ? (pour vous seul, facultatif)">
    <p v-if="nature === 'secret' && !restants" class="mini" style="margin:8px 0 0">
      Vos {{ max }} blocages secrets sont utilisés : retirez-en un dans
      Classement › Mes choix — ou choisissez « déjà pris ».
    </p>
    <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:8px 0 0">
      {{ erreur }}
    </p>

    <template #pied="{ fermer }">
      <button class="btn btn-1" :class="{ 'rouge-plein': nature === 'secret' }"
              :disabled="!nature || envoi || (nature === 'secret' && !restants)"
              @click="confirmer(fermer)">
        {{ bouton }}
      </button>
    </template>
  </Feuille>
</template>

<style scoped>
.raisons { border: 0; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.raisons legend { padding: 0; margin-bottom: 6px; }
.raison { display: flex; align-items: flex-start; gap: 10px; padding: 11px 12px;
  border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--fond);
  cursor: pointer; }
.raison input { margin: 3px 0 0; flex: none; width: 18px; height: 18px; accent-color: var(--encre); }
.raison .texte { display: flex; flex-direction: column; gap: 2px; }
.raison strong { font-size: .92rem; }
.raison .texte > span { font-size: .78rem; color: var(--doux); line-height: 1.35; }
/* var(--fond) et pas du blanc : en sombre, le rouge s'eclaircit et le blanc
   dessus tombait sous 3:1. */
.rouge-plein { background: var(--non); border-color: var(--non); color: var(--fond); }
.rouge-plein:disabled { opacity: .5; }
.raison.choisie { border-color: var(--encre); box-shadow: inset 0 0 0 1px var(--encre); }
.raison:has(input:focus-visible) { outline: 2px solid var(--encre); outline-offset: 2px; }
</style>
