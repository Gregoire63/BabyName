<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'

/**
 * Tout ce qui se regle : la liste d'abord, le compte ensuite. C'etait
 * l'onglet « Liste », qui melangeait les deux sans le dire.
 */
const props = defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

// --- prénoms écartés ------------------------------------------------------
const ecartes = ref<{ racine: string; prenoms: string[]; le: string }[]>([])
const seuls = ref<{ prenom: string; le: string }[]>([])
const totalEcartes = ref(0)
const ouvertEcartes = ref(false)
const remise = ref('')

async function chargerEcartes() {
  const r = await $fetch<any>(`/api/groupes/${g.gid}/ecartes`).catch(() => null)
  ecartes.value = r?.familles ?? []
  seuls.value = r?.seuls ?? []
  totalEcartes.value = r?.total ?? 0
}
watch(() => props.actif, a => { if (a) chargerEcartes() }, { immediate: true })

/** Remet des prénoms dans la pile : on supprime simplement mes votes « non ». */
async function remettre(prenoms: string[]) {
  remise.value = prenoms[0] ?? ''
  await $fetch(`/api/groupes/${g.gid}/vote`,
    { method: 'DELETE', body: { prenoms } }).catch(() => null)
  // La pile de tri lit dejaVotes : sans ça, il faudrait recharger la page.
  const s = new Set(g.dejaVotes.value)
  for (const p of prenoms) s.delete(p)
  g.dejaVotes.value = s
  remise.value = ''
  await chargerEcartes()
}

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

      <section v-if="totalEcartes" class="carte pile">
        <div class="ligne" style="cursor:pointer" @click="ouvertEcartes = !ouvertEcartes">
          <h2 style="flex:1">Prénoms écartés</h2>
          <span class="puce">{{ totalEcartes }}</span>
          <span class="doux">{{ ouvertEcartes ? '−' : '+' }}</span>
        </div>
        <p class="mini doux" style="margin:0">
          Les remettre les renvoie dans la pile à trier.
        </p>

        <template v-if="ouvertEcartes">
          <template v-if="ecartes.length">
            <p class="etiquette">Familles écartées d’un geste</p>
            <div v-for="f in ecartes" :key="f.racine" class="famille">
              <div class="ligne" style="flex-wrap:wrap;gap:6px;flex:1">
                <button v-for="p in f.prenoms" :key="p" class="puce"
                        style="border:0;cursor:pointer" @click="g.ouvrirFiche(p)">{{ p }}</button>
              </div>
              <button class="btn btn-0 mini" :disabled="remise === f.prenoms[0]"
                      @click="remettre(f.prenoms)">
                {{ remise === f.prenoms[0] ? '…' : `Remettre les ${f.prenoms.length}` }}
              </button>
            </div>
          </template>

          <template v-if="seuls.length">
            <p class="etiquette">Écartés un par un</p>
            <div class="ligne" style="flex-wrap:wrap;gap:6px">
              <span v-for="u in seuls" :key="u.prenom" class="jeton">
                <button class="etiq" @click="g.ouvrirFiche(u.prenom)">{{ u.prenom }}</button>
                <button class="plus" :aria-label="`Remettre ${u.prenom}`"
                        :disabled="remise === u.prenom" @click="remettre([u.prenom])">↩</button>
              </span>
            </div>
          </template>
        </template>
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
        Votre nom et votre clé d’accès ne dépendent d’aucune liste :
        ils sont sur l’accueil, sous votre nom.
      </p>
    </template>
  </div>
</template>

<style scoped>
.invit { display: flex; flex-direction: column; align-items: center; gap: 10px;
  color: var(--encre); }
.code { font-size: 1.7rem; letter-spacing: .16em; font-weight: 700; }
.famille { display: flex; align-items: flex-start; gap: 10px; padding: 9px 0;
  border-top: 1px solid var(--trait); }
.famille .btn { flex: none; white-space: nowrap; }
.etiquette { margin: 6px 0 0; font-size: .68rem; text-transform: uppercase;
  letter-spacing: .07em; font-weight: 800; color: var(--doux); }
.jeton { display: inline-flex; align-items: center; border: 1px solid var(--trait);
  border-radius: var(--pastille); overflow: hidden; background: var(--fond); }
.jeton .etiq { border: 0; background: none; padding: 6px 4px 6px 12px; cursor: pointer;
  font: inherit; font-size: .8rem; font-weight: 700; color: var(--texte); }
.jeton .plus { border: 0; background: none; cursor: pointer; color: var(--doux);
  font-size: .9rem; line-height: 1; padding: 6px 11px 6px 7px; }
.jeton .plus:disabled { opacity: .4; }
.invit .btn { background: rgba(255,255,255,.72); border-color: transparent; }
</style>
