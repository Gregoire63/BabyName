<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
const props = defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

const communs = ref<any[]>([])
const ouvert = ref<string | null>(null)
const commentaires = ref<any[]>([])
const brouillon = ref('')
const charge = ref(false)
const erreur = ref('')

async function charger() {
  communs.value = await $fetch<any[]>(`/api/groupes/${g.gid}/communs`).catch(() => [])
  charge.value = true
}
watch([() => props.actif, g.pret], ([a, p]) => { if (a && p && !charge.value) charger() },
  { immediate: true })

async function ouvrir(prenom: string) {
  if (ouvert.value === prenom) { ouvert.value = null; return }
  ouvert.value = prenom
  commentaires.value = await $fetch(
    `/api/groupes/${g.gid}/commentaires?prenom=${encodeURIComponent(prenom)}`)
}

async function commenter() {
  if (!brouillon.value.trim() || !ouvert.value) return
  const p = ouvert.value
  await $fetch(`/api/groupes/${g.gid}/commentaires`,
    { method: 'POST', body: { prenom: p, texte: brouillon.value } })
  brouillon.value = ''
  commentaires.value = await $fetch(
    `/api/groupes/${g.gid}/commentaires?prenom=${encodeURIComponent(p)}`)
}

async function veto(prenom: string) {
  erreur.value = ''
  try {
    await $fetch(`/api/groupes/${g.gid}/veto`, { method: 'POST', body: { prenom } })
    communs.value = communs.value.filter(c => c.prenom !== prenom)
    await g.recharger()
  } catch (e: any) {
    erreur.value = e?.data?.statusMessage === 'quota_veto_atteint'
      ? 'Vos vetos sont épuisés. Un veto, ça se dépense.'
      : 'Impossible de poser ce veto.'
  }
}

/** Qui traîne : un commun ne sort que si tout le monde a voté dessus. */
const enRetard = computed(() => {
  const a = g.etat.value?.avancement ?? []
  if (a.length < 2) return null
  const max = Math.max(...a.map((x: any) => x.votes))
  const lent = a.find((x: any) => x.votes < max * 0.6)
  return lent ? { pseudo: lent.pseudo, manque: max - lent.votes } : null
})
</script>

<template>
  <div class="pile">
    <div class="haut">
      <h1>Communs</h1>
      <span class="puce">{{ communs.length }}</span>
    </div>

    <p v-if="!charge" class="doux">Chargement…</p>

    <template v-else>
      <p v-if="enRetard" class="rappel mini">
        {{ enRetard.manque }} votes manquent à {{ enRetard.pseudo }} — la liste reste incomplète
        tant qu’il n’a pas rattrapé.
      </p>
      <p v-if="erreur" class="rappel mini">{{ erreur }}</p>

      <div v-if="!communs.length" class="vide">
        <h2>Rien en commun pour l’instant</h2>
        <p>Un prénom arrive ici quand <strong>tout le monde</strong> a voté dessus,
           que personne n’a dit non, et qu’au moins un a dit oui.</p>
      </div>

      <article v-for="c in communs" :key="c.prenom" class="carte" style="padding:14px 16px">
        <div class="ligne" style="cursor:pointer" @click="ouvrir(c.prenom)">
          <div style="flex:1;min-width:0">
            <h2>{{ c.prenom }}</h2>
            <p class="mini doux" style="margin:3px 0 0">
              {{ c.nb_oui }} oui<span v-if="c.nb_neutres"> · {{ c.nb_neutres }} neutre</span>
              <template v-if="g.parNom.value.get(c.prenom)?.m">
                · « {{ g.parNom.value.get(c.prenom)!.m }} »</template>
            </p>
          </div>
          <span class="puce">{{ Number(c.score).toFixed(1) }}</span>
        </div>

        <div v-if="ouvert === c.prenom" class="pile" style="margin-top:14px;gap:10px">
          <div v-for="m in commentaires" :key="m.id" class="mini">
            <strong>{{ m.pseudo }}</strong> — {{ m.texte }}
          </div>
          <p v-if="!commentaires.length" class="mini doux" style="margin:0">Aucun commentaire.</p>
          <div class="ligne">
            <input v-model="brouillon" class="champ mini" placeholder="Votre avis…"
                   @keyup.enter="commenter">
            <button class="btn mini" @click="commenter">Dire</button>
          </div>
          <div class="ligne" style="justify-content:space-between">
            <button class="btn btn-0 mini" @click="g.ouvrirFiche(c.prenom)">Tout voir</button>
            <button class="btn btn-0 mini" style="color:var(--non)" @click="veto(c.prenom)">
              Poser mon veto
            </button>
          </div>
        </div>
      </article>
    </template>
  </div>
</template>

<style scoped>
.haut { display: flex; align-items: center; justify-content: space-between; }
.rappel { margin: 0; padding: 10px 13px; border-radius: 12px;
  background: color-mix(in srgb, var(--peche) 42%, transparent); }
</style>
