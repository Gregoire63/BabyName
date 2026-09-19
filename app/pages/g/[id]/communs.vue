<script setup lang="ts">
import { chargerCatalogue, type Prenom } from '~/composables/useCatalogue'
const gid = useRoute().params.id as string
const communs = ref<any[]>([])
const parNom = ref<Map<string, Prenom>>(new Map())
const ouvert = ref<string | null>(null)
const commentaires = ref<any[]>([])
const brouillon = ref('')
const avancement = ref<any[]>([])
const pret = ref(false)

async function charger() {
  const [c, etat, cat] = await Promise.all([
    $fetch<any[]>(`/api/groupes/${gid}/communs`),
    $fetch<any>(`/api/groupes/${gid}`),
    chargerCatalogue()
  ])
  communs.value = c
  avancement.value = etat.avancement
  parNom.value = new Map(cat!.liste.map(p => [p.l, p]))
  pret.value = true
}

async function ouvrir(prenom: string) {
  if (ouvert.value === prenom) { ouvert.value = null; return }
  ouvert.value = prenom
  commentaires.value = await $fetch(`/api/groupes/${gid}/commentaires?prenom=${encodeURIComponent(prenom)}`)
}

async function commenter() {
  if (!brouillon.value.trim() || !ouvert.value) return
  await $fetch(`/api/groupes/${gid}/commentaires`, {
    method: 'POST', body: { prenom: ouvert.value, texte: brouillon.value }
  })
  brouillon.value = ''
  commentaires.value = await $fetch(`/api/groupes/${gid}/commentaires?prenom=${encodeURIComponent(ouvert.value)}`)
}

async function veto(prenom: string) {
  try {
    await $fetch(`/api/groupes/${gid}/veto`, { method: 'POST', body: { prenom } })
    communs.value = communs.value.filter(c => c.prenom !== prenom)
  } catch (e: any) {
    alert(e?.data?.statusMessage === 'quota_veto_atteint'
      ? 'Vos vetos sont épuisés. Un veto, ça se dépense.'
      : 'Impossible de poser ce veto.')
  }
}

const enRetard = computed(() => {
  if (avancement.value.length < 2) return null
  const max = Math.max(...avancement.value.map(a => a.votes))
  const lent = avancement.value.find(a => a.votes < max * 0.6)
  return lent ? { pseudo: lent.pseudo, manque: max - lent.votes } : null
})

onMounted(charger)
</script>

<template>
  <div>
    <header class="entete"><h1>Communs</h1>
      <span class="mini doux">{{ communs.length }}</span></header>

    <main class="page pile">
      <p v-if="!pret" class="doux">Chargement…</p>

      <template v-else>
        <div v-if="enRetard" class="carte mini doux" style="padding:10px 14px">
          Il manque {{ enRetard.manque }} votes de {{ enRetard.pseudo }} — la liste n’est pas complète.
        </div>

        <div v-if="!communs.length" class="vide">
          <h2>Rien en commun pour l’instant</h2>
          <p>Un prénom arrive ici quand <strong>tout le monde</strong> a voté dessus,
             que personne n’a dit non, et qu’au moins un a dit oui.</p>
        </div>

        <article v-for="c in communs" :key="c.prenom" class="carte">
          <div class="ligne" @click="ouvrir(c.prenom)" style="cursor:pointer">
            <div style="flex:1">
              <h2>{{ c.prenom }}</h2>
              <p class="mini doux" style="margin:3px 0 0">
                {{ c.nb_oui }} oui<span v-if="c.nb_neutres"> · {{ c.nb_neutres }} neutre(s)</span>
                <template v-if="parNom.get(c.prenom)?.m"> · « {{ parNom.get(c.prenom)!.m }} »</template>
              </p>
            </div>
            <span class="etiq">{{ Number(c.score).toFixed(1) }}</span>
          </div>

          <div v-if="ouvert === c.prenom" class="pile" style="margin-top:14px">
            <div v-for="m in commentaires" :key="m.id" class="mini">
              <strong>{{ m.pseudo }}</strong> — {{ m.texte }}
            </div>
            <p v-if="!commentaires.length" class="mini doux" style="margin:0">Aucun commentaire.</p>
            <div class="ligne">
              <input v-model="brouillon" class="champ mini" placeholder="Votre avis…"
                     @keyup.enter="commenter">
              <button class="btn mini" @click="commenter">Dire</button>
            </div>
            <button class="btn btn-fantome mini" style="color:var(--non);align-self:flex-start"
                    @click="veto(c.prenom)">Poser mon veto</button>
          </div>
        </article>
      </template>
    </main>

    <BarreOnglets :gid="gid" />
  </div>
</template>
