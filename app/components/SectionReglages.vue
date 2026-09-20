<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'

/**
 * Tout ce qui se regle : la liste d'abord, le compte ensuite. C'etait
 * l'onglet « Liste », qui melangeait les deux sans le dire.
 */
const props = defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

const copie = ref(false)
const renomme = ref(false)
const nouveauNom = ref('')

watch(g.etat, e => { if (e && !nouveauNom.value) nouveauNom.value = e.groupe.nom },
  { immediate: true })

const lien = computed(() => g.etat.value
  ? `${location.origin}/?code=${g.etat.value.groupe.code_invitation}` : '')

const nomChange = computed(() =>
  !!nouveauNom.value.trim() && nouveauNom.value !== g.etat.value?.groupe?.nom)

async function renommer() {
  if (!nomChange.value) return
  await $fetch(`/api/groupes/${g.gid}/nom`, { method: 'PUT', body: { nom: nouveauNom.value } })
  renomme.value = true
  setTimeout(() => renomme.value = false, 1600)
  await g.recharger()
}

async function partager() {
  const donnees = { title: 'babyNames', text: 'Aide-moi à choisir un prénom', url: lien.value }
  if (navigator.share) { try { await navigator.share(donnees); return } catch { /* annulé */ } }
  await navigator.clipboard.writeText(lien.value)
  copie.value = true; setTimeout(() => copie.value = false, 1800)
}

const erreur = ref('')
async function retirerVeto(prenom: string) {
  erreur.value = ''
  try { await $fetch(`/api/groupes/${g.gid}/veto?prenom=${encodeURIComponent(prenom)}`,
    { method: 'DELETE' }) }
  catch { erreur.value = 'Seul celui qui a posé ce veto peut le retirer.' }
  await g.recharger()
}

const filtresActifs = computed(() => {
  const f = g.filtres.value
  const out: string[] = []
  if (f.sexe.length < 3) out.push(f.sexe.map(s => s === 'f' ? 'fille' : s === 'm' ? 'garçon' : 'mixte').join(' + '))
  if (f.origines_in.length) out.push('origines : ' + f.origines_in.join(', '))
  if (f.origines_out.length) out.push('sans ' + f.origines_out.join(', '))
  if (f.compose === false) out.push('pas de composés')
  if (f.syllabes[0] > 1 || f.syllabes[1] < 6) out.push(`${f.syllabes[0]}–${f.syllabes[1]} syllabes`)
  if (f.car[0] > 2 || f.car[1] < 14) out.push(`${f.car[0]}–${f.car[1]} lettres`)
  if (f.originalite[0] > 0) out.push(`originalité ≥ ${f.originalite[0]}`)
  if (f.risque_max < 100) out.push(`risque ≤ ${f.risque_max}`)
  if (f.sens_requis) out.push('sens connu')
  if (f.exclure_objet) out.push('sans homonyme objet')
  if (f.revival_seulement) out.push('revivals seulement')
  return out
})
</script>

<template>
  <div class="pile">
    <div v-if="!g.etat.value" class="doux">Chargement…</div>

    <template v-else>
      <TeteListe onglet="Réglages de cette liste" />

      <section class="carte pile">
        <h2>Nom</h2>
        <div class="ligne">
          <input v-model="nouveauNom" class="champ" style="flex:1" @keyup.enter="renommer">
          <button class="btn mini" :disabled="!nomChange" @click="renommer">
            {{ renomme ? 'Fait' : 'Renommer' }}
          </button>
        </div>
      </section>

      <section class="carte degrade invit">
        <p class="mini" style="margin:0;opacity:.72">Code d’invitation</p>
        <strong class="code">{{ g.etat.value.groupe.code_invitation }}</strong>
        <button class="btn" @click="partager">
          {{ copie ? 'Lien copié' : 'Partager le lien' }}
        </button>
      </section>

      <section class="carte pile">
        <h2>Qui en est</h2>
        <div v-for="m in g.etat.value.avancement" :key="m.user_id" class="ligne">
          <span style="flex:1">{{ m.pseudo }}</span>
          <span class="mini doux">{{ m.votes }} jugés</span>
        </div>
      </section>

      <section class="carte pile">
        <div class="ligne">
          <h2 style="flex:1">Filtres</h2>
          <button class="btn btn-0 mini" @click="g.ouvrirFiltres()">Modifier</button>
        </div>
        <div v-if="filtresActifs.length" class="ligne" style="flex-wrap:wrap;gap:6px">
          <span v-for="f in filtresActifs" :key="f" class="puce">{{ f }}</span>
        </div>
        <p v-else class="mini doux" style="margin:0">Aucun filtre : tout le catalogue passe.</p>
      </section>

      <section v-if="g.favoris.value.size" class="carte pile">
        <h2>Mes gardés</h2>
        <p class="mini doux" style="margin:0">
          Ceux que vous gardez sous le coude, même sans unanimité.
        </p>
        <div class="ligne" style="flex-wrap:wrap;gap:6px">
          <button v-for="f in [...g.favoris.value]" :key="f" class="puce"
                  style="border:0;cursor:pointer" @click="g.ouvrirFiche(f)">{{ f }}</button>
        </div>
      </section>

      <section v-if="g.etat.value.vetos.length" class="carte pile">
        <h2>Vetos</h2>
        <p class="mini doux" style="margin:0">
          Définitifs. {{ g.etat.value.groupe.nb_vetos_max }} par personne, pas un de plus.
        </p>
        <p v-if="erreur" class="mini" style="color:var(--non);margin:0">{{ erreur }}</p>
        <div v-for="v in g.etat.value.vetos" :key="v.prenom" class="ligne">
          <span style="flex:1"><strong>{{ v.prenom }}</strong>
            <span class="mini doux"> — {{ v.pseudo }}<template v-if="v.motif">, {{ v.motif }}</template></span>
          </span>
          <button class="btn btn-0 mini" @click="retirerVeto(v.prenom)">Retirer</button>
        </div>
      </section>

      <p class="mini doux" style="text-align:center;margin:6px 0 0">
        Vos prénoms écartés sont dans Classement · Mes choix. Votre nom et votre
        clé d’accès sont sur l’accueil, sous votre nom.
      </p>
    </template>
  </div>
</template>

<style scoped>
.invit { display: flex; flex-direction: column; align-items: center; gap: 10px;
  color: var(--encre); }
.code { font-size: 1.7rem; letter-spacing: .16em; font-weight: 700; }
.invit .btn { background: rgba(255,255,255,.72); border-color: transparent; }
</style>
